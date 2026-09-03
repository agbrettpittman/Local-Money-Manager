import { describe, expect, it } from 'vitest';
import { costToMoveSeries, summarizeSavings } from './history';
import { defaultCostToMoveState } from './defaults';
import type { CostToMoveState, Item, JournalEntry } from '$lib/db/types';

const item = (id: string, name: string, kind: 'asset' | 'liability'): Item => ({
	id,
	name,
	kind,
	createdAt: '2026-01-01T00:00:00Z'
});

const entry = (date: string, lines: { itemId: string; amount: number }[]): JournalEntry => ({
	id: `e-${date}`,
	date,
	lines,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z'
});

const items = [item('a1', 'Savings', 'asset')];

const entries = [
	entry('2026-01-15', [{ itemId: 'a1', amount: 10_000 }]),
	entry('2026-02-15', [{ itemId: 'a1', amount: 20_000 }]),
	entry('2026-03-15', [{ itemId: 'a1', amount: 30_000 }])
];

const stateWithPrice = (): CostToMoveState => ({
	...defaultCostToMoveState(),
	housePrice: 100_000
});

describe('costToMoveSeries', () => {
	it('returns one point per entry, in date order', () => {
		const points = costToMoveSeries(entries, stateWithPrice(), items, []);
		expect(points.map((p) => p.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
	});

	it('sorts unordered input', () => {
		const points = costToMoveSeries(
			[entries[2], entries[0], entries[1]],
			stateWithPrice(),
			items,
			[]
		);
		expect(points.map((p) => p.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
	});

	it('uses each entry’s balances, not the latest', () => {
		const points = costToMoveSeries(entries, stateWithPrice(), items, []);
		expect(points.map((p) => p.availableCash)).toEqual([10_000, 20_000, 30_000]);
		expect(points.map((p) => p.loanAmount)).toEqual([90_000, 80_000, 70_000]);
	});

	it('monthly payment falls as cash grows', () => {
		const points = costToMoveSeries(entries, stateWithPrice(), items, []);
		expect(points[0].totalMonthly).toBeGreaterThan(points[2].totalMonthly);
	});

	it('leaves projected null when Future Mode is off', () => {
		const points = costToMoveSeries(entries, stateWithPrice(), items, []);
		expect(points.every((p) => p.projected === null)).toBe(true);
	});

	it('projects from each entry’s own date when Future Mode is on', () => {
		const s: CostToMoveState = {
			...stateWithPrice(),
			futureMode: {
				enabled: true,
				moveDate: '2027-01-01',
				homePriceInflationRate: 3,
				currentHomeGrowthRate: 3
			},
			assetSelections: {
				a1: {
					enabled: true,
					isInvestment: true,
					investmentConfig: {
						annualReturnRate: 0,
						contributionAmount: 500,
						contributionFrequency: 'monthly'
					}
				}
			}
		};
		const points = costToMoveSeries(entries, s, items, []);
		expect(points.every((p) => p.projected !== null)).toBe(true);
		// The earliest entry has the longest runway, so it accrues the most contributions.
		const gains = points.map((p) => p.projected!.availableCash - p.availableCash);
		expect(gains[0]).toBeGreaterThan(gains[1]);
		expect(gains[1]).toBeGreaterThan(gains[2]);
	});

	it('leaves projected null once the move date is no longer months away', () => {
		const s: CostToMoveState = {
			...stateWithPrice(),
			futureMode: {
				enabled: true,
				moveDate: '2026-02-20',
				homePriceInflationRate: 3,
				currentHomeGrowthRate: 3
			}
		};
		const points = costToMoveSeries(entries, s, items, []);
		expect(points[0].projected).not.toBeNull();
		expect(points[1].projected).toBeNull();
		expect(points[2].projected).toBeNull();
	});

	it('returns empty for no entries', () => {
		expect(costToMoveSeries([], stateWithPrice(), items, [])).toEqual([]);
	});
});

describe('summarizeSavings', () => {
	it('returns null below two points', () => {
		const points = costToMoveSeries([entries[0]], stateWithPrice(), items, []);
		expect(summarizeSavings(points, stateWithPrice())).toBeNull();
	});

	it('reports change and monthly rate across the span', () => {
		const s = stateWithPrice();
		const summary = summarizeSavings(costToMoveSeries(entries, s, items, []), s)!;
		expect(summary.months).toBe(2);
		expect(summary.spanDays).toBe(59);
		expect(summary.cashChange).toBe(20_000);
		expect(summary.cashPerMonth).toBeCloseTo(20_000 / (59 / 30.44), 5);
		expect(summary.loanChange).toBe(-20_000);
		expect(summary.monthlyPaymentChange).toBeLessThan(0);
	});

	it('still reports a rate for spans under a calendar month', () => {
		const week = [
			entry('2026-05-02', [{ itemId: 'a1', amount: 10_000 }]),
			entry('2026-05-09', [{ itemId: 'a1', amount: 11_400 }])
		];
		const s = stateWithPrice();
		const summary = summarizeSavings(costToMoveSeries(week, s, items, []), s)!;
		expect(summary.months).toBe(0);
		expect(summary.spanDays).toBe(7);
		expect(summary.cashPerMonth).toBeCloseTo(1400 / (7 / 30.44), 5);
	});

	it('reports a zero rate when two entries share a date', () => {
		const sameDay = [
			entry('2026-05-02', [{ itemId: 'a1', amount: 10_000 }]),
			{ ...entry('2026-05-02', [{ itemId: 'a1', amount: 12_000 }]), id: 'e-dup' }
		];
		const s = stateWithPrice();
		const summary = summarizeSavings(costToMoveSeries(sameDay, s, items, []), s)!;
		expect(summary.spanDays).toBe(0);
		expect(summary.cashPerMonth).toBe(0);
		expect(summary.monthsToFullyFunded).toBeNull();
	});

	it('estimates months to fully fund the purchase at the observed rate', () => {
		const s = stateWithPrice();
		// $70k short, saving $10k/mo → 7 months.
		expect(summarizeSavings(costToMoveSeries(entries, s, items, []), s)!.monthsToFullyFunded).toBe(
			7
		);
	});

	it('reports no funding estimate when cash is already sufficient', () => {
		const s: CostToMoveState = { ...defaultCostToMoveState(), housePrice: 25_000 };
		expect(
			summarizeSavings(costToMoveSeries(entries, s, items, []), s)!.monthsToFullyFunded
		).toBeNull();
	});

	it('reports no funding estimate when savings are flat or falling', () => {
		const flat = [
			entry('2026-01-15', [{ itemId: 'a1', amount: 10_000 }]),
			entry('2026-02-15', [{ itemId: 'a1', amount: 10_000 }])
		];
		const s = stateWithPrice();
		expect(
			summarizeSavings(costToMoveSeries(flat, s, items, []), s)!.monthsToFullyFunded
		).toBeNull();
	});
});
