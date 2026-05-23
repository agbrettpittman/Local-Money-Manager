import type { Item, JournalLine, LineKind } from '$lib/db/types';

/**
 * Within a single entry, a parent item acts as a group container when it has at
 * least one child line present. Its own amount is then derived (the sum of its
 * children) and must be excluded from totals to avoid double-counting.
 */
export function containerParentIds(lines: JournalLine[], items: Item[]): Set<string> {
	const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
	const containers = new Set<string>();
	for (const line of lines) {
		const parentId = parentOf.get(line.itemId);
		if (parentId) containers.add(parentId);
	}
	return containers;
}

export type LineWithItem = { line: JournalLine; item: Item | undefined };

export type Group = {
	key: string;
	parent: Item | null;
	parentLine: LineWithItem | undefined;
	children: LineWithItem[];
};

/**
 * Group an entry's lines of a single kind into parent containers with their
 * children, sorted alphabetically. Shared by the journal editor and the
 * dashboard's read-only latest-entry view.
 */
export function buildGroups(lines: JournalLine[], items: Item[], kind: LineKind): Group[] {
	const itemsById = new Map(items.map((i) => [i.id, i]));
	const linesWithItems: LineWithItem[] = lines.map((l) => ({
		line: l,
		item: itemsById.get(l.itemId)
	}));
	const filtered = linesWithItems.filter((p) => p.item?.kind === kind);
	const groupsByKey: Record<string, Group> = {};

	for (const lwi of filtered) {
		const item = lwi.item!;
		if (item.parentId) {
			const key = item.parentId;
			if (!groupsByKey[key]) {
				groupsByKey[key] = {
					key,
					parent: itemsById.get(key) ?? null,
					parentLine: undefined,
					children: []
				};
			}
			groupsByKey[key].children.push(lwi);
		} else {
			const key = item.id;
			if (!groupsByKey[key]) {
				groupsByKey[key] = { key, parent: item, parentLine: lwi, children: [] };
			} else {
				groupsByKey[key].parentLine = lwi;
				if (!groupsByKey[key].parent) groupsByKey[key].parent = item;
			}
		}
	}

	return Object.values(groupsByKey)
		.map((g) => ({
			...g,
			children: g.children
				.slice()
				.sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? ''))
		}))
		.sort((a, b) => (a.parent?.name ?? '~').localeCompare(b.parent?.name ?? '~'));
}

/** A group with children is a container: its value is the sum of its children. */
export function childTotal(group: Group): number {
	return group.children.reduce((sum, c) => sum + c.line.amount, 0);
}

/** Prior total for trend colouring — undefined when no child had a prior amount. */
export function priorChildTotal(
	group: Group,
	priorAmountByItem: Map<string, number>
): number | undefined {
	const vals = group.children
		.map((c) => priorAmountByItem.get(c.line.itemId))
		.filter((v): v is number => v !== undefined);
	return vals.length ? vals.reduce((sum, v) => sum + v, 0) : undefined;
}
