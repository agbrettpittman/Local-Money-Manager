<script lang="ts">
	import type { Item } from '$lib/db/types';
	import MoneyInput from './MoneyInput.svelte';

	interface Props {
		item: Item;
		amount: number;
		onCommit: (amount: number) => void;
		onRemove: () => void;
	}

	let { item, amount, onCommit, onRemove }: Props = $props();
</script>

<div class="flex items-center gap-2 py-1">
	<span class="flex-1 truncate text-sm">
		{item.name}
		{#if item.archivedAt}
			<span class="badge badge-ghost badge-xs">archived</span>
		{/if}
	</span>
	<div class="w-32">
		<MoneyInput value={amount} {onCommit} ariaLabel="{item.name} amount" />
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
