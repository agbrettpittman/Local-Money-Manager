import { writable } from 'svelte/store';
import { exportAll } from '$lib/db/repo';

const STORAGE_KEY = 'lmm:lastBackupAt';
const DISMISS_KEY = 'lmm:backupReminderDismissedUntil';
export const REMINDER_AFTER_DAYS = 14;

function readLastBackup(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(STORAGE_KEY);
}

function readDismissedUntil(): number {
	if (typeof localStorage === 'undefined') return 0;
	return Number(localStorage.getItem(DISMISS_KEY)) || 0;
}

/** ISO timestamp of the last export-to-file, or null if never backed up. */
export const lastBackupAt = writable<string | null>(readLastBackup());

/** Epoch ms until which the backup reminder is snoozed (0 = not snoozed). */
export const reminderDismissedUntil = writable<number>(readDismissedUntil());

export function dismissReminderFor(days: number): void {
	const until = Date.now() + days * 86_400_000;
	if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, String(until));
	reminderDismissedUntil.set(until);
}

/**
 * Marks "a file matching this data exists". Exported because a just-imported profile
 * is backed up by definition — the file it came from is that copy — so nagging about
 * it would be wrong.
 */
export function recordBackup(): void {
	const now = new Date().toISOString();
	if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, now);
	lastBackupAt.set(now);
}

export function daysSince(iso: string): number {
	return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function todayIsoSlug(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Export all data to a downloaded JSON file and record the backup time. */
export async function downloadBackup(): Promise<void> {
	const data = await exportAll();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `local-money-manager-${todayIsoSlug()}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	recordBackup();
}
