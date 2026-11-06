<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { initStorage, flush } from '$lib/db/store';
	import { EnvelopeTooNewError } from '$lib/db/migrate';
	import NavLink from '$lib/components/NavLink.svelte';
	import DataMenu from '$lib/components/DataMenu.svelte';
	import BackupReminder from '$lib/components/BackupReminder.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	let status = $state<'loading' | 'ready' | 'error' | 'downgrade'>('loading');
	let errorDetail = $state('');

	onMount(() => {
		initStorage()
			.then(() => {
				status = 'ready';
			})
			.catch((err) => {
				// Never fall through to an empty app: that would overwrite real data on the
				// next save. Refuse to start instead. A too-new file is its own case —
				// the data is fine, this build just can't read it yet.
				status = err instanceof EnvelopeTooNewError ? 'downgrade' : 'error';
				errorDetail = err instanceof Error ? err.message : String(err);
				console.error('Could not load your data', err);
			});

		// Writes are debounced, so the last edit needs flushing before the page goes away.
		const onLeave = () => void flush();
		window.addEventListener('beforeunload', onLeave);
		return () => window.removeEventListener('beforeunload', onLeave);
	});
</script>

<svelte:head>
	<title>Local Money Manager</title>
</svelte:head>

{#if status === 'ready'}
	<div class="navbar sticky top-0 z-30 bg-base-100 shadow-sm">
		<div class="navbar-start">
			<a class="btn gap-2 text-lg font-bold normal-case btn-ghost" href="/">
				<img src="{base}/favicon.svg" alt="" width="24" height="24" class="rounded-md" />
				LMM
			</a>
		</div>
		<div class="navbar-center">
			<ul class="menu menu-horizontal items-center gap-1 px-1">
				<li><NavLink href="/" exact>Dashboard</NavLink></li>
				<li class="pointer-events-none px-0 text-base-content/30" aria-hidden="true">|</li>
				<li><NavLink href="/journal">Journal</NavLink></li>
				<li class="pointer-events-none px-0 text-base-content/30" aria-hidden="true">|</li>
				<li><NavLink href="/assets-and-liabilities">Assets &amp; Liabilities</NavLink></li>
				<li class="pointer-events-none px-0 text-base-content/30" aria-hidden="true">|</li>
				<li><NavLink href="/cost-to-move">Cost To Move</NavLink></li>
			</ul>
		</div>
		<div class="navbar-end">
			<DataMenu />
		</div>
	</div>

	<main class="container mx-auto max-w-6xl space-y-4 p-4">
		<UpdateBanner />
		<BackupReminder />
		{@render children()}
	</main>

	<footer class="container mx-auto max-w-6xl px-4 pb-4 text-right text-xs text-base-content/40">
		v{__APP_VERSION__}
	</footer>

	<Toast />
{:else if status === 'loading'}
	<div class="flex min-h-screen items-center justify-center">
		<span class="loading loading-lg loading-spinner"></span>
	</div>
{:else if status === 'downgrade'}
	<div class="flex min-h-screen items-center justify-center p-4">
		<div class="card max-w-md bg-base-100 shadow-md">
			<div class="card-body items-center text-center">
				<h1 class="card-title">Update needed</h1>
				<p class="text-sm">
					Your data was saved by a newer version of Local Money Manager than the one running here.
					Nothing is wrong with it — this build just can't read the newer format. Update to the
					latest version to open it.
				</p>
				{#if errorDetail}
					<pre
						class="mt-2 max-h-32 w-full overflow-auto rounded-box bg-base-200 p-2 text-left text-xs whitespace-pre-wrap">{errorDetail}</pre>
				{/if}
				<button type="button" class="btn mt-2" onclick={() => location.reload()}>Reload</button>
				<p class="mt-3 text-xs text-base-content/40">v{__APP_VERSION__}</p>
			</div>
		</div>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center p-4">
		<div class="card max-w-md bg-base-100 shadow-md">
			<div class="card-body items-center text-center">
				<h1 class="card-title">Could not load your data</h1>
				<p class="text-sm">
					Your saved data couldn't be read, so the app has stopped rather than start empty and risk
					overwriting it. Your most recent backup file is unaffected.
				</p>
				{#if errorDetail}
					<pre
						class="mt-2 max-h-32 w-full overflow-auto rounded-box bg-base-200 p-2 text-left text-xs whitespace-pre-wrap">{errorDetail}</pre>
				{/if}
				<button type="button" class="btn mt-2" onclick={() => location.reload()}>Reload</button>
				<p class="mt-3 text-xs text-base-content/40">v{__APP_VERSION__}</p>
			</div>
		</div>
	</div>
{/if}
