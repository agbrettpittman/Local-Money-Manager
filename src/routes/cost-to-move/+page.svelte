<script lang="ts">
	import { allItems } from '$lib/stores/items';
	import { allHomes } from '$lib/stores/homes';
	import { allEntries } from '$lib/stores/entries';
	import { costToMove } from '$lib/stores/costToMove';
	import { latestAmountByItem } from '$lib/calc/latestAmounts';

	import NewHomeForm from '$lib/components/cost-to-move/NewHomeForm.svelte';
	import OwnedHomesList from '$lib/components/cost-to-move/OwnedHomesList.svelte';
	import AssetSelectionList from '$lib/components/cost-to-move/AssetSelectionList.svelte';
	import ExpenseSelectionList from '$lib/components/cost-to-move/ExpenseSelectionList.svelte';
	import AdHocExpenseList from '$lib/components/cost-to-move/AdHocExpenseList.svelte';
	import FutureModeControls from '$lib/components/cost-to-move/FutureModeControls.svelte';
	import ProgressBar from '$lib/components/cost-to-move/ProgressBar.svelte';
	import ResultsCards from '$lib/components/cost-to-move/ResultsCards.svelte';

	const latestAmounts = $derived(latestAmountByItem($allEntries));
</script>

<header class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold">Cost To Move</h1>
		<p class="text-sm text-base-content/70">
			Estimate progress toward buying a new home, drawing on your journal items.
		</p>
	</div>
	<FutureModeControls state={$costToMove} />
</header>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<ProgressBar state={$costToMove} items={$allItems} homes={$allHomes} {latestAmounts} />
	</div>
</div>

<div class="grid gap-4 lg:grid-cols-[1fr_280px]">
	<div class="space-y-4">
		<NewHomeForm state={$costToMove} />

		<div class="grid gap-4 md:grid-cols-2">
			<AssetSelectionList state={$costToMove} items={$allItems} {latestAmounts} />
			<ExpenseSelectionList state={$costToMove} items={$allItems} {latestAmounts} />
		</div>

		<AdHocExpenseList
			state={$costToMove}
			bucket="adHocExpenses"
			title="Other expenses"
			description="One-time cash drains that aren't journal-tracked (moving truck, security deposit, closing costs, emergency fund)."
		/>

		<OwnedHomesList state={$costToMove} homes={$allHomes} {latestAmounts} />

		<AdHocExpenseList
			state={$costToMove}
			bucket="currentHomeExpenses"
			title="Home expenses"
			description="Costs that reduce net proceeds from selling (repairs, renovations)."
		/>
	</div>

	<ResultsCards state={$costToMove} items={$allItems} homes={$allHomes} {latestAmounts} />
</div>
