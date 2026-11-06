import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { clearToast, showToast, toastMessage } from './toast';

describe('toast', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		clearToast();
		vi.useRealTimers();
	});

	it('starts empty', () => {
		expect(get(toastMessage)).toBeNull();
	});

	it('shows a message', () => {
		showToast('Saved');
		expect(get(toastMessage)).toBe('Saved');
	});

	it('clears itself after the timeout', () => {
		showToast('Saved', 1000);
		vi.advanceTimersByTime(999);
		expect(get(toastMessage)).toBe('Saved');
		vi.advanceTimersByTime(1);
		expect(get(toastMessage)).toBeNull();
	});

	it('replaces rather than queues, and restarts the clock', () => {
		showToast('First', 1000);
		vi.advanceTimersByTime(900);
		showToast('Second', 1000);

		expect(get(toastMessage)).toBe('Second');
		// The first message's timer must not clear the second one early.
		vi.advanceTimersByTime(500);
		expect(get(toastMessage)).toBe('Second');
		vi.advanceTimersByTime(500);
		expect(get(toastMessage)).toBeNull();
	});

	it('can be dismissed before the timeout', () => {
		showToast('Saved', 5000);
		clearToast();
		expect(get(toastMessage)).toBeNull();
	});

	it('stays clear after dismissal', () => {
		showToast('Saved', 1000);
		clearToast();
		vi.advanceTimersByTime(2000);
		expect(get(toastMessage)).toBeNull();
	});
});
