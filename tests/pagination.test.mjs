/**
 * Pagination golden tests: assert the pure `Pagination` plan data (no
 * pdf-lib rendering) plus one end-to-end page-count invariant.
 *
 * Run: node tests/pagination.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import { Paginator } from '../dist/internals.js';
import {
  Page,
  Text,
  Column,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FixedContainer,
} from '../dist/widgets.js';

/**
 * Deterministic fake backend for planning. Metrics: char width = 0.6 * size,
 * line height = 1.2 * size, ascent = size — so Text(size: 10, lineHeight: 10)
 * wraps 6 "word" tokens (29 chars = 174pt) per 200pt line.
 */
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

const words = (count) => Array.from({ length: count }, () => 'word').join(' ');

async function plan(page) {
  const context = new FakeContext();
  page.setContext(context);
  return new Paginator().paginate(page, context);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Plan tests ---

test('fitting content renders through the legacy path (overflow: false)', async () => {
  const text = Text(words(5), { size: 10, lineHeight: 10 });
  const page = Page({ dimensions: [200, 100], children: [text] });

  const pagination = await plan(page);

  assert.equal(pagination.overflow, false);
  assert.equal(pagination.pageCount, 1);
  assert.equal(pagination.pages.length, 0);
});

test('breakable text splits by lines across pages', async () => {
  // 66 words -> 11 lines of 10pt = 110pt on a 100pt content box.
  const text = Text(words(66), { size: 10, lineHeight: 10 });
  const page = Page({ dimensions: [200, 100], children: [text] });

  const { pages, pageCount, overflow } = await plan(page);

  assert.equal(overflow, true);
  assert.equal(pageCount, 2);

  const [p1, p2] = pages;
  assert.equal(p1.index, 0);
  assert.equal(p1.roots.length, 1);
  const f1 = p1.roots[0];
  assert.equal(f1.widget, text);
  assert.deepEqual(
    { x: f1.box.x, y: f1.box.y, width: f1.box.width, height: f1.box.height },
    { x: 0, y: 0, width: 200, height: 100 },
  );
  assert.equal(f1.sliceTop, 0);
  assert.equal(f1.continuation, false);

  assert.equal(p2.roots.length, 1);
  const f2 = p2.roots[0];
  assert.equal(f2.widget, text);
  assert.equal(f2.box.y, 0);
  assert.equal(f2.box.height, 10);
  assert.equal(f2.sliceTop, 100);
  assert.equal(f2.continuation, true);
});

test('unbreakable block moves whole to the next page', async () => {
  const first = Text(words(30), { size: 10, lineHeight: 10 }); // 5 lines = 50pt
  const second = Text(words(36), { size: 10, lineHeight: 10, breakable: false }); // 6 lines = 60pt
  const page = Page({ dimensions: [200, 100], children: [first, second] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);
  assert.equal(pages[0].roots.length, 1);
  assert.equal(pages[0].roots[0].widget, first);
  assert.equal(pages[0].roots[0].box.height, 50);

  assert.equal(pages[1].roots.length, 1);
  assert.equal(pages[1].roots[0].widget, second);
  assert.equal(pages[1].roots[0].box.y, 0);
  assert.equal(pages[1].roots[0].box.height, 60);
  assert.equal(pages[1].roots[0].sliceTop, 0);
});

test('atomic block taller than a full page is clipped', async () => {
  const huge = Text(words(120), { size: 10, lineHeight: 10, breakable: false }); // 20 lines = 200pt
  const page = Page({ dimensions: [200, 100], children: [huge] });

  const { pages, pageCount, overflow } = await plan(page);

  assert.equal(overflow, true);
  assert.equal(pageCount, 1);
  assert.equal(pages[0].clipped, true);
  assert.equal(pages[0].roots[0].widget, huge);
  assert.equal(pages[0].roots[0].box.height, 100);
});

test('nested container splits with its children; ancestor fragments follow', async () => {
  const first = Text(words(30), { size: 10, lineHeight: 10 }); // 50pt
  const second = Text(words(36), { size: 10, lineHeight: 10 }); // 60pt
  const column = Column({ children: [first, second] });
  const page = Page({ dimensions: [200, 100], children: [column] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);

  const c1 = pages[0].roots[0];
  assert.equal(c1.widget, column);
  assert.equal(c1.box.y, 0);
  assert.equal(c1.box.height, 100); // chrome clipped to the content box
  assert.equal(c1.children.length, 2);
  assert.equal(c1.children[0].widget, first);
  assert.equal(c1.children[0].box.height, 50);
  assert.equal(c1.children[1].widget, second);
  assert.equal(c1.children[1].box.y, 50);
  assert.equal(c1.children[1].box.height, 50); // first 5 lines
  assert.equal(c1.children[1].sliceTop, 0);

  const c2 = pages[1].roots[0];
  assert.equal(c2.widget, column);
  assert.equal(c2.box.y, 0);
  assert.equal(c2.box.height, 10); // only the continuation slice
  assert.equal(c2.children.length, 1);
  assert.equal(c2.children[0].widget, second);
  assert.equal(c2.children[0].box.y, 0);
  assert.equal(c2.children[0].box.height, 10);
  assert.equal(c2.children[0].sliceTop, 50);
  assert.equal(c2.children[0].continuation, true);
});

test('table rows split whole and the head repeats on continuation pages', async () => {
  const row = (label) =>
    TableRow({ minHeight: 10, children: [TableCell({ child: Text(label, { size: 10, lineHeight: 10 }) })] });
  const head = TableHead({ rows: [row('head')] });
  const body = TableBody({ rows: Array.from({ length: 12 }, (_, i) => row(`r${i}`)) });
  const table = Table({ head, body });
  const page = Page({ dimensions: [200, 100], children: [table] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);

  const t1 = pages[0].roots[0];
  assert.equal(t1.widget, table);
  assert.equal(t1.box.height, 100); // clipped chrome
  // head + 9 body rows fill page 1 (10 * 10 = 100)
  assert.equal(t1.children.length, 10);
  assert.equal(t1.children[0].widget, head);
  assert.equal(t1.children[0].repeated, false);
  assert.equal(t1.children[1].widget, body.getRows()[0]);

  const t2 = pages[1].roots[0];
  assert.equal(t2.widget, table);
  assert.equal(t2.box.height, 40); // head + 3 remaining rows
  assert.equal(t2.children.length, 4);
  const repeatedHead = t2.children[0];
  assert.equal(repeatedHead.widget, head);
  assert.equal(repeatedHead.repeated, true);
  assert.equal(repeatedHead.box.y, 0);
  assert.equal(repeatedHead.box.height, 10);
  assert.equal(t2.children[1].widget, body.getRows()[9]);
  assert.equal(t2.children[1].box.y, 10);
  assert.equal(t2.children[3].widget, body.getRows()[11]);
  assert.equal(t2.children[3].box.y, 30);
});

test('keep-with-next moves the head to the next page instead of orphaning it', async () => {
  const filler = Text(words(54), { size: 10, lineHeight: 10 }); // 9 lines = 90pt
  const row = (label) =>
    TableRow({ minHeight: 10, children: [TableCell({ child: Text(label, { size: 10, lineHeight: 10 }) })] });
  const table = Table({
    head: TableHead({ rows: [row('head')] }),
    body: TableBody({ rows: [row('a'), row('b'), row('c')] }),
  });
  const page = Page({ dimensions: [200, 100], children: [filler, table] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);

  // Page 1: only the filler — the head would be orphaned at its bottom.
  assert.equal(pages[0].roots.length, 1);
  assert.equal(pages[0].roots[0].widget, filler);
  assert.equal(pages[0].roots[0].box.height, 90);

  // Page 2: the whole table, head first.
  assert.equal(pages[1].roots.length, 1);
  const t2 = pages[1].roots[0];
  assert.equal(t2.widget, table);
  assert.equal(t2.children.length, 4);
  assert.equal(t2.children[0].repeated, false); // first placement, not a re-emission
  assert.equal(t2.children[0].box.y, 0);
  assert.equal(t2.children[1].box.y, 10);
});

test('page-root fixed widgets are re-emitted on every page', async () => {
  const banner = FixedContainer({ top: 5, left: 5, width: 50, height: 10 });
  const text = Text(words(66), { size: 10, lineHeight: 10 }); // 110pt -> 2 pages
  const page = Page({ dimensions: [200, 100], children: [banner, text] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);
  for (const p of pages) {
    assert.equal(p.fixed.length, 1);
    assert.equal(p.fixed[0].widget, banner);
    assert.equal(p.fixed[0].box.y, 5);
    assert.equal(p.fixed[0].box.x, 5);
  }
  // Fixed widgets do not consume flow: the text still starts at the top.
  assert.equal(pages[0].roots[0].widget, text);
  assert.equal(pages[0].roots[0].box.y, 0);
});

test('bottom-anchored fixed widgets re-anchor to the real page box on every page', async () => {
  // In the flow pass (height auto) Yoga resolves `bottom` against the tall
  // canvas; the paginator must re-anchor it against the 100pt page.
  const footer = FixedContainer({ bottom: 0, left: 0, right: 0, height: 20 });
  const text = Text(words(66), { size: 10, lineHeight: 10 }); // 110pt -> 2 pages
  const page = Page({ dimensions: [200, 100], children: [footer, text] });

  const { pages, pageCount } = await plan(page);

  assert.equal(pageCount, 2);
  for (const p of pages) {
    assert.equal(p.fixed.length, 1);
    assert.equal(p.fixed[0].widget, footer);
    assert.equal(p.fixed[0].box.y, 80); // 100 - 0 - 20
    assert.equal(p.fixed[0].box.height, 20);
    assert.equal(p.fixed[0].box.width, 200); // left 0 + right 0 stretch
  }
});

// --- End-to-end ---

test('end-to-end: saved PDF page count matches getPageCount()', async () => {
  const { PdfDoc } = await import('../dist/index.js');
  const longText = words(400);
  const doc = new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [Text(longText, { size: 10, lineHeight: 10 })] })],
  });

  const bytes = await doc.save();
  const pdf = await PDFDocument.load(bytes);
  const plannedCount = await doc.getPageCount();

  assert.ok(plannedCount > 1, 'expected a multi-page document');
  assert.equal(pdf.getPages().length, plannedCount);
});

// --- Runner ---

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log(`\n${tests.length} tests passed`);