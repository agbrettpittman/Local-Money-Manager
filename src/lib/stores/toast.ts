import { writable } from 'svelte/store';

/** The message currently on screen, or null when nothing is showing. */
export const toastMessage = writable<string | null>(null);

const DEFAULT_MS = 5000;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows a transient confirmation. A second call replaces the first rather than
 * queueing — these are acknowledgements, not a log, and a backlog of stale ones
 * would outlive whatever prompted them.
 */
export function showToast(message: string, ms: number = DEFAULT_MS): void {
	if (timer) clearTimeout(timer);
	toastMessage.set(message);
	timer = setTimeout(() => {
		timer = null;
		toastMessage.set(null);
	}, ms);
}

/** Clears immediately, e.g. when the user dismisses it. */
export function clearToast(): void {
	if (timer) clearTimeout(timer);
	timer = null;
	toastMessage.set(null);
}
