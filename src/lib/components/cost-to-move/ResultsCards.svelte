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
		/** 'current' forces present-day values, 'future' shows projections, 'auto' follows Future Mode. */
		variant?: 'auto' | 'current' | 'future';
		title?: string;
		/** Optional badge shown next to the title (e.g. the projection horizon). */
		badge?: string;
	}
	let {
		state,
		items,
		homes,
		latestAmounts,
		variant = 'auto',
		title = 'Results',
		badge
	}: Props = $props();

	const computeState = $derived(
		variant === 'current'
			? { ...state, futureMode: { ...state.futureMode, enabled: false } }
			: state
	);

	const future = $derived(isFutureActive(computeState));
	// Per-stat "est." badges only clutter the dedicated Future panel — its title says it all.
	const showEst = $derived(future && variant === 'auto');
	const availableCash = $derived(calcAvailableCash(computeState, items, homes, latestAmounts));
	const loanAmount = $derived(calcLoanAmount(computeState, items, homes, latestAmounts));
	const totalMonthly = $derived(calcTotalMonthlyPayment(computeState, items, homes, latestAmounts));
	const breakdown = $derived.by(() => {
		const rate = future
			? getEffectiveValue(computeState, 'interestRate')
			: computeState.interestRate;
		const years = future ? getEffectiveValue(computeState, 'loanYears') : computeState.loanYears;
		const insurance = future
			? getEffectiveValue(computeState, 'monthlyInsurance')
			: computeState.monthlyInsurance;
		const pi = calcMortgagePayment(loanAmount, rate, years);
		const tax = calcMonthlyTaxes(computeState);
		return { pi, tax, insurance };
	});

	const currentMode = $derived(
		variant === 'auto' && future ? calcCurrentModeValues(state, items, homes, latestAmounts) : null
	);
</script>

<section class="space-y-3">
	<h2 class="text-lg font-semibold">
		{title}
		{#if badge}
			<span class="num ml-1 badge align-middle badge-sm badge-warning">{badge}</span>
		{/if}
	</h2>

	<div class="stats w-full stats-vertical bg-base-100 shadow-sm">
		<div class="stat">
			<div class="stat-title text-xs">
				Available Cash{#if showEst}
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
				Loan Amount{#if showEst}
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
				Monthly Payment{#if showEst}
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
			{:else if computeState.housePrice > 0}
				<div class="stat-desc text-success">No loan needed — fully covered by assets</div>
			{/if}
			{#if currentMode}
				<div class="stat-desc">Current: {formatCurrency(currentMode.totalMonthly)}</div>
			{/if}
		</div>
	</div>
</section>
