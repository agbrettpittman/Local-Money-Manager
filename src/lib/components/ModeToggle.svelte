<script lang="ts">
	export type ChartMode = 'net' | 'assets' | 'liabilities';

	interface Props {
		mode: ChartMode;
		onChange: (mode: ChartMode) => void;
	}

	let { mode, onChange }: Props = $props();

	const modes: { id: ChartMode; label: string }[] = [
		{ id: 'net', label: 'Net Worth' },
		{ id: 'assets', label: 'Assets' },
		{ id: 'liabilities', label: 'Liabilities' }
	];
</script>

<div role="tablist" class="tabs-box tabs">
	{#each modes as m (m.id)}
		<button
			type="button"
			role="tab"
			aria-selected={mode === m.id}
			class="tab"
			class:tab-active={mode === m.id}
			onclick={() => onChange(m.id)}
		>
			{m.label}
		</button>
	{/each}
</div>
