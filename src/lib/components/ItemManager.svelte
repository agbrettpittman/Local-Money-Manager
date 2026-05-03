<script lang="ts">
	import { allItems } from '$lib/stores/items';
	import { archiveItem, deleteItem, previewDeleteItem, unarchiveItem } from '$lib/db/repo';
	import type { Item } from '$lib/db/types';

	const manageable = $derived(
		[...$allItems]
			.filter((i) => !i.homeId)
			.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
				return a.name.localeCompare(b.name);
			})
	);

	const itemsById = $derived(new Map($allItems.map((i) => [i.id, i])));

	function parentName(item: Item): string | null {
		if (!item.parentId) return null;
		return itemsById.get(item.parentId)?.name ?? null;
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
					{@const parent = parentName(item)}
					<li class="flex items-center gap-2 py-2">
						<span
							class="badge badge-sm"
							class:badge-success={item.kind === 'asset'}
							class:badge-error={item.kind === 'liability'}
						>
							{item.kind}
						</span>
						<span class="flex-1 truncate text-sm">
							{#if parent}
								<span class="text-base-content/60">{parent} ›</span>
							{/if}
							{item.name}
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
						<button
							type="button"
							class="btn btn-outline btn-xs btn-error"
							onclick={() => handleDelete(item)}
						>
							Delete
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</details>
