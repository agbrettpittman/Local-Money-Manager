import { describe, expect, it } from 'vitest';
import { containerParentIds } from './groups';
import type { Item } from '$lib/db/types';

const item = (id: string, parentId?: string): Item => ({
	id,
	name: id,
	kind: 'asset',
	parentId,
	createdAt: '2026-01-01T00:00:00Z'
});

describe('containerParentIds', () => {
	it('returns parents that have a child line present', () => {
		const items = [item('bank'), item('checking', 'bank'), item('cash')];
		const lines = [
			{ itemId: 'bank', amount: 0 },
			{ itemId: 'checking', amount: 100 },
			{ itemId: 'cash', amount: 50 }
		];
		expect(containerParentIds(lines, items)).toEqual(new Set(['bank']));
	});

	it('ignores a parent with no child lines in the entry', () => {
		const items = [item('bank'), item('checking', 'bank')];
		const lines = [{ itemId: 'bank', amount: 999 }];
		expect(containerParentIds(lines, items)).toEqual(new Set());
	});

	it('returns empty when there are no lines', () => {
		expect(containerParentIds([], [item('bank')])).toEqual(new Set());
	});
});
