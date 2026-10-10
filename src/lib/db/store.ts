import { writable } from 'svelte/store';
import { selectBackend, type PersistBackend } from './persist';
import { cloneSnapshot, emptySnapshot, type Snapshot } from './snapshot';

const PERSIST_DEBOUNCE_MS = 400;

let backend: PersistBackend = selectBackend();
let current: Snapshot = emptySnapshot();
/** Nothing is written before a successful load — otherwise a read failure would
 *  quietly replace real data with an empty snapshot. */
let ready = false;
let pending: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<void> = Promise.resolve();

const store = writable<Snapshot>(current);

/** Read-only view of the working set for the UI stores. */
export const snapshot = { subscribe: store.subscribe };

/** The live working set. Callers inside the repo layer must not mutate it directly. */
export function getSnapshot(): Snapshot {
	return current;
}

export async function initStorage(): Promise<void> {
	const loaded = await backend.load();
	current = loaded ?? emptySnapshot();
	ready = true;
	store.set(current);
}

function schedulePersist(): void {
	if (!ready) return;
	if (pending) clearTimeout(pending);
	pending = setTimeout(() => {
		pending = null;
		void flush();
	}, PERSIST_DEBOUNCE_MS);
}

/** Writes any pending changes now. Call before the window closes. */
export function flush(): Promise<void> {
	if (pending) {
		clearTimeout(pending);
		pending = null;
	}
	if (!ready) return Promise.resolve();
	const snap = current;
	chain = chain.then(() => backend.save(snap));
	return chain;
}

/**
 * Applies `fn` to a copy of the working set and commits it. A throw from `fn` leaves
 * the stored data untouched, which is what replaces the old Dexie transactions.
 */
export async function mutate<T>(fn: (draft: Snapshot) => T): Promise<T> {
	const draft = cloneSnapshot(current);
	const result = fn(draft);
	current = draft;
	store.set(draft);
	schedulePersist();
	return result;
}

/** Test seam: swaps the backend and resets in-memory state. */
export function __setBackendForTests(next: PersistBackend): void {
	backend = next;
	current = emptySnapshot();
	ready = false;
	if (pending) clearTimeout(pending);
	pending = null;
	chain = Promise.resolve();
	store.set(current);
}
