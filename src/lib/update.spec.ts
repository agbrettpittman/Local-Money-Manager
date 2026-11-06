import { describe, expect, it, vi } from 'vitest';
import { summarise } from './update';

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));

describe('summarise', () => {
	it('is empty for missing notes', () => {
		expect(summarise(undefined)).toBe('');
		expect(summarise('')).toBe('');
	});

	it('keeps a short single line as-is', () => {
		expect(summarise('Fixed the chart axis')).toBe('Fixed the chart axis');
	});

	it('takes only the first line of multi-line notes', () => {
		expect(summarise('Headline change\n\n- detail one\n- detail two')).toBe('Headline change');
	});

	it('trims surrounding whitespace', () => {
		expect(summarise('   padded   \nmore')).toBe('padded');
	});

	it('truncates past the limit with an ellipsis', () => {
		const out = summarise('x'.repeat(200));
		expect(out).toHaveLength(120);
		expect(out.endsWith('…')).toBe(true);
	});

	it('keeps a line exactly at the limit intact', () => {
		const exact = 'y'.repeat(120);
		expect(summarise(exact)).toBe(exact);
	});

	it('honours a custom limit', () => {
		expect(summarise('abcdefghij', 5)).toBe('abcd…');
	});
});
