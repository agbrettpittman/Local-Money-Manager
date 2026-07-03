<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { db } from '$lib/db/schema';
	import NavLink from '$lib/components/NavLink.svelte';
	import DataMenu from '$lib/components/DataMenu.svelte';
	import BackupReminder from '$lib/components/BackupReminder.svelte';

	let { children } = $props();

	type DbStatus = 'loading' | 'ready' | 'blocked' | 'downgrade';
	let status = $state<DbStatus>('loading');

	onMount(async () => {
		try {
			if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
			await db.open();
			status = 'ready';
			void navigator.storage?.persist?.();
		} catch (err) {
			// VersionError => the on-disk DB is newer than this build (a downgrade).
			status = err instanceof Error && err.name === 'VersionError' ? 'downgrade' : 'blocked';
			console.error('Database failed to open', err);
		}
	});
</script>

<svelte:head>
	<title>Local Money Manager</title>
</svelte:head>

{#if status === 'ready'}
	<div class="navbar sticky top-0 z-30 bg-base-100 shadow-sm">
		<div class="navbar-start">
			<a class="btn text-lg font-bold normal-case btn-ghost" href="/">💰 LMM</a>
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
		<BackupReminder />
		{@render children()}
	</main>

	<footer class="container mx-auto max-w-6xl px-4 pb-4 text-right text-xs text-base-content/40">
		v{__APP_VERSION__}
	</footer>
{:else if status === 'loading'}
	<div class="flex min-h-screen items-center justify-center">
		<span class="loading loading-lg loading-spinner"></span>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center p-4">
		<div class="card max-w-md bg-base-100 shadow-md">
			<div class="card-body items-center text-center">
				{#if status === 'downgrade'}
					<h1 class="card-title">Update needed</h1>
					<p class="text-sm">
						Your saved data was created by a newer version of Local Money Manager than the one
						loaded here. Reload to get the latest version.
					</p>
					<button type="button" class="btn mt-2 btn-primary" onclick={() => location.reload()}>
						Reload
					</button>
				{:else}
					<h1 class="card-title">Local storage is blocked</h1>
					<p class="text-sm">
						This app stores everything in your browser, but it can't access local storage right now.
						This usually happens in private/incognito windows or when site data is disabled. Try a
						normal window or enable site data for this page, then reload.
					</p>
					<button type="button" class="btn mt-2" onclick={() => location.reload()}>Reload</button>
				{/if}
				<p class="mt-3 text-xs text-base-content/40">v{__APP_VERSION__}</p>
			</div>
		</div>
	</div>
{/if}
