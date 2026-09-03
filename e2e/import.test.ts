import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/backup.json', import.meta.url));

test('imports a JSON backup into IndexedDB', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

	await page.goto('/');
	await page.getByRole('button', { name: /Data/ }).click();
	await page.getByRole('button', { name: 'Import from JSON' }).click();
	await page.setInputFiles('input[type=file]', fixture);

	await expect(page.getByText('Replace all data?')).toBeVisible();
	await expect(page.getByText('11 items')).toBeVisible();
	await page.getByRole('button', { name: 'Replace' }).click();
	await expect(page.getByText('Replace all data?')).toBeHidden();

	await page.goto('/journal');
	await expect(page.getByText('2026-05-02')).toBeVisible();

	// The whole envelope must survive the structured clone into IndexedDB.
	const counts = await page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const req = indexedDB.open('LocalMoneyManagerDB');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const names = [...db.objectStoreNames];
					const tx = db.transaction(names, 'readonly');
					const out: Record<string, number> = {};
					let left = names.length;
					for (const n of names) {
						const c = tx.objectStore(n).count();
						c.onsuccess = () => {
							out[n] = c.result;
							if (--left === 0) resolve(out);
						};
					}
				};
			})
	);
	expect(counts).toEqual({ items: 11, homes: 1, journalEntries: 2, costToMove: 1 });
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
