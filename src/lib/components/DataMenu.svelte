<script lang="ts">
	import { clearAllData, importAll } from '$lib/db/repo';
	import { downloadBackup } from '$lib/backup/backup';
	import { exportEnvelopeSchema } from '$lib/db/exportSchema';
	import { loadDemoData } from '$lib/dev/seed';
	import type { ExportEnvelope } from '$lib/db/types';

	const isDev = import.meta.env.DEV;
	const CLEAR_PHRASE = 'Clear All Data';

	let pendingImport = $state<ExportEnvelope | null>(null);
	let importError = $state<string | null>(null);
	let clearConfirmText = $state('');
	let fileInput: HTMLInputElement | null = $state(null);
	let confirmDialog: HTMLDialogElement | null = $state(null);
	let errorDialog: HTMLDialogElement | null = $state(null);
	let clearDialog: HTMLDialogElement | null = $state(null);

	const clearMatches = $derived(clearConfirmText === CLEAR_PHRASE);

	function handleImportClick() {
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
			pendingImport = exportEnvelopeSchema.parse(json);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Invalid file';
			errorDialog?.showModal();
		}
	}

	$effect(() => {
		if (pendingImport && confirmDialog && !confirmDialog.open) confirmDialog.showModal();
	});

	async function confirmImport() {
		if (!pendingImport) return;
		await importAll(pendingImport);
		pendingImport = null;
		confirmDialog?.close();
	}

	function cancelImport() {
		pendingImport = null;
		confirmDialog?.close();
	}

	function openClearDialog() {
		clearConfirmText = '';
		clearDialog?.showModal();
	}

	async function performClear() {
		if (!clearMatches) return;
		await clearAllData();
		clearConfirmText = '';
		clearDialog?.close();
	}

	function cancelClear() {
		clearConfirmText = '';
		clearDialog?.close();
	}

	async function handleLoadDemo() {
		await loadDemoData();
	}
</script>

<div class="dropdown dropdown-end">
	<div tabindex="0" role="button" class="btn btn-ghost btn-sm">Data ▾</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<ul
		tabindex="0"
		class="dropdown-content menu z-30 mt-1 w-52 menu-sm rounded-box bg-base-100 p-1 shadow-lg"
	>
		<li><button type="button" onclick={downloadBackup}>Export to JSON</button></li>
		<li><button type="button" onclick={handleImportClick}>Import from JSON</button></li>
		{#if isDev}
			<li>
				<button type="button" onclick={handleLoadDemo}>
					Load demo data
					<span class="badge badge-ghost badge-xs">dev</span>
				</button>
			</li>
		{/if}
		<li>
			<button type="button" class="text-error" onclick={openClearDialog}>Clear all data</button>
		</li>
	</ul>
</div>

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
		<div class="modal-box">
			<h3 class="text-lg font-bold">Replace all data?</h3>
			<p class="py-2 text-sm">
				This will <strong>replace all existing data</strong> with the contents of the file. Export your
				current data first if you want a backup.
			</p>
			<ul class="list-inside list-disc rounded-box bg-base-200 p-3 text-sm">
				<li>{pendingImport.items.length} items</li>
				<li>{pendingImport.journalEntries.length} journal entries</li>
				<li>Cost To Move state: {pendingImport.costToMove ? 'included' : 'none'}</li>
				<li class="text-xs text-base-content/60">Exported: {pendingImport.exportedAt}</li>
			</ul>
			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={cancelImport}>Cancel</button>
				<button type="button" class="btn btn-error" onclick={confirmImport}>Replace</button>
			</div>
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

<!-- Clear all data confirmation -->
<dialog bind:this={clearDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold text-error">Clear all data?</h3>
		<p class="py-2 text-sm">
			This permanently deletes all items, journal entries, and the Cost To Move state. This
			<strong>cannot be undone</strong>.
		</p>
		<p class="text-sm">
			To confirm, type
			<code class="rounded bg-base-200 px-1 py-0.5 text-xs">{CLEAR_PHRASE}</code> below.
		</p>
		<input
			type="text"
			bind:value={clearConfirmText}
			placeholder={CLEAR_PHRASE}
			class="input-bordered input mt-3 w-full"
			autocomplete="off"
		/>
		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={cancelClear}>Cancel</button>
			<button type="button" class="btn btn-error" disabled={!clearMatches} onclick={performClear}>
				Clear all data
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button onclick={cancelClear}>close</button></form>
</dialog>
