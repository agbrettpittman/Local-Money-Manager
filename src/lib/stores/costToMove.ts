import { derived } from 'svelte/store';
import { snapshot } from '$lib/db/store';
import { defaultCostToMoveState } from '$lib/cost-to-move/defaults';

export const costToMove = derived(snapshot, ($s) => $s.costToMove ?? defaultCostToMoveState());
