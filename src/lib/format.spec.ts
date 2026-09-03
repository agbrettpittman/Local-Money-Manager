import { describe, expect, it } from 'vitest';
import { formatAxisTick } from './format';

describe('formatAxisTick', () => {
	it('keeps whole dollars below $10k', () => {
		expect(formatAxisTick(1_750, 100)).toBe('$1,750');
		expect(formatAxisTick(0, 100)).toBe('$0');
		expect(formatAxisTick(-420, 100)).toBe('-$420');
	});

	it('rounds away cents', () => {
		expect(formatAxisTick(1_791.67, 100)).toBe('$1,792');
	});

	it('abbreviates thousands once the step is a full unit', () => {
		expect(formatAxisTick(45_000, 5_000)).toBe('$45k');
		expect(formatAxisTick(1_200_000, 200_000)).toBe('$1.2M');
	});

	it('keeps a decimal when the step is finer than the unit', () => {
		expect(formatAxisTick(12_500, 500)).toBe('$12.5k');
		expect(formatAxisTick(2_400_000, 100_000)).toBe('$2.4M');
	});

	it('drops the decimal for million-scale steps', () => {
		expect(formatAxisTick(3_000_000, 1_000_000)).toBe('$3M');
	});

	it('abbreviates by magnitude when no step is given', () => {
		expect(formatAxisTick(45_000)).toBe('$45.0k');
		expect(formatAxisTick(900)).toBe('$900');
	});
});
