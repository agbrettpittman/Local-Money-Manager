<script lang="ts">
	import './layout.css';
	import NavLink from '$lib/components/NavLink.svelte';
	import DataMenu from '$lib/components/DataMenu.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Local Money Manager</title>
</svelte:head>

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
	{@render children()}
</main>
