<script lang="ts">
	import { setFutureField } from '$lib/cost-to-move/actions';
	import { calcDurationMonths } from '$lib/cost-to-move/calc';
	import { formatDuration } from '$lib/format';
	import type { CostToMoveState } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
	}
	let { state }: Props = $props();

	const months = $derived(calcDurationMonths(state));
	const durationLabel = $derived.by(() => {
		if (!state.futureMode.enabled) return '';
		if (months > 0) return formatDuration(months);
		return state.futureMode.moveDate ? 'Pick a future date' : '';
	});
</script>

<div class="flex flex-wrap items-center gap-3">
	<label class="label cursor-pointer gap-2">
		<input
			type="checkbox"
			checked={state.futureMode.enabled}
			onchange={(e) => setFutureField('enabled', e.currentTarget.checked)}
			class="toggle toggle-primary toggle-sm"
		/>
		<span class="label-text font-semibold">Future Mode</span>
	</label>

	{#if state.futureMode.enabled}
		<label class="flex items-center gap-2 text-sm">
			<span class="text-base-content/70">Move date:</span>
			<input
				type="date"
				value={state.futureMode.moveDate}
				oninput={(e) => setFutureField('moveDate', e.currentTarget.value)}
				class="input input-sm"
			/>
		</label>
		{#if durationLabel}
			<span class="num badge badge-sm badge-warning">{durationLabel}</span>
		{/if}
	{/if}
</div>
