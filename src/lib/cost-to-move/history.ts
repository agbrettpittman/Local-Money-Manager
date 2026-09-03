import type { CostToMoveState, Home, Item, JournalEntry } from '$lib/db/types';
import { amountsAsOf } from '$lib/calc/latestAmounts';
import { calcAvailableCash, calcLoanAmount, calcTotalMonthlyPayment, isFutureActive } from './calc';

export interface HistoryPoint {
	date: string;
	/** Values from that entry's balances, with Future Mode off. */
	availableCash: number;
	loanAmount: number;
	totalMonthly: number;
	/**
	 * The same three figures projected to the move date *from that entry's date* —
	 * what you would have projected at the time. Null when Future Mode is off or
	 * the entry is dated on/after the move date.
	 */
	projected: {
		availableCash: number;
		loanAmount: number;
		totalMonthly: number;
	} | null;
}

export type HistoryMetric = 'totalMonthly' | 'loanAmount' | 'availableCash';

/**
 * Parses YYYY-MM-DD as local noon so the date lands on the intended day
 * regardless of timezone, and month arithmetic against it stays stable.
 */
function parseEntryDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d, 12);
}

/**
 * Replays the cost-to-move calcs against every journal entry in turn, using the
 * balances as they stood on that date. Config (house price, rates, selections)
 * is held at its current value throughout — the series shows how *your money*
 * moved, not how your assumptions changed.
 */
export function costToMoveSeries(
	entries: JournalEntry[],
	state: CostToMoveState,
	items: Item[],
	homes: Home[]
): HistoryPoint[] {
	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
	const currentState: CostToMoveState = {
		...state,
		futureMode: { ...state.futureMode, enabled: false }
	};

	return sorted.map((entry) => {
		const amounts = amountsAsOf(sorted, entry.date);
		const at = parseEntryDate(entry.date);

		const point: HistoryPoint = {
			date: entry.date,
			availableCash: calcAvailableCash(currentState, items, homes, amounts, at),
			loanAmount: calcLoanAmount(currentState, items, homes, amounts, at),
			totalMonthly: calcTotalMonthlyPayment(currentState, items, homes, amounts, at),
			projected: null
		};

		if (isFutureActive(state, at)) {
			point.projected = {
				availableCash: calcAvailableCash(state, items, homes, amounts, at),
				loanAmount: calcLoanAmount(state, items, homes, amounts, at),
				totalMonthly: calcTotalMonthlyPayment(state, items, homes, amounts, at)
			};
		}

		return point;
	});
}

export interface SavingsSummary {
	/** Whole calendar months between the first and last point, for labelling. */
	months: number;
	spanDays: number;
	cashChange: number;
	/** Change per 30.44-day month, so spans shorter than a month still report a rate. */
	cashPerMonth: number;
	monthlyPaymentChange: number;
	loanChange: number;
	/** Months to fully cover the house price at the observed savings rate, or null when not on track. */
	monthsToFullyFunded: number | null;
}

const DAYS_PER_MONTH = 30.44;
const MS_PER_DAY = 86_400_000;

/**
 * Trend between the first and last points of a series. Returns null below two
 * points — there's no rate of change to report from a single snapshot.
 */
export function summarizeSavings(
	points: HistoryPoint[],
	state: CostToMoveState
): SavingsSummary | null {
	if (points.length < 2) return null;
	const first = points[0];
	const last = points[points.length - 1];

	const start = parseEntryDate(first.date);
	const end = parseEntryDate(last.date);
	const months =
		(end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
	const spanDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);

	const cashChange = last.availableCash - first.availableCash;
	const cashPerMonth = spanDays > 0 ? cashChange / (spanDays / DAYS_PER_MONTH) : 0;

	let monthsToFullyFunded: number | null = null;
	const shortfall = state.housePrice - last.availableCash;
	if (shortfall > 0 && cashPerMonth > 0) {
		monthsToFullyFunded = Math.ceil(shortfall / cashPerMonth);
	}

	return {
		months,
		spanDays,
		cashChange,
		cashPerMonth,
		monthlyPaymentChange: last.totalMonthly - first.totalMonthly,
		loanChange: last.loanAmount - first.loanAmount,
		monthsToFullyFunded
	};
}
