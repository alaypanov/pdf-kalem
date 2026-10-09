/**
 * Rich-run tests: `Text(string | Run[])` — per-run faces, cross-run wrapping
 * (including mid-word), strikethrough geometry, per-fragment link
 * annotations, and pagination of run text.
 *
 * Run: node tests/runs.test.mjs (after `pnpm build`).
 *
 * Deterministic metrics (size 10): regular char = 6pt, bold = 7pt,
 * mono = 5pt — so run-level measurement is observable in wrapping.
 */
import assert from 'node:assert/strict';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';

import { PdfDoc, useFonts } from '../dist/index.js';
import { Paginator } from '../dist/internals.js';
import { TextLayoutEngine } from '../dist/widgets.js';
import { Page, Text, Link } from '../dist/widgets.js';
import { fromHex } from '../dist/utils/color-utils.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Deterministic metrics ---

const SIZE = 10;
const charWidth = (fontName) => {
  if (/bold/i.test(fontName)) return 0.7;
  if (/^Courier/i.test(fontName)) return 0.5;
  return 0.6;
};
const measure = (text, fontName) => text.length * SIZE * charWidth(fontName);

// --- Engine-level tests (pure TextLayoutEngine) ---

function richEngine(runs, overrides = {}) {
  return new TextLayoutEngine({
    text: runs.map((run) => run.text).join(''),
    size: SIZE,
    lineHeight: SIZE,
    align: 'left',
    ascent: SIZE,
    whiteSpace: 'normal',
    wordBreak: 'normal',
    overflow: 'visible',
    measureTextWidth: (text) => measure(text, 'Helvetica'),
    runs: runs.map((run) => ({
      text: run.text,
      fontName: run.mono ? 'Courier' : run.bold ? 'Helvetica-Bold' : 'Helvetica',
    })),
    measureRunWidth: (text, fontName) => measure(text, fontName),
    ...overrides,
  });
}

test('runs wrap across run boundaries and emit per-run fragments', () => {
  const engine = richEngine([{ text: 'aaa ' }, { text: 'bbb', bold: true }]);
  const { lines } = engine.layoutText(30);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], {
    text: 'aaa',
    width: 18,
    fragments: [{ runIndex: 0, text: 'aaa', width: 18 }],
  });
  assert.deepEqual(lines[1], {
    text: 'bbb',
    width: 21,
    fragments: [{ runIndex: 1, text: 'bbb', width: 21 }],
  });
});

test('a word spanning runs stays unbroken while it fits', () => {
  const engine = richEngine([{ text: 'he' }, { text: 'llo', bold: true }]);
  const { lines } = engine.layoutText(40);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'hello');
  assert.deepEqual(lines[0].fragments, [
    { runIndex: 0, text: 'he', width: 12 },
    { runIndex: 1, text: 'llo', width: 21 },
  ]);
});

test('narrow boxes break mid-word across run boundaries', () => {
  const engine = richEngine([{ text: 'he' }, { text: 'llo', bold: true }]);
  const { lines } = engine.layoutText(20);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].fragments, [
    { runIndex: 0, text: 'he', width: 12 },
    { runIndex: 1, text: 'l', width: 7 },
  ]);
  assert.deepEqual(lines[1].fragments, [{ runIndex: 1, text: 'lo', width: 14 }]);
});

test('cross-run whitespace collapses to a single space owned by the first run', () => {
  const engine = richEngine([{ text: 'a ' }, { text: ' b' }]);
  const { lines } = engine.layoutText(100);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'a b');
  assert.deepEqual(lines[0].fragments, [
    { runIndex: 0, text: 'a ', width: 12 },
    { runIndex: 1, text: 'b', width: 6 },
  ]);
});

test('pre-wrap preserves whitespace inside runs', () => {
  const engine = richEngine([{ text: 'a  b' }], { whiteSpace: 'pre-wrap' });
  const { lines } = engine.layoutText(100);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'a  b');
  assert.equal(lines[0].width, 24);
});

test('newlines inside runs force hard breaks', () => {
  const engine = richEngine([{ text: 'aa' }, { text: '\nbb', bold: true }]);
  const { lines } = engine.layoutText(100);

  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'aa');
  assert.equal(lines[1].text, 'bb');
  assert.deepEqual(lines[1].fragments, [{ runIndex: 1, text: 'bb', width: 14 }]);
});

test('natural width sums per-run measurements', () => {
  const engine = richEngine([{ text: 'aaa' }, { text: 'bb', bold: true }]);
  assert.equal(engine.getNaturalWidth(''), 18 + 14);
});

