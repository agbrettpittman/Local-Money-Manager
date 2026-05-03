<script lang="ts">
	interface Props {
		enteredDates: Set<string>;
		onSelect: (date: string) => void;
	}

	let { enteredDates, onSelect }: Props = $props();

	const today = new Date();
	const todayIso = $derived(toIso(today));

	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	function toIso(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const monthLabel = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);

	const cells = $derived.by(() => {
		const first = new Date(viewYear, viewMonth, 1);
		const startDow = first.getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const arr: Array<{ date: string; day: number } | null> = [];
		for (let i = 0; i < startDow; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) {
			const iso = toIso(new Date(viewYear, viewMonth, d));
			arr.push({ date: iso, day: d });
		}
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	});

	function prev() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}
	function next() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}
	function goToday() {
		viewYear = today.getFullYear();
		viewMonth = today.getMonth();
	}
</script>

<details class="card max-w-[500px] bg-base-100 shadow-sm">
	<summary class="cursor-pointer px-4 py-3 text-sm font-medium select-none">📅 Calendar</summary>
	<div class="card-body p-4 pt-0">
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				class="btn btn-square btn-ghost btn-sm"
				aria-label="Previous month"
				onclick={prev}
			>
				‹
			</button>
			<button
				type="button"
				class="btn flex-1 font-medium btn-ghost btn-sm"
				onclick={goToday}
				title="Jump to today"
			>
				{monthLabel}
			</button>
			<button
				type="button"
				class="btn btn-square btn-ghost btn-sm"
				aria-label="Next month"
				onclick={next}
			>
				›
			</button>
		</div>

		<div class="grid grid-cols-7 gap-0.5 text-center">
			{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as label, idx (idx)}
				<div class="text-xs font-medium text-base-content/50">{label}</div>
			{/each}
			{#each cells as cell, idx (idx)}
				{#if cell === null}
					<div></div>
				{:else}
					{@const isToday = cell.date === todayIso}
					{@const hasEntry = enteredDates.has(cell.date)}
					<button
						type="button"
						class="relative aspect-square rounded text-sm hover:bg-base-200"
						class:ring-1={isToday}
						class:ring-primary={isToday}
						class:font-semibold={hasEntry}
						onclick={() => onSelect(cell.date)}
					>
						<span>{cell.day}</span>
						{#if hasEntry}
							<span
								class="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
							></span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
</details>
