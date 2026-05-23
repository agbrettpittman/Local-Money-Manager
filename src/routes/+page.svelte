<script lang="ts">
	import { entriesByDate, allEntries } from '$lib/stores/entries';
	import { allItems } from '$lib/stores/items';
	import { allHomes } from '$lib/stores/homes';
	import { costToMove } from '$lib/stores/costToMove';
	import { latestAmountByItem } from '$lib/calc/latestAmounts';
	import { calcDurationMonths, isFutureActive } from '$lib/cost-to-move/calc';
	import { formatDuration } from '$lib/format';
	import NetworthChart from '$lib/components/NetworthChart.svelte';
	import LatestEntryCard from '$lib/components/LatestEntryCard.svelte';
	import ResultsCards from '$lib/components/cost-to-move/ResultsCards.svelte';
	import ModeToggle, { type ChartMode } from '$lib/components/ModeToggle.svelte';

	let mode = $state<ChartMode>('net');

	const hasData = $derived($entriesByDate.length > 0);
	const latestEntry = $derived($entriesByDate.at(-1));
	const priorEntry = $derived($entriesByDate.at(-2));

	const latestAmounts = $derived(latestAmountByItem($allEntries));
	const futureActive = $derived(isFutureActive($costToMove));
	const futureLabel = $derived(formatDuration(calcDurationMonths($costToMove)));
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
	<div class="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
		<div class="min-w-0 space-y-4">
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<NetworthChart {mode} entries={$entriesByDate} items={$allItems} />
				</div>
			</div>
			{#if latestEntry}
				<LatestEntryCard entry={latestEntry} prior={priorEntry} items={$allItems} />
			{/if}
		</div>

		<aside class="space-y-3">
			<p class="text-xs font-semibold tracking-wide text-base-content/50 uppercase">Cost to move</p>
			<ResultsCards
				variant="current"
				title="Current"
				state={$costToMove}
				items={$allItems}
				homes={$allHomes}
				{latestAmounts}
			/>
			{#if futureActive}
				<ResultsCards
					variant="future"
					title="Future"
					badge={futureLabel}
					state={$costToMove}
					items={$allItems}
					homes={$allHomes}
					{latestAmounts}
				/>
			{:else}
				<div class="card border-2 border-dashed border-base-300 bg-base-100">
					<div class="card-body items-start gap-2 p-4">
						<p class="text-sm text-base-content/70">
							Enable Future Mode to project these numbers to your move date.
						</p>
						<a href="/cost-to-move" class="link text-sm link-primary">Set up in Cost To Move →</a>
					</div>
				</div>
			{/if}
		</aside>
	</div>
{:else}
	<div class="card border-2 border-dashed border-base-300 bg-base-100">
		<div class="card-body items-start gap-3">
			<p>No journal entries yet.</p>
			<a href="/journal" class="btn btn-sm btn-primary">Start your first entry →</a>
		</div>
	</div>
{/if}
