import { derived } from 'svelte/store';
import { snapshot } from '$lib/db/store';

export const allHomes = derived(snapshot, ($s) => $s.homes);

export const activeHomes = derived(allHomes, ($all) =>
	$all.filter((h) => !h.archivedAt).sort((a, b) => a.name.localeCompare(b.name))
);
