import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const { findUpdate, platform } = vi.hoisted(() => ({
	findUpdate: vi.fn(),
	platform: { isDesktop: true }
}));

vi.mock('$lib/update', () => ({ findUpdate, summarise: (s: string) => s }));
vi.mock('$lib/platform', () => ({
	get isDesktop() {
		return platform.isDesktop;
	}
}));

const fakeUpdate = (version: string) => ({ version, body: 'notes' });

async function freshModule() {
	vi.resetModules();
	return import('./update');
}

describe('update polling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		platform.isDesktop = true;
		findUpdate.mockReset();
	});
	afterEach(() => vi.useRealTimers());

	it('starts with no update', async () => {
		const { availableUpdate } = await freshModule();
		expect(get(availableUpdate)).toBeNull();
	});

	it('publishes an update found at launch', async () => {
		findUpdate.mockResolvedValue(fakeUpdate('1.0.4'));
		const { availableUpdate, startUpdatePolling } = await freshModule();

		const stop = startUpdatePolling();
		await vi.waitFor(() => expect(get(availableUpdate)).not.toBeNull());

		expect(get(availableUpdate)?.version).toBe('1.0.4');
		stop();
	});

	it('does nothing off the desktop', async () => {
		platform.isDesktop = false;
		findUpdate.mockResolvedValue(fakeUpdate('1.0.4'));
		const { availableUpdate, startUpdatePolling } = await freshModule();

		startUpdatePolling();
		await Promise.resolve();

		expect(findUpdate).not.toHaveBeenCalled();
		expect(get(availableUpdate)).toBeNull();
	});

	it('only one caller starts a timer', async () => {
		findUpdate.mockResolvedValue(null);
		const { startUpdatePolling } = await freshModule();

		const stop1 = startUpdatePolling();
		startUpdatePolling();
		await vi.waitFor(() => expect(findUpdate).toHaveBeenCalledTimes(1));

		stop1();
	});

	it('keeps the same object when the version is unchanged', async () => {
		findUpdate.mockResolvedValue(fakeUpdate('1.0.4'));
		const { availableUpdate, startUpdatePolling } = await freshModule();

		const stop = startUpdatePolling();
		await vi.waitFor(() => expect(get(availableUpdate)).not.toBeNull());
		const first = get(availableUpdate);

		// A later check returning the same version must not swap the object.
		findUpdate.mockResolvedValue(fakeUpdate('1.0.4'));
		await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

		expect(get(availableUpdate)).toBe(first);
		stop();
	});

	it('stops checking once cancelled', async () => {
		findUpdate.mockResolvedValue(null);
		const { startUpdatePolling } = await freshModule();

		const stop = startUpdatePolling();
		await vi.waitFor(() => expect(findUpdate).toHaveBeenCalledTimes(1));
		stop();

		await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000);
		expect(findUpdate).toHaveBeenCalledTimes(1);
	});
});
