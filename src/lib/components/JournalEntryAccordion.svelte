<script lang="ts">
	import type { Item, JournalEntry, JournalLine, LineKind } from '$lib/db/types';
	import { allItems } from '$lib/stores/items';
	import { deleteEntry, getPriorEntry, upsertEntry } from '$lib/db/repo';
	import JournalLineRow from '$lib/components/JournalLineRow.svelte';
	import ItemPicker from '$lib/components/ItemPicker.svelte';
	import { networthSeries } from '$lib/calc/networth';
	import { formatCurrency } from '$lib/format';

	interface Props {
		entry: JournalEntry;
		open: boolean;
	}

	let { entry, open = $bindable() }: Props = $props();

	let lines = $state<JournalLine[]>([]);
	let savedAt = $state<Date | null>(null);
	let pickerState = $state<{ kind: LineKind; parentId?: string } | null>(null);

	// Initialize once and re-sync if the entry id changes (e.g., import)
	let lastEntryId = $state('');
	$effect(() => {
		if (entry.id !== lastEntryId) {
			lines = entry.lines.map((l) => ({ ...l }));
			lastEntryId = entry.id;
		}
	});

	const itemsById = $derived(new Map($allItems.map((i) => [i.id, i])));
	const linesWithItems = $derived(lines.map((l) => ({ line: l, item: itemsById.get(l.itemId) })));

	const headerPoint = $derived(networthSeries([{ ...entry, lines }], $allItems)[0]);

	const assetTotal = $derived(headerPoint?.assetTotal ?? 0);
	const liabilityTotal = $derived(headerPoint?.liabilityTotal ?? 0);
	const netWorth = $derived(headerPoint?.value ?? 0);

	type LineWithItem = { line: JournalLine; item: Item | undefined };
	type Group = {
		key: string;
		parent: Item | null;
		parentLine: LineWithItem | undefined;
		children: LineWithItem[];
	};

	function buildGroups(kind: LineKind): Group[] {
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

	const assetGroups = $derived(buildGroups('asset'));
	const liabilityGroups = $derived(buildGroups('liability'));

	// Serialize writes so two rapid persists (e.g. pickItem then blur-commit) can't
	// race each other and leave the DB with the earlier snapshot.
	let persistQueue: Promise<unknown> = Promise.resolve();

	function persist(): Promise<void> {
		const snapshot = lines.map((l) => ({ ...l }));
		const next = persistQueue.then(async () => {
			await upsertEntry(entry.date, snapshot);
			savedAt = new Date();
		});
		persistQueue = next.catch((err) => {
			console.error('Failed to persist journal entry', err);
		});
		return next;
	}

	function commitAmount(itemId: string, amount: number) {
		lines = lines.map((l) => (l.itemId === itemId ? { ...l, amount } : l));
		void persist();
	}

	function removeLine(itemId: string) {
		lines = lines.filter((l) => l.itemId !== itemId);
		void persist();
	}

	function pickItem(item: Item) {
		if (!lines.some((l) => l.itemId === item.id)) {
			lines = [...lines, { itemId: item.id, amount: 0 }];
			void persist();
		}
		pickerState = null;
	}

	async function carryOver() {
		const prior = await getPriorEntry(entry.date);
		if (!prior) return;
		lines = prior.lines.map((l) => ({ itemId: l.itemId, amount: l.amount }));
		await persist();
	}

	async function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		if (!confirm(`Delete the journal entry for ${entry.date}?`)) return;
		await deleteEntry(entry.id);
	}
</script>

