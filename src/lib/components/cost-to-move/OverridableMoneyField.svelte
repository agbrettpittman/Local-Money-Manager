<script lang="ts">
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import { setField, setOverrideValue, toggleOverride } from '$lib/cost-to-move/actions';
	import type { CostToMoveState, OverridableField } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
		field: OverridableField;
		label: string;
	}

	let { state, field, label }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const override = $derived(state.futureOverrides[field]);
	const isOverridden = $derived(override.isOverridden);
</script>

<label class="form-control w-full">
	<div class="label py-1"><span class="label-text text-xs font-medium">{label}</span></div>
	<div class="join w-full">
		<div class="join-item flex-1">
			<MoneyInput
				value={state[field] as number}
				disabled={future && isOverridden}
				onCommit={(v) => setField(field, v)}
			/>
		</div>
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
			<MoneyInput
				value={override.futureValue ?? (state[field] as number)}
				onCommit={(v) => setOverrideValue(field, v)}
			/>
		</div>
	{/if}
</label>
