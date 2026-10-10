import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setBackendForTests, flush, getSnapshot, initStorage, mutate } from './store';
import { emptySnapshot, type Snapshot } from './snapshot';
import type { PersistBackend } from './persist';

function fakeBackend(initial: Snapshot | null = null) {
	const saves: Snapshot[] = [];
	const backend: PersistBackend = {
		name: 'fake',
		load: vi.fn(async () => initial),
		save: vi.fn(async (snap: Snapshot) => {
			saves.push(structuredClone(snap));
		})
	};
	return { backend, saves };
}

const withItem = (name: string): Snapshot => ({
	...emptySnapshot(),
	items: [{ id: 'i1', name, kind: 'asset', createdAt: '2026-01-01T00:00:00Z' }]
});

describe('storage store', () => {
	beforeEach(() => {
		__setBackendForTests(fakeBackend().backend);
	});

	it('loads the backend snapshot on init', async () => {
		const { backend } = fakeBackend(withItem('Checking'));
		__setBackendForTests(backend);

		await initStorage();

		expect(getSnapshot().items[0].name).toBe('Checking');
	});

	it('starts empty when the backend has nothing stored', async () => {
		const { backend } = fakeBackend(null);
		__setBackendForTests(backend);

		await initStorage();

		expect(getSnapshot()).toEqual(emptySnapshot());
	});

	it('persists a mutation on flush', async () => {
		const { backend, saves } = fakeBackend();
		__setBackendForTests(backend);
		await initStorage();

		await mutate((draft) => {
			draft.items.push({ id: 'x', name: 'New', kind: 'asset', createdAt: 'now' });
		});
		await flush();

		expect(saves).toHaveLength(1);
		expect(saves[0].items[0].name).toBe('New');
	});

	it('does not write before a successful load', async () => {
		const { backend, saves } = fakeBackend();
		__setBackendForTests(backend);

		// No initStorage() — simulates load having failed.
		await mutate((draft) => {
			draft.items.push({ id: 'x', name: 'New', kind: 'asset', createdAt: 'now' });
		});
		await flush();

		expect(saves).toEqual([]);
		expect(backend.save).not.toHaveBeenCalled();
	});

	it('leaves the working set untouched when a mutation throws', async () => {
		const { backend } = fakeBackend(withItem('Original'));
		__setBackendForTests(backend);
		await initStorage();

		await expect(
			mutate((draft) => {
				draft.items[0].name = 'Half-applied';
				throw new Error('nope');
			})
		).rejects.toThrow('nope');

		expect(getSnapshot().items[0].name).toBe('Original');
	});

	it('returns the callback result', async () => {
		const { backend } = fakeBackend();
		__setBackendForTests(backend);
		await initStorage();

		await expect(mutate(() => 42)).resolves.toBe(42);
	});

	it('propagates a load failure rather than starting empty', async () => {
		const backend: PersistBackend = {
			name: 'broken',
			load: vi.fn(async () => {
				throw new Error('corrupt');
			}),
			save: vi.fn()
		};
		__setBackendForTests(backend);

		await expect(initStorage()).rejects.toThrow('corrupt');
		expect(backend.save).not.toHaveBeenCalled();
	});
});
