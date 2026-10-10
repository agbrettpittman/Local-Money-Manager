import type { CostToMoveState, ExportEnvelope, Home, Item, JournalEntry } from './types';

/** The entire working set. Small enough to hold in memory and persist whole. */
export interface Snapshot {
	items: Item[];
	homes: Home[];
	journalEntries: JournalEntry[];
	costToMove: CostToMoveState | null;
}

export const ENVELOPE_VERSION = 1;

export function emptySnapshot(): Snapshot {
	return { items: [], homes: [], journalEntries: [], costToMove: null };
}

export function cloneSnapshot(snap: Snapshot): Snapshot {
	return structuredClone(snap);
}

/** The on-disk format is an export envelope, so the data file *is* a backup file. */
export function toEnvelope(snap: Snapshot): ExportEnvelope {
	return {
		version: ENVELOPE_VERSION,
		exportedAt: new Date().toISOString(),
		items: snap.items,
		homes: snap.homes,
		journalEntries: snap.journalEntries,
		costToMove: snap.costToMove
	};
}

export function fromEnvelope(env: ExportEnvelope): Snapshot {
	return {
		items: env.items,
		homes: env.homes ?? [],
		journalEntries: env.journalEntries,
		costToMove: env.costToMove
	};
}
