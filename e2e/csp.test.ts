import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/backup.json', import.meta.url));
const builtIndex = fileURLToPath(new URL('../build/index.html', import.meta.url));

/** The policy SvelteKit actually emitted into the built page. */
function shippedCsp(): string {
	const html = readFileSync(builtIndex, 'utf8');
	const match = /<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(html);
	if (!match) throw new Error('no CSP meta tag in build/index.html');
	return match[1];
}

test('the shipped policy blocks inline and remote script', () => {
	const csp = shippedCsp();
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("object-src 'none'");
	// The bootstrap script is allowed by hash, never by a blanket unsafe-inline —
	// that distinction is the whole point of the policy.
	expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
	expect(csp).not.toContain('unsafe-eval');
	expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
});

test('the app boots and exports a backup under the shipped policy', async ({ page }) => {
	const violations: string[] = [];
	const errors: string[] = [];
	page.on('console', (m) => {
		const text = m.text();
		if (/content security policy/i.test(text)) violations.push(text);
		else if (m.type() === 'error') errors.push(text);
	});
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

	// The preview server serves build/, so the meta policy above is live here.
	await page.goto('/');
	await expect(page.locator('.navbar')).toBeVisible();

	await page.getByRole('button', { name: 'Import a backup' }).click();
	await page.setInputFiles('input[type=file]', fixture);
	await expect(page.getByText('Import backup')).toBeVisible();
	await page.getByRole('button', { name: 'Merge' }).click();
	await expect(page.getByText('Nothing saved yet')).toBeHidden();

	// Export builds a blob: URL and clicks a download link — the thing a strict
	// default-src is most likely to break.
	const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
	await page.getByRole('button', { name: /Data/ }).click();
	await page.getByRole('button', { name: 'Export to JSON' }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/^local-money-manager-\d{4}-\d{2}-\d{2}\.json$/);

	// It must be a readable envelope, not an empty or truncated blob.
	const path = await download.path();
	const envelope = JSON.parse(readFileSync(path, 'utf8'));
	expect(envelope.version).toBe(1);
	expect(envelope.items.length).toBeGreaterThan(0);

	expect(violations, 'CSP violations in console').toEqual([]);
	expect(errors, 'console/page errors').toEqual([]);
});

test('charts and inline styles survive the policy', async ({ page }) => {
	const violations: string[] = [];
	page.on('console', (m) => {
		if (/content security policy/i.test(m.text())) violations.push(m.text());
	});

	await page.goto('/');
	await page.getByRole('button', { name: 'Import a backup' }).click();
	await page.setInputFiles('input[type=file]', fixture);
	await page.getByRole('button', { name: 'Merge' }).click();

	// Chart.js draws to a canvas; the progress bar sets inline widths.
	await expect(page.locator('canvas')).toBeVisible();
	await page.goto('/cost-to-move');
	await expect(page.locator('.navbar')).toBeVisible();

	expect(violations, 'CSP violations in console').toEqual([]);
});
