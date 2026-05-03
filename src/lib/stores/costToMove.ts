import { readable } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '$lib/db/schema';
import { defaultCostToMoveState } from '$lib/cost-to-move/defaults';
import type { CostToMoveState } from '$lib/db/types';

export const costToMove = readable<CostToMoveState>(defaultCostToMoveState(), (set) => {
	const sub = liveQuery(() => db.costToMove.get('singleton')).subscribe({
		next: (val) => set(val ?? defaultCostToMoveState()),
		error: (err) => console.error('costToMove liveQuery error', err)
	});
	return () => sub.unsubscribe();
});
