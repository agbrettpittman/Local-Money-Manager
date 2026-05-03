import { readable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '$lib/db/schema';
import type { Item } from '$lib/db/types';

export const allItems = readable<Item[]>([], (set) => {
	const sub = liveQuery(() => db.items.toArray()).subscribe({
		next: (val) => set(val),
		error: (err) => console.error('items liveQuery error', err)
	});
	return () => sub.unsubscribe();
});

export const activeItems = derived(allItems, ($all) =>
	$all.filter((i) => !i.archivedAt).sort((a, b) => a.name.localeCompare(b.name))
);
