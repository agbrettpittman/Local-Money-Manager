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

	const DISMISS_DAYS = 7;

	const hasData = $derived($allItems.length > 0 || $allEntries.length > 0);
	const staleDays = $derived($lastBackupAt === null ? Infinity : daysSince($lastBackupAt));
	const snoozed = $derived($reminderDismissedUntil > Date.now());
	const show = $derived(!snoozed && hasData && staleDays >= REMINDER_AFTER_DAYS);

	const message = $derived(
		$lastBackupAt === null
			? "You haven't exported a backup yet."
			: `Your last backup was ${Math.floor(staleDays)} days ago.`
	);
</script>

{#if show}
	<div class="alert alert-warning" role="status">
		<span class="text-sm">
			{message} Your data lives only in this browser — export a backup so you don't lose it.
		</span>
		<div class="flex gap-2">
			<button type="button" class="btn btn-sm" onclick={() => downloadBackup()}>Export now</button>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => dismissReminderFor(DISMISS_DAYS)}
			>
				Dismiss for {DISMISS_DAYS} days
			</button>
		</div>
	</div>
{/if}
