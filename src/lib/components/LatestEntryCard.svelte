<script lang="ts">
	import type { Item, JournalEntry, LineKind } from '$lib/db/types';
	import { networthSeries } from '$lib/calc/networth';
	import { buildGroups, childTotal, priorChildTotal, type Group } from '$lib/calc/groups';
	import { formatCurrency } from '$lib/format';
	import JournalLineRow from '$lib/components/JournalLineRow.svelte';

	interface Props {
		entry: JournalEntry;
		/** The entry immediately before this one, for trend colouring. */
		prior?: JournalEntry;
		items: Item[];
	}

	let { entry, prior, items }: Props = $props();

	const point = $derived(networthSeries([entry], items)[0]);
	const assetTotal = $derived(point?.assetTotal ?? 0);
	const liabilityTotal = $derived(point?.liabilityTotal ?? 0);
	const netWorth = $derived(point?.value ?? 0);

	const priorAmountByItem = $derived(
		new Map((prior?.lines ?? []).map((l) => [l.itemId, l.amount]))
	);

	const assetGroups = $derived(buildGroups(entry.lines, items, 'asset'));
	const liabilityGroups = $derived(buildGroups(entry.lines, items, 'liability'));
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
						readonly
					/>
				{/if}

				{#if group.children.length > 0}
					<div class="ml-4 border-l-2 border-base-300 pl-3">
						{#each group.children as child (child.line.itemId)}
							{#if child.item}
								<JournalLineRow
									item={child.item}
									amount={child.line.amount}
									priorAmount={priorAmountByItem.get(child.line.itemId)}
									readonly
								/>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<p class="px-1 py-1 text-sm text-base-content/50">None.</p>
		{/each}
	</div>
{/snippet}

<div class="card bg-base-100 shadow-sm">
	<div class="card-body gap-3">
		<header class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Latest entry</h2>
				<p class="num text-sm text-base-content/60">{entry.date}</p>
			</div>
			<div class="flex items-center gap-4 text-right text-xs">
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
		</header>

		{#if entry.notes?.trim()}
			<p class="rounded-box bg-base-200 px-3 py-2 text-sm text-base-content/80 italic">
				{entry.notes}
			</p>
		{/if}

		<div class="grid gap-3 md:grid-cols-2">
			{@render section('asset', assetGroups, assetTotal)}
			{@render section('liability', liabilityGroups, liabilityTotal)}
		</div>

		<div class="flex justify-end">
			<a href="/journal" class="link text-sm">View in journal →</a>
		</div>
	</div>
</div>
