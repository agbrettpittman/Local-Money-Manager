<script lang="ts">
	import { summarise } from '$lib/update';
	import { availableUpdate } from '$lib/stores/update';

	type Phase = 'installing' | 'done' | 'error';

	let phase = $state<Phase | null>(null);
	let message = $state('');
	/** The version the user dismissed, if any. A newer one shows again. */
	let dismissed = $state<string | null>(null);

	const update = $derived($availableUpdate);
	const notes = $derived(update ? summarise(update.body) : '');
	// Once an install starts, keep the banner up to report how it went, even if the
	// store changes underneath.
	const show = $derived(phase !== null || (update !== null && dismissed !== update.version));

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

{#if show}
	<div class="alert flex flex-wrap items-start justify-between gap-3 py-2 alert-info" role="status">
		<div class="min-w-0 flex-1 text-sm">
			{#if phase === 'done' || phase === 'error'}
				<span class:text-error={phase === 'error'}>{message}</span>
			{:else if update}
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
				onclick={() => {
					if (phase === null) dismissed = update?.version ?? null;
					else phase = null;
				}}
				aria-label="Dismiss"
			>
				✕
			</button>
		</div>
	</div>
{/if}
