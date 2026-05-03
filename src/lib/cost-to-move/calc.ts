import type {
	AssetSelection,
	CostToMoveState,
	ExpenseSelection,
	Frequency,
	Home,
	InvestmentConfig,
	Item,
	OverridableField
} from '$lib/db/types';
import { defaultAssetSelection } from './defaults';

const FREQUENCY_PERIODS_PER_YEAR: Record<Frequency, number> = {
	daily: 365.25,
	weekly: 52,
	monthly: 12,
	yearly: 1
};

const DOLLAR_OVERRIDE_FIELDS: Set<OverridableField> = new Set(['housePrice', 'monthlyInsurance']);

export function isFutureActive(state: CostToMoveState, now: Date = new Date()): boolean {
	return state.futureMode.enabled && calcDurationMonths(state, now) > 0;
}

export function calcDurationMonths(state: CostToMoveState, now: Date = new Date()): number {
	if (!state.futureMode.enabled || !state.futureMode.moveDate) return 0;
	const move = new Date(state.futureMode.moveDate);
	if (Number.isNaN(move.getTime()) || move <= now) return 0;
	return (move.getFullYear() - now.getFullYear()) * 12 + (move.getMonth() - now.getMonth());
}

export function getEffectiveValue(state: CostToMoveState, field: OverridableField): number {
	if (state.futureMode.enabled) {
		const o = state.futureOverrides[field];
		if (o && o.isOverridden && o.futureValue !== null) return o.futureValue;
	}
	return state[field] as number;
}

export function calcFutureHomePrice(state: CostToMoveState, now: Date = new Date()): number {
	const months = calcDurationMonths(state, now);
	const base = getEffectiveValue(state, 'housePrice');
	if (months === 0) return base;
	const years = months / 12;
	const rate = state.futureMode.homePriceInflationRate / 100;
	return base * Math.pow(1 + rate, years);
}

export function calcFutureAssetValue(
	currentAmount: number,
	sel: AssetSelection,
	state: CostToMoveState,
	now: Date = new Date()
): number {
	if (!sel.isInvestment) return currentAmount;
	const months = calcDurationMonths(state, now);
	if (months === 0) return currentAmount;
	return projectInvestment(currentAmount, sel.investmentConfig, months);
}

export function projectInvestment(current: number, cfg: InvestmentConfig, months: number): number {
	const monthlyRate = cfg.annualReturnRate / 100 / 12;
	const periodsPerYear = FREQUENCY_PERIODS_PER_YEAR[cfg.contributionFrequency];
	const monthlyContribution = cfg.contributionAmount * (periodsPerYear / 12);
	if (monthlyRate === 0) {
		return Math.max(0, current + monthlyContribution * months);
	}
	const compounded = current * Math.pow(1 + monthlyRate, months);
	const contributions =
		monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
	return Math.max(0, compounded + contributions);
}

export function calcFutureExpenseValue<
	S extends {
		hasGrowth: boolean;
		growthConfig: { annualGrowthRate: number; growthFrequency: Frequency };
	}
>(currentAmount: number, sel: S, state: CostToMoveState, now: Date = new Date()): number {
	if (!sel.hasGrowth) return currentAmount;
	const months = calcDurationMonths(state, now);
	if (months === 0) return currentAmount;
	const { annualGrowthRate, growthFrequency } = sel.growthConfig;
	const periodsPerYear = FREQUENCY_PERIODS_PER_YEAR[growthFrequency];
	const periodRate = annualGrowthRate / 100 / periodsPerYear;
	const periods = months * (periodsPerYear / 12);
	return currentAmount * Math.pow(1 + periodRate, periods);
}

// ── Resolution helpers ────────────────────────────────────

export function resolveAmount(
	itemId: string,
	sel: { amountOverride?: number },
	latestAmounts: Record<string, number>
): number {
	return sel.amountOverride ?? latestAmounts[itemId] ?? 0;
}

interface ResolvedAsset {
	itemId: string;
	amount: number;
	selection: AssetSelection;
}

interface ResolvedExpense {
	itemId: string;
	amount: number;
	selection: ExpenseSelection;
}

