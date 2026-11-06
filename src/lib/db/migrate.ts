import { ENVELOPE_VERSION } from './snapshot';

/**
 * The envelope was written by a build newer than this one. Distinct from a plain
 * version error because the app can recover: update, don't repair. The desktop data
 * file hits this when an older build opens a file a newer build already upgraded.
 */
export class EnvelopeTooNewError extends Error {
	readonly foundVersion: number;
	constructor(foundVersion: number) {
		super(
			`This data was saved by a newer version of Local Money Manager ` +
				`(format v${foundVersion}; this build reads up to v${ENVELOPE_VERSION}).`
		);
		this.name = 'EnvelopeTooNewError';
		this.foundVersion = foundVersion;
	}
}

/** The input isn't a readable envelope at all, or no upgrade path reaches the current format. */
export class EnvelopeVersionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EnvelopeVersionError';
	}
}

type RawEnvelope = Record<string, unknown>;

export interface Migration {
	/** Version this step reads. */
	readonly from: number;
	/** Version it produces — always `from + 1`, so the chain can't skip a step. */
	readonly to: number;
	migrate(envelope: RawEnvelope): RawEnvelope;
}

/**
 * Ordered upgrade steps, oldest first. Empty while v1 is the only format.
 *
 * When the shape changes: bump `ENVELOPE_VERSION`, add the matching Dexie-style step
 * here, and add the step's test. Both the backup file and the desktop data file are
 * this envelope, so one chain serves both.
 */
export const MIGRATIONS: readonly Migration[] = [];

/**
 * Brings a parsed envelope up to the current format, before schema validation.
 *
 * Validation alone can't do this: it would reject an older file outright instead of
 * upgrading it, and report a newer one as a shape error rather than "update the app".
 *
 * `migrations` and `target` are injectable so the chain can be exercised in tests
 * while only one real format exists.
 */
export function migrateEnvelope(
	raw: unknown,
	migrations: readonly Migration[] = MIGRATIONS,
	target: number = ENVELOPE_VERSION
): unknown {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		throw new EnvelopeVersionError("This file isn't a Local Money Manager backup.");
	}

	const version = (raw as RawEnvelope).version;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
		throw new EnvelopeVersionError(
			"This file has no format version, so it can't be read as a backup."
		);
	}

	if (version > target) throw new EnvelopeTooNewError(version);

	// Copy once up front so a failed migration can't leave the caller's object half-changed.
	let current: RawEnvelope = { ...(raw as RawEnvelope) };
	let at = version;
	while (at < target) {
		const step = migrations.find((m) => m.from === at);
		if (!step) {
			throw new EnvelopeVersionError(
				`This backup is in format v${at}, which this build no longer knows how to upgrade.`
			);
		}
		current = { ...step.migrate(current), version: step.to };
		at = step.to;
	}

	return current;
}
