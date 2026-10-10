<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { entriesByDateDesc } from '$lib/stores/entries';
	import { activeItems } from '$lib/stores/items';
	import { getOrCreateEntry } from '$lib/db/repo';
	import { buildDefaultLines, entryBefore } from '$lib/calc/entryDefaults';
	import JournalCalendar from '$lib/components/JournalCalendar.svelte';
	import JournalEntryAccordion from '$lib/components/JournalEntryAccordion.svelte';

	const enteredDates = $derived(new SvelteSet($entriesByDateDesc.map((e) => e.date)));

	// Cloning only has meaning when today is still blank — getOrCreateEntry returns an
	// existing entry untouched, so the button would otherwise look like it did nothing.
	const previousEntry = $derived(entryBefore($entriesByDateDesc, todayIso()));
	const canClone = $derived(previousEntry !== undefined && !enteredDates.has(todayIso()));

	// Track which accordions are open by entry id.
	const openIds = new SvelteSet<string>();

	function isOpen(id: string): boolean {
		return openIds.has(id);
	}
	function setOpen(id: string, value: boolean) {
		if (value) openIds.add(id);
		else openIds.delete(id);
	}

	function todayIso(): string {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	async function handleDateSelect(date: string, clonePrevious = false) {
		const prior = clonePrevious ? entryBefore($entriesByDateDesc, date) : undefined;
		const entry = await getOrCreateEntry(date, buildDefaultLines($activeItems, prior));
		openIds.add(entry.id);
		await tick();
		document
			.getElementById(`entry-${entry.id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function newEntryToday() {
		void handleDateSelect(todayIso());
	}

	function cloneIntoToday() {
		void handleDateSelect(todayIso(), true);
	}
</script>

<header>
	<h1 class="text-2xl font-semibold">Journal</h1>
	<p class="text-sm text-base-content/70">
		Open today's entry or pick another day from the calendar. New entries are pre-populated from
		your <a href="/assets-and-liabilities" class="link">Assets & Liabilities</a>, at zero — or clone
		the previous entry's amounts to start from where you left off.
	</p>
</header>

<div class="flex items-center justify-start gap-2">
	<button type="button" class="btn btn-sm btn-primary" onclick={newEntryToday}>
		+ New entry (today)
	</button>
	<button
		type="button"
		class="btn btn-sm"
		onclick={cloneIntoToday}
		disabled={!canClone}
		title={canClone
			? `Start today from ${previousEntry?.date}`
			: previousEntry
				? "Today's entry already exists"
				: 'No earlier entry to clone'}
	>
		+ Clone last entry
	</button>
	<JournalCalendar {enteredDates} onSelect={handleDateSelect} />
</div>

{#if $entriesByDateDesc.length === 0}
	<div class="card border-2 border-dashed border-base-300 bg-base-100">
		<div class="card-body">
			<p>No journal entries yet — click "New entry" above or pick a day in the calendar.</p>
		</div>
	</div>
{:else}
	<div class="space-y-2">
		{#each $entriesByDateDesc as entry (entry.id)}
			<JournalEntryAccordion
				{entry}
				bind:open={() => isOpen(entry.id), (v) => setOpen(entry.id, v)}
			/>
		{/each}
	</div>
{/if}