/**
 * Items that are auto-managed by a home are excluded from the asset/expense
 * lists — those flow through home selections instead.
 */
function isJournalScoped(item: Item): boolean {
	return !item.archivedAt && !item.homeId;
}

/**
 * Assets are default-enabled — a missing selection record is treated as ON,
 * matching `AssetSelectionList`'s `?? defaultAssetSelection()` rendering. The
 * user has to explicitly toggle off (creating a record with `enabled: false`)
 * to exclude an asset.
 */
export function resolveActiveAssets(
	state: CostToMoveState,
	items: Item[],
	latestAmounts: Record<string, number>
): ResolvedAsset[] {
	return items
		.filter((i) => i.kind === 'asset' && isJournalScoped(i))
		.map((item) => {
			const sel = state.assetSelections[item.id] ?? defaultAssetSelection();
			return { item, sel };
		})
		.filter(({ sel }) => sel.enabled)
		.map(({ item, sel }) => ({
			itemId: item.id,
			amount: resolveAmount(item.id, sel, latestAmounts),
			selection: sel
		}));
}

export function resolveActiveJournalExpenses(
	state: CostToMoveState,
	items: Item[],
	latestAmounts: Record<string, number>
): ResolvedExpense[] {
	return items
		.filter((i) => i.kind === 'liability' && isJournalScoped(i))
		.map((i) => ({ item: i, sel: state.expenseSelections[i.id] }))
		.filter((p): p is { item: Item; sel: ExpenseSelection } => Boolean(p.sel?.enabled))
		.map(({ item, sel }) => ({
			itemId: item.id,
			amount: resolveAmount(item.id, sel, latestAmounts),
			selection: sel
		}));
}

// ── Per-home calcs ────────────────────────────────────────

export interface HomeProjection {
	value: number;
	mortgage: number;
	sellingCost: number;
	netProceeds: number;
}

export interface MortgageStatus {
	monthsElapsed: number;
	monthsRemaining: number;
	totalMonths: number;
	percentComplete: number;
	payoffDate: string;
	monthlyPayment: number;
	originalPrincipal: number;
}

/**
 * Parses YYYY-MM-DD as UTC midnight so subsequent month math (using UTC
 * getters) is timezone-independent.
 */
function parseStartDate(iso: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!m) return null;
	const [, y, mo, d] = m;
	const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
	return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Months between an ISO start date and `now`, floored at 0. Computed in UTC
 * so it doesn't drift across timezone boundaries.
 */
export function calcMonthsSinceStart(startDate: string, now: Date = new Date()): number {
	const start = parseStartDate(startDate);
	if (!start || start > now) return 0;
	return (
		(now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth())
	);
}

/**
 * Derives the monthly P&I payment for a home's mortgage. When `mortgageStartDate`
 * is set, uses it to back out the original principal from the current balance,
 * yielding the *actual* fixed payment. Otherwise falls back to treating the
 * current balance as the principal of a fresh `mortgageYears` loan.
 */
export function calcMortgagePaymentForHome(
	home: Home,
	currentBalance: number,
	now: Date = new Date()
): number {
	if (currentBalance <= 0 || home.mortgageRate <= 0 || home.mortgageYears <= 0) return 0;
	const r = home.mortgageRate / 100 / 12;
	const n = home.mortgageYears * 12;

	if (home.mortgageStartDate) {
		const k = calcMonthsSinceStart(home.mortgageStartDate, now);
		if (k > 0 && k < n) {
			// B(k) = P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
			// → P = B(k) * [(1+r)^n - 1] / [(1+r)^n - (1+r)^k]
			const denom = Math.pow(1 + r, n) - Math.pow(1 + r, k);
			if (denom > 0) {
				const principal = (currentBalance * (Math.pow(1 + r, n) - 1)) / denom;
				return calcMortgagePayment(principal, home.mortgageRate, home.mortgageYears);
			}
		}
	}

	return calcMortgagePayment(currentBalance, home.mortgageRate, home.mortgageYears);
}

/**
 * Where this mortgage stands today: months elapsed/remaining, derived original
 * principal, and projected payoff date. Returns null when start date is missing.
 */
