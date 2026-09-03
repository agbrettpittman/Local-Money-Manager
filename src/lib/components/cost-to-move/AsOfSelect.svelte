<script lang="ts">
	import type { JournalEntry } from '$lib/db/types';

	interface Props {
		/** Entries in any order — rendered newest-first. */
		entries: JournalEntry[];
		/** Selected entry id, or null for "latest". */
		asOfId: string | null;
		onChange: (id: string | null) => void;
	}

	let { entries, asOfId, onChange }: Props = $props();

	const sorted = $derived([...entries].sort((a, b) => b.date.localeCompare(a.date)));

	function label(iso: string): string {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

{#if sorted.length > 0}
	<label class="flex items-center gap-2 text-sm">
		<span class="text-base-content/70">Based on:</span>
		<select
			class="select select-sm"
			value={asOfId ?? ''}
			onchange={(e) => onChange(e.currentTarget.value || null)}
			aria-label="Journal entry to base figures on"
		>
			<option value="">Latest entry</option>
			{#each sorted as entry (entry.id)}
				<option value={entry.id}>{label(entry.date)}</option>
			{/each}
		</select>
	</label>
{/if}
