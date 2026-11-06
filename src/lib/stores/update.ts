import { writable } from 'svelte/store';
import type { Update } from '@tauri-apps/plugin-updater';
import { findUpdate } from '$lib/update';
import { isDesktop } from '$lib/platform';

/** How often to look again while the app stays open. */
const RECHECK_MS = 2 * 60 * 60 * 1000;

/**
 * The newer release waiting to be installed, or null. Shared rather than owned by the
 * banner: the footer keeps flagging it after the banner is dismissed.
 */
export const availableUpdate = writable<Update | null>(null);

let polling = false;

/**
 * Checks at launch and every couple of hours, so a machine left running picks up a
 * release without a restart. A no-op off the desktop, and only the first caller
 * starts a timer.
 */
export function startUpdatePolling(): () => void {
	if (!isDesktop || polling) return () => {};
	polling = true;
	let cancelled = false;

	const poll = async () => {
		const found = await findUpdate();
		if (cancelled) return;
		// Keep the existing object when the version is unchanged, so a repeat check
		// doesn't re-render or reset a dismissal.
		availableUpdate.update((prev) => (prev?.version === found?.version ? prev : found));
	};

	void poll();
	const id = setInterval(poll, RECHECK_MS);

	return () => {
		cancelled = true;
		polling = false;
		clearInterval(id);
	};
}
