<script lang="ts">
	import type { CostToMoveState, Home } from '$lib/db/types';
	import { setHomeSelection } from '$lib/cost-to-move/actions';
	import { calcMortgageStatus, isHomeSelected, projectHome } from '$lib/cost-to-move/calc';
	import { formatCurrency } from '$lib/format';

	interface Props {
		state: CostToMoveState;
		homes: Home[];
		latestAmounts: Record<string, number>;
	}
	let { state, homes, latestAmounts }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const activeHomes = $derived(homes.filter((h) => !h.archivedAt));
	const totalSelected = $derived(
		activeHomes
			.filter((h) => isHomeSelected(state, h))
			.reduce((sum, h) => sum + projectHome(h, state, latestAmounts).netProceeds, 0)
	);

	function formatPayoffDate(iso: string): string {
		const [y, m] = iso.split('-').map(Number);
		const dt = new Date(y, (m ?? 1) - 1, 1);
		return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function formatMonthsAsYears(months: number): string {
		const yrs = Math.floor(months / 12);
		const mos = months % 12;
		const parts: string[] = [];
		if (yrs > 0) parts.push(`${yrs}y`);
		if (mos > 0 || yrs === 0) parts.push(`${mos}m`);
		return parts.join(' ');
	}
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="card-title text-base">Owned Homes</h2>
				<p class="text-sm text-base-content/70">
					Toggle which homes you'll sell as part of the move. Edit home details on the
					<a href="/journal" class="link">Journal page</a>.
				</p>
			</div>
		</div>

		{#if activeHomes.length === 0}
			<div class="alert">
				<span>
					No homes yet. <a href="/journal" class="link">Add one in the Journal</a> to compute net proceeds
					toward your next home.
				</span>
			</div>
		{:else}
			<ul class="divide-y divide-base-200">
				{#each activeHomes as home (home.id)}
					{@const projection = projectHome(home, state, latestAmounts)}
					{@const enabled = isHomeSelected(state, home)}
					{@const valueLogged = home.valueItemId in latestAmounts}
					{@const mortgageLogged = home.mortgageItemId in latestAmounts}
					{@const currentBalance = latestAmounts[home.mortgageItemId] ?? 0}
					{@const status = calcMortgageStatus(home, currentBalance)}
					<li class="py-3">
						<div class="flex items-center gap-3">
							<input
								type="checkbox"
								checked={enabled}
								onchange={(e) => setHomeSelection(home.id, e.currentTarget.checked)}
								aria-label="Sell {home.name}"
								class="toggle toggle-primary toggle-sm"
							/>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline gap-2">
									<span class="truncate font-medium">{home.name}</span>
									{#if !valueLogged && !mortgageLogged}
										<span class="badge badge-ghost badge-xs">never logged</span>
									{/if}
								</div>
								<div class="num text-xs text-base-content/60">
									Value {formatCurrency(projection.value)} · Mortgage {formatCurrency(
										projection.mortgage
									)} · Selling cost {formatCurrency(projection.sellingCost)}
								</div>
							</div>
							<div class="text-right">
								<div class="text-xs text-base-content/50 uppercase">
									Net {future ? '(est.)' : ''}
								</div>
								<div
									class="num font-semibold"
									class:text-success={projection.netProceeds >= 0}
									class:text-error={projection.netProceeds < 0}
								>
									{formatCurrency(projection.netProceeds)}
								</div>
							</div>
						</div>

						{#if status}
							<div class="mt-2 ml-9 space-y-1">
								<div class="flex items-center justify-between text-xs text-base-content/70">
									<span>
										<span class="num">{formatMonthsAsYears(status.monthsElapsed)}</span> of
										<span class="num">{formatMonthsAsYears(status.totalMonths)}</span>
										elapsed
									</span>
									<span class="num">
										{status.percentComplete.toFixed(1)}%
									</span>
								</div>
								<progress
									class="progress w-full progress-primary"
									value={status.percentComplete}
									max="100"
								></progress>
								<div class="num flex flex-wrap gap-x-3 text-xs text-base-content/60">
									<span>
										P&amp;I {formatCurrency(status.monthlyPayment)}/mo
									</span>
									{#if status.originalPrincipal > 0 && status.monthsElapsed > 0}
										<span>
											Original ≈{formatCurrency(status.originalPrincipal)}
										</span>
									{/if}
									<span>
										Payoff: {formatPayoffDate(status.payoffDate)}
									</span>
									<span>
										{formatMonthsAsYears(status.monthsRemaining)} remaining
									</span>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="mt-2 alert py-2 text-sm alert-info">
				<span>Combined net proceeds from selected homes:</span>
				<span class="num font-semibold">{formatCurrency(totalSelected)}</span>
			</div>
		{/if}
	</div>
</div>
