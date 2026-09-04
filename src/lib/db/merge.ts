import { v4 as uuid } from 'uuid';
import type { CostToMoveState, ExportEnvelope, Home, Item, JournalEntry } from './types';

export interface MergeSummary {
	itemsAdded: number;
	itemsKept: number;
	homesAdded: number;
	homesKept: number;
	entriesAdded: number;
	entriesUpdated: number;
	entriesKept: number;
	/** True when the file carried Cost To Move settings that a merge deliberately ignores. */
	costToMoveIgnored: boolean;
	/**
	 * Names that exist on both sides under different ids. Merging keeps both, so the
	 * user ends up with two same-named rows splitting one real-world account's history.
	 */
	duplicateNames: string[];
}

export interface MergePlan {
	items: Item[];
	homes: Home[];
	journalEntries: JournalEntry[];
	costToMove: CostToMoveState | null;
	summary: MergeSummary;
}

type Snapshot = Pick<ExportEnvelope, 'items' | 'homes' | 'journalEntries' | 'costToMove'>;

const nameKey = (r: { name: string; kind?: string }) =>
	`${r.kind ?? ''}:${r.name.trim().toLowerCase()}`;

/** Keeps the entry with the newer updatedAt when a date appears more than once. */
function byDate(entries: JournalEntry[]): Map<string, JournalEntry> {
	const out = new Map<string, JournalEntry>();
	for (const e of entries) {
		const existing = out.get(e.date);
		if (!existing || e.updatedAt > existing.updatedAt) out.set(e.date, e);
	}
	return out;
}

/**
 * Combines an imported backup with what is already stored, without losing either side.
 *
 * Items and homes union by id, keeping the local copy when ids collide — they carry no
 * updatedAt to arbitrate with, and re-doing a rename costs less than silently undoing one.
 * Journal entries key off `date` rather than `id` because date is uniquely indexed: two
 * browsers that both recorded the same day hold different ids for it, and merging by id
 * would violate the index. Cost To Move is local-only configuration, so a merge leaves it
 * alone rather than guessing which browser's settings are current.
 *
 * Pure: `newId` is injectable so tests stay deterministic.
 */
export function planMerge(
	local: Snapshot,
	incoming: Snapshot,
	newId: () => string = uuid
): MergePlan {
	const items = [...local.items];
	const itemsById = new Map(items.map((i) => [i.id, i]));
	const localItemNames = new Set(items.map(nameKey));
	const duplicateNames: string[] = [];
	let itemsAdded = 0;
	let itemsKept = 0;

	for (const incomingItem of incoming.items) {
		if (itemsById.has(incomingItem.id)) {
			itemsKept += 1;
			continue;
		}
		if (localItemNames.has(nameKey(incomingItem))) duplicateNames.push(incomingItem.name);
		items.push(incomingItem);
		itemsById.set(incomingItem.id, incomingItem);
		itemsAdded += 1;
	}

	const homes = [...local.homes];
	const homesById = new Map(homes.map((h) => [h.id, h]));
	let homesAdded = 0;
	let homesKept = 0;

	for (const incomingHome of incoming.homes) {
		if (homesById.has(incomingHome.id)) {
			homesKept += 1;
			continue;
		}
		homes.push(incomingHome);
		homesById.set(incomingHome.id, incomingHome);
		homesAdded += 1;
	}

	const merged = byDate(local.journalEntries);
	const usedIds = new Set([...merged.values()].map((e) => e.id));
	let entriesAdded = 0;
	let entriesUpdated = 0;
	let entriesKept = 0;

	for (const incomingEntry of byDate(incoming.journalEntries).values()) {
		const existing = merged.get(incomingEntry.date);
		if (!existing) {
			// A fresh id only when the file reuses one already spoken for on another date.
			const id = usedIds.has(incomingEntry.id) ? newId() : incomingEntry.id;
			merged.set(incomingEntry.date, { ...incomingEntry, id });
			usedIds.add(id);
			entriesAdded += 1;
		} else if (incomingEntry.updatedAt > existing.updatedAt) {
			// Keep the local id so nothing else that points at this entry has to move.
			merged.set(incomingEntry.date, { ...incomingEntry, id: existing.id });
			entriesUpdated += 1;
		} else {
			entriesKept += 1;
		}
	}

	return {
		items,
		homes,
		journalEntries: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)),
		costToMove: local.costToMove,
		summary: {
			itemsAdded,
			itemsKept,
			homesAdded,
			homesKept,
			entriesAdded,
			entriesUpdated,
			entriesKept,
			costToMoveIgnored: incoming.costToMove !== null,
			duplicateNames
		}
	};
}
