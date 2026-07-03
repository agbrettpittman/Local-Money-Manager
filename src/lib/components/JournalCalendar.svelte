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
	let triggerEl: HTMLDivElement | null = $state(null);

	function toIso(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const monthLabel = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric'
		})
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

	function handlePick(date: string) {
		onSelect(date);
		// Close the daisyUI dropdown by removing focus from the trigger/content.
		(document.activeElement as HTMLElement | null)?.blur();
	}
</script>

<div class="dropdown dropdown-end">
	<div
		bind:this={triggerEl}
		tabindex="0"
		role="button"
		class="btn btn-square btn-sm btn-primary"
		aria-label="Open calendar"
		title="Pick a date"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
			<line x1="16" y1="2" x2="16" y2="6"></line>
			<line x1="8" y1="2" x2="8" y2="6"></line>
			<line x1="3" y1="10" x2="21" y2="10"></line>
		</svg>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="dropdown-content z-30 mt-1 w-[210px] rounded-box bg-base-100 p-2 shadow-lg"
	>
		<div class="flex items-center justify-between gap-1">
			<button
				type="button"
				class="btn btn-square btn-ghost btn-xs"
				aria-label="Previous month"
				onclick={prev}
			>
				‹
			</button>
			<button
				type="button"
				class="btn flex-1 text-xs font-medium btn-ghost btn-xs"
				onclick={goToday}
				title="Jump to today"
			>
				{monthLabel}
			</button>
			<button
				type="button"
				class="btn btn-square btn-ghost btn-xs"
				aria-label="Next month"
				onclick={next}
			>
				›
			</button>
		</div>

		<div class="mt-1 grid grid-cols-7 gap-0.5 text-center">
			{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as label, idx (idx)}
				<div class="text-[10px] font-medium text-base-content/50">{label}</div>
			{/each}
			{#each cells as cell, idx (idx)}
				{#if cell === null}
					<div></div>
				{:else}
					{@const isToday = cell.date === todayIso}
					{@const hasEntry = enteredDates.has(cell.date)}
					<button
						type="button"
						class="aspect-square rounded text-[11px] leading-none transition-colors hover:bg-base-200"
						class:bg-primary={hasEntry}
						class:text-primary-content={hasEntry}
						class:font-semibold={hasEntry}
						class:hover:bg-primary-focus={hasEntry}
						class:ring-1={isToday}
						class:ring-primary={isToday}
						onclick={() => handlePick(cell.date)}
					>
						{cell.day}
					</button>
				{/if}
			{/each}
		</div>
	</div>
</div>
