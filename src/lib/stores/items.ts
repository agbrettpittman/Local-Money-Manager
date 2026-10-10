import { derived } from 'svelte/store';
import { snapshot } from '$lib/db/store';

export const allItems = derived(snapshot, ($s) => $s.items);

export const activeItems = derived(allItems, ($all) =>
	$all.filter((i) => !i.archivedAt).sort((a, b) => a.name.localeCompare(b.name))
);
