<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { entriesByDateDesc } from '$lib/stores/entries';
	import { activeItems } from '$lib/stores/items';
	import { getOrCreateEntry } from '$lib/db/repo';
	import JournalCalendar from '$lib/components/JournalCalendar.svelte';
	import JournalEntryAccordion from '$lib/components/JournalEntryAccordion.svelte';

	const enteredDates = $derived(new SvelteSet($entriesByDateDesc.map((e) => e.date)));

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

	async function handleDateSelect(date: string) {
		const defaultLines = $activeItems.map((i) => ({ itemId: i.id, amount: 0 }));
		const entry = await getOrCreateEntry(date, defaultLines);
		openIds.add(entry.id);
		await tick();
		document
			.getElementById(`entry-${entry.id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function newEntryToday() {
		void handleDateSelect(todayIso());
	}
</script>

<header>
	<h1 class="text-2xl font-semibold">Journal</h1>
	<p class="text-sm text-base-content/70">
		Open today's entry or pick another day from the calendar. New entries are pre-populated from
		your <a href="/assets-and-liabilities" class="link">Assets & Liabilities</a>.
	</p>
</header>

<div class="flex items-center justify-start gap-2">
	<button type="button" class="btn btn-sm btn-primary" onclick={newEntryToday}>
		+ New entry (today)
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
