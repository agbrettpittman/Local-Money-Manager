import { describe, expect, it } from 'vitest';
import { amountsAsOf, latestAmountByItem } from './latestAmounts';
import type { JournalEntry } from '$lib/db/types';

const entry = (date: string, lines: { itemId: string; amount: number }[]): JournalEntry => ({
	id: `e-${date}`,
	date,
	lines,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z'
});

describe('latestAmountByItem', () => {
	it('returns empty for no entries', () => {
		expect(latestAmountByItem([])).toEqual({});
	});

	it('takes the most recent value per item across dates', () => {
		const entries = [
			entry('2026-04-01', [{ itemId: 'a1', amount: 100 }]),
			entry('2026-04-02', [
				{ itemId: 'a1', amount: 200 },
				{ itemId: 'a2', amount: 50 }
			]),
			entry('2026-04-03', [{ itemId: 'a2', amount: 75 }])
		];
		expect(latestAmountByItem(entries)).toEqual({ a1: 200, a2: 75 });
	});

	it('is order-independent across input', () => {
		const a = entry('2026-04-01', [{ itemId: 'x', amount: 1 }]);
		const b = entry('2026-04-02', [{ itemId: 'x', amount: 2 }]);
		expect(latestAmountByItem([a, b])).toEqual({ x: 2 });
		expect(latestAmountByItem([b, a])).toEqual({ x: 2 });
	});
});

describe('amountsAsOf', () => {
	const entries = [
		entry('2026-04-01', [
			{ itemId: 'a1', amount: 100 },
			{ itemId: 'a2', amount: 10 }
		]),
		entry('2026-04-02', [{ itemId: 'a1', amount: 200 }]),
		entry('2026-04-03', [{ itemId: 'a3', amount: 5 }])
	];

	it('ignores entries dated after the cutoff', () => {
		expect(amountsAsOf(entries, '2026-04-02')).toEqual({ a1: 200, a2: 10 });
	});

	it('includes an entry dated exactly on the cutoff', () => {
		expect(amountsAsOf(entries, '2026-04-01')).toEqual({ a1: 100, a2: 10 });
	});

	it('carries forward the last value before the cutoff for unlogged items', () => {
		expect(amountsAsOf(entries, '2026-04-03').a2).toBe(10);
	});

	it('returns empty when the cutoff precedes every entry', () => {
		expect(amountsAsOf(entries, '2026-03-31')).toEqual({});
	});

	it('matches latestAmountByItem at the final date', () => {
		expect(amountsAsOf(entries, '2026-04-03')).toEqual(latestAmountByItem(entries));
	});
});
