import { v4 as uuid } from 'uuid';
import { db } from './schema';
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

const nowIso = () => new Date().toISOString();

// ── Items ──────────────────────────────────────────────────

export async function listActiveItems(): Promise<Item[]> {
	const items = await db.items.toArray();
	return items.filter((i) => !i.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllItems(): Promise<Item[]> {
	return db.items.toArray();
}

export async function createItem(name: string, kind: LineKind, parentId?: string): Promise<Item> {
	if (parentId) {
		const parent = await db.items.get(parentId);
		if (!parent) throw new Error(`Parent item ${parentId} not found`);
		if (parent.kind !== kind)
			throw new Error(`Parent kind (${parent.kind}) does not match new item kind (${kind})`);
		if (parent.parentId)
			throw new Error('Cannot nest under a sub-item — only one level of hierarchy is supported');
		if (parent.homeId) throw new Error('Cannot add sub-items under a home-managed item');
	}
	const item: Item = { id: uuid(), name, kind, createdAt: nowIso(), parentId };
	await db.items.add(item);
	return item;
}

export async function renameItem(id: string, name: string): Promise<void> {
	await db.items.update(id, { name });
}

export async function archiveItem(id: string): Promise<void> {
	await db.items.update(id, { archivedAt: nowIso() });
}

export async function unarchiveItem(id: string): Promise<void> {
	const item = await db.items.get(id);
	if (!item) return;
	const next: Partial<Item> = { archivedAt: undefined };
	await db.items.update(id, next);
	// Dexie's update with undefined doesn't always remove; force put if needed.
	if ((await db.items.get(id))?.archivedAt) {
		const cleaned = { ...item } as Item;
		delete cleaned.archivedAt;
		await db.items.put(cleaned);
	}
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
	const entries = await db.journalEntries.toArray();
	let entriesAffected = 0;
	let linesRemoved = 0;
	for (const entry of entries) {
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
	const item = await db.items.get(id);
	if (!item) return { entriesAffected: 0, linesRemoved: 0 };
	if (item.homeId) {
		throw new Error('This item is managed by a Home — archive the home instead.');
	}

	const all = await db.items.toArray();
	const children = all.filter((i) => i.parentId === id);
	if (children.length > 0) {
		throw new Error(
			`Cannot delete: this item has ${children.length} sub-item${children.length === 1 ? '' : 's'}. Delete or reparent them first.`
		);
	}

	const ts = nowIso();
	let entriesAffected = 0;
	let linesRemoved = 0;

	await db.transaction('rw', [db.items, db.journalEntries, db.costToMove], async () => {
		const entries = await db.journalEntries.toArray();
		for (const entry of entries) {
			const filtered = entry.lines.filter((l) => l.itemId !== id);
			if (filtered.length !== entry.lines.length) {
				entriesAffected += 1;
				linesRemoved += entry.lines.length - filtered.length;
				await db.journalEntries.put({ ...entry, lines: filtered, updatedAt: ts });
			}
		}

		const ctm = await db.costToMove.get('singleton');
		if (ctm) {
			let changed = false;
			const next: CostToMoveState = { ...ctm };
			if (id in next.assetSelections) {
				next.assetSelections = { ...next.assetSelections };
				delete next.assetSelections[id];
				changed = true;
			}
			if (id in next.expenseSelections) {
				next.expenseSelections = { ...next.expenseSelections };
				delete next.expenseSelections[id];
				changed = true;
			}
			if (changed) await db.costToMove.put(next);
		}

		await db.items.delete(id);
	});

	return { entriesAffected, linesRemoved };
}

// ── Homes ──────────────────────────────────────────────────

export async function listAllHomes(): Promise<Home[]> {
	return db.homes.toArray();
}

export async function listActiveHomes(): Promise<Home[]> {
	const homes = await db.homes.toArray();
	return homes.filter((h) => !h.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export interface CreateHomeInput {
	name: string;
	sellingCostPercent: number;
	mortgageRate: number;
	mortgageYears: number;
	mortgageStartDate?: string;
}

export async function createHome(input: CreateHomeInput): Promise<Home> {
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

	await db.transaction('rw', [db.items, db.homes], async () => {
		await db.items.bulkAdd([valueItem, mortgageItem]);
		await db.homes.add(home);
	});
	return home;
}

export async function updateHome(
	id: string,
	patch: Partial<Omit<Home, 'id' | 'valueItemId' | 'mortgageItemId' | 'createdAt'>>
): Promise<void> {
	const home = await db.homes.get(id);
	if (!home) throw new Error(`Home ${id} not found`);

	await db.transaction('rw', [db.items, db.homes], async () => {
		if (patch.name !== undefined && patch.name !== home.name) {
			await db.items.update(home.valueItemId, { name: patch.name });
			await db.items.update(home.mortgageItemId, { name: `${patch.name} Mortgage` });
		}
		await db.homes.update(id, patch);
	});
}

export async function archiveHome(id: string): Promise<void> {
	const home = await db.homes.get(id);
	if (!home) return;
	const ts = nowIso();
	await db.transaction('rw', [db.items, db.homes], async () => {
		await db.items.update(home.valueItemId, { archivedAt: ts });
		await db.items.update(home.mortgageItemId, { archivedAt: ts });
		await db.homes.update(id, { archivedAt: ts });
	});
}

export async function unarchiveHome(id: string): Promise<void> {
	const home = await db.homes.get(id);
	if (!home) return;
	await db.transaction('rw', [db.items, db.homes], async () => {
		for (const itemId of [home.valueItemId, home.mortgageItemId]) {
			const item = await db.items.get(itemId);
			if (item && item.archivedAt) {
				const cleaned = { ...item };
				delete cleaned.archivedAt;
				await db.items.put(cleaned);
			}
		}
		const cleaned = { ...home };
		delete cleaned.archivedAt;
		await db.homes.put(cleaned);
	});
}

// ── Journal entries ────────────────────────────────────────

export async function listEntries(): Promise<JournalEntry[]> {
	const entries = await db.journalEntries.toArray();
	return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEntryByDate(date: string): Promise<JournalEntry | undefined> {
	return db.journalEntries.where('date').equals(date).first();
}

export async function getPriorEntry(date: string): Promise<JournalEntry | undefined> {
	const entries = await db.journalEntries.where('date').below(date).toArray();
	if (entries.length === 0) return undefined;
	return entries.reduce((latest, e) => (e.date > latest.date ? e : latest));
}

export async function upsertEntry(
	date: string,
	lines: JournalLine[],
	notes?: string
): Promise<JournalEntry> {
	const existing = await getEntryByDate(date);
	const ts = nowIso();
	if (existing) {
		const updated: JournalEntry = { ...existing, lines, notes, updatedAt: ts };
		await db.journalEntries.put(updated);
		return updated;
	}
	const entry: JournalEntry = {
		id: uuid(),
		date,
		lines,
		notes,
		createdAt: ts,
		updatedAt: ts
	};
	await db.journalEntries.add(entry);
	return entry;
}

export async function deleteEntry(id: string): Promise<void> {
	await db.journalEntries.delete(id);
}

/**
 * Returns the existing entry for `date`, or creates an empty one and returns it.
 * Always reads the DB (not a store), so it is safe to call before liveQuery has
 * emitted — preventing accidental overwrites of persisted entries.
 */
export async function getOrCreateEntry(date: string): Promise<JournalEntry> {
	const existing = await getEntryByDate(date);
	if (existing) return existing;
	const ts = nowIso();
	const entry: JournalEntry = {
		id: uuid(),
		date,
		lines: [],
		createdAt: ts,
		updatedAt: ts
	};
	await db.journalEntries.add(entry);
	return entry;
}

// ── Cost To Move ──────────────────────────────────────────

export async function getCostToMove(): Promise<CostToMoveState> {
	const existing = await db.costToMove.get('singleton');
	if (existing) return existing;
	const fresh = defaultCostToMoveState();
	await db.costToMove.put(fresh);
	return fresh;
}

export async function saveCostToMove(state: CostToMoveState): Promise<void> {
	await db.costToMove.put({ ...state, id: 'singleton' });
}

// ── Export / import ───────────────────────────────────────

export async function exportAll(): Promise<ExportEnvelope> {
	const [items, homes, journalEntries, costToMove] = await Promise.all([
		db.items.toArray(),
		db.homes.toArray(),
		db.journalEntries.toArray(),
		db.costToMove.get('singleton')
	]);
	return {
		version: 1,
		exportedAt: nowIso(),
		items,
		homes,
		journalEntries,
		costToMove: costToMove ?? null
	};
}

export async function clearAllData(): Promise<void> {
	await db.transaction('rw', [db.items, db.homes, db.journalEntries, db.costToMove], async () => {
		await db.items.clear();
		await db.homes.clear();
		await db.journalEntries.clear();
		await db.costToMove.clear();
	});
}

export async function importAll(data: ExportEnvelope): Promise<void> {
	await db.transaction('rw', [db.items, db.homes, db.journalEntries, db.costToMove], async () => {
		await db.items.clear();
		await db.homes.clear();
		await db.journalEntries.clear();
		await db.costToMove.clear();
		if (data.items.length) await db.items.bulkAdd(data.items);
		if (data.homes?.length) await db.homes.bulkAdd(data.homes);
		if (data.journalEntries.length) await db.journalEntries.bulkAdd(data.journalEntries);
		if (data.costToMove) await db.costToMove.put({ ...data.costToMove, id: 'singleton' });
	});
}
