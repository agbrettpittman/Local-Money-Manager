import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		// SvelteKit owns the CSP rather than tauri.conf.json: its bootstrap script is
		// inline, so the policy has to carry that script's hash, which changes every
		// build. Hash mode regenerates it automatically.
		//
		// tauri.conf.json deliberately keeps `csp: null` — two policies intersect, and
		// Tauri's would block the very script hashed here.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				// app.html carries style="display: contents", and daisyUI sets inline styles.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				// 'self' covers the web build; the ipc entries are how the Tauri webview
				// reaches the Rust side.
				'connect-src': ['self', 'ipc:', 'http://ipc.localhost'],
				'object-src': ['none'],
				'base-uri': ['self']
			}
		}
	}
};

export default config;
