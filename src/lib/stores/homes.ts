import { readable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '$lib/db/schema';
import type { Home } from '$lib/db/types';

export const allHomes = readable<Home[]>([], (set) => {
	const sub = liveQuery(() => db.homes.toArray()).subscribe({
		next: (val) => set(val),
		error: (err) => console.error('homes liveQuery error', err)
	});
	return () => sub.unsubscribe();
});

export const activeHomes = derived(allHomes, ($all) =>
	$all.filter((h) => !h.archivedAt).sort((a, b) => a.name.localeCompare(b.name))
);
