import { v4 as uuid } from 'uuid';
import { getSnapshot, mutate } from './store';
import { toEnvelope, type Snapshot } from './snapshot';
import type {
	CostToMoveState,
	ExportEnvelope,
	Home,
	Item,
	JournalEntry,
	JournalLine,
	LineKind
} from './types';
import { defaultCostToMoveState } from '$lib/cost-to-move/defaults';
import { planMerge, type MergeSummary } from './merge';

const nowIso = () => new Date().toISOString();

// ── Items ──────────────────────────────────────────────────

export async function listActiveItems(): Promise<Item[]> {
	return getSnapshot()
		.items.filter((i) => !i.archivedAt)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllItems(): Promise<Item[]> {
	return [...getSnapshot().items];
}

export async function createItem(name: string, kind: LineKind, parentId?: string): Promise<Item> {
	return mutate((draft) => {
		if (parentId) {
			const parent = draft.items.find((i) => i.id === parentId);
			if (!parent) throw new Error(`Parent item ${parentId} not found`);
			if (parent.kind !== kind)
				throw new Error(`Parent kind (${parent.kind}) does not match new item kind (${kind})`);
			if (parent.parentId)
				throw new Error('Cannot nest under a sub-item — only one level of hierarchy is supported');
			if (parent.homeId) throw new Error('Cannot add sub-items under a home-managed item');
		}
		const item: Item = { id: uuid(), name, kind, createdAt: nowIso(), parentId };
		draft.items.push(item);
		return item;
	});
}

export async function renameItem(id: string, name: string): Promise<void> {
	await mutate((draft) => {
		const item = draft.items.find((i) => i.id === id);
		if (item) item.name = name;
	});
}

export async function archiveItem(id: string): Promise<void> {
	await mutate((draft) => {
		const item = draft.items.find((i) => i.id === id);
		if (item) item.archivedAt = nowIso();
	});
}

export async function unarchiveItem(id: string): Promise<void> {
	await mutate((draft) => {
		const item = draft.items.find((i) => i.id === id);
		if (item) delete item.archivedAt;
	});
}

export interface DeleteItemImpact {
	entriesAffected: number;
	linesRemoved: number;
}

/**
 * Returns how many journal lines reference this item — for confirmation UI
 * before a hard delete. Read-only.
 */
export async function previewDeleteItem(id: string): Promise<DeleteItemImpact> {
	return countImpact(getSnapshot(), id);
}

function countImpact(snap: Snapshot, id: string): DeleteItemImpact {
	let entriesAffected = 0;
	let linesRemoved = 0;
	for (const entry of snap.journalEntries) {
		const matches = entry.lines.filter((l) => l.itemId === id).length;
		if (matches > 0) {
			entriesAffected += 1;
			linesRemoved += matches;
		}
	}
	return { entriesAffected, linesRemoved };
}

/**
 * Hard-deletes an item and cascades: removes any journal lines that reference it,
 * and clears its entries from CTM asset/expense selection records.
 *
 * Refuses to delete items managed by a Home (delete the home instead) or items
 * that have child sub-items (delete or reparent the children first).
 */
export async function deleteItem(id: string): Promise<DeleteItemImpact> {
	return mutate((draft) => {
		const item = draft.items.find((i) => i.id === id);
		if (!item) return { entriesAffected: 0, linesRemoved: 0 };
		if (item.homeId) {
			throw new Error('This item is managed by a Home — archive the home instead.');
		}

		const children = draft.items.filter((i) => i.parentId === id);
		if (children.length > 0) {
			throw new Error(
				`Cannot delete: this item has ${children.length} sub-item${children.length === 1 ? '' : 's'}. Delete or reparent them first.`
			);
		}

		const impact = countImpact(draft, id);
		const ts = nowIso();
		for (const entry of draft.journalEntries) {
			const filtered = entry.lines.filter((l) => l.itemId !== id);
			if (filtered.length !== entry.lines.length) {
				entry.lines = filtered;
				entry.updatedAt = ts;
			}
		}

		if (draft.costToMove) {
			delete draft.costToMove.assetSelections[id];
			delete draft.costToMove.expenseSelections[id];
		}

		draft.items = draft.items.filter((i) => i.id !== id);
		return impact;
	});
}

// ── Homes ──────────────────────────────────────────────────

export async function listAllHomes(): Promise<Home[]> {
	return [...getSnapshot().homes];
}

export async function listActiveHomes(): Promise<Home[]> {
	return getSnapshot()
		.homes.filter((h) => !h.archivedAt)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export interface CreateHomeInput {
	name: string;
	sellingCostPercent: number;
	mortgageRate: number;
	mortgageYears: number;
	mortgageStartDate?: string;
}

export async function createHome(input: CreateHomeInput): Promise<Home> {
	return mutate((draft) => {
		const ts = nowIso();
		const homeId = uuid();
		const valueItem: Item = {
			id: uuid(),
			name: input.name,
			kind: 'asset',
			homeId,
			createdAt: ts
		};
		const mortgageItem: Item = {
			id: uuid(),
			name: `${input.name} Mortgage`,
			kind: 'liability',
			homeId,
			createdAt: ts
		};
		const home: Home = {
			id: homeId,
			name: input.name,
			valueItemId: valueItem.id,
			mortgageItemId: mortgageItem.id,
			sellingCostPercent: input.sellingCostPercent,
			mortgageRate: input.mortgageRate,
			mortgageYears: input.mortgageYears,
			mortgageStartDate: input.mortgageStartDate,
			createdAt: ts
		};
		draft.items.push(valueItem, mortgageItem);
		draft.homes.push(home);
		return home;
	});
}

export async function updateHome(
	id: string,
	patch: Partial<Omit<Home, 'id' | 'valueItemId' | 'mortgageItemId' | 'createdAt'>>
): Promise<void> {
	await mutate((draft) => {
		const home = draft.homes.find((h) => h.id === id);
		if (!home) throw new Error(`Home ${id} not found`);

		if (patch.name !== undefined && patch.name !== home.name) {
			const value = draft.items.find((i) => i.id === home.valueItemId);
			const mortgage = draft.items.find((i) => i.id === home.mortgageItemId);
			if (value) value.name = patch.name;
			if (mortgage) mortgage.name = `${patch.name} Mortgage`;
		}
		Object.assign(home, patch);
	});
}

export async function archiveHome(id: string): Promise<void> {
	await mutate((draft) => {
		const home = draft.homes.find((h) => h.id === id);
		if (!home) return;
		const ts = nowIso();
		for (const item of draft.items) {
			if (item.id === home.valueItemId || item.id === home.mortgageItemId) item.archivedAt = ts;
		}
		home.archivedAt = ts;
	});
}

export async function unarchiveHome(id: string): Promise<void> {
	await mutate((draft) => {
		const home = draft.homes.find((h) => h.id === id);
		if (!home) return;
		for (const item of draft.items) {
			if (item.id === home.valueItemId || item.id === home.mortgageItemId) delete item.archivedAt;
		}
		delete home.archivedAt;
	});
}

// ── Journal entries ────────────────────────────────────────

export async function listEntries(): Promise<JournalEntry[]> {
	return [...getSnapshot().journalEntries].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEntryByDate(date: string): Promise<JournalEntry | undefined> {
	return getSnapshot().journalEntries.find((e) => e.date === date);
}

export async function getPriorEntry(date: string): Promise<JournalEntry | undefined> {
	const earlier = getSnapshot().journalEntries.filter((e) => e.date < date);
	if (earlier.length === 0) return undefined;
	return earlier.reduce((latest, e) => (e.date > latest.date ? e : latest));
}

export async function upsertEntry(
	date: string,
	lines: JournalLine[],
	notes?: string
): Promise<JournalEntry> {
	return mutate((draft) => {
		const ts = nowIso();
		const existing = draft.journalEntries.find((e) => e.date === date);
		if (existing) {
			existing.lines = lines;
			existing.notes = notes;
			existing.updatedAt = ts;
			return existing;
		}
		const entry: JournalEntry = { id: uuid(), date, lines, notes, createdAt: ts, updatedAt: ts };
		draft.journalEntries.push(entry);
		return entry;
	});
}

export async function deleteEntry(id: string): Promise<void> {
	await mutate((draft) => {
		draft.journalEntries = draft.journalEntries.filter((e) => e.id !== id);
	});
}

/**
 * Returns the existing entry for `date`, or creates one (optionally pre-populated
 * with `defaultLines`) and returns it.
 */
export async function getOrCreateEntry(
	date: string,
	defaultLines: JournalLine[] = []
): Promise<JournalEntry> {
	return mutate((draft) => {
		const existing = draft.journalEntries.find((e) => e.date === date);
		if (existing) return existing;
		const ts = nowIso();
		const entry: JournalEntry = {
			id: uuid(),
			date,
			lines: defaultLines.map((l) => ({ ...l })),
			createdAt: ts,
			updatedAt: ts
		};
		draft.journalEntries.push(entry);
		return entry;
	});
}

// ── Cost To Move ──────────────────────────────────────────

export async function getCostToMove(): Promise<CostToMoveState> {
	return mutate((draft) => {
		draft.costToMove ??= defaultCostToMoveState();
		return draft.costToMove;
	});
}

export async function saveCostToMove(state: CostToMoveState): Promise<void> {
	await mutate((draft) => {
		draft.costToMove = { ...state, id: 'singleton' };
	});
}

// ── Export / import ───────────────────────────────────────

export async function exportAll(): Promise<ExportEnvelope> {
	return toEnvelope(getSnapshot());
}

export async function clearAllData(): Promise<void> {
	await mutate((draft) => {
		draft.items = [];
		draft.homes = [];
		draft.journalEntries = [];
		draft.costToMove = null;
	});
}

/** 'replace' discards everything stored; 'merge' keeps both sides (see planMerge). */
export type ImportMode = 'replace' | 'merge';

/** What a merge of `data` would do, for confirmation UI. Read-only. */
export async function previewMerge(data: ExportEnvelope): Promise<MergeSummary> {
	return planMerge(getSnapshot(), normalize(data)).summary;
}

function normalize(data: ExportEnvelope): Snapshot {
	return {
		items: data.items,
		homes: data.homes ?? [],
		journalEntries: data.journalEntries,
		costToMove: data.costToMove
	};
}

export async function importAll(data: ExportEnvelope, mode: ImportMode = 'replace'): Promise<void> {
	await mutate((draft) => {
		const next = mode === 'merge' ? planMerge(draft, normalize(data)) : normalize(data);
		draft.items = next.items;
		draft.homes = next.homes;
		draft.journalEntries = next.journalEntries;
		draft.costToMove = next.costToMove;
	});
}
