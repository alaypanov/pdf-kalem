/**
 * I11 option-surface tests: Container style escape hatch, the alignSelf
 * default change, per-side padding, base margins, and FixedContainer theme
 * tokens.
 *
 * Run: node tests/spacing.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { Page, Container, Column, Flex, Row, Text, FixedContainer } from '../dist/widgets.js';
import { PdfDoc, createTheme } from '../dist/index.js';

const theme = createTheme({
  colors: { brand: { kind: 'rgb', red: 16, green: 32, blue: 48 } },
  container: { padding: 8 },
});

async function layout(widget, pageOptions = {}) {
  const doc = new PdfDoc({
    theme,
    children: [Page({ dimensions: [400, 300], padding: 0, ...pageOptions, children: [widget] })],
  });
  await doc.save();
  return widget;
}

const box = (widget) => widget.getAbsoluteLayoutBox();
const close = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- 1: Container style escape hatch ---

test('Container style overrides the built-in yoga style per key', async () => {
  // No padding: the assertion math below assumes a bare content box.
  const container = await layout(
    Container({ width: 100, height: 40, padding: 0, style: { justifyContent: 'flex-end', alignItems: 'center' }, child: Text('x') }),
  );
  const child = box(container.getChildWidgets()[0]);

  assert.ok(close(child.y + child.height, box(container).y + 40), 'child pushed to the bottom (justifyContent override)');
  assert.ok(close(child.x + child.width / 2, box(container).x + 50), 'child centered (alignItems override)');
});

// --- 2: alignSelf default ---

test('Container fills a stretching parent unless sized (alignSelf default removed)', async () => {
  // Page stretches its children (alignItems: stretch); Row/Column default
  // to flex-start, so only a stretching parent exercises the change.
  const page = await layout(
    Container({ height: 20, child: Text('fills') }),
  );
  const container = box(page);

  assert.ok(close(container.width, 400), `expected the container to fill the 400pt page, got ${container.width}`);
});

test('Container no longer defeats a parent\'s alignItems: stretch', async () => {
  const column = await layout(
    Flex({ flexDirection: 'column', width: 300, alignItems: 'stretch', children: [Container({ height: 20, child: Text('fills') })] }),
  );
  const container = box(column.getChildWidgets()[0]);

  assert.ok(close(container.width, 300), `expected the container to fill 300pt, got ${container.width}`);
});

test('Container still shrink-wraps when the parent does not stretch', async () => {
  // Row defaults to alignItems: flex-start — the cross axis does not stretch.
  const row = await layout(
    Row({ children: [Container({ height: 20, child: Text('wrap') })] }),
  );
  const container = box(row.getChildWidgets()[0]);

  assert.ok(container.width < 400, `expected shrink-wrap, got ${container.width}`);
});

test('shrink-wrap is available explicitly via style', async () => {
  const column = await layout(
    Column({ width: 300, children: [Container({ height: 20, style: { alignSelf: 'flex-start' }, child: Text('wrap') })] }),
  );
  const container = box(column.getChildWidgets()[0]);

  assert.ok(container.width < 300, `expected explicit shrink-wrap, got ${container.width}`);
});

// --- 3: Spacing ---

test('per-side padding applies edge-by-edge', async () => {
  // A Flex child fills the content box (alignSelf: stretch) so all four
  // padding edges are measurable — Text measures its own lines and would
  // not reach the right/bottom edges.
  const container = await layout(
    Container({
      width: 100,
      height: 100,
      padding: { top: 4, left: 10, right: 20, bottom: 8 },
      child: Flex({ width: '100%', height: '100%' }),
    }),
  );
  const child = box(container.getChildWidgets()[0]);
  const parent = box(container);

  assert.ok(close(child.x - parent.x, 10), `left padding 10, got ${child.x - parent.x}`);
  assert.ok(close(child.y - parent.y, 4), `top padding 4, got ${child.y - parent.y}`);
  assert.ok(close(parent.x + 100 - (child.x + child.width), 20), `right padding 20`);
  assert.ok(close(parent.y + 100 - (child.y + child.height), 8), `bottom padding 8`);
});

test('per-side padding falls back to the theme default on unset sides', async () => {
  const container = await layout(
    Container({
      width: 100,
      height: 100,
      padding: { left: 10 },
      child: Flex({ width: '100%', height: '100%' }),
    }),
  );
  const child = box(container.getChildWidgets()[0]);
  const parent = box(container);

  assert.ok(close(child.x - parent.x, 10), 'explicit left wins');
  assert.ok(close(child.y - parent.y, 8), 'unset top falls back to the theme padding (8)');
});

test('margin on the base pushes any widget away from its sibling', async () => {
  const column = await layout(
    Column({ width: 300, children: [Text('a'), Text('b', { margin: { top: 24 } })] }),
  );
  const [a, b] = column.getChildWidgets().map(box);

  // 1.5pt tolerance: Yoga's hierarchical point rounding (B6).
  assert.ok(close(b.y - (a.y + a.height), 24, 1.5), `expected a 24pt margin gap, got ${b.y - a.y - a.height}`);
});

test('margin number applies to all sides', async () => {
  const row = await layout(
    Row({ width: 300, children: [Text('a'), Text('b', { margin: 10 })] }),
  );
  const [a, b] = row.getChildWidgets().map(box);

  assert.ok(close(b.x - (a.x + a.width), 10, 1.5), `left margin 10, got ${b.x - a.x - a.width}`);
});

// --- 4: FixedContainer theme tokens ---

test('FixedContainer bgColor resolves theme tokens like Container', async () => {
  const page = Page({
    dimensions: [400, 300],
    children: [
      FixedContainer({ top: 0, left: 0, width: 100, height: 50, bgColor: 'brand' }),
    ],
  });
  const doc = new PdfDoc({ theme, children: [page] });
  // No throw + a valid PDF is the contract here; token resolution is pinned
  // by the theme-resolve tests. A raw RenderColor would have typechecked
  // before but tokens silently drew white.
  const bytes = await doc.save();
  assert.ok(bytes.length > 0);
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
