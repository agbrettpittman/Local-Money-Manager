<script lang="ts">
	import HomeManager from '$lib/components/HomeManager.svelte';
	import ItemManager from '$lib/components/ItemManager.svelte';
</script>

<header>
	<h1 class="text-2xl font-semibold">Assets & Liabilities</h1>
	<p class="text-sm text-base-content/70">
		Manage the things you track. Each new journal entry will be populated from this list.
	</p>
</header>

<HomeManager />

<ItemManager />
