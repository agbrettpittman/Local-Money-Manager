import type { Item, JournalEntry, JournalLine } from '$lib/db/types';

/**
 * The lines a new entry starts with: one per active item, at zero.
 *
 * When `prior` is given, each item carries over that entry's amount instead — items
 * it never logged still start at zero, so adding an item later doesn't inherit a
 * stale figure from an entry that predates it.
 */
export function buildDefaultLines(items: Item[], prior?: JournalEntry): JournalLine[] {
	const priorAmounts = new Map((prior?.lines ?? []).map((l) => [l.itemId, l.amount]));
	return items.map((item) => ({
		itemId: item.id,
		amount: priorAmounts.get(item.id) ?? 0
	}));
}

/**
 * The most recent entry strictly before `date` — what "the previous entry" means when
 * back-filling a day in the middle of your history, not just the newest one overall.
 */
export function entryBefore(entries: JournalEntry[], date: string): JournalEntry | undefined {
	return entries
		.filter((e) => e.date < date)
		.reduce<
			JournalEntry | undefined
		>((latest, e) => (!latest || e.date > latest.date ? e : latest), undefined);
}
