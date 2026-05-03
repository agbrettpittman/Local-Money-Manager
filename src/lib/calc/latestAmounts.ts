import type { JournalEntry } from '$lib/db/types';

/**
 * Returns the most recent (by date) amount logged for each itemId across all entries.
 * Items never logged are absent from the map.
 */
export function latestAmountByItem(entries: JournalEntry[]): Record<string, number> {
	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
	const latest: Record<string, number> = {};
	for (const entry of sorted) {
		for (const line of entry.lines) {
			latest[line.itemId] = line.amount;
		}
	}
	return latest;
}
