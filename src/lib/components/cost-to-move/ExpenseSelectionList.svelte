<script lang="ts">
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import {
		setExpenseAmountOverride,
		setExpenseGrowthField,
		toggleExpense,
		toggleExpenseGrowth
	} from '$lib/cost-to-move/actions';
	import { parentItemIds } from '$lib/cost-to-move/calc';
	import { defaultExpenseSelection } from '$lib/cost-to-move/defaults';
	import type { CostToMoveState, Frequency, Item } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
		items: Item[];
		latestAmounts: Record<string, number>;
	}
	let { state, items, latestAmounts }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const itemsById = $derived(new Map(items.map((i) => [i.id, i])));
	const parents = $derived(parentItemIds(items));
	const liabilities = $derived(
		items
			.filter((i) => i.kind === 'liability' && !i.archivedAt && !i.homeId && !parents.has(i.id))
			.sort(byParentGroup)
	);

	function parentName(item: Item): string | null {
		if (!item.parentId) return null;
		return itemsById.get(item.parentId)?.name ?? null;
	}

	function byParentGroup(a: Item, b: Item): number {
		const groupA = parentName(a) ?? a.name;
		const groupB = parentName(b) ?? b.name;
		const cmp = groupA.localeCompare(groupB);
		if (cmp !== 0) return cmp;
		return a.name.localeCompare(b.name);
	}

	function selFor(itemId: string) {
		return state.expenseSelections[itemId] ?? defaultExpenseSelection();
	}

	function effectiveAmount(itemId: string): number {
		const sel = selFor(itemId);
		return sel.amountOverride ?? latestAmounts[itemId] ?? 0;
	}

	const FREQS: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title text-base">Liabilities to settle</h2>
		<p class="text-sm text-base-content/70">
			Pick which journal liabilities you'll pay off before moving (default: none).
		</p>

		{#if liabilities.length === 0}
			<div class="alert">
				<span>No liabilities in your journal yet.</span>
			</div>
		{:else}
			<ul class="divide-y divide-base-200">
				{#each liabilities as item (item.id)}
					{@const sel = selFor(item.id)}
					{@const everLogged = item.id in latestAmounts}
					<li class="py-2">
						<div class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={sel.enabled}
								onchange={() => toggleExpense(item.id)}
								aria-label="Settle {item.name}"
								class="toggle toggle-sm"
							/>
							<span class="flex-1 truncate text-sm">
								{#if parentName(item)}
									<span class="text-base-content/60">{parentName(item)} ›</span>
								{/if}
								{item.name}
								{#if !everLogged}
									<span class="badge badge-ghost badge-xs">never logged</span>
								{/if}
							</span>
							<div class="w-32">
								<MoneyInput
									value={effectiveAmount(item.id)}
									disabled={!sel.enabled}
									onCommit={(v) => {
										const latest = latestAmounts[item.id] ?? 0;
										setExpenseAmountOverride(item.id, v === latest ? undefined : v);
									}}
								/>
							</div>
							{#if future}
								<button
									type="button"
									class="btn btn-square btn-sm"
									class:btn-warning={sel.hasGrowth}
									class:btn-outline={!sel.hasGrowth}
									title="Configure growth over time"
									disabled={!sel.enabled}
									onclick={() => toggleExpenseGrowth(item.id)}
								>
									📈
								</button>
							{/if}
						</div>

						{#if future && sel.enabled && sel.hasGrowth}
							<div class="mt-2 ml-6 grid gap-2 rounded-lg bg-warning/10 p-3 sm:grid-cols-2">
								<label class="form-control">
									<div class="label py-0">
										<span class="label-text text-xs">Annual growth (%)</span>
									</div>
									<input
										type="number"
										step="0.1"
										value={sel.growthConfig.annualGrowthRate}
										oninput={(e) =>
											setExpenseGrowthField(
												item.id,
												'annualGrowthRate',
												e.currentTarget.valueAsNumber || 0
											)}
										class="input input-xs w-full text-right"
									/>
								</label>
								<label class="form-control">
									<div class="label py-0"><span class="label-text text-xs">Compounds</span></div>
									<select
										value={sel.growthConfig.growthFrequency}
										onchange={(e) =>
											setExpenseGrowthField(
												item.id,
												'growthFrequency',
												e.currentTarget.value as Frequency
											)}
										class="select w-full select-xs"
									>
										{#each FREQS as f (f)}
											<option value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
										{/each}
									</select>
								</label>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
