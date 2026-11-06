<script lang="ts">
	import { toastMessage, clearToast } from '$lib/stores/toast';
</script>

{#if $toastMessage}
	<div class="toast toast-end toast-bottom z-50">
		<div class="alert alert-success">
			<span class="text-sm">{$toastMessage}</span>
			<button type="button" class="btn btn-ghost btn-xs" onclick={clearToast} aria-label="Dismiss">
				✕
			</button>
		</div>
	</div>
{/if}
