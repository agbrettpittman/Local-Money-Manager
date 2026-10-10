import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/backup.json', import.meta.url));

/** Row counts straight out of the persisted data file. */
function storedCounts(page: Page) {
	return page.evaluate(() => {
		const raw = localStorage.getItem('lmm:data');
		if (raw === null) return null;
		const env = JSON.parse(raw);
		return {
			items: env.items.length,
			homes: env.homes.length,
			journalEntries: env.journalEntries.length,
			costToMove: env.costToMove ? 1 : 0
		};
	});
}

async function chooseFile(page: Page) {
	await page.getByRole('button', { name: /Data/ }).click();
	await page.getByRole('button', { name: 'Import from JSON' }).click();
	await page.setInputFiles('input[type=file]', fixture);
	await expect(page.getByText('Import backup')).toBeVisible();
}

test('imports a JSON backup and persists it', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

	await page.goto('/');
	await chooseFile(page);
	await expect(page.getByText('11 items', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Replace all' }).click();
	await expect(page.getByText('Import backup')).toBeHidden();

	await page.goto('/journal');
	await expect(page.getByText('2026-05-02')).toBeVisible();

	// Writes are debounced, so persistence is an eventual assertion.
	await expect
		.poll(() => storedCounts(page))
		.toEqual({
			items: 11,
			homes: 1,
			journalEntries: 2,
			costToMove: 1
		});
	expect(errors, 'console/page errors during import').toEqual([]);

	// Cost To Move's history chart and as-of picker only appear once entries exist.
	await page.goto('/cost-to-move');
	const asOf = page.getByLabel('Journal entry to base figures on');
	await expect(asOf).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Progress over time' })).toBeVisible();

	await asOf.selectOption({ index: 2 });
	await expect(page.getByText(/Showing balances as of/)).toBeVisible();
	await page.getByRole('button', { name: 'Back to latest' }).click();
	await expect(page.getByText(/Showing balances as of/)).toBeHidden();

	expect(errors, 'console/page errors on cost-to-move').toEqual([]);
});

test('merging a backup that is already loaded changes nothing', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

	await page.goto('/');
	await chooseFile(page);
	await page.getByRole('button', { name: 'Replace all' }).click();
	await expect(page.getByText('Import backup')).toBeHidden();

	await expect.poll(() => storedCounts(page)).not.toBeNull();
	const before = await storedCounts(page);

	await chooseFile(page);
	await expect(page.getByText('Add 0 items and 0 entries')).toBeVisible();
	await page.getByRole('button', { name: 'Merge' }).click();
	await expect(page.getByText('Import backup')).toBeHidden();

	await expect.poll(() => storedCounts(page)).toEqual(before);
	expect(errors, 'console/page errors during merge').toEqual([]);
});

test('a fresh profile offers to import a backup', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByText('Nothing stored in this browser yet')).toBeVisible();
	await page.getByRole('button', { name: 'Import a backup' }).click();
	await page.setInputFiles('input[type=file]', fixture);

	await expect(page.getByText('Import backup')).toBeVisible();
	await page.getByRole('button', { name: 'Merge' }).click();

	await expect(page.getByText('Nothing stored in this browser yet')).toBeHidden();
	await expect
		.poll(() => storedCounts(page))
		.toEqual({
			items: 11,
			homes: 1,
			journalEntries: 2,
			costToMove: 0
		});
});

test('a journal edit survives a reload', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

	await page.goto('/');
	await chooseFile(page);
	await page.getByRole('button', { name: 'Replace all' }).click();
	await expect(page.getByText('Import backup')).toBeHidden();

	await page.goto('/journal');
	await page.getByRole('button', { name: '+ New entry (today)' }).click();

	// Entries render newest first, so today's new one leads.
	const todaysEntry = page.locator('[id^="entry-"]').first();
	const amount = todaysEntry.getByLabel('Checking amount');
	await expect(amount).toBeVisible();
	await amount.fill('1234.56');
	await amount.blur();

	// The whole point of the storage rewrite: a reload must not lose this.
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('lmm:data')?.includes('1234.56')))
		.toBe(true);
	await page.reload();

	const reloaded = page.locator('[id^="entry-"]').first();
	await reloaded.getByLabel(/^Toggle entry for/).check();
	await expect(reloaded.getByLabel('Checking amount')).toHaveValue(/1,?234\.56/);
	expect(errors, 'console/page errors during journal edit').toEqual([]);
});
