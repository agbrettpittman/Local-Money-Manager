<script lang="ts">
	import { entriesByDate } from '$lib/stores/entries';
	import { allItems } from '$lib/stores/items';
	import NetworthChart from '$lib/components/NetworthChart.svelte';
	import ModeToggle, { type ChartMode } from '$lib/components/ModeToggle.svelte';

	let mode = $state<ChartMode>('net');

	const hasData = $derived($entriesByDate.length > 0);
</script>

<header class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold">Net Worth</h1>
		<p class="text-sm text-base-content/70">
			How your assets and liabilities have moved over time.
		</p>
	</div>
	{#if hasData}
		<ModeToggle {mode} onChange={(m) => (mode = m)} />
	{/if}
</header>

{#if hasData}
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<NetworthChart {mode} entries={$entriesByDate} items={$allItems} />
		</div>
	</div>
{:else}
	<div class="card border-2 border-dashed border-base-300 bg-base-100">
		<div class="card-body items-start gap-3">
			<p>No journal entries yet.</p>
			<a href="/journal" class="btn btn-sm btn-primary">Start your first entry →</a>
		</div>
	</div>
{/if}
