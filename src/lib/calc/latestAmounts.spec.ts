import { describe, expect, it } from 'vitest';
import { latestAmountByItem } from './latestAmounts';
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
