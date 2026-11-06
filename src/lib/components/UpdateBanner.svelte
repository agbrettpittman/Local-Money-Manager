<script lang="ts">
	import { onMount } from 'svelte';
	import type { Update } from '@tauri-apps/plugin-updater';
	import { findUpdate, summarise } from '$lib/update';
	import { isDesktop } from '$lib/platform';

	type Phase = 'installing' | 'done' | 'error';

	/** How often to look again while the app stays open. */
	const RECHECK_MS = 2 * 60 * 60 * 1000;

	// $state.raw: Update is a class instance whose methods break under a deep proxy.
	let update = $state.raw<Update | null>(null);
	let phase = $state<Phase | null>(null);
	let message = $state('');
	/** The version the user dismissed, if any. A newer one shows again. */
	let dismissed = $state<string | null>(null);

	onMount(() => {
		if (!isDesktop) return;
		let cancelled = false;

		const poll = async () => {
			// Never swap the update out from under an install already running.
			if (phase !== null) return;
			const found = await findUpdate();
			if (cancelled || !found) return;
			if (update?.version !== found.version) update = found;
		};

		void poll();
		const id = setInterval(poll, RECHECK_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	});

	const notes = $derived(update ? summarise(update.body) : '');
	const show = $derived(update !== null && dismissed !== update.version);

	function install() {
		if (!update) return;
		phase = 'installing';
		update
			.downloadAndInstall()
			.then(() => {
				// The Windows installer closes the app to replace it, so there's nothing
				// to relaunch from here — restarting is the user's move.
				phase = 'done';
				message = 'Update installed. Restart Local Money Manager to finish.';
			})
			.catch((e: unknown) => {
				phase = 'error';
				message = e instanceof Error ? e.message : String(e);
			});
	}
</script>

{#if show && update}
	<div class="alert flex flex-wrap items-start justify-between gap-3 py-2 alert-info" role="status">
		<div class="min-w-0 flex-1 text-sm">
			{#if phase === 'done' || phase === 'error'}
				<span class:text-error={phase === 'error'}>{message}</span>
			{:else}
				<span class="font-semibold">Version {update.version} is available.</span>
				{#if notes}
					<span class="ml-2 opacity-80">{notes}</span>
				{/if}
			{/if}
		</div>
		<div class="flex shrink-0 gap-2">
			{#if phase === null}
				<button type="button" class="btn btn-sm" onclick={install}>Install</button>
			{:else if phase === 'installing'}
				<span class="text-sm opacity-70">Installing…</span>
			{/if}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => (dismissed = update?.version ?? null)}
				aria-label="Dismiss"
			>
				✕
			</button>
		</div>
	</div>
{/if}
