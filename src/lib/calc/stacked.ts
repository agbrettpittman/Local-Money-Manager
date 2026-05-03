import type { Item, JournalEntry, LineKind } from '$lib/db/types';

export interface StackedPoint {
	date: string;
	byItem: Record<string, number>;
	total: number;
}

export interface StackedSeries {
	itemIds: string[];
	points: StackedPoint[];
}

/**
 * Build a stacked series for the given kind. itemIds are the union of items that
 * ever appeared in the dataset for that kind, in stable name order — used to drive
 * consistent color assignment in the chart.
 */
export function stackedSeries(
	entries: JournalEntry[],
	items: Item[],
	kind: LineKind
): StackedSeries {
	const kindById = new Map(items.map((i) => [i.id, i.kind]));
	const seenItemIds = new Set<string>();

	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

	const points: StackedPoint[] = sorted.map((entry) => {
		const byItem: Record<string, number> = {};
		let total = 0;
		for (const line of entry.lines) {
			if (kindById.get(line.itemId) !== kind) continue;
			byItem[line.itemId] = line.amount;
			seenItemIds.add(line.itemId);
			total += line.amount;
		}
		return { date: entry.date, byItem, total };
	});

	const itemIds = items
		.filter((i) => i.kind === kind && seenItemIds.has(i.id))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((i) => i.id);

	return { itemIds, points };
}
