import { exportEnvelopeSchema } from './exportSchema';
import { fromEnvelope, toEnvelope, type Snapshot } from './snapshot';

export interface PersistBackend {
	readonly name: string;
	load(): Promise<Snapshot | null>;
	save(snap: Snapshot): Promise<void>;
}

const STORAGE_KEY = 'lmm:data';

/**
 * Development and test backend. Real storage is the Tauri filesystem backend; this
 * exists so the UI still runs under `vite dev` and Playwright without a Tauri host.
 */
export const localStorageBackend: PersistBackend = {
	name: 'localStorage',
	async load() {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return null;
		// A parse failure means corrupt storage. Throwing keeps the app from starting
		// empty and then overwriting whatever was really there.
		return fromEnvelope(exportEnvelopeSchema.parse(JSON.parse(raw)));
	},
	async save(snap) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toEnvelope(snap)));
	}
};

export function selectBackend(): PersistBackend {
	return localStorageBackend;
}
