<script lang="ts">
	import { importAll, previewMerge } from '$lib/db/repo';
	import { exportEnvelopeSchema } from '$lib/db/exportSchema';
	import { migrateEnvelope } from '$lib/db/migrate';
	import { recordBackup } from '$lib/backup/backup';
	import { allItems } from '$lib/stores/items';
	import { allEntries } from '$lib/stores/entries';
	import { allHomes } from '$lib/stores/homes';
	import type { MergeSummary } from '$lib/db/merge';
	import type { ExportEnvelope } from '$lib/db/types';

	// $state.raw: a deep $state proxy can't be structured-cloned into IndexedDB
	// (DataCloneError). Only whole-object assignment happens here, so raw is enough.
	let pendingImport = $state.raw<ExportEnvelope | null>(null);
	let mergePreview = $state.raw<MergeSummary | null>(null);
	let importError = $state<string | null>(null);
	let busy = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);
	let confirmDialog: HTMLDialogElement | null = $state(null);
	let errorDialog: HTMLDialogElement | null = $state(null);

	/** Opens the file picker. Must be called from a user gesture. */
	export function open() {
		importError = null;
		fileInput?.click();
	}

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const text = await file.text();
			const json = JSON.parse(text);
			const envelope = exportEnvelopeSchema.parse(migrateEnvelope(json));
			mergePreview = await previewMerge(envelope);
			pendingImport = envelope;
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Invalid file';
			errorDialog?.showModal();
		}
	}

	$effect(() => {
		if (pendingImport && confirmDialog && !confirmDialog.open) confirmDialog.showModal();
	});

	async function runImport(mode: 'replace' | 'merge') {
		if (!pendingImport || busy) return;
		busy = true;
		// Whether the file alone accounts for everything stored afterwards. A replace
		// always does; a merge only when there was nothing here to merge into. Anything
		// else leaves data no single file holds, so the backup reminder still applies.
		const fileIsWholeStore =
			mode === 'replace' ||
			($allItems.length === 0 && $allEntries.length === 0 && $allHomes.length === 0);
		try {
			await importAll(pendingImport, mode);
			if (fileIsWholeStore) recordBackup();
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Import failed';
			confirmDialog?.close();
			reset();
			errorDialog?.showModal();
			return;
		} finally {
			busy = false;
		}
		confirmDialog?.close();
		reset();
	}

	function reset() {
		pendingImport = null;
		mergePreview = null;
	}

	function cancelImport() {
		reset();
		confirmDialog?.close();
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="application/json"
	class="hidden"
	onchange={handleFile}
/>

<!-- Import confirmation -->
<dialog bind:this={confirmDialog} class="modal">
	{#if pendingImport}
		<div class="modal-box max-w-lg">
			<h3 class="text-lg font-bold">Import backup</h3>

			<p class="pt-2 text-xs text-base-content/60">This file contains</p>
			<ul class="mt-1 list-inside list-disc rounded-box bg-base-200 p-3 text-sm">
				<li>{pendingImport.items.length} items</li>
				<li>{pendingImport.journalEntries.length} journal entries</li>
				<li>Cost To Move state: {pendingImport.costToMove ? 'included' : 'none'}</li>
				<li class="text-xs text-base-content/60">Exported: {pendingImport.exportedAt}</li>
			</ul>

			{#if mergePreview}
				<p class="pt-4 text-xs text-base-content/60">Merging would</p>
				<ul class="mt-1 list-inside list-disc rounded-box bg-base-200 p-3 text-sm">
					<li>Add {mergePreview.itemsAdded} items and {mergePreview.entriesAdded} entries</li>
					<li>Update {mergePreview.entriesUpdated} entries the file has a newer version of</li>
					<li>Keep {mergePreview.entriesKept} entries that are newer here</li>
					{#if mergePreview.costToMoveIgnored}
						<li class="text-base-content/60">Leave your Cost To Move settings untouched</li>
					{/if}
				</ul>
				{#if mergePreview.duplicateNames.length > 0}
					<div class="mt-3 alert py-2 alert-warning">
						<span class="text-xs">
							{mergePreview.duplicateNames.length} name{mergePreview.duplicateNames.length === 1
								? ''
								: 's'} exist on both sides as separate rows ({mergePreview.duplicateNames
								.slice(0, 3)
								.join(', ')}{mergePreview.duplicateNames.length > 3 ? '…' : ''}). Merging keeps
							both, so their history will be split until you tidy them up.
						</span>
					</div>
				{/if}
			{/if}

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={cancelImport} disabled={busy}>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error"
					onclick={() => runImport('replace')}
					disabled={busy}
				>
					Replace all
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={() => runImport('merge')}
					disabled={busy}
				>
					Merge
				</button>
			</div>
			<p class="pt-1 text-right text-xs text-base-content/50">
				Replace all discards everything currently stored here.
			</p>
		</div>
	{/if}
	<form method="dialog" class="modal-backdrop"><button onclick={cancelImport}>close</button></form>
</dialog>

<!-- Import error -->
<dialog bind:this={errorDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Import failed</h3>
		<pre
			class="mt-2 max-h-48 overflow-y-auto rounded-box bg-base-200 p-3 text-xs whitespace-pre-wrap">{importError}</pre>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Dismiss</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
