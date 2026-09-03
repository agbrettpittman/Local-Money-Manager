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
	import type { CostToMoveState, Home, Item, JournalEntry } from '$lib/db/types';
	import {
		costToMoveSeries,
		summarizeSavings,
		type HistoryMetric
	} from '$lib/cost-to-move/history';
	import { formatCurrency, formatDuration } from '$lib/format';

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
		entries: JournalEntry[];
		state: CostToMoveState;
		items: Item[];
		homes: Home[];
		/** Date of the entry currently driving the page, highlighted on the line. */
		asOfDate?: string;
	}

	// Aliased: a local binding named `state` would shadow the `$state` rune below.
	let { entries, state: moveState, items, homes, asOfDate }: Props = $props();

	const METRICS: { id: HistoryMetric; label: string }[] = [
		{ id: 'totalMonthly', label: 'Monthly Payment' },
		{ id: 'loanAmount', label: 'Loan Amount' },
		{ id: 'availableCash', label: 'Available Cash' }
	];

	let metric = $state<HistoryMetric>('totalMonthly');

	const points = $derived(costToMoveSeries(entries, moveState, items, homes));
	const summary = $derived(summarizeSavings(points, moveState));
	const hasProjection = $derived(points.some((p) => p.projected !== null));
	const spanLabel = $derived.by(() => {
		if (!summary) return '';
		if (summary.months > 0) return formatDuration(summary.months);
		return summary.spanDays === 1 ? '1 day' : `${summary.spanDays} days`;
	});

	function formatDateLabel(iso: string): string {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const chartData = $derived.by(() => {
		const labels = points.map((p) => formatDateLabel(p.date));
		const highlight = points.map((p) => (asOfDate && p.date === asOfDate ? 6 : 3));

		const datasets = [
			{
				label: 'At the time',
				data: points.map((p) => p[metric]),
				borderColor: '#3b82f6',
				backgroundColor: 'rgba(59, 130, 246, 0.15)',
				borderWidth: 2,
				pointRadius: highlight,
				tension: 0.2,
				fill: false,
				spanGaps: true
			}
		];

		if (hasProjection) {
			datasets.push({
				label: 'Projected at move date',
				// Gaps once an entry sits at/past the move date — nothing left to project.
				data: points.map((p) => p.projected?.[metric] ?? (null as unknown as number)),
				borderColor: '#f59e0b',
				backgroundColor: 'rgba(245, 158, 11, 0.15)',
				borderWidth: 2,
				pointRadius: highlight,
				tension: 0.2,
				fill: false,
				spanGaps: true
			});
		}

		return { labels, datasets };
	});

	const chartOptions: ChartOptions<'line'> = $derived({
		responsive: true,
		maintainAspectRatio: false,
		interaction: { mode: 'index', intersect: false },
		plugins: {
			legend: {
				display: hasProjection,
				position: 'bottom',
				labels: { boxWidth: 12, font: { size: 11 } }
			},
			tooltip: {
				callbacks: {
					label: (ctx) => `${ctx.dataset.label ?? ''}: ${formatCurrency(ctx.parsed.y ?? 0)}`
				}
			}
		},
		scales: {
			y: {
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

<section class="card bg-base-100 shadow-sm">
	<div class="card-body gap-3 p-4">
		<header class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Progress over time</h2>
				<p class="text-xs text-base-content/70">
					Each journal entry re-run through today's assumptions.
				</p>
			</div>
			<div role="tablist" class="tabs-box tabs tabs-sm">
				{#each METRICS as m (m.id)}
					<button
						type="button"
						role="tab"
						aria-selected={metric === m.id}
						class="tab"
						class:tab-active={metric === m.id}
						onclick={() => (metric = m.id)}
					>
						{m.label}
					</button>
				{/each}
			</div>
		</header>

		<div class="relative h-64 w-full">
			{#key metric + '|' + points.length + '|' + hasProjection}
				<Line data={chartData} options={chartOptions} />
			{/key}
		</div>

		{#if summary}
			<div class="stats w-full stats-vertical bg-base-200 sm:stats-horizontal">
				<div class="stat p-3">
					<div class="stat-title text-xs">Cash saved</div>
					<div
						class="num stat-value text-lg"
						class:text-success={summary.cashChange > 0}
						class:text-error={summary.cashChange < 0}
					>
						{summary.cashChange >= 0 ? '+' : ''}{formatCurrency(summary.cashChange)}
					</div>
					<div class="stat-desc">over {spanLabel}</div>
				</div>

				<div class="stat p-3">
					<div class="stat-title text-xs">Savings rate</div>
					<div class="num stat-value text-lg">{formatCurrency(summary.cashPerMonth)}</div>
					<div class="stat-desc">per month, averaged</div>
				</div>

				<div class="stat p-3">
					<div class="stat-title text-xs">Monthly payment</div>
					<div
						class="num stat-value text-lg"
						class:text-success={summary.monthlyPaymentChange < 0}
						class:text-error={summary.monthlyPaymentChange > 0}
					>
						{summary.monthlyPaymentChange >= 0 ? '+' : ''}{formatCurrency(
							summary.monthlyPaymentChange
						)}
					</div>
					<div class="stat-desc">change since first entry</div>
				</div>

				{#if summary.monthsToFullyFunded !== null}
					<div class="stat p-3">
						<div class="stat-title text-xs">Fully funded in</div>
						<div class="num stat-value text-lg">
							{formatDuration(summary.monthsToFullyFunded)}
						</div>
						<div class="stat-desc">at this rate, no loan needed</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
