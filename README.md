# Local Money Manager

A local-first personal finance tracker. All data lives in your browser's IndexedDB — nothing is sent to a server, there are no accounts, and there is no telemetry.

## Features

- **Dashboard** — Net worth chart over time, with toggleable views (net, stacked assets vs. liabilities).
- **Journal** — Record balances for assets and liabilities on any date. Items support nesting (e.g. a "Bank" group containing "Checking" and "Savings") and can be tied to a home so its value and mortgage stay linked.
- **Cost To Move** — Compare the cost of buying a new home against staying put. Models mortgage payments, property tax, insurance, selling costs on owned homes, investment growth on liquid assets, and ad-hoc expenses. Includes a future mode for projecting a move at a later date.
- **Import / Export** — Back up to a JSON file, then restore it by replacing everything or merging it into what's already here. Schema is validated on import.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 2 with Svelte 5 runes, built as a static site via `@sveltejs/adapter-static`
- [Dexie](https://dexie.org/) for IndexedDB
- [Tailwind CSS](https://tailwindcss.com/) 4 + [DaisyUI](https://daisyui.com/)
- [Chart.js](https://www.chartjs.org/) via `svelte-chartjs`
- [Zod](https://zod.dev/) for import validation
- [Vitest](https://vitest.dev/) for unit tests

## Getting started

```sh
npm install
npm run dev
```

Then open the printed URL.

In dev mode, the **Data ▾** menu in the navbar has a "Load demo data" option that seeds the database with a realistic-looking 12 months of sample entries.

## Scripts

| Command             | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the dev server              |
| `npm run build`     | Build the static site to `build/` |
| `npm run preview`   | Preview the production build      |
| `npm run check`     | Type-check with `svelte-check`    |
| `npm run lint`      | Prettier + ESLint                 |
| `npm run format`    | Apply Prettier                    |
| `npm test`          | Run unit tests once               |
| `npm run test:unit` | Run unit tests in watch mode      |

## Deploying

`npm run build` produces a fully static site in `build/` that can be served by any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.). No server-side runtime is required.

## Data & privacy

Everything is stored in the browser via IndexedDB under the database name `LocalMoneyManagerDB`. Use **Data ▾ → Export to JSON** to back up.

**Your data does not follow you between browsers.** IndexedDB is scoped to a single browser profile, so data entered in one browser is invisible to any other, and there is no web API that can bridge them. Switching browsers, resetting a profile, or clearing site data erases it permanently. An exported JSON file is the only copy that survives any of those.

To move your data to another browser: export from the old one, then use **Data ▾ → Import from JSON** in the new one.

### Replace vs. merge on import

- **Replace all** discards everything currently stored and installs the file's contents.
- **Merge** keeps both sides. Journal entries are matched by date — where both have the same date, the one with the newer `updatedAt` wins. Items and homes are matched by id, keeping the local copy on a collision. Cost To Move settings are treated as local configuration and are never overwritten by a merge.

Merge is the right choice when you have real data in two places. Note that if both browsers independently created an item with the same name, they have different ids, so merging keeps both and their history stays split until you clean them up — the import dialog warns when it detects this.
