<script lang="ts">
	import type { Item } from '$lib/db/types';
	import { formatCurrency } from '$lib/format';
	import MoneyInput from './MoneyInput.svelte';

	interface Props {
		item: Item;
		amount: number;
		/** Same item's amount in the previous journal entry, if any, for trend colouring. */
		priorAmount?: number;
		/** Render the value as static text — no input, no remove (e.g. group totals or a read-only view). */
		readonly?: boolean;
		/** Mark the value as auto-calculated from child items (shows an "(auto)" hint). */
		auto?: boolean;
		onCommit?: (amount: number) => void;
		onRemove?: () => void;
	}

	let {
		item,
		amount,
		priorAmount,
		readonly = false,
		auto = false,
		onCommit,
		onRemove
	}: Props = $props();

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
		{#if auto}
			<span class="ml-1 text-xs text-base-content/40" title="Auto-calculated from the items below"
				>(auto)</span
			>
		{/if}
		{#if item.archivedAt}
			<span class="badge badge-ghost badge-xs">archived</span>
		{/if}
	</span>
	{#if trend}
		<span class="{trend.tone} text-xs leading-none" title={trend.label} aria-hidden="true">
			{trend.higher ? '▲' : '▼'}
		</span>
	{/if}
	{#if readonly}
		<div class="num w-32 px-3 text-right text-sm font-medium {trend?.tone ?? ''}">
			{formatCurrency(amount)}
		</div>
		<div class="w-8 shrink-0" aria-hidden="true"></div>
	{:else}
		<div class="w-32">
			<MoneyInput
				value={amount}
				onCommit={(v) => onCommit?.(v)}
				ariaLabel="{item.name} amount"
				toneClass={trend?.tone ?? ''}
			/>
		</div>
		<button
			type="button"
			class="btn btn-square btn-ghost btn-sm"
			aria-label="Remove {item.name}"
			onclick={() => onRemove?.()}
		>
			✕
		</button>
	{/if}
</div>