{#snippet section(kind: LineKind, groups: Group[], total: number)}
	{@const isAsset = kind === 'asset'}
	<div class="rounded-box bg-base-200 p-3">
		<header class="mb-2 flex items-center justify-between">
			<strong>{isAsset ? 'Assets' : 'Liabilities'}</strong>
			<span class="num text-sm" class:text-success={isAsset} class:text-error={!isAsset}>
				{formatCurrency(total)}
			</span>
		</header>

		{#each groups as group (group.key)}
			<div class="mb-2">
				{#if group.parentLine?.item}
					<JournalLineRow
						item={group.parentLine.item}
						amount={group.parentLine.line.amount}
						onCommit={(amt) => commitAmount(group.parentLine!.line.itemId, amt)}
						onRemove={() => removeLine(group.parentLine!.line.itemId)}
					/>
				{:else if group.parent}
					<div class="px-1 py-1 text-sm font-medium text-base-content/70">
						{group.parent.name}
						<span class="ml-1 text-xs text-base-content/40">(group)</span>
					</div>
				{/if}

				{#if group.children.length > 0}
					<div class="ml-4 border-l-2 border-base-300 pl-3">
						{#each group.children as child (child.line.itemId)}
							{#if child.item}
								<JournalLineRow
									item={child.item}
									amount={child.line.amount}
									onCommit={(amt) => commitAmount(child.line.itemId, amt)}
									onRemove={() => removeLine(child.line.itemId)}
								/>
							{/if}
						{/each}
					</div>
				{/if}

				{#if group.parent && !group.parent.parentId && !group.parent.archivedAt}
					<button
						type="button"
						class="btn mt-1 ml-4 text-base-content/60 btn-ghost btn-xs"
						onclick={() => (pickerState = { kind, parentId: group.parent!.id })}
					>
						+ Sub-{kind} under {group.parent.name}
					</button>
				{/if}
			</div>
		{/each}

		{#if pickerState?.kind === kind}
			<ItemPicker
				{kind}
				excludeIds={lines.map((l) => l.itemId)}
				defaultParentId={pickerState.parentId}
				onPick={pickItem}
				onCancel={() => (pickerState = null)}
			/>
		{:else}
			<button
				type="button"
				class="btn mt-2 w-full btn-outline btn-sm"
				onclick={() => (pickerState = { kind })}
			>
				+ Add {kind}
			</button>
		{/if}
	</div>
{/snippet}

<div id="entry-{entry.id}" class="collapse-arrow collapse border border-base-300 bg-base-100">
	<input type="checkbox" bind:checked={open} aria-label="Toggle entry for {entry.date}" />
	<div class="collapse-title flex items-center gap-3 pr-12">
		<div class="flex-1">
			<div class="num font-medium">{entry.date}</div>
			<div class="text-xs text-base-content/60">
				{lines.length} item{lines.length === 1 ? '' : 's'}
			</div>
		</div>
		<div class="flex gap-4 text-right text-xs">
			<div>
				<div class="text-base-content/50 uppercase">Assets</div>
				<div class="num text-success">{formatCurrency(assetTotal)}</div>
			</div>
			<div>
				<div class="text-base-content/50 uppercase">Liabilities</div>
				<div class="num text-error">{formatCurrency(liabilityTotal)}</div>
			</div>
			<div>
				<div class="text-base-content/50 uppercase">Net</div>
				<div class="num font-semibold">{formatCurrency(netWorth)}</div>
			</div>
		</div>
	</div>
	<div class="collapse-content space-y-3">
		<div class="flex items-center justify-end gap-2">
			{#if savedAt}
				<span class="badge badge-sm badge-success">saved ✓</span>
			{/if}
			<button type="button" class="btn btn-outline btn-xs btn-error" onclick={handleDelete}>
				Delete entry
			</button>
		</div>

		{#if lines.length === 0}
			<div class="alert">
				<span class="text-sm">No lines yet.</span>
				<button type="button" class="btn btn-xs btn-primary" onclick={carryOver}>
					Carry over from previous entry
				</button>
				<span class="text-xs text-base-content/60">or add items below.</span>
			</div>
		{/if}

		<div class="grid gap-3 md:grid-cols-2">
			{@render section('asset', assetGroups, assetTotal)}
			{@render section('liability', liabilityGroups, liabilityTotal)}
		</div>
	</div>
</div>
