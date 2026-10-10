import { describe, expect, it } from 'vitest';
import { buildDefaultLines, entryBefore } from './entryDefaults';
import type { Item, JournalEntry } from '$lib/db/types';

const item = (id: string, name: string): Item => ({
	id,
	name,
	kind: 'asset',
	createdAt: '2026-01-01T00:00:00Z'
});

const entry = (date: string, lines: { itemId: string; amount: number }[]): JournalEntry => ({
	id: `e-${date}`,
	date,
	lines,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z'
});

const items = [item('a1', 'Checking'), item('a2', 'Savings')];

describe('buildDefaultLines', () => {
	it('starts every active item at zero with no prior entry', () => {
		expect(buildDefaultLines(items)).toEqual([
			{ itemId: 'a1', amount: 0 },
			{ itemId: 'a2', amount: 0 }
		]);
	});

	it('carries the prior entry’s amounts across', () => {
		const prior = entry('2026-05-01', [
			{ itemId: 'a1', amount: 1200 },
			{ itemId: 'a2', amount: 8000 }
		]);
		expect(buildDefaultLines(items, prior)).toEqual([
			{ itemId: 'a1', amount: 1200 },
			{ itemId: 'a2', amount: 8000 }
		]);
	});

	it('zeroes items the prior entry never logged', () => {
		const prior = entry('2026-05-01', [{ itemId: 'a1', amount: 1200 }]);
		expect(buildDefaultLines(items, prior)).toEqual([
			{ itemId: 'a1', amount: 1200 },
			{ itemId: 'a2', amount: 0 }
		]);
	});

	it('ignores prior lines for items that no longer exist', () => {
		const prior = entry('2026-05-01', [
			{ itemId: 'a1', amount: 1200 },
			{ itemId: 'gone', amount: 999 }
		]);
		expect(buildDefaultLines(items, prior).map((l) => l.itemId)).toEqual(['a1', 'a2']);
	});

	it('returns nothing when there are no active items', () => {
		expect(buildDefaultLines([], entry('2026-05-01', [{ itemId: 'a1', amount: 5 }]))).toEqual([]);
	});
});

describe('entryBefore', () => {
	const entries = [entry('2026-05-01', []), entry('2026-05-10', []), entry('2026-05-20', [])];

	it('finds the latest entry before the date', () => {
		expect(entryBefore(entries, '2026-05-15')?.date).toBe('2026-05-10');
	});

	it('excludes an entry on the date itself', () => {
		expect(entryBefore(entries, '2026-05-10')?.date).toBe('2026-05-01');
	});

	it('is undefined when nothing precedes the date', () => {
		expect(entryBefore(entries, '2026-04-01')).toBeUndefined();
	});

	it('does not assume the input is sorted', () => {
		const shuffled = [entries[2], entries[0], entries[1]];
		expect(entryBefore(shuffled, '2026-05-25')?.date).toBe('2026-05-20');
	});

	it('is undefined for an empty history', () => {
		expect(entryBefore([], '2026-05-01')).toBeUndefined();
	});
});
