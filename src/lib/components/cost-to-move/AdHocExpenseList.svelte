<script lang="ts">
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import {
		addAdHoc,
		removeAdHoc,
		setAdHocGrowthField,
		toggleAdHocGrowth,
		updateAdHoc
	} from '$lib/cost-to-move/actions';
	import type { AdHocExpense, CostToMoveState, Frequency } from '$lib/db/types';

	interface Props {
		state: CostToMoveState;
		bucket: 'adHocExpenses' | 'currentHomeExpenses';
		title: string;
		description?: string;
	}
	let { state, bucket, title, description }: Props = $props();

	const future = $derived(state.futureMode.enabled);
	const items = $derived<AdHocExpense[]>(state[bucket]);

	const FREQS: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h2 class="card-title text-base">{title}</h2>
		{#if description}
			<p class="text-sm text-base-content/70">{description}</p>
		{/if}

		{#if items.length === 0}
			<p class="text-sm text-base-content/50">None yet.</p>
		{:else}
			<ul class="divide-y divide-base-200">
				{#each items as item (item.id)}
					<li class="py-2">
						<div class="flex items-center gap-2">
							<input
								type="text"
								placeholder="Name"
								value={item.name}
								oninput={(e) => updateAdHoc(bucket, item.id, { name: e.currentTarget.value })}
								class="input input-sm flex-1"
							/>
							<div class="w-32">
								<MoneyInput
									value={item.amount}
									onCommit={(v) => updateAdHoc(bucket, item.id, { amount: v })}
									ariaLabel="{item.name} amount"
								/>
							</div>
							{#if future}
								<button
									type="button"
									class="btn btn-square btn-sm"
									class:btn-warning={item.hasGrowth}
									class:btn-outline={!item.hasGrowth}
									title="Configure growth over time"
									onclick={() => toggleAdHocGrowth(bucket, item.id)}
								>
									📈
								</button>
							{/if}
							<button
								type="button"
								class="btn btn-square btn-ghost btn-sm"
								aria-label="Remove"
								onclick={() => removeAdHoc(bucket, item.id)}
							>
								✕
							</button>
						</div>

						{#if future && item.hasGrowth}
							<div class="mt-2 grid gap-2 rounded-lg bg-warning/10 p-3 sm:grid-cols-2">
								<label class="form-control">
									<div class="label py-0">
										<span class="label-text text-xs">Annual growth (%)</span>
									</div>
									<input
										type="number"
										step="0.1"
										value={item.growthConfig.annualGrowthRate}
										oninput={(e) =>
											setAdHocGrowthField(
												bucket,
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
										value={item.growthConfig.growthFrequency}
										onchange={(e) =>
											setAdHocGrowthField(
												bucket,
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

		<button type="button" class="btn w-full btn-outline btn-sm" onclick={() => addAdHoc(bucket)}>
			+ Add {title.toLowerCase()}
		</button>
	</div>
</div>