export function calcMortgageStatus(
	home: Home,
	currentBalance: number,
	now: Date = new Date()
): MortgageStatus | null {
	if (!home.mortgageStartDate || home.mortgageYears <= 0) return null;
	const start = parseStartDate(home.mortgageStartDate);
	if (!start) return null;

	const totalMonths = home.mortgageYears * 12;
	const rawElapsed = calcMonthsSinceStart(home.mortgageStartDate, now);
	const monthsElapsed = Math.max(0, Math.min(totalMonths, rawElapsed));
	const monthsRemaining = totalMonths - monthsElapsed;
	const percentComplete = totalMonths > 0 ? (monthsElapsed / totalMonths) * 100 : 0;

	const payoff = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + totalMonths, 1));
	const payoffDate = `${payoff.getUTCFullYear()}-${String(payoff.getUTCMonth() + 1).padStart(2, '0')}-${String(payoff.getUTCDate()).padStart(2, '0')}`;

	const monthlyPayment = calcMortgagePaymentForHome(home, currentBalance, now);

	let originalPrincipal = currentBalance;
	if (home.mortgageRate > 0 && monthsElapsed > 0 && monthsElapsed < totalMonths) {
		const r = home.mortgageRate / 100 / 12;
		const denom = Math.pow(1 + r, totalMonths) - Math.pow(1 + r, monthsElapsed);
		if (denom > 0) {
			originalPrincipal = (currentBalance * (Math.pow(1 + r, totalMonths) - 1)) / denom;
		}
	}

	return {
		monthsElapsed,
		monthsRemaining,
		totalMonths,
		percentComplete,
		payoffDate,
		monthlyPayment,
		originalPrincipal
	};
}

export function projectHome(
	home: Home,
	state: CostToMoveState,
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): HomeProjection {
	const baseValue = latestAmounts[home.valueItemId] ?? 0;
	const baseMortgage = latestAmounts[home.mortgageItemId] ?? 0;

	let value = baseValue;
	let mortgage = baseMortgage;

	if (isFutureActive(state, now)) {
		const months = calcDurationMonths(state, now);
		const years = months / 12;
		const growthRate = state.futureMode.currentHomeGrowthRate / 100;
		value = baseValue * Math.pow(1 + growthRate, years);

		if (mortgage > 0 && home.mortgageRate > 0 && home.mortgageYears > 0) {
			const r = home.mortgageRate / 100 / 12;
			const n = home.mortgageYears * 12;
			const monthsRemaining = home.mortgageStartDate
				? Math.max(0, n - calcMonthsSinceStart(home.mortgageStartDate, now))
				: n;
			const k = Math.min(months, monthsRemaining);
			const pmt = calcMortgagePaymentForHome(home, mortgage, now);
			mortgage = Math.max(0, mortgage * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r));
		}
	}

	const sellingCost = value * (home.sellingCostPercent / 100);
	return {
		value,
		mortgage,
		sellingCost,
		netProceeds: value - mortgage - sellingCost
	};
}

export function isHomeSelected(state: CostToMoveState, home: Home): boolean {
	if (home.archivedAt) return false;
	return state.homeSelections[home.id]?.enabled ?? false;
}

// ── Aggregate calcs ───────────────────────────────────────

/**
 * Total net proceeds from selling all homes flagged as enabled, minus the
 * shared `currentHomeExpenses` bucket (renovations / repairs).
 */
