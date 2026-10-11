/**
 * Theme-resolution policy tests: the precedence seam (ARCHITECTURE.md #6) as
 * pure functions — no widget, no context, no Yoga.
 *
 * Run: node tests/theme-resolve.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { resolveColor, resolveFont, resetThemeWarningsForTests } from '../dist/internals.js';
import { createTheme } from '../dist/index.js';
import { fromHex } from '../dist/utils/color-utils.js';

const theme = createTheme({
  colors: { primary: fromHex('#102030') },
  fonts: { brand: 'Inter' },
});

/** Captures console.warn around `fn` (the fonts.test.mjs pattern). */
async function captureWarn(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('override wins over the theme default', () => {
  assert.deepEqual(resolveColor(theme, '#FF0000', 'primary'), fromHex('#FF0000'));
});

test('theme default applies when no override is given', async () => {
  resetThemeWarningsForTests();
  const { result, warnings } = await captureWarn(async () => {
    assert.deepEqual(resolveColor(theme, undefined, 'primary'), fromHex('#102030'));
    assert.equal(resolveColor(undefined, undefined, 'primary'), undefined, 'tokens need the theme to resolve');
  });
  assert.equal(warnings.length, 1, 'the no-theme miss warns (I12)');
  resetThemeWarningsForTests();
});

test('fallback applies when neither layer resolves', async () => {
  resetThemeWarningsForTests();
  const fallback = fromHex('#000000');
  const { result, warnings } = await captureWarn(async () => {
    assert.equal(resolveColor(undefined, undefined, undefined, fallback), fallback);
    assert.equal(resolveColor(theme, 'no-such-token', 'no-such-token-either', fallback), fallback);
  });
  assert.equal(warnings.length, 1, 'the unknown-token miss warns (I12)');
  resetThemeWarningsForTests();
});

test('no fallback: unresolved stays undefined (unset is meaningful)', async () => {
  resetThemeWarningsForTests();
  const { result, warnings } = await captureWarn(async () => {
    assert.equal(resolveColor(undefined, undefined), undefined);
    assert.equal(resolveColor(theme, 'missing', 'also-missing'), undefined);
  });
  assert.equal(warnings.length, 1, 'the unknown-token miss warns (I12)');
  resetThemeWarningsForTests();
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

// --- I12: unknown tokens warn once instead of failing silently ---

test('unknown color token warns once, then stays quiet', async () => {
  resetThemeWarningsForTests();
  const first = await captureWarn(() => resolveColor(theme, 'brnad'));
  assert.equal(first.warnings.length, 1);
  assert.match(first.warnings[0], /color token "brnad" is not defined/);

  // Same typo again (next render call): no repeat.
  const second = await captureWarn(() => resolveColor(theme, 'brnad'));
  assert.equal(second.warnings.length, 0);

  resetThemeWarningsForTests();
});

test('known tokens, hex strings, and color objects never warn', async () => {
  resetThemeWarningsForTests();
  const { warnings } = await captureWarn(async () => {
    resolveColor(theme, 'primary');
    resolveColor(theme, '#FF0000');
    resolveColor(theme, fromHex('#00FF00'));
    resolveColor(theme, undefined);
  });
  assert.equal(warnings.length, 0);
  resetThemeWarningsForTests();
});

test('a token with no theme set warns with the no-theme hint', async () => {
  resetThemeWarningsForTests();
  const { warnings } = await captureWarn(() => resolveColor(undefined, 'primary'));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no theme is set/);
  resetThemeWarningsForTests();
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
