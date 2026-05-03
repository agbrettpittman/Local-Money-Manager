<script lang="ts">
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import {
		setAssetAmountOverride,
		setAssetInvestmentField,
		toggleAsset,
		toggleAssetInvestment
	} from '$lib/cost-to-move/actions';
	import { calcFutureAssetValue, parentItemIds } from '$lib/cost-to-move/calc';
	import { defaultAssetSelection } from '$lib/cost-to-move/defaults';
	import { formatCurrency } from '$lib/format';
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
	const assets = $derived(
		items
			.filter((i) => i.kind === 'asset' && !i.archivedAt && !i.homeId && !parents.has(i.id))
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
		return state.assetSelections[itemId] ?? defaultAssetSelection();
	}

	function effectiveAmount(itemId: string): number {
		const sel = selFor(itemId);
		return sel.amountOverride ?? latestAmounts[itemId] ?? 0;
	}

	function projected(itemId: string): number {
		const sel = selFor(itemId);
		return calcFutureAssetValue(effectiveAmount(itemId), sel, state);
	}

	const FREQS: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title text-base">Assets</h2>
		<p class="text-sm text-base-content/70">
			Toggle which journal assets to include. Amounts default to the latest journal value.
		</p>

		{#if assets.length === 0}
			<div class="alert">
				<span>
					No assets in your journal yet.
					<a href="/journal" class="link">Add one</a> in the Networth Journal.
				</span>
			</div>
		{:else}
			<ul class="divide-y divide-base-200">
				{#each assets as item (item.id)}
					{@const sel = selFor(item.id)}
					{@const everLogged = item.id in latestAmounts}
					<li class="py-2">
						<div class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={sel.enabled}
								onchange={() => toggleAsset(item.id)}
								aria-label="Include {item.name}"
								class="toggle toggle-primary toggle-sm"
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
										setAssetAmountOverride(item.id, v === latest ? undefined : v);
									}}
								/>
							</div>
							{#if future}
								<button
									type="button"
									class="btn btn-square btn-sm"
									class:btn-success={sel.isInvestment}
									class:btn-outline={!sel.isInvestment}
									title="Configure as investment"
									disabled={!sel.enabled}
									onclick={() => toggleAssetInvestment(item.id)}
								>
									📈
								</button>
							{/if}
						</div>

						{#if future && sel.enabled && sel.isInvestment}
							<div class="mt-2 ml-6 grid gap-2 rounded-lg bg-success/10 p-3 sm:grid-cols-3">
								<label class="form-control">
									<div class="label py-0">
										<span class="label-text text-xs">Annual return (%)</span>
									</div>
									<input
										type="number"
										step="0.1"
										value={sel.investmentConfig.annualReturnRate}
										oninput={(e) =>
											setAssetInvestmentField(
												item.id,
												'annualReturnRate',
												e.currentTarget.valueAsNumber || 0
											)}
										class="input input-xs w-full text-right"
									/>
								</label>
								<label class="form-control">
									<div class="label py-0">
										<span class="label-text text-xs">Contribution ($)</span>
									</div>
									<input
										type="number"
										step="1"
										min="0"
										value={sel.investmentConfig.contributionAmount}
										oninput={(e) =>
											setAssetInvestmentField(
												item.id,
												'contributionAmount',
												e.currentTarget.valueAsNumber || 0
											)}
										class="input input-xs w-full text-right"
									/>
								</label>
								<label class="form-control">
									<div class="label py-0"><span class="label-text text-xs">Frequency</span></div>
									<select
										value={sel.investmentConfig.contributionFrequency}
										onchange={(e) =>
											setAssetInvestmentField(
												item.id,
												'contributionFrequency',
												e.currentTarget.value as Frequency
											)}
										class="select w-full select-xs"
									>
										{#each FREQS as f (f)}
											<option value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
										{/each}
									</select>
								</label>
								<p class="text-xs text-success sm:col-span-3">
									Projected at move date:
									<strong class="num">{formatCurrency(projected(item.id))}</strong>
								</p>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
