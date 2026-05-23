import type { Item, JournalEntry } from '$lib/db/types';
import { containerParentIds } from './groups';

export interface NetWorthPoint {
	date: string;
	assetTotal: number;
	liabilityTotal: number;
	value: number;
}

export function networthSeries(entries: JournalEntry[], items: Item[]): NetWorthPoint[] {
	const kindById = new Map(items.map((i) => [i.id, i.kind]));
	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

	return sorted.map((entry) => {
		const containers = containerParentIds(entry.lines, items);
		let assetTotal = 0;
		let liabilityTotal = 0;
		for (const line of entry.lines) {
			// Group containers are represented by their children; skip to avoid double-counting.
			if (containers.has(line.itemId)) continue;
			const kind = kindById.get(line.itemId);
			if (kind === 'asset') assetTotal += line.amount;
			else if (kind === 'liability') liabilityTotal += line.amount;
		}
		return {
			date: entry.date,
			assetTotal,
			liabilityTotal,
			value: assetTotal - liabilityTotal
		};
	});
}

export function netWorthFor(entry: JournalEntry, items: Item[]): NetWorthPoint {
	return networthSeries([entry], items)[0];
}