test('ellipsis truncates in the truncated fragment\'s font', () => {
  const engine = richEngine(
    [{ text: 'aa' }, { text: 'bbb', bold: true }],
    { maxLines: 1, overflow: 'ellipsis' }
  );
  const { lines } = engine.layoutText(30);

  // 'aa'+'bbb' is one word spanning runs; it breaks as aa|bb + b. Line 1
  // ('aa' + 'bb', 26pt) is ellipsized: 'aa' kept (12) + 'b' (7) + '…' (7)
  // = 26 ≤ 30, with the ellipsis drawn in the bold run's font.
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'aab…');
  assert.deepEqual(lines[0].fragments, [
    { runIndex: 0, text: 'aa', width: 12 },
    { runIndex: 1, text: 'b…', width: 14 },
  ]);
});

test('mono runs measure with the mono font', () => {
  const engine = richEngine([{ text: 'code', mono: true }]);
  const { lines } = engine.layoutText(100);

  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].fragments, [{ runIndex: 0, text: 'code', width: 20 }]);
});

// --- Widget-level tests (recording fake context) ---

class RecordingContext {
  constructor() {
    this.pages = [];
    this.page = null;
    this.drawTexts = [];
    this.drawLines = [];
    this.linkAnnotations = [];
    this.preloadedFonts = [];
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
  measureTextWidth(text, size, fontName = 'Helvetica') {
    return text.length * size * charWidth(fontName);
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
  async preloadFont(fontName) {
    this.preloadedFonts.push(fontName);
  }
  drawRectangle() {}
  drawText(args) {
    this.drawTexts.push(args);
  }
  drawLine(args) {
    this.drawLines.push(args);
  }
  drawImage() {}
  drawSvgPath() {}
  addLinkAnnotation(args) {
    this.linkAnnotations.push(args);
  }
  async embedImage() {
    throw new Error('embedImage not implemented in RecordingContext');
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

async function renderPage(widget, dimensions = [200, 100]) {
  const context = new RecordingContext();
  const page = Page({ dimensions, children: [widget] });
  page.setContext(context);
  await page.render(context);
  return context;
}

test('paints each fragment with its own font and color', async () => {
  const context = await renderPage(
    Text([{ text: 'ab', color: '#ff0000' }, { text: 'cd', bold: true }], { size: SIZE })
  );

  assert.equal(context.drawTexts.length, 2);
  const [first, second] = context.drawTexts;
  assert.equal(first.text, 'ab');
  assert.equal(first.fontName, 'Helvetica');
  assert.deepEqual(first.color, fromHex('#ff0000'));
  assert.equal(second.text, 'cd');
  assert.equal(second.fontName, 'Helvetica-Bold');

  // Fragments sit side by side on one baseline: 2 regular chars apart.
  assert.equal(second.x - first.x, 12);
  assert.equal(second.y, first.y);
});

test('preloads every distinct run font', async () => {
  const context = await renderPage(
    Text([{ text: 'a' }, { text: 'b', bold: true }, { text: 'c', bold: true }, { text: 'd', mono: true }], {
      size: SIZE,
    })
  );

  for (const fontName of ['Helvetica', 'Helvetica-Bold', 'Courier']) {
    assert.ok(context.preloadedFonts.includes(fontName), `missing preload of ${fontName}`);
  }
});

test('draws strikethrough for strike runs at baseline + 0.28em', async () => {
  const context = await renderPage(
    Text([{ text: 'ab', strike: true }, { text: 'cd' }], { size: SIZE })
  );

  assert.equal(context.drawTexts.length, 2);
  const struck = context.drawTexts[0];
  assert.equal(context.drawLines.length, 1);

  const line = context.drawLines[0];
  assert.equal(line.start.x, struck.x);
  assert.equal(line.end.x, struck.x + 12);
  // PDF y grows up: the strike sits ABOVE the baseline (an underline would
  // be below it).
  assert.equal(line.start.y, struck.y + SIZE * 0.28);
  assert.equal(line.end.y, struck.y + SIZE * 0.28);
  assert.equal(line.thickness, 0.6);
});

test('annotates href runs per line fragment', async () => {
  const context = await renderPage(
    Text([{ text: 'go ', href: 'https://a.example' }, { text: 'stay' }], { size: SIZE })
  );

  assert.equal(context.linkAnnotations.length, 1);
  const annotation = context.linkAnnotations[0];
  assert.equal(annotation.href, 'https://a.example');
  assert.equal(annotation.rect[2] - annotation.rect[0], 18); // 'go ' = 3 chars
});

test('Link with runs annotates per fragment with the link href', async () => {
  const context = await renderPage(
    Link([{ text: 'ab' }, { text: 'cd', bold: true }], { href: 'https://link.example', size: SIZE })
  );

  // Per-fragment annotations only — no whole-box rect.
  assert.equal(context.linkAnnotations.length, 2);
  assert.deepEqual(
    context.linkAnnotations.map((a) => a.href),
    ['https://link.example', 'https://link.example']
  );
  assert.equal(context.linkAnnotations[0].rect[2] - context.linkAnnotations[0].rect[0], 12);
  assert.equal(context.linkAnnotations[1].rect[2] - context.linkAnnotations[1].rect[0], 14);
});

test('plain Link keeps the whole-box annotation', async () => {
  const context = await renderPage(Link('ab', { href: 'https://link.example', size: SIZE }));

  assert.equal(context.linkAnnotations.length, 1);
  const [x0, y0, x1, y1] = context.linkAnnotations[0].rect;
  assert.ok(x1 > x0 && y1 > y0);
});

test('run hrefs win over the Link href', async () => {
  const context = await renderPage(
    Link([{ text: 'own', href: 'https://own.example' }, { text: ' inherited' }], {
      href: 'https://link.example',
      size: SIZE,
    })
  );

  assert.deepEqual(
    context.linkAnnotations.map((a) => a.href),
    ['https://own.example', 'https://link.example']
  );
});

test('positions baselines with half-leading inside the line box', async () => {
  const widget = Text([{ text: 'a\nb' }], { size: SIZE });
  const context = await renderPage(widget);

  // Test contexts hand back yoga-space boxes (the PDF flip lives in the real
  // backend's getLayoutBox), so the line-box top is y + height. With
  // fontHeight = size and lineHeight = 1.2 × size, halfLeading = 0.1 × size:
  // the first baseline sits halfLeading + ascent below the box top (was just
  // ascent — hugging the top with all the slack below the baseline).
  const box = widget.getAbsoluteLayoutBox();
  const topY = box.y + box.height;
  const halfLeading = (SIZE * 1.2 - SIZE) / 2;

  assert.equal(context.drawTexts.length, 2);
  assert.equal(context.drawTexts[0].y, topY - halfLeading - SIZE);
  // Line-to-line leading is unchanged: exactly one lineHeight apart.
  assert.equal(context.drawTexts[1].y, context.drawTexts[0].y - SIZE * 1.2);
});

// --- Pagination of run text ---

const words = (count) => Array.from({ length: count }, () => ({ text: 'word ' }));

test('run text paginates by lines across pages', async () => {
  // 66 words -> 11 lines of 10pt = 110pt on a 100pt content box (same
  // wrapping as the plain-text golden test: 6 words per 200pt line).
  const text = Text(words(66), { size: SIZE, lineHeight: SIZE });
  const page = Page({ dimensions: [200, 100], children: [text] });

  const context = new RecordingContext();
  page.setContext(context);
  const { pageCount, overflow } = await new Paginator().paginate(page, context);

  assert.equal(overflow, true);
  assert.equal(pageCount, 2);
});

test('mixed-style run text paginates with per-run measurement', async () => {
  // Bold chars are 7pt: each 'word ' run is 35pt and its collapsed space
  // measures bold too (7pt), so 4 words + 3 gaps = 161pt; a 5th word
  // (203pt) wraps. 10 words -> 3 lines -> 30pt, fits one page.
  const runs = Array.from({ length: 10 }, () => [{ text: 'word ', bold: true }]);
  const text = Text(runs.flat(), { size: SIZE, lineHeight: SIZE });
  const page = Page({ dimensions: [200, 100], children: [text] });

  const context = new RecordingContext();
  page.setContext(context);
  const { pageCount } = await new Paginator().paginate(page, context);

  // 10 bold words -> 2 lines (5 per line) -> 20pt, fits one page.
  assert.equal(pageCount, 1);
});

// --- End-to-end (real pdf-lib embedding) ---

async function embeddedBaseFonts(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const fonts = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) {
      const baseFont = obj.get(PDFName.of('BaseFont'));
      if (baseFont) fonts.push(baseFont.toString());
    }
  }
  return fonts;
}

test('rich text embeds one font per used face', async () => {
  const doc = new PdfDoc({
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          Text([{ text: 'Regular ' }, { text: 'bold', bold: true }, { text: ' mono', mono: true }], {
            size: 12,
          }),
        ],
      }),
    ],
  });
  const out = await doc.save();

  const fonts = await embeddedBaseFonts(out);
  assert.ok(fonts.some((name) => name.includes('Helvetica')), `no Helvetica in ${fonts}`);
  assert.ok(fonts.some((name) => name.includes('Helvetica-Bold')), `no Helvetica-Bold in ${fonts}`);
  assert.ok(fonts.some((name) => name.includes('Courier')), `no Courier in ${fonts}`);
});

test('custom-family runs resolve bold faces through the doc FontSet', async () => {
  const fonts = await useFonts({ body: 'inter' });
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          Text([{ text: 'Regular ' }, { text: 'bold', bold: true }], { font: 'body', size: 12 }),
        ],
      }),
    ],
  });
  const out = await doc.save();

  const fontsEmbedded = await embeddedBaseFonts(out);
  assert.ok(
    fontsEmbedded.some((name) => name.includes('Inter-Bold')),
    `no Inter-Bold face in ${fontsEmbedded}`
  );
  assert.ok(
    fontsEmbedded.some((name) => name.includes('Inter-Regular') || /Inter\b/.test(name)),
    `no Inter regular face in ${fontsEmbedded}`
  );
});

// --- Runner ---

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log(`\n${tests.length} tests passed`);
}
