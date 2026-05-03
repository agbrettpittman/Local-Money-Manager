<script lang="ts">
	import type { CostToMoveState, Home, Item } from '$lib/db/types';
	import {
		calcAvailableCash,
		calcCurrentModeValues,
		calcLoanAmount,
		calcMonthlyTaxes,
		calcMortgagePayment,
		calcTotalMonthlyPayment,
		getEffectiveValue,
		isFutureActive
	} from '$lib/cost-to-move/calc';
	import { formatCurrency } from '$lib/format';

	interface Props {
		state: CostToMoveState;
		items: Item[];
		homes: Home[];
		latestAmounts: Record<string, number>;
	}
	let { state, items, homes, latestAmounts }: Props = $props();

	const future = $derived(isFutureActive(state));
	const availableCash = $derived(calcAvailableCash(state, items, homes, latestAmounts));
	const loanAmount = $derived(calcLoanAmount(state, items, homes, latestAmounts));
	const totalMonthly = $derived(calcTotalMonthlyPayment(state, items, homes, latestAmounts));
	const breakdown = $derived.by(() => {
		const rate = future ? getEffectiveValue(state, 'interestRate') : state.interestRate;
		const years = future ? getEffectiveValue(state, 'loanYears') : state.loanYears;
		const insurance = future
			? getEffectiveValue(state, 'monthlyInsurance')
			: state.monthlyInsurance;
		const pi = calcMortgagePayment(loanAmount, rate, years);
		const tax = calcMonthlyTaxes(state);
		return { pi, tax, insurance };
	});

	const currentMode = $derived(
		future ? calcCurrentModeValues(state, items, homes, latestAmounts) : null
	);
</script>

<aside class="space-y-3">
	<h2 class="text-lg font-semibold">Results</h2>

	<div class="stats w-full stats-vertical bg-base-100 shadow-sm">
		<div class="stat">
			<div class="stat-title text-xs">
				Available Cash{#if future}
					<span class="ml-1 badge badge-xs badge-warning">est.</span>
				{/if}
			</div>
			<div class="num stat-value text-xl">{formatCurrency(availableCash)}</div>
			{#if currentMode}
				<div class="stat-desc">Current: {formatCurrency(currentMode.availableCash)}</div>
			{/if}
		</div>

		<div class="stat">
			<div class="stat-title text-xs">
				Loan Amount{#if future}
					<span class="ml-1 badge badge-xs badge-warning">est.</span>
				{/if}
			</div>
			<div class="num stat-value text-xl">{formatCurrency(loanAmount)}</div>
			{#if currentMode}
				<div class="stat-desc">Current: {formatCurrency(currentMode.loanAmount)}</div>
			{/if}
		</div>

		<div class="stat">
			<div class="stat-title text-xs">
				Monthly Payment{#if future}
					<span class="ml-1 badge badge-xs badge-warning">est.</span>
				{/if}
			</div>
			<div class="num stat-value text-xl">{formatCurrency(totalMonthly)}</div>
			{#if loanAmount > 0}
				<div class="stat-desc">
					P&amp;I {formatCurrency(breakdown.pi)} + Tax {formatCurrency(breakdown.tax)} + Ins {formatCurrency(
						breakdown.insurance
					)}
				</div>
			{:else if state.housePrice > 0}
				<div class="stat-desc text-success">No loan needed — fully covered by assets</div>
			{/if}
			{#if currentMode}
				<div class="stat-desc">Current: {formatCurrency(currentMode.totalMonthly)}</div>
			{/if}
		</div>
	</div>
</aside>
