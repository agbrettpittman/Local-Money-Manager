import { describe, expect, it } from 'vitest';
import { stackedSeries } from './stacked';
import type { Item, JournalEntry } from '$lib/db/types';

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

describe('stackedSeries', () => {
	it('returns empty for no entries', () => {
		expect(stackedSeries([], [], 'asset')).toEqual({ itemIds: [], points: [] });
	});

	it('only includes lines of the requested kind', () => {
		const items = [item('a1', 'Cash', 'asset'), item('l1', 'CC', 'liability')];
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'a1', amount: 100 },
				{ itemId: 'l1', amount: 50 }
			])
		];
		const assetSeries = stackedSeries(entries, items, 'asset');
		expect(assetSeries.itemIds).toEqual(['a1']);
		expect(assetSeries.points[0].byItem).toEqual({ a1: 100 });
		expect(assetSeries.points[0].total).toBe(100);

		const liabSeries = stackedSeries(entries, items, 'liability');
		expect(liabSeries.itemIds).toEqual(['l1']);
		expect(liabSeries.points[0].total).toBe(50);
	});

	it('itemIds includes only items that appeared, sorted by name', () => {
		const items = [
			item('a1', 'Zebra', 'asset'),
			item('a2', 'Apple', 'asset'),
			item('a3', 'Banana', 'asset')
		];
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'a1', amount: 1 },
				{ itemId: 'a2', amount: 2 }
			])
		];
		const series = stackedSeries(entries, items, 'asset');
		expect(series.itemIds).toEqual(['a2', 'a1']);
	});

	it('handles items appearing on later dates only', () => {
		const items = [item('a1', 'Cash', 'asset'), item('a2', 'Brokerage', 'asset')];
		const entries = [
			entry('2026-04-01', [{ itemId: 'a1', amount: 100 }]),
			entry('2026-04-02', [
				{ itemId: 'a1', amount: 100 },
				{ itemId: 'a2', amount: 500 }
			])
		];
		const series = stackedSeries(entries, items, 'asset');
		expect(series.points[0].byItem).toEqual({ a1: 100 });
		expect(series.points[1].byItem).toEqual({ a1: 100, a2: 500 });
		expect(series.points[1].total).toBe(600);
	});

	it('excludes a group parent that has child lines', () => {
		const items = [
			item('bank', 'Bank', 'asset'),
			{ ...item('checking', 'Checking', 'asset'), parentId: 'bank' },
			{ ...item('savings', 'Savings', 'asset'), parentId: 'bank' }
		];
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'bank', amount: 999 },
				{ itemId: 'checking', amount: 100 },
				{ itemId: 'savings', amount: 50 }
			])
		];
		const series = stackedSeries(entries, items, 'asset');
		expect(series.itemIds).toEqual(['checking', 'savings']);
		expect(series.points[0].byItem).toEqual({ checking: 100, savings: 50 });
		expect(series.points[0].total).toBe(150);
	});

	it('still resolves archived items if they appeared in entries', () => {
		const items = [{ ...item('a1', 'OldCash', 'asset'), archivedAt: '2026-04-05T00:00:00Z' }];
		const entries = [entry('2026-04-01', [{ itemId: 'a1', amount: 100 }])];
		const series = stackedSeries(entries, items, 'asset');
		expect(series.itemIds).toEqual(['a1']);
		expect(series.points[0].total).toBe(100);
	});
});