export function calcNetProceeds(
	state: CostToMoveState,
	homes: Home[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	const future = isFutureActive(state, now);
	const homeProceeds = homes
		.filter((h) => isHomeSelected(state, h))
		.reduce((sum, h) => sum + projectHome(h, state, latestAmounts, now).netProceeds, 0);
	const homeExpenses = future
		? state.currentHomeExpenses.reduce(
				(sum, e) => sum + calcFutureExpenseValue(e.amount, e, state, now),
				0
			)
		: state.currentHomeExpenses.reduce((sum, e) => sum + e.amount, 0);
	return homeProceeds - homeExpenses;
}

export function calcTotalAssets(
	state: CostToMoveState,
	items: Item[],
	homes: Home[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	const future = isFutureActive(state, now);
	const assets = resolveActiveAssets(state, items, latestAmounts);
	const assetsSum = future
		? assets.reduce((sum, a) => sum + calcFutureAssetValue(a.amount, a.selection, state, now), 0)
		: assets.reduce((sum, a) => sum + a.amount, 0);
	return assetsSum + Math.max(0, calcNetProceeds(state, homes, latestAmounts, now));
}

export function calcTotalExpenses(
	state: CostToMoveState,
	items: Item[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	const future = isFutureActive(state, now);
	const journal = resolveActiveJournalExpenses(state, items, latestAmounts);
	const journalSum = future
		? journal.reduce((sum, e) => sum + calcFutureExpenseValue(e.amount, e.selection, state, now), 0)
		: journal.reduce((sum, e) => sum + e.amount, 0);
	const adHocSum = future
		? state.adHocExpenses.reduce(
				(sum, e) => sum + calcFutureExpenseValue(e.amount, e, state, now),
				0
			)
		: state.adHocExpenses.reduce((sum, e) => sum + e.amount, 0);
	return journalSum + adHocSum;
}

export function calcAvailableCash(
	state: CostToMoveState,
	items: Item[],
	homes: Home[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	return (
		calcTotalAssets(state, items, homes, latestAmounts, now) -
		calcTotalExpenses(state, items, latestAmounts, now)
	);
}

export function calcLoanAmount(
	state: CostToMoveState,
	items: Item[],
	homes: Home[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	const cash = calcAvailableCash(state, items, homes, latestAmounts, now);
	const housePrice = isFutureActive(state, now)
		? calcFutureHomePrice(state, now)
		: state.housePrice;
	return Math.max(0, housePrice - cash);
}

export function calcMortgagePayment(principal: number, annualRate: number, years: number): number {
	if (principal <= 0) return 0;
	const r = annualRate / 100 / 12;
	const n = years * 12;
	if (n <= 0) return 0;
	if (r === 0) return principal / n;
	return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcMonthlyTaxes(state: CostToMoveState, now: Date = new Date()): number {
	const housePrice = isFutureActive(state, now)
		? calcFutureHomePrice(state, now)
		: state.housePrice;
	if (!housePrice || housePrice <= 0) return 0;
	const taxRate = isFutureActive(state, now)
		? getEffectiveValue(state, 'propertyTaxRate')
		: state.propertyTaxRate;
	return (housePrice * (taxRate / 100)) / 12;
}

export function calcTotalMonthlyPayment(
	state: CostToMoveState,
	items: Item[],
	homes: Home[],
	latestAmounts: Record<string, number>,
	now: Date = new Date()
): number {
	const future = isFutureActive(state, now);
	const loan = calcLoanAmount(state, items, homes, latestAmounts, now);
	const rate = future ? getEffectiveValue(state, 'interestRate') : state.interestRate;
	const years = future ? getEffectiveValue(state, 'loanYears') : state.loanYears;
	const insurance = future ? getEffectiveValue(state, 'monthlyInsurance') : state.monthlyInsurance;
	return calcMortgagePayment(loan, rate, years) + calcMonthlyTaxes(state, now) + insurance;
}

export interface CurrentModeValues {
	availableCash: number;
	loanAmount: number;
	totalMonthly: number;
}

export function calcCurrentModeValues(
	state: CostToMoveState,
	items: Item[],
	homes: Home[],
	latestAmounts: Record<string, number>
): CurrentModeValues {
	const currentState: CostToMoveState = {
		...state,
		futureMode: { ...state.futureMode, enabled: false }
	};
	return {
		availableCash: calcAvailableCash(currentState, items, homes, latestAmounts),
		loanAmount: calcLoanAmount(currentState, items, homes, latestAmounts),
		totalMonthly: calcTotalMonthlyPayment(currentState, items, homes, latestAmounts)
	};
}

export { DOLLAR_OVERRIDE_FIELDS, FREQUENCY_PERIODS_PER_YEAR };
