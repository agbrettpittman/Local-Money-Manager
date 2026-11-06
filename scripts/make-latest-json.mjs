// Builds the updater manifest from the NSIS bundle output.
//
// Tauri emits the installer and its .sig, but not latest.json — that normally comes
// from tauri-action in CI. Assembling it by hand means pasting a signature and
// hand-writing a URL, and a single wrong character silently breaks auto-update for
// everyone. So: generate it.
//
//   node scripts/make-latest-json.mjs "what changed in this release"

import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'agbrettpittman/Local-Money-Manager';
const BUNDLE_DIR = join('src-tauri', 'target', 'release', 'bundle', 'nsis');

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const notes = process.argv[2] ?? `Version ${version}`;

let files;
try {
	files = readdirSync(BUNDLE_DIR);
} catch {
	console.error(`No bundle output at ${BUNDLE_DIR} — run "npm run tauri:build" first.`);
	process.exit(1);
}

// Match this version explicitly: the directory keeps every build ever made, so
// picking "the newest file" would happily ship a stale installer.
const installer = files.find((f) => f.includes(version) && f.endsWith('-setup.exe'));
if (!installer) {
	console.error(
		`No installer for version ${version} in ${BUNDLE_DIR}.\n` +
			`Found: ${files.join(', ') || '(nothing)'}\n` +
			`Does package.json's version match the build?`
	);
	process.exit(1);
}

const sigFile = `${installer}.sig`;
if (!files.includes(sigFile)) {
	console.error(
		`Installer is unsigned — ${sigFile} is missing.\n` +
			`Set TAURI_SIGNING_PRIVATE_KEY before building, or the updater can't verify it.`
	);
	process.exit(1);
}

// "Local Money Manager_1.0.0_x64-setup.exe" has spaces, and GitHub rewrites spaces in
// release asset names. The updater would then request a URL that 404s — a silently
// broken update. Upload a space-free copy instead, so the name is ours to predict.
const assetName = installer.replace(/ /g, '.');
if (assetName !== installer) {
	copyFileSync(join(BUNDLE_DIR, installer), join(BUNDLE_DIR, assetName));
}

const manifest = {
	version,
	notes,
	pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
	platforms: {
		'windows-x86_64': {
			signature: readFileSync(join(BUNDLE_DIR, sigFile), 'utf8').trim(),
			url: `https://github.com/${REPO}/releases/download/v${version}/${assetName}`
		}
	}
};

const out = join(BUNDLE_DIR, 'latest.json');
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${out}`);
console.log(`  version: ${version}`);
console.log(`  url:     ${manifest.platforms['windows-x86_64'].url}`);
console.log(`\nRelease with:`);
console.log(
	`  gh release create v${version} ` +
		`"${join(BUNDLE_DIR, assetName)}" ` +
		`"${join(BUNDLE_DIR, sigFile)}" ` +
		`"${out}" ` +
		`--title "Local Money Manager ${version}" --notes "${notes}"`
);
