<script lang="ts">
	import type { CostToMoveState, Home, Item } from '$lib/db/types';
	import {
		calcFutureAssetValue,
		calcLoanAmount,
		calcNetProceeds,
		isFutureActive,
		resolveActiveAssets
	} from '$lib/cost-to-move/calc';

	interface Props {
		state: CostToMoveState;
		items: Item[];
		homes: Home[];
		latestAmounts: Record<string, number>;
	}
	let { state, items, homes, latestAmounts }: Props = $props();

	const segments = $derived.by(() => {
		const future = isFutureActive(state);
		const assetsResolved = resolveActiveAssets(state, items, latestAmounts);
		const assetsSum = future
			? assetsResolved.reduce((s, a) => s + calcFutureAssetValue(a.amount, a.selection, state), 0)
			: assetsResolved.reduce((s, a) => s + a.amount, 0);
		const netHome = Math.max(0, calcNetProceeds(state, homes, latestAmounts));
		const loan = calcLoanAmount(state, items, homes, latestAmounts);
		const total = Math.max(assetsSum + netHome + loan, 1);
		return {
			assetsPct: (assetsSum / total) * 100,
			homePct: (netHome / total) * 100,
			loanPct: (loan / total) * 100
		};
	});
</script>

<div class="space-y-1">
	<div class="flex justify-between text-xs text-base-content/70">
		<span class="flex items-center gap-1">
			<span class="inline-block size-2 rounded bg-success"></span> Assets
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-2 rounded bg-info"></span> Net home value
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-2 rounded bg-base-300"></span> Loan amount
		</span>
	</div>
	<div class="flex h-3 overflow-hidden rounded-full bg-base-200">
		<div class="bg-success" style:width="{segments.assetsPct}%"></div>
		<div class="bg-info" style:width="{segments.homePct}%"></div>
		<div class="bg-base-300" style:width="{segments.loanPct}%"></div>
	</div>
	<div class="num flex justify-between text-xs text-base-content/60">
		<span>{segments.assetsPct.toFixed(1)}%</span>
		<span>{segments.homePct.toFixed(1)}%</span>
		<span>{segments.loanPct.toFixed(1)}%</span>
	</div>
</div>
