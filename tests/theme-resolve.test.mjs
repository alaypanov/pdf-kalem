/**
 * Theme-resolution policy tests: the precedence seam (ARCHITECTURE.md #6) as
 * pure functions — no widget, no context, no Yoga.
 *
 * Run: node tests/theme-resolve.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { resolveColor, resolveFont } from '../dist/internals.js';
import { createTheme } from '../dist/index.js';
import { fromHex } from '../dist/utils/color-utils.js';

const theme = createTheme({
  colors: { primary: fromHex('#102030') },
  fonts: { brand: 'Inter' },
});

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('override wins over the theme default', () => {
  assert.deepEqual(resolveColor(theme, '#FF0000', 'primary'), fromHex('#FF0000'));
});

test('theme default applies when no override is given', () => {
  assert.deepEqual(resolveColor(theme, undefined, 'primary'), fromHex('#102030'));
  assert.equal(resolveColor(undefined, undefined, 'primary'), undefined, 'tokens need the theme to resolve');
});

test('fallback applies when neither layer resolves', () => {
  const fallback = fromHex('#000000');
  assert.equal(resolveColor(undefined, undefined, undefined, fallback), fallback);
  assert.equal(resolveColor(theme, 'no-such-token', 'no-such-token-either', fallback), fallback);
});

test('no fallback: unresolved stays undefined (unset is meaningful)', () => {
  assert.equal(resolveColor(undefined, undefined), undefined);
  assert.equal(resolveColor(theme, 'missing', 'also-missing'), undefined);
});

test('hex strings resolve through the theme resolver', () => {
  assert.deepEqual(resolveColor(theme, '#00FF00'), fromHex('#00FF00'));
});

test('font: override wins, then theme mapping, then raw passthrough', () => {
  assert.equal(resolveFont(theme, 'Inter-Bold', 'brand'), 'Inter-Bold');
  assert.equal(resolveFont(theme, undefined, 'brand'), 'Inter');
  assert.equal(resolveFont(undefined, undefined, 'brand'), 'brand', 'without a theme, names pass through as family names');
  assert.equal(resolveFont(undefined, undefined, undefined), undefined);
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
