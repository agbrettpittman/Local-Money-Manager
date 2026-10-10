import { invoke, isTauri } from '@tauri-apps/api/core';
import { exportEnvelopeSchema } from './exportSchema';
import { fromEnvelope, toEnvelope, type Snapshot } from './snapshot';

export interface PersistBackend {
	readonly name: string;
	load(): Promise<Snapshot | null>;
	save(snap: Snapshot): Promise<void>;
}

const STORAGE_KEY = 'lmm:data';

function parseEnvelope(raw: string): Snapshot {
	// A parse failure means corrupt storage. Throwing keeps the app from starting
	// empty and then overwriting whatever was really there.
	return fromEnvelope(exportEnvelopeSchema.parse(JSON.parse(raw)));
}

/**
 * Development and test backend. Real storage is the Tauri filesystem backend; this
 * exists so the UI still runs under `vite dev` and Playwright without a Tauri host.
 */
export const localStorageBackend: PersistBackend = {
	name: 'localStorage',
	async load() {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return null;
		return parseEnvelope(raw);
	},
	async save(snap) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toEnvelope(snap)));
	}
};

/**
 * Desktop backend: one JSON file in the OS app-data directory, written atomically by
 * the Rust side. Indented because the on-disk format is the export envelope — the data
 * file is a backup file, and someone may well open it in an editor.
 */
export const tauriBackend: PersistBackend = {
	name: 'tauri',
	async load() {
		const raw = await invoke<string | null>('load_data');
		return raw === null ? null : parseEnvelope(raw);
	},
	async save(snap) {
		await invoke('save_data', { contents: JSON.stringify(toEnvelope(snap), null, 2) });
	}
};

/** Absolute path of the desktop data file, or null when running on the web. */
export async function dataFilePath(): Promise<string | null> {
	if (!isTauri()) return null;
	return invoke<string>('data_file_path');
}

export function selectBackend(): PersistBackend {
	return isTauri() ? tauriBackend : localStorageBackend;
}
