import { isTauri } from '@tauri-apps/api/core';

/**
 * True when running inside the Tauri desktop shell rather than a browser tab.
 * Copy that describes where data lives has to differ: on desktop it's a file on
 * disk, on the web it's storage tied to one browser profile.
 */
export const isDesktop = isTauri();
