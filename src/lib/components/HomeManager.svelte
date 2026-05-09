<script lang="ts">
	import { activeHomes } from '$lib/stores/homes';
	import { archiveHome, createHome, updateHome } from '$lib/db/repo';
	import type { Home } from '$lib/db/types';

	let adding = $state(false);
	let saveError = $state<string | null>(null);

	let draftName = $state('');
	let draftSellingCost = $state(7);
	let draftMortgageRate = $state(6.5);
	let draftMortgageYears = $state(30);
	let draftMortgageStartDate = $state('');

	function resetDraft() {
		draftName = '';
		draftSellingCost = 7;
		draftMortgageRate = 6.5;
		draftMortgageYears = 30;
		draftMortgageStartDate = '';
		saveError = null;
	}

	async function handleAdd(e: SubmitEvent) {
		e.preventDefault();
		const name = draftName.trim();
		if (!name) return;
		try {
			await createHome({
				name,
				sellingCostPercent: draftSellingCost,
				mortgageRate: draftMortgageRate,
				mortgageYears: draftMortgageYears,
				mortgageStartDate: draftMortgageStartDate || undefined
			});
			resetDraft();
			adding = false;
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		}
	}

	function commitField<
		K extends keyof Omit<Home, 'id' | 'valueItemId' | 'mortgageItemId' | 'createdAt'>
	>(home: Home, field: K, value: Home[K]) {
		void updateHome(home.id, { [field]: value } as Partial<Home>).catch((err) =>
			console.error('updateHome failed', err)
		);
	}

	async function handleArchive(home: Home) {
		if (
			!confirm(
				`Archive "${home.name}"? Its value and mortgage items will also be archived. Historical entries are kept.`
			)
		)
			return;
		await archiveHome(home.id);
	}
</script>

<details open class="collapse-arrow collapse border border-base-300 bg-base-100">
	<summary class="collapse-title flex items-center gap-2 font-medium">
		🏠 Homes
		<span class="badge badge-sm">{$activeHomes.length}</span>
	</summary>
	<div class="collapse-content space-y-3">
		<p class="text-sm text-base-content/70">
			Each home creates a value asset and a mortgage liability — log monthly amounts on them like
			any other journal items. Selling cost % and mortgage terms here feed the
			<a href="/cost-to-move" class="link">Cost To Move</a> calculator.
		</p>

		{#if $activeHomes.length === 0}
			<div class="alert">
				<span>No homes yet. Add one below.</span>
			</div>
		{:else}
			<div class="space-y-2">
				{#each $activeHomes as home (home.id)}
					<div class="rounded-box border border-base-200 bg-base-200/40 p-3">
						<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							<label class="form-control">
								<div class="label py-0">
									<span class="label-text text-xs font-medium">Name</span>
								</div>
								<input
									type="text"
									value={home.name}
									onchange={(e) => commitField(home, 'name', e.currentTarget.value)}
									class="input input-sm w-full"
								/>
							</label>
							<label class="form-control">
								<div class="label py-0">
									<span class="label-text text-xs font-medium">Selling cost (%)</span>
								</div>
								<input
									type="number"
									step="0.1"
									min="0"
									max="100"
									value={home.sellingCostPercent}
									onchange={(e) =>
										commitField(home, 'sellingCostPercent', e.currentTarget.valueAsNumber || 0)}
									class="input input-sm w-full text-right"
								/>
							</label>
							<label class="form-control">
								<div class="label py-0">
									<span class="label-text text-xs font-medium">Mortgage rate (%)</span>
								</div>
								<input
									type="number"
									step="0.01"
									min="0"
									max="100"
									value={home.mortgageRate}
									onchange={(e) =>
										commitField(home, 'mortgageRate', e.currentTarget.valueAsNumber || 0)}
									class="input input-sm w-full text-right"
								/>
							</label>
							<label class="form-control">
								<div class="label py-0">
									<span class="label-text text-xs font-medium">Original term (years)</span>
								</div>
								<input
									type="number"
									step="1"
									min="0"
									max="50"
									value={home.mortgageYears}
									onchange={(e) =>
										commitField(home, 'mortgageYears', e.currentTarget.valueAsNumber || 0)}
									class="input input-sm w-full text-right"
								/>
							</label>
							<label class="form-control sm:col-span-2">
								<div class="label py-0">
									<span class="label-text text-xs font-medium">Mortgage start date</span>
									<span class="label-text-alt text-xs text-base-content/60">optional</span>
								</div>
								<input
									type="date"
									value={home.mortgageStartDate ?? ''}
									onchange={(e) =>
										commitField(home, 'mortgageStartDate', e.currentTarget.value || undefined)}
									class="input input-sm w-full"
								/>
							</label>
						</div>
						<div class="mt-2 flex justify-end">
							<button
								type="button"
								class="btn btn-outline btn-xs btn-error"
								onclick={() => handleArchive(home)}
							>
								Archive
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if adding}
			<form class="rounded-box border border-dashed border-base-300 p-3" onsubmit={handleAdd}>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					<label class="form-control">
						<div class="label py-0">
							<span class="label-text text-xs font-medium">Name</span>
						</div>
						<input
							type="text"
							placeholder="e.g. Primary Residence"
							bind:value={draftName}
							required
							class="input input-sm w-full"
						/>
					</label>
					<label class="form-control">
						<div class="label py-0">
							<span class="label-text text-xs font-medium">Selling cost (%)</span>
						</div>
						<input
							type="number"
							step="0.1"
							min="0"
							max="100"
							bind:value={draftSellingCost}
							class="input input-sm w-full text-right"
						/>
					</label>
					<label class="form-control">
						<div class="label py-0">
							<span class="label-text text-xs font-medium">Mortgage rate (%)</span>
						</div>
						<input
							type="number"
							step="0.01"
							min="0"
							max="100"
							bind:value={draftMortgageRate}
							class="input input-sm w-full text-right"
						/>
					</label>
					<label class="form-control">
						<div class="label py-0">
							<span class="label-text text-xs font-medium">Original term (years)</span>
						</div>
						<input
							type="number"
							step="1"
							min="0"
							max="50"
							bind:value={draftMortgageYears}
							class="input input-sm w-full text-right"
						/>
					</label>
					<label class="form-control sm:col-span-2">
						<div class="label py-0">
							<span class="label-text text-xs font-medium">Mortgage start date</span>
							<span class="label-text-alt text-xs text-base-content/60">optional</span>
						</div>
						<input type="date" bind:value={draftMortgageStartDate} class="input input-sm w-full" />
					</label>
				</div>
				{#if saveError}
					<div class="mt-2 alert py-1 text-sm alert-error">
						<span>{saveError}</span>
					</div>
				{/if}
				<div class="mt-2 flex justify-end gap-2">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => {
							resetDraft();
							adding = false;
						}}
					>
						Cancel
					</button>
					<button type="submit" class="btn btn-sm btn-primary">+ Add home</button>
				</div>
			</form>
		{:else}
			<button type="button" class="btn w-full btn-outline btn-sm" onclick={() => (adding = true)}>
				+ New home
			</button>
		{/if}
	</div>
</details>
