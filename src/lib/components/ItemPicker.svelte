<script lang="ts">
	import type { Item, LineKind } from '$lib/db/types';
	import { activeItems } from '$lib/stores/items';

	interface Props {
		kind: LineKind;
		excludeIds?: string[];
		/** Pre-select a parent for "+ Sub-{kind}" flows. */
		defaultParentId?: string;
		onPick: (item: Item) => void;
		onCancel: () => void;
	}

	let { kind, excludeIds = [], defaultParentId, onPick, onCancel }: Props = $props();

	let query = $state('');

	const candidates = $derived(
		$activeItems
			.filter((i) => i.kind === kind && !excludeIds.includes(i.id))
			.filter((i) => (defaultParentId ? i.parentId === defaultParentId : true))
			.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
	);

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="card bg-base-200 shadow-sm card-sm">
	<div class="card-body gap-2 p-3">
		<input
			type="text"
			bind:value={query}
			placeholder="Search {kind}s..."
			aria-label="Search {kind}s"
			class="input input-sm w-full"
		/>
		{#if candidates.length > 0}
			<ul class="menu max-h-48 w-full overflow-y-auto menu-sm rounded bg-base-100">
				{#each candidates as item (item.id)}
					{@const parent = item.parentId ? $activeItems.find((p) => p.id === item.parentId) : null}
					<li>
						<button type="button" onclick={() => onPick(item)}>
							{#if parent}
								<span class="text-base-content/60">{parent.name} ›</span>
							{/if}
							{item.name}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-base-content/60">
				{#if query.trim()}
					No matching {kind}s.
				{:else}
					No more {kind}s available — manage them in
					<a href="/assets-and-liabilities" class="link">Assets &amp; Liabilities</a>.
				{/if}
			</p>
		{/if}
		<button type="button" class="btn ml-auto btn-ghost btn-xs" onclick={onCancel}>Cancel</button>
	</div>
</div>
