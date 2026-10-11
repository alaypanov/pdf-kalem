/**
 * Everyday-widget tests: VLine, Spacer, Stack (I14).
 *
 * Geometry assertions run against a real PdfDoc layout (the harness from
 * layout.test.mjs); pagination atomicity runs against the pure Paginator
 * plan (the harness from pagination.test.mjs).
 *
 * Run: node tests/widgets.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { Paginator } from '../dist/internals.js';
import {
  Page,
  Text,
  Column,
  Row,
  Flex,
  FixedContainer,
  Stack,
  Spacer,
  VLine,
} from '../dist/widgets.js';
import { PdfDoc } from '../dist/index.js';

// --- Harnesses ---

const theme = {
  text: {
    body: { size: 10, lineHeight: 12 },
  },
};

async function layout(widget) {
  const doc = new PdfDoc({
    theme,
    children: [Page({ dimensions: [612, 792], padding: 36, children: [widget] })],
  });
  await doc.save();
  return widget;
}

class FakeContext {
  constructor() {
    this.pages = [];
    this.page = null;
  }
  setTheme() {}
  getTheme() {
    return undefined;
  }
  setDebug() {}
  isDebugEnabled() {
    return false;
  }
  getDebugStrokeWidth() {
    return 0.5;
  }
  setDefaultDimensions() {}
  getOptions() {
    return {};
  }
  measureTextWidth(text, size) {
    return text.length * size * 0.6;
  }
  measureFontAscent(size) {
    return size;
  }
  measureFontHeight(size) {
    return size;
  }
  measureDefaultLineHeight(size) {
    return size * 1.2;
  }
  async preloadFont() {}
  drawRectangle() {}
  async drawText() {}
  drawLine() {}
  drawImage() {}
  drawSvgPath() {}
  addLinkAnnotation() {}
  async embedImage() {
    throw new Error('embedImage not implemented in FakeContext');
  }
  addPage(dimensions) {
    const page = { width: dimensions[0], height: dimensions[1] };
    this.pages.push(page);
    this.page = page;
    return page;
  }
  getCurrentPage() {
    return this.page;
  }
  setCurrentPage(page) {
    this.page = page;
  }
  getPageHeight() {
    return this.page ? this.page.height : 0;
  }
  getPageWidth() {
    return this.page ? this.page.width : 0;
  }
  getDimensions() {
    return this.page ? [this.page.width, this.page.height] : [200, 100];
  }
  getLayoutBox(widget) {
    return widget.getAbsoluteLayoutBox();
  }
  mapContentBox(box) {
    return { ...box };
  }
  getFlowOffset() {
    return 0;
  }
}

async function plan(page) {
  const context = new FakeContext();
  page.setContext(context);
  return new Paginator().paginate(page, context);
}

const box = (widget) => widget.getAbsoluteLayoutBox();
const words = (count) => Array.from({ length: count }, () => 'word').join(' ');
const close = (a, b, eps = 1) => Math.abs(a - b) < eps;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- VLine ---

test('VLine is a thickness-wide box stretched to the row height', async () => {
  const row = await layout(
    Row({ height: 120, children: [Flex({ width: 100 }), VLine()] }),
  );
  const line = box(row.getChildWidgets()[1]);

  assert.equal(line.width, 1, 'default thickness is 1pt');
  assert.ok(close(line.height, 120), `expected stretch to 120pt, got ${line.height}pt`);
});

test('VLine honors thickness and explicit height', async () => {
  const row = await layout(
    Row({ height: 120, children: [Flex({ width: 100 }), VLine({ thickness: 3, height: 40 })] }),
  );
  const line = box(row.getChildWidgets()[1]);

  assert.equal(line.width, 3);
  assert.equal(line.height, 40);
});

// --- Spacer ---

test('Spacer with size inserts a fixed gap between siblings', async () => {
  const column = await layout(
    Column({ children: [Text('above', { variant: 'body' }), Spacer({ size: 12 }), Text('below', { variant: 'body' })] }),
  );
  const [above, , below] = column.getChildWidgets().map(box);

  assert.ok(
    close(below.y - (above.y + above.height), 12, 0.5),
    `expected a 12pt gap, got ${(below.y - above.y - above.height).toFixed(1)}pt`,
  );
});

test('bare Spacer absorbs the column\'s free space', async () => {
  const column = await layout(
    Column({ height: 200, children: [Text('top', { variant: 'body' }), Spacer(), Text('bottom', { variant: 'body' })] }),
  );
  const [top, spacer, bottom] = column.getChildWidgets().map(box);

  const free = 200 - top.height - bottom.height;
  assert.ok(close(spacer.height, free, 0.5), `expected spacer ~${free}pt, got ${spacer.height}pt`);
  assert.ok(close(bottom.y + bottom.height - top.y, 200, 0.5), 'content should fill the 200pt column');
});

// --- Stack ---

test('Stack sizes itself to its largest non-positioned child', async () => {
  const inner = Flex({ width: 120, height: 50 });
  const stack = await layout(Stack({ children: [inner, Text('badge', { variant: 'body' })] }));
  const stackBox = box(stack);

  assert.ok(close(stackBox.width, 120, 0.5), `expected width 120, got ${stackBox.width}`);
  assert.ok(close(stackBox.height, 50, 0.5), `expected height 50, got ${stackBox.height}`);
});

test('Stack aligns non-positioned children per alignment', async () => {
  const child = Flex({ width: 50, height: 30 });
  const stack = await layout(Stack({ width: 300, height: 200, alignment: 'center', children: [child] }));
  const childBox = box(child);

  assert.ok(close(childBox.x - box(stack).x, 125, 0.5), `expected x 125, got ${childBox.x}`);
  assert.ok(close(childBox.y - box(stack).y, 85, 0.5), `expected y 85, got ${childBox.y}`);
});

test('Stack default alignment is topLeft', async () => {
  const child = Flex({ width: 50, height: 30 });
  await layout(Stack({ width: 300, height: 200, children: [child] }));
  const childBox = box(child);

  assert.ok(close(childBox.x, 36, 0.5), `expected content-left, got ${childBox.x}`);
  assert.ok(close(childBox.y, 36, 0.5), `expected content-top, got ${childBox.y}`);
});

test('positioned children (FixedContainer) keep their insets', async () => {
  const badge = FixedContainer({ top: 10, right: 20, width: 30, height: 20 });
  const stack = await layout(
    Stack({ width: 200, height: 100, alignment: 'center', children: [badge] }),
  );
  const badgeBox = box(badge);
  const stackBox = box(stack);

  assert.ok(close(badgeBox.y - stackBox.y, 10, 0.5), `expected top 10, got ${badgeBox.y - stackBox.y}`);
  assert.ok(
    close(stackBox.x + 200 - (badgeBox.x + badgeBox.width), 20, 0.5),
    `expected right 20, got ${stackBox.x + 200 - badgeBox.x - badgeBox.width}`,
  );
});

test('Stack children overlap inside the stack box', async () => {
  const base = Flex({ width: 100, height: 50 });
  const overlay = FixedContainer({ top: 5, left: 5, width: 40, height: 20 });
  const stack = await layout(Stack({ children: [base, overlay] }));
  const stackBox = box(stack);

  for (const child of [base, overlay]) {
    const childBox = box(child);
    assert.ok(childBox.x >= stackBox.x - 0.5 && childBox.x + childBox.width <= stackBox.x + stackBox.width + 0.5, 'child inside horizontally');
    assert.ok(childBox.y >= stackBox.y - 0.5 && childBox.y + childBox.height <= stackBox.y + stackBox.height + 0.5, 'child inside vertically');
  }
});

test('Stack with only positioned children and no explicit size throws with guidance', async () => {
  await assert.rejects(
    layout(Stack({ children: [FixedContainer({ top: 0, left: 0, width: 10, height: 10 })] })),
    /explicit width and height/,
  );
});

// --- Stack under pagination ---

test('Stack is atomic: it moves whole to the next page, never splits', async () => {
  // 60pt of text (6 lines) + a 60pt stack on a 100pt content box: the stack
  // straddles the boundary and must land whole on page 2.
  const stack = Stack({ height: 60, children: [Flex({ width: 100, height: 60 })] });
  const page = Page({
    dimensions: [200, 100],
    children: [Text(words(26), { size: 10, lineHeight: 10 }), stack],
  });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);
  assert.ok(
    !pages[0].roots.some((f) => f.widget === stack),
    'stack must not be placed on page 1',
  );
  assert.ok(
    pages[1].roots.some((f) => f.widget === stack),
    'stack must move whole to page 2',
  );
});

// --- End to end ---

test('VLine, Spacer, and Stack compose in a real PDF', async () => {
  const doc = new PdfDoc({
    theme,
    children: [
      Page({
        dimensions: [612, 792],
        padding: 36,
        children: [
          Column({
            children: [
              Text('Header', { variant: 'body' }),
              Spacer({ size: 24 }),
              Stack({
                width: 200,
                height: 80,
                children: [
                  Flex({ width: 200, height: 80 }),
                  FixedContainer({ top: 8, right: 8, width: 40, height: 16 }),
                ],
              }),
              Spacer(),
              Row({ height: 40, children: [Flex({ width: 100 }), VLine({ thickness: 2 })] }),
            ],
          }),
        ],
      }),
    ],
  });
  const bytes = await doc.save();
  assert.ok(bytes.length > 0, 'PDF bytes produced');
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
