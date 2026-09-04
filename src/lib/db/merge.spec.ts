import { describe, expect, it } from 'vitest';
import { planMerge } from './merge';
import type { CostToMoveState, Home, Item, JournalEntry } from './types';
import { defaultCostToMoveState } from '$lib/cost-to-move/defaults';

const item = (id: string, name: string, kind: Item['kind'] = 'asset'): Item => ({
	id,
	name,
	kind,
	createdAt: '2026-01-01T00:00:00Z'
});

const entry = (id: string, date: string, updatedAt: string, amount = 0): JournalEntry => ({
	id,
	date,
	lines: [{ itemId: 'a1', amount }],
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt
});

const home = (id: string, name: string): Home => ({
	id,
	name,
	valueItemId: `${id}-v`,
	mortgageItemId: `${id}-m`,
	sellingCostPercent: 6,
	mortgageRate: 5,
	mortgageYears: 30,
	createdAt: '2026-01-01T00:00:00Z'
});

const snapshot = (over: {
	items?: Item[];
	homes?: Home[];
	journalEntries?: JournalEntry[];
	costToMove?: CostToMoveState | null;
}) => ({
	items: over.items ?? [],
	homes: over.homes ?? [],
	journalEntries: over.journalEntries ?? [],
	costToMove: over.costToMove ?? null
});

const ids = () => {
	let n = 0;
	return () => `generated-${++n}`;
};

describe('planMerge', () => {
	it('keeps both sides when nothing overlaps', () => {
		const plan = planMerge(
			snapshot({
				items: [item('a', 'Checking')],
				journalEntries: [entry('e1', '2026-01-01', 't1')]
			}),
			snapshot({
				items: [item('b', 'Savings')],
				journalEntries: [entry('e2', '2026-02-01', 't1')]
			}),
			ids()
		);

		expect(plan.items.map((i) => i.id)).toEqual(['a', 'b']);
		expect(plan.journalEntries.map((e) => e.date)).toEqual(['2026-01-01', '2026-02-01']);
		expect(plan.summary.itemsAdded).toBe(1);
		expect(plan.summary.entriesAdded).toBe(1);
	});

	it('keeps the local copy when item ids collide', () => {
		const plan = planMerge(
			snapshot({ items: [item('a', 'Local name')] }),
			snapshot({ items: [item('a', 'Incoming name')] }),
			ids()
		);

		expect(plan.items).toHaveLength(1);
		expect(plan.items[0].name).toBe('Local name');
		expect(plan.summary).toMatchObject({ itemsAdded: 0, itemsKept: 1 });
	});

	it('merges journal entries by date, newest updatedAt winning', () => {
		const plan = planMerge(
			snapshot({ journalEntries: [entry('local', '2026-01-01', '2026-05-01T00:00:00Z', 100)] }),
			snapshot({ journalEntries: [entry('remote', '2026-01-01', '2026-06-01T00:00:00Z', 200)] }),
			ids()
		);

		expect(plan.journalEntries).toHaveLength(1);
		expect(plan.journalEntries[0].lines[0].amount).toBe(200);
		expect(plan.summary).toMatchObject({ entriesUpdated: 1, entriesAdded: 0, entriesKept: 0 });
	});

	it('keeps the local id when an incoming entry wins on date', () => {
		const plan = planMerge(
			snapshot({ journalEntries: [entry('local', '2026-01-01', '2026-05-01T00:00:00Z')] }),
			snapshot({ journalEntries: [entry('remote', '2026-01-01', '2026-06-01T00:00:00Z')] }),
			ids()
		);

		expect(plan.journalEntries[0].id).toBe('local');
	});

	it('keeps the local entry when it is the newer of the two', () => {
		const plan = planMerge(
			snapshot({ journalEntries: [entry('local', '2026-01-01', '2026-06-01T00:00:00Z', 100)] }),
			snapshot({ journalEntries: [entry('remote', '2026-01-01', '2026-05-01T00:00:00Z', 200)] }),
			ids()
		);

		expect(plan.journalEntries[0].lines[0].amount).toBe(100);
		expect(plan.summary).toMatchObject({ entriesKept: 1, entriesUpdated: 0 });
	});

	it('never emits two entries for one date', () => {
		const plan = planMerge(
			snapshot({ journalEntries: [entry('local', '2026-01-01', 't1')] }),
			snapshot({
				journalEntries: [entry('r1', '2026-01-01', 't2'), entry('r2', '2026-01-01', 't3')]
			}),
			ids()
		);

		expect(plan.journalEntries).toHaveLength(1);
		expect(new Set(plan.journalEntries.map((e) => e.date)).size).toBe(1);
	});

	it('reassigns an incoming id that is already taken on another date', () => {
		const plan = planMerge(
			snapshot({ journalEntries: [entry('shared', '2026-01-01', 't1')] }),
			snapshot({ journalEntries: [entry('shared', '2026-02-01', 't1')] }),
			ids()
		);

		expect(plan.journalEntries.map((e) => e.id)).toEqual(['shared', 'generated-1']);
	});

	it('flags names that exist on both sides under different ids', () => {
		const plan = planMerge(
			snapshot({ items: [item('a', 'Checking')] }),
			snapshot({ items: [item('b', 'checking ')] }),
			ids()
		);

		expect(plan.items).toHaveLength(2);
		expect(plan.summary.duplicateNames).toEqual(['checking ']);
	});

	it('does not flag a same name across different kinds', () => {
		const plan = planMerge(
			snapshot({ items: [item('a', 'Loan', 'asset')] }),
			snapshot({ items: [item('b', 'Loan', 'liability')] }),
			ids()
		);

		expect(plan.summary.duplicateNames).toEqual([]);
	});

	it('leaves Cost To Move settings on the local side', () => {
		const incoming = { ...defaultCostToMoveState(), housePrice: 999_999 };
		const local = { ...defaultCostToMoveState(), housePrice: 100 };
		const plan = planMerge(
			snapshot({ costToMove: local }),
			snapshot({ costToMove: incoming }),
			ids()
		);

		expect(plan.costToMove?.housePrice).toBe(100);
		expect(plan.summary.costToMoveIgnored).toBe(true);
	});

	it('unions homes by id', () => {
		const plan = planMerge(
			snapshot({ homes: [home('h1', 'Current')] }),
			snapshot({ homes: [home('h1', 'Renamed'), home('h2', 'Other')] }),
			ids()
		);

		expect(plan.homes.map((h) => h.name)).toEqual(['Current', 'Other']);
		expect(plan.summary).toMatchObject({ homesAdded: 1, homesKept: 1 });
	});

	it('is idempotent when merging a file into data already containing it', () => {
		const data = snapshot({
			items: [item('a', 'Checking')],
			homes: [home('h1', 'Current')],
			journalEntries: [entry('e1', '2026-01-01', 't1')]
		});
		const plan = planMerge(data, data, ids());

		expect(plan.items).toEqual(data.items);
		expect(plan.homes).toEqual(data.homes);
		expect(plan.journalEntries).toEqual(data.journalEntries);
		expect(plan.summary).toMatchObject({ itemsAdded: 0, homesAdded: 0, entriesAdded: 0 });
	});
});
