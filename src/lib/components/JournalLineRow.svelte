<script lang="ts">
	import type { Item } from '$lib/db/types';
	import { formatCurrency } from '$lib/format';
	import MoneyInput from './MoneyInput.svelte';

	interface Props {
		item: Item;
		amount: number;
		/** Same item's amount in the previous journal entry, if any, for trend colouring. */
		priorAmount?: number;
		onCommit: (amount: number) => void;
		onRemove: () => void;
	}

	let { item, amount, priorAmount, onCommit, onRemove }: Props = $props();

	// Colour the value relative to the prior entry: better for net worth is green.
	// For assets that means a higher value; for liabilities, a lower one.
	const trend = $derived.by(() => {
		if (priorAmount === undefined || amount === priorAmount) return null;
		const higher = amount > priorAmount;
		const good = item.kind === 'asset' ? higher : !higher;
		const delta = amount - priorAmount;
		return {
			higher,
			tone: good ? 'text-success' : 'text-error',
			label: `${delta > 0 ? '+' : ''}${formatCurrency(delta)} vs previous entry`
		};
	});
</script>

<div class="flex items-center gap-2 py-1">
	<span class="flex-1 truncate text-sm">
		{item.name}
		{#if item.archivedAt}
			<span class="badge badge-ghost badge-xs">archived</span>
		{/if}
	</span>
	{#if trend}
		<span class="{trend.tone} text-xs leading-none" title={trend.label} aria-hidden="true">
			{trend.higher ? '▲' : '▼'}
		</span>
	{/if}
	<div class="w-32">
		<MoneyInput
			value={amount}
			{onCommit}
			ariaLabel="{item.name} amount"
			toneClass={trend?.tone ?? ''}
		/>
	</div>
	<button
		type="button"
		class="btn btn-square btn-ghost btn-sm"
		aria-label="Remove {item.name}"
		onclick={onRemove}
	>
		✕
	</button>
</div>
