/**
 * Yoga style interpreter tests: the styling seam (ARCHITECTURE.md #8) against
 * a bare Yoga node — no widget, no context, no layout tree.
 *
 * Run: node tests/yoga-style.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import Yoga from 'yoga-layout';

import { applyYogaStyle } from '../dist/internals.js';

/** Apply `style` to a child of a fixed 200×100 parent, then lay out. */
function layout(style, parentStyle = { width: 200, height: 100 }) {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, parentStyle);
  const child = Yoga.Node.create();
  applyYogaStyle(child, style);
  parent.insertChild(child, 0);
  parent.calculateLayout(undefined, undefined);
  return {
    width: child.getComputedWidth(),
    height: child.getComputedHeight(),
    left: child.getComputedLeft(),
    top: child.getComputedTop(),
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('number dimensions set exact points', () => {
  assert.deepEqual(layout({ width: 120, height: 40 }), { width: 120, height: 40, left: 0, top: 0 });
});

test('percent dimensions resolve against the parent', () => {
  assert.deepEqual(layout({ width: '50%', height: '25%' }), { width: 100, height: 25, left: 0, top: 0 });
});

test("auto dimensions shrink-wrap content", () => {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, { width: 200 });
  const child = Yoga.Node.create();
  applyYogaStyle(child, { width: 'auto', height: 30, flexBasis: 60, flexGrow: 0 });
  parent.insertChild(child, 0);
  parent.calculateLayout(undefined, undefined);
  assert.equal(child.getComputedHeight(), 30);
});

test('flexBasis percent resolves along the main axis', () => {
  const box = layout({ flexBasis: '50%' });
  assert.equal(box.height, 50);
});

test('flexGrow absorbs free main-axis space', () => {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, { width: 200, height: 100, flexDirection: 'column' });
  const a = Yoga.Node.create();
  applyYogaStyle(a, { height: 30 });
  const spacer = Yoga.Node.create();
  applyYogaStyle(spacer, { flexBasis: 0, flexGrow: 1, flexShrink: 1 });
  parent.insertChild(a, 0);
  parent.insertChild(spacer, 1);
  parent.calculateLayout(undefined, undefined);
  assert.equal(spacer.getComputedHeight(), 70);
});

test('justifyContent and alignItems position an inset-less absolute child', () => {
  const box = layout(
    { width: 50, height: 30, position: 'absolute' },
    { width: 300, height: 200, justifyContent: 'center', alignItems: 'center' },
  );
  assert.equal(box.width, 50);
  assert.equal(box.left, 125);
  assert.equal(box.top, 85);
});

test('position insets place an absolute child', () => {
  const box = layout(
    { width: 50, height: 30, position: 'absolute', top: 10, left: 15 },
    { width: 300, height: 200 },
  );
  assert.equal(box.left, 15);
  assert.equal(box.top, 10);
});

test('padding shifts content inside the box', () => {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, { width: 100, height: 100, padding: 10 });
  const child = Yoga.Node.create();
  applyYogaStyle(child, { width: '100%', height: 20 });
  parent.insertChild(child, 0);
  parent.calculateLayout(undefined, undefined);
  assert.equal(child.getComputedWidth(), 80);
  assert.equal(child.getComputedLeft(), 10);
});

test('gap separates children along the main axis', () => {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, { width: 200, height: 100, flexDirection: 'column', gap: 12 });
  const a = Yoga.Node.create();
  applyYogaStyle(a, { height: 20 });
  const b = Yoga.Node.create();
  applyYogaStyle(b, { height: 20 });
  parent.insertChild(a, 0);
  parent.insertChild(b, 1);
  parent.calculateLayout(undefined, undefined);
  assert.equal(b.getComputedTop(), 32);
});

test('undefined and null values are skipped (no silent no-op errors)', () => {
  const node = Yoga.Node.create();
  assert.doesNotThrow(() => applyYogaStyle(node, { width: undefined, height: null }));
});

test('min/max constraints clamp the resolved size', () => {
  const parent = Yoga.Node.create();
  applyYogaStyle(parent, { width: 200, flexDirection: 'column' });
  const child = Yoga.Node.create();
  applyYogaStyle(child, { height: 500, maxHeight: 120 });
  parent.insertChild(child, 0);
  parent.calculateLayout(undefined, undefined);
  assert.equal(child.getComputedHeight(), 120);
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
