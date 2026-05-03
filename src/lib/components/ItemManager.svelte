<script lang="ts">
	import { allItems } from '$lib/stores/items';
	import { archiveItem, deleteItem, previewDeleteItem, unarchiveItem } from '$lib/db/repo';
	import type { Item } from '$lib/db/types';

	const itemsById = $derived(new Map($allItems.map((i) => [i.id, i])));

	const childCountById = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const i of $allItems) {
			if (i.parentId) counts.set(i.parentId, (counts.get(i.parentId) ?? 0) + 1);
		}
		return counts;
	});

	const manageable = $derived(
		[...$allItems]
			.filter((i) => !i.homeId)
			.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
				const groupA = a.parentId ? (itemsById.get(a.parentId)?.name ?? a.name) : a.name;
				const groupB = b.parentId ? (itemsById.get(b.parentId)?.name ?? b.name) : b.name;
				const cmp = groupA.localeCompare(groupB);
				if (cmp !== 0) return cmp;
				// Same group: parent (no parentId) comes before its children.
				if (!a.parentId && b.parentId) return -1;
				if (a.parentId && !b.parentId) return 1;
				return a.name.localeCompare(b.name);
			})
	);

	function childCount(item: Item): number {
		return childCountById.get(item.id) ?? 0;
	}

	async function handleDelete(item: Item) {
		try {
			const preview = await previewDeleteItem(item.id);
			const lines = preview.linesRemoved;
			const entries = preview.entriesAffected;
			let msg = `Permanently delete "${item.name}"?`;
			if (lines > 0) {
				msg += `\n\nThis will also remove ${lines} journal line${lines === 1 ? '' : 's'} across ${entries} entr${entries === 1 ? 'y' : 'ies'}.`;
			}
			msg += '\n\nThis cannot be undone.';
			if (!confirm(msg)) return;
			await deleteItem(item.id);
		} catch (err) {
			alert(err instanceof Error ? err.message : String(err));
		}
	}
</script>

<details class="collapse-arrow collapse border border-base-300 bg-base-100">
	<summary class="collapse-title flex items-center gap-2 font-medium">
		📋 Manage items
		<span class="badge badge-sm">{manageable.length}</span>
	</summary>
	<div class="collapse-content space-y-3">
		<p class="text-sm text-base-content/70">
			Archive items to hide them from pickers (history is preserved). Delete permanently removes the
			item and any journal lines that reference it. Home-managed items are edited in the Homes
			section above.
		</p>

		{#if manageable.length === 0}
			<div class="alert">
				<span>No items yet.</span>
			</div>
		{:else}
			<ul class="divide-y divide-base-200">
				{#each manageable as item (item.id)}
					{@const subCount = childCount(item)}
					{@const canDelete = subCount === 0}
					<li class="flex items-center gap-2 py-2" class:pl-8={!!item.parentId}>
						<span
							class="badge badge-sm"
							class:badge-success={item.kind === 'asset'}
							class:badge-error={item.kind === 'liability'}
						>
							{item.kind}
						</span>
						<span class="flex-1 truncate text-sm">
							{item.name}
							{#if subCount > 0}
								<span class="badge badge-ghost badge-xs">
									{subCount} sub-item{subCount === 1 ? '' : 's'}
								</span>
							{/if}
							{#if item.archivedAt}
								<span class="badge badge-ghost badge-xs">archived</span>
							{/if}
						</span>
						{#if item.archivedAt}
							<button
								type="button"
								class="btn btn-outline btn-xs"
								onclick={() => unarchiveItem(item.id)}
							>
								Unarchive
							</button>
						{:else}
							<button
								type="button"
								class="btn btn-outline btn-xs"
								onclick={() => archiveItem(item.id)}
							>
								Archive
							</button>
						{/if}
						{#if canDelete}
							<button
								type="button"
								class="btn btn-outline btn-xs btn-error"
								onclick={() => handleDelete(item)}
							>
								Delete
							</button>
						{:else}
							<span
								class="tooltip tooltip-left"
								data-tip="Delete or reparent the {subCount} sub-item{subCount === 1
									? ''
									: 's'} first"
							>
								<button type="button" class="btn btn-outline btn-xs" disabled> Delete </button>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</details>
