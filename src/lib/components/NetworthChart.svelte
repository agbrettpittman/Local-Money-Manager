<script lang="ts">
	import { Line } from 'svelte-chartjs';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler,
		type ChartOptions
	} from 'chart.js';
	import type { ChartMode } from './ModeToggle.svelte';
	import type { Item, JournalEntry } from '$lib/db/types';
	import { networthSeries } from '$lib/calc/networth';
	import { stackedSeries } from '$lib/calc/stacked';
	import { formatCurrency } from '$lib/format';

	ChartJS.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler
	);

	interface Props {
		mode: ChartMode;
		entries: JournalEntry[];
		items: Item[];
	}

	let { mode, entries, items }: Props = $props();

	const PALETTE = [
		'#10b981',
		'#3b82f6',
		'#f59e0b',
		'#8b5cf6',
		'#ef4444',
		'#06b6d4',
		'#ec4899',
		'#84cc16',
		'#f97316',
		'#6366f1'
	];

	function hexToRgba(hex: string, alpha: number): string {
		const v = hex.replace('#', '');
		const r = parseInt(v.slice(0, 2), 16);
		const g = parseInt(v.slice(2, 4), 16);
		const b = parseInt(v.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function formatDateLabel(iso: string): string {
		const [y, m, d] = iso.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	const itemsById = $derived(new Map(items.map((i) => [i.id, i])));

	// Sorted once at component scope so both the datasets and the tooltip (which
	// looks up a hovered point's comment by dataIndex) share the same ordering.
	const sortedEntries = $derived([...entries].sort((a, b) => a.date.localeCompare(b.date)));

	// Wrap a comment to a sensible width so long notes don't blow out the tooltip.
	function wrap(text: string, width = 48): string[] {
		const out: string[] = [];
		for (const paragraph of text.split('\n')) {
			let line = '';
			for (const word of paragraph.split(/\s+/)) {
				if (line && (line + ' ' + word).length > width) {
					out.push(line);
					line = word;
				} else {
					line = line ? `${line} ${word}` : word;
				}
			}
			out.push(line);
		}
		return out;
	}

	const chartData = $derived.by(() => {
		const sorted = sortedEntries;
		const labels = sorted.map((e) => formatDateLabel(e.date));

		if (mode === 'net') {
			const points = networthSeries(sorted, items);
			return {
				labels,
				datasets: [
					{
						label: 'Net Worth',
						data: points.map((p) => p.value),
						borderColor: '#18181b',
						backgroundColor: hexToRgba('#18181b', 0.1),
						borderWidth: 2,
						pointRadius: 3,
						tension: 0.2,
						fill: false
					}
				]
			};
		}

		const kind = mode === 'liabilities' ? 'liability' : 'asset';
		const stack = stackedSeries(sorted, items, kind);

		// Group itemIds by top-level parent for hierarchical coloring.
		// Top-level id = item.parentId ?? item.id (orphans of deleted parents collapse to their own group).
		const groups: Record<string, string[]> = {};
		for (const itemId of stack.itemIds) {
			const item = itemsById.get(itemId);
			const topId = item?.parentId && itemsById.has(item.parentId) ? item.parentId : itemId;
			if (!groups[topId]) groups[topId] = [];
			groups[topId].push(itemId);
		}

		// Sort top-level groups by name for stable hue assignment.
		const sortedTopIds = Object.keys(groups).sort((a, b) =>
			(itemsById.get(a)?.name ?? '').localeCompare(itemsById.get(b)?.name ?? '')
		);

		// Within each group: parent first, then children alphabetically.
		for (const topId of sortedTopIds) {
			groups[topId].sort((a, b) => {
				if (a === topId) return -1;
				if (b === topId) return 1;
				return (itemsById.get(a)?.name ?? '').localeCompare(itemsById.get(b)?.name ?? '');
			});
		}

		// Build datasets in stack order. Each top-level group shares a hue.
		// Parent (if present) gets full alpha; children spread between 0.45 and 0.85.
		const datasets: ReturnType<typeof buildDataset>[] = [];

		function buildDataset(itemId: string, color: string, alpha: number) {
			const item = itemsById.get(itemId);
			const parent = item?.parentId ? itemsById.get(item.parentId) : null;
			const label = parent ? `${parent.name} › ${item?.name}` : (item?.name ?? '(unknown)');
			return {
				label,
				data: stack.points.map((p) => p.byItem[itemId] ?? 0),
				borderColor: color,
				backgroundColor: hexToRgba(color, alpha),
				borderWidth: 1,
				pointRadius: 2,
				tension: 0.2,
				fill: true
			};
		}

		sortedTopIds.forEach((topId, groupIdx) => {
			const color = PALETTE[groupIdx % PALETTE.length];
			const ids = groups[topId];
			const hasParent = ids[0] === topId;
			const childCount = hasParent ? ids.length - 1 : ids.length;

			ids.forEach((itemId, i) => {
				const isParent = itemId === topId;
				let alpha: number;
				if (isParent) {
					alpha = childCount > 0 ? 1.0 : 0.85;
				} else {
					// Children get descending alpha in [0.45, 0.85].
					const childIdx = hasParent ? i - 1 : i;
					if (childCount === 1) alpha = 0.7;
					else alpha = 0.85 - (childIdx * 0.4) / (childCount - 1);
				}
				datasets.push(buildDataset(itemId, color, alpha));
			});
		});

		return { labels, datasets };
	});

	const chartOptions: ChartOptions<'line'> = $derived({
		responsive: true,
		maintainAspectRatio: false,
		interaction: { mode: 'index', intersect: false },
		plugins: {
			legend: {
				display: mode !== 'net',
				position: 'bottom',
				labels: { boxWidth: 12, font: { size: 11 } }
			},
			tooltip: {
				callbacks: {
					label: (ctx) => `${ctx.dataset.label ?? ''}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
					footer: (items) => {
						const idx = items[0]?.dataIndex;
						const note = idx == null ? undefined : sortedEntries[idx]?.notes?.trim();
						const lines: string[] = [];
						if (mode !== 'net') {
							const total = items.reduce((s, i) => s + (i.parsed.y ?? 0), 0);
							lines.push(`Total: ${formatCurrency(total)}`);
						}
						if (note) {
							if (lines.length) lines.push('');
							lines.push(...wrap(note));
						}
						return lines;
					}
				}
			}
		},
		scales: {
			y: {
				stacked: mode !== 'net',
				ticks: {
					callback: (value) => {
						const v = typeof value === 'number' ? value : Number(value);
						if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
						if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
						return `$${v}`;
					}
				}
			}
		}
	});
</script>

<div class="relative h-80 w-full">
	{#key mode + '|' + entries.length + '|' + items.length}
		<Line data={chartData} options={chartOptions} />
	{/key}
</div>
