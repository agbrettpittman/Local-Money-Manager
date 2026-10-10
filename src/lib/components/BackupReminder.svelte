<script lang="ts">
	import { allItems } from '$lib/stores/items';
	import { allEntries } from '$lib/stores/entries';
	import {
		lastBackupAt,
		reminderDismissedUntil,
		dismissReminderFor,
		daysSince,
		downloadBackup,
		REMINDER_AFTER_DAYS
	} from '$lib/backup/backup';
	import { isDesktop } from '$lib/platform';

	const DISMISS_DAYS = 7;
	const URGENT_AFTER_DAYS = 45;

	const hasData = $derived($allItems.length > 0 || $allEntries.length > 0);
	const neverBackedUp = $derived($lastBackupAt === null);
	const staleDays = $derived($lastBackupAt === null ? Infinity : daysSince($lastBackupAt));
	const snoozed = $derived($reminderDismissedUntil > Date.now());
	const show = $derived(!snoozed && hasData && staleDays >= REMINDER_AFTER_DAYS);

	// Never backed up, or long past due — this is the case that loses everything.
	const urgent = $derived(neverBackedUp || staleDays >= URGENT_AFTER_DAYS);

	const message = $derived(
		neverBackedUp
			? "You've never exported a backup."
			: `Your last backup was ${Math.floor(staleDays)} days ago.`
	);
</script>

{#if show}
	<!-- flex overrides daisyUI's grid: its auto columns let the buttons overflow the
	     alert's padding box once the message wraps. -->
	<div
		class="alert {urgent
			? 'alert-error'
			: 'alert-warning'} flex flex-wrap items-start justify-between gap-3"
		role="status"
	>
		<div class="min-w-0 flex-1 text-sm">
			<p class="font-semibold">{message}</p>
			<p class="opacity-90">
				{#if isDesktop}
					Your data is one file on this computer. If that file is deleted or this machine fails,
					it's gone with no way back — an exported backup is the only copy that survives.
				{:else}
					This data exists only in this browser. Switching browsers, resetting your profile, or
					clearing site data erases it with no way back — exporting is the only copy that survives.
				{/if}
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			<button type="button" class="btn btn-sm" onclick={() => downloadBackup()}>Export now</button>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => dismissReminderFor(DISMISS_DAYS)}
			>
				Later
			</button>
		</div>
	</div>
{/if}
