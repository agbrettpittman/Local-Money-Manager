import { test, expect } from '@playwright/test';

// Each Playwright test runs in a fresh browser context => empty IndexedDB,
// simulating a first-time friend loading the app.

const routes = ['/', '/journal', '/assets-and-liabilities', '/cost-to-move'];

for (const route of routes) {
	test(`renders ${route} on a fresh (empty) profile`, async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

		await page.goto(route);

		await expect(page.locator('.navbar')).toBeVisible();
		await expect(page.locator('footer')).toHaveText(/^v\d+\.\d+\.\d+$/);
		expect(errors, `console/page errors on ${route}`).toEqual([]);
	});
}

test('refuses to start when stored data cannot be read', async ({ page }) => {
	// Corrupt storage must not fall through to an empty app — that would overwrite
	// whatever was really there on the next save.
	await page.addInitScript(() => {
		localStorage.setItem('lmm:data', '{ not valid json');
	});

	await page.goto('/');

	await expect(page.getByText(/could not load your data/i)).toBeVisible();
	await expect(page.locator('.navbar')).toHaveCount(0);
});
