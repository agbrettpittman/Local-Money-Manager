<script lang="ts">
	import type { Item, JournalEntry, JournalLine, LineKind } from '$lib/db/types';
	import { allItems } from '$lib/stores/items';
	import { entriesByDate } from '$lib/stores/entries';
	import { deleteEntry, getPriorEntry, upsertEntry } from '$lib/db/repo';
	import JournalLineRow from '$lib/components/JournalLineRow.svelte';
	import ItemPicker from '$lib/components/ItemPicker.svelte';
	import { networthSeries } from '$lib/calc/networth';
	import {
		buildGroups,
		childTotal,
		containerParentIds,
		priorChildTotal,
		type Group
	} from '$lib/calc/groups';
	import { formatCurrency } from '$lib/format';

	interface Props {
		entry: JournalEntry;
		open: boolean;
	}

	let { entry, open = $bindable() }: Props = $props();

	let lines = $state<JournalLine[]>([]);
	let notes = $state('');
	let savedAt = $state<Date | null>(null);
	let pickerState = $state<{ kind: LineKind; parentId?: string } | null>(null);

	// Initialize once and re-sync if the entry id changes (e.g., import)
	let lastEntryId = $state('');
	$effect(() => {
		if (entry.id !== lastEntryId) {
			lines = entry.lines.map((l) => ({ ...l }));
			notes = entry.notes ?? '';
			lastEntryId = entry.id;
		}
	});

	const itemsById = $derived(new Map($allItems.map((i) => [i.id, i])));

	// The most recent entry dated before this one — used to colour each line by trend.
	const priorEntry = $derived.by(() => {
		let prior: JournalEntry | undefined;
		for (const e of $entriesByDate) {
			if (e.date < entry.date) prior = e;
			else break;
		}
		return prior;
	});
	const priorAmountByItem = $derived(
		new Map((priorEntry?.lines ?? []).map((l) => [l.itemId, l.amount]))
	);

	const headerPoint = $derived(networthSeries([{ ...entry, lines }], $allItems)[0]);

	const assetTotal = $derived(headerPoint?.assetTotal ?? 0);
	const liabilityTotal = $derived(headerPoint?.liabilityTotal ?? 0);
	const netWorth = $derived(headerPoint?.value ?? 0);

	// Net change versus the prior entry; 0 when there is no prior entry.
	const priorPoint = $derived(priorEntry ? networthSeries([priorEntry], $allItems)[0] : undefined);
	const netChange = $derived(priorPoint ? netWorth - (priorPoint.value ?? 0) : 0);

	const assetGroups = $derived(buildGroups(lines, $allItems, 'asset'));
	const liabilityGroups = $derived(buildGroups(lines, $allItems, 'liability'));

	// Replace each container parent's amount with the sum of its children before
	// persisting, so the stored value matches what's shown and stays self-consistent.
	function normalizedLines(): JournalLine[] {
		const containers = containerParentIds(lines, $allItems);
		if (containers.size === 0) return lines;
		const totals: Record<string, number> = {};
		for (const l of lines) {
			const parentId = itemsById.get(l.itemId)?.parentId;
			if (parentId && containers.has(parentId)) {
				totals[parentId] = (totals[parentId] ?? 0) + l.amount;
			}
		}
		return lines.map((l) =>
			containers.has(l.itemId) ? { ...l, amount: totals[l.itemId] ?? 0 } : l
		);
	}

	// Serialize writes so two rapid persists (e.g. pickItem then blur-commit) can't
	// race each other and leave the DB with the earlier snapshot.
	let persistQueue: Promise<unknown> = Promise.resolve();

	function persist(): Promise<void> {
		const snapshot = normalizedLines().map((l) => ({ ...l }));
		const noteSnapshot = notes.trim() || undefined;
		const next = persistQueue.then(async () => {
			await upsertEntry(entry.date, snapshot, noteSnapshot);
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

	function commitNotes() {
		if ((notes.trim() || undefined) !== (entry.notes ?? undefined)) void persist();
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
				{#if group.children.length > 0 && group.parent}
					<JournalLineRow
						item={group.parent}
						amount={childTotal(group)}
						priorAmount={priorChildTotal(group, priorAmountByItem)}
						readonly
						auto
					/>
				{:else if group.parentLine?.item}
					<JournalLineRow
						item={group.parentLine.item}
						amount={group.parentLine.line.amount}
						priorAmount={priorAmountByItem.get(group.parentLine.line.itemId)}
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
									priorAmount={priorAmountByItem.get(child.line.itemId)}
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
			<div class="num flex items-center gap-1.5 font-medium">
				{entry.date}
				{#if notes.trim()}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-base-content/40"
						aria-label="Has a comment"
					>
						<title>{notes}</title>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
					</svg>
				{/if}
			</div>
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
			<div>
				<div class="text-base-content/50 uppercase">Change</div>
				<div
					class="num font-semibold"
					class:text-success={netChange > 0}
					class:text-error={netChange < 0}
				>
					{netChange > 0 ? '+' : ''}{formatCurrency(netChange)}
				</div>
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
			<div class="rounded-box bg-base-200 p-3 md:col-span-2">
				<header class="mb-2 flex items-center justify-between">
					<strong>Comment</strong>
				</header>
				<textarea
					class="textarea-bordered textarea w-full bg-base-100 textarea-sm"
					rows="2"
					placeholder="Add a note about this entry…"
					bind:value={notes}
					onblur={commitNotes}
				></textarea>
			</div>
			{@render section('asset', assetGroups, assetTotal)}
			{@render section('liability', liabilityGroups, liabilityTotal)}
		</div>
	</div>
</div>
