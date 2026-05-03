<script lang="ts">
	import OverridableMoneyField from './OverridableMoneyField.svelte';
	import OverridableNumberField from './OverridableNumberField.svelte';
	import { setFutureField } from '$lib/cost-to-move/actions';
	import { calcMonthlyTaxes } from '$lib/cost-to-move/calc';
	import { formatCurrency } from '$lib/format';
	import type { CostToMoveState } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
	}
	let { state }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const monthlyTax = $derived(calcMonthlyTaxes(state));
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title text-base">New Home</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<OverridableMoneyField {state} field="housePrice" label="House Price" />
			<OverridableNumberField
				{state}
				field="interestRate"
				label="Annual Interest (%)"
				step="0.01"
				min={0}
				max={100}
			/>
			<OverridableNumberField
				{state}
				field="loanYears"
				label="Loan Duration (years)"
				step="1"
				min={1}
				max={50}
			/>
			<div>
				<OverridableNumberField
					{state}
					field="propertyTaxRate"
					label="Property Tax (%/yr)"
					step="0.01"
					min={0}
					max={100}
				/>
				{#if monthlyTax > 0}
					<p class="mt-1 text-xs text-base-content/60">Monthly: {formatCurrency(monthlyTax)}</p>
				{/if}
			</div>
			<OverridableMoneyField {state} field="monthlyInsurance" label="Monthly Insurance" />
			{#if future}
				<label class="form-control w-full">
					<div class="label py-1">
						<span class="label-text text-xs font-medium">Home Price Inflation (%/yr)</span>
					</div>
					<input
						type="number"
						step="0.1"
						min="-20"
						max="50"
						value={state.futureMode.homePriceInflationRate}
						oninput={(e) =>
							setFutureField('homePriceInflationRate', e.currentTarget.valueAsNumber || 0)}
						class="input input-sm w-full text-right"
					/>
				</label>
			{/if}
		</div>
	</div>
</div>
