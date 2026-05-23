import type { Item, JournalLine } from '$lib/db/types';

/**
 * Within a single entry, a parent item acts as a group container when it has at
 * least one child line present. Its own amount is then derived (the sum of its
 * children) and must be excluded from totals to avoid double-counting.
 */
export function containerParentIds(lines: JournalLine[], items: Item[]): Set<string> {
	const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
	const containers = new Set<string>();
	for (const line of lines) {
		const parentId = parentOf.get(line.itemId);
		if (parentId) containers.add(parentId);
	}
	return containers;
}
