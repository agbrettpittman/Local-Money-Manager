<script lang="ts">
	import { clearAllData } from '$lib/db/repo';
	import { downloadBackup } from '$lib/backup/backup';
	import { loadDemoData } from '$lib/dev/seed';
	import ImportBackup from './ImportBackup.svelte';

	const isDev = import.meta.env.DEV;
	const CLEAR_PHRASE = 'Clear All Data';

	let clearConfirmText = $state('');
	let clearDialog: HTMLDialogElement | null = $state(null);
	let importer: ImportBackup | null = $state(null);

	const clearMatches = $derived(clearConfirmText === CLEAR_PHRASE);

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
		<li><button type="button" onclick={() => importer?.open()}>Import from JSON</button></li>
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

<ImportBackup bind:this={importer} />

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
