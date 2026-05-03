import { readable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '$lib/db/schema';
import type { JournalEntry } from '$lib/db/types';

export const allEntries = readable<JournalEntry[]>([], (set) => {
	const sub = liveQuery(() => db.journalEntries.toArray()).subscribe({
		next: (val) => set(val),
		error: (err) => console.error('entries liveQuery error', err)
	});
	return () => sub.unsubscribe();
});

export const entriesByDate = derived(allEntries, ($all) =>
	[...$all].sort((a, b) => a.date.localeCompare(b.date))
);

export const entriesByDateDesc = derived(allEntries, ($all) =>
	[...$all].sort((a, b) => b.date.localeCompare(a.date))
);
