/**
 * Example runner: picks example entry points and runs them from each
 * example's own directory (so PDFs land next to the code).
 *
 * - `pnpm example` — run every example (the old behavior).
 * - `pnpm example invoice` — run one.
 * - `pnpm example invoice report` — run several, in the order given.
 *
 * The `example` package script builds dist/ first; this file only selects
 * and runs. An example is any folder here containing `src/main.ts` or
 * `main.ts`.
 *
 * Run: node examples/run.mjs [name ...] (after `pnpm build`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const examplesRoot = dirname(fileURLToPath(import.meta.url));

const ENTRY_CANDIDATES = ['src/main.ts', 'main.ts'];

function entryFor(name) {
  for (const candidate of ENTRY_CANDIDATES) {
    const entry = join(examplesRoot, name, candidate);
    if (existsSync(entry)) return entry;
  }
  return undefined;
}

const available = readdirSync(examplesRoot, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory() && entryFor(dirent.name) !== undefined)
  .map((dirent) => dirent.name)
  .sort();

const selected = process.argv.slice(2).length > 0 ? process.argv.slice(2) : available;

const unknown = selected.filter((name) => !available.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown example(s): ${unknown.join(', ')}\nAvailable: ${available.join(', ')}`);
  process.exit(1);
}

for (const name of selected) {
  const entry = entryFor(name);
  console.log(`\n--- ${name} (${relative(examplesRoot, entry)}) ---`);
  const result = spawnSync(process.execPath, [entry], {
    cwd: join(examplesRoot, name),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
