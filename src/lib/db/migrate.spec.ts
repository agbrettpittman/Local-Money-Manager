import { describe, expect, it } from 'vitest';
import {
	EnvelopeTooNewError,
	EnvelopeVersionError,
	MIGRATIONS,
	migrateEnvelope,
	type Migration
} from './migrate';
import { ENVELOPE_VERSION } from './snapshot';
import { exportEnvelopeSchema } from './exportSchema';

const v1Envelope = () => ({
	version: 1,
	exportedAt: '2026-01-01T00:00:00Z',
	items: [{ id: 'i1', name: 'Checking', kind: 'asset', createdAt: '2026-01-01T00:00:00Z' }],
	homes: [],
	journalEntries: [
		{
			id: 'e1',
			date: '2026-01-01',
			lines: [{ itemId: 'i1', amount: 100 }],
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z'
		}
	],
	costToMove: null
});

describe('migrateEnvelope', () => {
	it('passes a current-format envelope through unchanged', () => {
		const input = v1Envelope();
		expect(migrateEnvelope(input)).toEqual(input);
	});

	it('leaves the caller’s object untouched', () => {
		const input = v1Envelope();
		const snapshot = structuredClone(input);
		migrateEnvelope(input);
		expect(input).toEqual(snapshot);
	});

	it('produces something the current schema accepts', () => {
		expect(() => exportEnvelopeSchema.parse(migrateEnvelope(v1Envelope()))).not.toThrow();
	});

	it('rejects a newer format as recoverable-by-updating', () => {
		const future = { ...v1Envelope(), version: ENVELOPE_VERSION + 1 };
		expect(() => migrateEnvelope(future)).toThrow(EnvelopeTooNewError);
		try {
			migrateEnvelope(future);
		} catch (e) {
			expect((e as EnvelopeTooNewError).foundVersion).toBe(ENVELOPE_VERSION + 1);
			expect((e as Error).message).toMatch(/newer version/i);
		}
	});

	it.each([
		['a missing version', { exportedAt: 'x' }],
		['a non-numeric version', { version: 'one' }],
		['a fractional version', { version: 1.5 }],
		['a zero version', { version: 0 }]
	])('rejects %s', (_label, input) => {
		expect(() => migrateEnvelope(input)).toThrow(EnvelopeVersionError);
	});

	it.each([
		['null', null],
		['an array', []],
		['a string', 'not an envelope'],
		['a number', 7]
	])('rejects %s as not an envelope', (_label, input) => {
		expect(() => migrateEnvelope(input)).toThrow(EnvelopeVersionError);
	});

	it('ships with no migrations while v1 is the only format', () => {
		expect(MIGRATIONS).toHaveLength(0);
		expect(ENVELOPE_VERSION).toBe(1);
	});
});

// The real registry is empty, so the chain itself is exercised with stand-in steps.
describe('migrateEnvelope chain', () => {
	const addedField: Migration = {
		from: 1,
		to: 2,
		migrate: (e) => ({ ...e, nickname: 'unnamed' })
	};
	const renamedField: Migration = {
		from: 2,
		to: 3,
		migrate: ({ nickname, ...rest }) => ({ ...rest, label: nickname })
	};
	const chain = [addedField, renamedField];

	it('runs every step needed to reach the target', () => {
		const out = migrateEnvelope({ version: 1 }, chain, 3) as Record<string, unknown>;
		expect(out).toEqual({ version: 3, label: 'unnamed' });
	});

	it('starts partway through for a half-current envelope', () => {
		const out = migrateEnvelope({ version: 2, nickname: 'kept' }, chain, 3) as Record<
			string,
			unknown
		>;
		expect(out).toEqual({ version: 3, label: 'kept' });
	});

	it('stamps the version each step produces', () => {
		const out = migrateEnvelope({ version: 1 }, chain, 2) as Record<string, unknown>;
		expect(out.version).toBe(2);
	});

	it('errors when no step covers a version in the middle of the chain', () => {
		const gapped = [addedField]; // nothing from v2 onward
		expect(() => migrateEnvelope({ version: 1 }, gapped, 3)).toThrow(EnvelopeVersionError);
	});

	it('still rejects an envelope newer than the target', () => {
		expect(() => migrateEnvelope({ version: 4 }, chain, 3)).toThrow(EnvelopeTooNewError);
	});
});
