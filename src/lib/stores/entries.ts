import { derived } from 'svelte/store';
import { snapshot } from '$lib/db/store';

export const allEntries = derived(snapshot, ($s) => $s.journalEntries);

export const entriesByDate = derived(allEntries, ($all) =>
	[...$all].sort((a, b) => a.date.localeCompare(b.date))
);

export const entriesByDateDesc = derived(allEntries, ($all) =>
	[...$all].sort((a, b) => b.date.localeCompare(a.date))
);
