<script lang="ts">
	import { setField, setOverrideValue, toggleOverride } from '$lib/cost-to-move/actions';
	import type { CostToMoveState, OverridableField } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
		field: OverridableField;
		label: string;
		step?: string;
		min?: number;
		max?: number;
	}

	let { state, field, label, step = 'any', min, max }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const override = $derived(state.futureOverrides[field]);
	const isOverridden = $derived(override.isOverridden);

	function handleBase(e: Event) {
		const v = (e.target as HTMLInputElement).valueAsNumber;
		setField(field, Number.isNaN(v) ? 0 : v);
	}
	function handleOverride(e: Event) {
		const v = (e.target as HTMLInputElement).valueAsNumber;
		setOverrideValue(field, Number.isNaN(v) ? 0 : v);
	}
</script>

<label class="form-control w-full">
	<div class="label py-1"><span class="label-text text-xs font-medium">{label}</span></div>
	<div class="join w-full">
		<input
			type="number"
			{step}
			{min}
			{max}
			value={state[field] as number}
			disabled={future && isOverridden}
			oninput={handleBase}
			class="input input-sm join-item w-full text-right"
		/>
		{#if future}
			<button
				type="button"
				class="btn join-item btn-sm"
				class:btn-warning={isOverridden}
				class:btn-outline={!isOverridden}
				title={isOverridden
					? 'Click to use current value'
					: 'Click to override for future projection'}
				onclick={() => toggleOverride(field)}
			>
				{isOverridden ? '🔓' : '🔒'}
			</button>
		{/if}
	</div>
	{#if future && isOverridden}
		<div class="mt-1 flex items-center gap-2">
			<span class="text-xs text-warning">Future:</span>
			<input
				type="number"
				{step}
				{min}
				{max}
				value={override.futureValue ?? (state[field] as number)}
				oninput={handleOverride}
				class="input input-sm w-full text-right"
			/>
		</div>
	{/if}
</label>
