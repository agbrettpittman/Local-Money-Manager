<script lang="ts">
	import type { Item, LineKind } from '$lib/db/types';
	import { activeItems } from '$lib/stores/items';
	import { createItem } from '$lib/db/repo';

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
	let parentId = $state<string | ''>('');

	// Initialize parentId from prop on first mount and resync if the prop changes.
	let lastDefault = $state<string | undefined>(undefined);
	$effect(() => {
		if (defaultParentId !== lastDefault) {
			parentId = defaultParentId ?? '';
			lastDefault = defaultParentId;
		}
	});

	const candidates = $derived(
		$activeItems
			.filter((i) => i.kind === kind && !excludeIds.includes(i.id))
			.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
	);

	const exactMatch = $derived(
		query.trim().length > 0 &&
			$activeItems.some(
				(i) => i.kind === kind && i.name.toLowerCase() === query.trim().toLowerCase()
			)
	);

	// Possible parents: same kind, not archived, not themselves a child.
	const possibleParents = $derived($activeItems.filter((i) => i.kind === kind && !i.parentId));

	async function createAndPick() {
		const trimmed = query.trim();
		if (!trimmed) return;
		const item = await createItem(trimmed, kind, parentId || undefined);
		onPick(item);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = query.trim();
		if (!trimmed) return;
		// If an item with this exact name already exists, pick it instead of creating.
		const exact = $activeItems.find(
			(i) =>
				i.kind === kind &&
				!excludeIds.includes(i.id) &&
				i.name.toLowerCase() === trimmed.toLowerCase()
		);
		if (exact) {
			onPick(exact);
			return;
		}
		await createAndPick();
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={handleKey} />

<form class="card bg-base-200 shadow-sm card-sm" onsubmit={handleSubmit}>
	<div class="card-body gap-2 p-3">
		<input
			type="text"
			bind:value={query}
			placeholder="Search or create {kind}..."
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
		{/if}
		{#if query.trim() && !exactMatch}
			<div class="space-y-2 rounded border border-dashed border-base-300 p-2">
				<p class="text-xs text-base-content/70">
					Create "<strong>{query.trim()}</strong>"
				</p>
				{#if possibleParents.length > 0}
					<label class="form-control">
						<div class="label py-0">
							<span class="label-text text-xs">Under (optional)</span>
						</div>
						<select
							bind:value={parentId}
							class="select-bordered select w-full select-sm"
							disabled={!!defaultParentId}
						>
							<option value="">— top-level —</option>
							{#each possibleParents as p (p.id)}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</label>
				{/if}
				<button type="submit" class="btn w-full btn-sm btn-primary">+ Create</button>
			</div>
		{/if}
		{#if candidates.length === 0 && !query.trim()}
			<p class="text-sm text-base-content/60">No {kind}s yet — type a name to create one.</p>
		{/if}
		<button type="button" class="btn ml-auto btn-ghost btn-xs" onclick={onCancel}>Cancel</button>
	</div>
</form>
