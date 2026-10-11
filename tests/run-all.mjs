/**
 * Test runner: runs every `*.test.mjs` in this directory, each in its own
 * process (isolation matches the old per-file `&&` chain in package.json),
 * failing fast on the first failure. New test files are picked up
 * automatically — no list to maintain.
 *
 * Run: node tests/run-all.mjs (after `pnpm build`).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

if (files.length === 0) {
  console.error('no *.test.mjs files found in tests/');
  process.exit(1);
}

for (const file of files) {
  const result = spawnSync(process.execPath, [join(here, file)], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\n${files.length} test files passed`);
