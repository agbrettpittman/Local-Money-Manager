import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataFilePath, localStorageBackend, selectBackend, tauriBackend } from './persist';
import { emptySnapshot, ENVELOPE_VERSION, type Snapshot } from './snapshot';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
	invoke,
	// Mirrors the real helper, which reads a flag the Tauri host sets on globalThis.
	isTauri: () => Boolean((globalThis as { isTauri?: boolean }).isTauri)
}));

const withItem = (name: string): Snapshot => ({
	...emptySnapshot(),
	items: [{ id: 'i1', name, kind: 'asset', createdAt: '2026-01-01T00:00:00Z' }]
});

function asTauriHost(): void {
	(globalThis as { isTauri?: boolean }).isTauri = true;
}

afterEach(() => {
	delete (globalThis as { isTauri?: boolean }).isTauri;
	invoke.mockReset();
});

describe('selectBackend', () => {
	it('uses localStorage off a Tauri host', () => {
		expect(selectBackend()).toBe(localStorageBackend);
	});

	it('uses the Tauri backend on a Tauri host', () => {
		asTauriHost();
		expect(selectBackend()).toBe(tauriBackend);
	});
});

describe('tauriBackend', () => {
	it('returns null when no data file exists yet', async () => {
		invoke.mockResolvedValueOnce(null);
		await expect(tauriBackend.load()).resolves.toBeNull();
		expect(invoke).toHaveBeenCalledWith('load_data');
	});

	it('parses a stored envelope', async () => {
		invoke.mockResolvedValueOnce(
			JSON.stringify({
				version: ENVELOPE_VERSION,
				exportedAt: '2026-01-01T00:00:00Z',
				...withItem('Checking'),
				costToMove: null
			})
		);
		const snap = await tauriBackend.load();
		expect(snap?.items[0].name).toBe('Checking');
	});

	it('rejects rather than returning empty when the file is corrupt', async () => {
		invoke.mockResolvedValueOnce('{ not valid json');
		await expect(tauriBackend.load()).rejects.toThrow();
	});

	it('sends indented envelope JSON to the Rust side', async () => {
		invoke.mockResolvedValueOnce(undefined);
		await tauriBackend.save(withItem('Savings'));

		const [command, args] = invoke.mock.calls[0];
		expect(command).toBe('save_data');
		const contents = (args as { contents: string }).contents;
		expect(contents).toContain('\n  ');
		expect(JSON.parse(contents)).toMatchObject({ version: ENVELOPE_VERSION });
	});
});

describe('dataFilePath', () => {
	it('is null on the web', async () => {
		await expect(dataFilePath()).resolves.toBeNull();
		expect(invoke).not.toHaveBeenCalled();
	});

	it('asks the Rust side on a Tauri host', async () => {
		asTauriHost();
		invoke.mockResolvedValueOnce('/home/u/.local/share/app/data.json');
		await expect(dataFilePath()).resolves.toBe('/home/u/.local/share/app/data.json');
	});
});

describe('localStorageBackend', () => {
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it('round-trips a snapshot', async () => {
		await localStorageBackend.save(withItem('Brokerage'));
		const snap = await localStorageBackend.load();
		expect(snap?.items[0].name).toBe('Brokerage');
	});

	it('returns null when nothing is stored', async () => {
		await expect(localStorageBackend.load()).resolves.toBeNull();
	});
});
