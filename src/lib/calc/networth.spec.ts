import { describe, expect, it } from 'vitest';
import { networthSeries } from './networth';
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

describe('networthSeries', () => {
	it('returns empty for no entries', () => {
		expect(networthSeries([], [])).toEqual([]);
	});

	it('computes single entry', () => {
		const items = [item('a1', 'Cash', 'asset'), item('l1', 'CC', 'liability')];
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'a1', amount: 1000 },
				{ itemId: 'l1', amount: 200 }
			])
		];
		expect(networthSeries(entries, items)).toEqual([
			{ date: '2026-04-01', assetTotal: 1000, liabilityTotal: 200, value: 800 }
		]);
	});

	it('returns points sorted ascending by date', () => {
		const items = [item('a1', 'Cash', 'asset')];
		const entries = [
			entry('2026-04-03', [{ itemId: 'a1', amount: 300 }]),
			entry('2026-04-01', [{ itemId: 'a1', amount: 100 }]),
			entry('2026-04-02', [{ itemId: 'a1', amount: 200 }])
		];
		expect(networthSeries(entries, items).map((p) => p.date)).toEqual([
			'2026-04-01',
			'2026-04-02',
			'2026-04-03'
		]);
	});

	it('ignores lines whose item is unknown', () => {
		const items = [item('a1', 'Cash', 'asset')];
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'a1', amount: 100 },
				{ itemId: 'ghost', amount: 99999 }
			])
		];
		expect(networthSeries(entries, items)[0].value).toBe(100);
	});

	it('excludes a group parent that has child lines (uses children instead)', () => {
		const items = [
			item('bank', 'Bank', 'asset'),
			{ ...item('checking', 'Checking', 'asset'), parentId: 'bank' },
			{ ...item('savings', 'Savings', 'asset'), parentId: 'bank' }
		];
		// Parent carries a stale 999 that must be ignored in favour of the children.
		const entries = [
			entry('2026-04-01', [
				{ itemId: 'bank', amount: 999 },
				{ itemId: 'checking', amount: 100 },
				{ itemId: 'savings', amount: 50 }
			])
		];
		expect(networthSeries(entries, items)[0]).toEqual({
			date: '2026-04-01',
			assetTotal: 150,
			liabilityTotal: 0,
			value: 150
		});
	});

	it('counts a parent normally when it has no child lines in the entry', () => {
		const items = [
			item('bank', 'Bank', 'asset'),
			{ ...item('checking', 'Checking', 'asset'), parentId: 'bank' }
		];
		const entries = [entry('2026-04-01', [{ itemId: 'bank', amount: 999 }])];
		expect(networthSeries(entries, items)[0].value).toBe(999);
	});

	it('handles items appearing and disappearing across dates', () => {
		const items = [item('a1', 'Cash', 'asset'), item('a2', 'Brokerage', 'asset')];
		const entries = [
			entry('2026-04-01', [{ itemId: 'a1', amount: 100 }]),
			entry('2026-04-02', [
				{ itemId: 'a1', amount: 100 },
				{ itemId: 'a2', amount: 500 }
			]),
			entry('2026-04-03', [{ itemId: 'a2', amount: 600 }])
		];
		expect(networthSeries(entries, items).map((p) => p.value)).toEqual([100, 600, 600]);
	});
});
