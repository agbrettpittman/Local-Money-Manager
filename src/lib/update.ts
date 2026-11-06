import { check, type Update } from '@tauri-apps/plugin-updater';

/**
 * How long to wait on the update endpoint before giving up. Short on purpose:
 * this runs at launch, and an unreachable endpoint must not leave a request
 * hanging around in the background.
 */
const TIMEOUT_MS = 10_000;

/**
 * Looks for a newer release, or returns null.
 *
 * Every failure is swallowed deliberately. The endpoint 404s until a release
 * publishes a `latest.json`, and there is nothing useful to tell someone about an
 * update check that couldn't reach anything — an error banner on every launch
 * would be worse than no updater at all.
 */
export async function findUpdate(): Promise<Update | null> {
	try {
		return await check({ timeout: TIMEOUT_MS });
	} catch {
		return null;
	}
}

/** Trims release notes to something that fits a one-line banner. */
export function summarise(body: string | undefined, limit = 120): string {
	const text = (body ?? '').trim().split('\n')[0]?.trim() ?? '';
	if (text.length <= limit) return text;
	return `${text.slice(0, limit - 1).trimEnd()}…`;
}
