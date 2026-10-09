/**
 * Markdown module tests: token → widget conversion (headings, emphasis
 * runs, links, lists, code, quotes, tables, rules, images) and the
 * `markdownToPdf` sugar (theme merge, e2e save).
 *
 * Run: node tests/markdown.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { createTheme, PdfDoc } from '../dist/index.js';
import {
  markdownToWidgets,
  markdownToPdf,
  markdownThemeDefaults,
  mergeMarkdownTheme,
  sniffImageFormat,
} from '../dist/markdown.js';
import {
  Page,
  TextWidget,
  ImageWidget,
  TableWidget,
  ContainerWidget,
} from '../dist/widgets.js';
import { fromHex } from '../dist/utils/color-utils.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Recording fake context (deterministic builtin metrics) ---

const charWidth = (fontName) => {
  if (/bold/i.test(fontName)) return 0.7;
  if (/^Courier/i.test(fontName)) return 0.5;
  return 0.6;
};

class RecordingContext {
  constructor() {
    this.pages = [];
    this.page = null;
    this.theme = undefined;
    this.drawTexts = [];
    this.drawLines = [];
    this.drawRects = [];
    this.linkAnnotations = [];
  }

  setTheme(theme) {
    this.theme = theme;
  }
  getTheme() {
    return this.theme;
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
  async preloadFont() {}
  drawRectangle(args) {
    this.drawRects.push(args);
  }
  async drawText(args) {
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
    return this.page ? [this.page.width, this.page.height] : [300, 200];
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

async function renderWidgets(widgets, theme) {
  const context = new RecordingContext();
  const page = Page({ dimensions: [300, 200], children: widgets });
  page.setContext(context);
  if (theme) {
    context.setTheme(theme);
  }
  await page.render(context);
  return context;
}

// A 1x1 black PNG, fetched through a data URL in the image tests.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG_1X1}`;
const GIF_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

// --- Format sniffing ---

test('sniffImageFormat reads magic bytes', () => {
  const png = Buffer.from(PNG_1X1, 'base64');
  assert.equal(sniffImageFormat(png), 'png');
  assert.equal(sniffImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(sniffImageFormat(Buffer.from('GIF89a')), undefined);
  assert.equal(sniffImageFormat(new Uint8Array(0)), undefined);
});

// --- Blocks ---

test('headings emit bold text with h1..h6 variants', async () => {
  const widgets = await markdownToWidgets('# Title\n\n## Sub');
  assert.equal(widgets.length, 2);
  assert.ok(widgets[0] instanceof TextWidget);
  assert.ok(widgets[1] instanceof TextWidget);

  const context = await renderWidgets(widgets, createTheme({
    text: { h1: { size: 26 }, h2: { size: 21 } },
  }));

  assert.equal(context.drawTexts.length, 2);
  assert.equal(context.drawTexts[0].text, 'Title');
  assert.equal(context.drawTexts[0].size, 26);
  assert.equal(context.drawTexts[0].fontName, 'Helvetica-Bold');
  assert.equal(context.drawTexts[1].text, 'Sub');
  assert.equal(context.drawTexts[1].size, 21);
});

test('paragraphs render emphasis as runs', async () => {
  const context = await renderWidgets(
    await markdownToWidgets('**bold** *italic* ~~gone~~ `code` plain')
  );

  // Whitespace between spans is its own plain run; assert the styled ones.
  const styled = context.drawTexts.filter((call) => call.text.trim().length > 0);
  assert.deepEqual(styled.map((call) => call.text.trim()), ['bold', 'italic', 'gone', 'code', 'plain']);
  assert.deepEqual(styled.map((call) => call.fontName), [
    'Helvetica-Bold',
    'Helvetica-Oblique',
    'Helvetica',
    'Courier',
    'Helvetica',
  ]);

  // Strikethrough: one line over the 'gone' fragment, ABOVE the baseline
  // (0.28em up — PDF y grows up; an underline would be below).
  assert.equal(context.drawLines.length, 1);
  const struck = styled[2];
  assert.equal(context.drawLines[0].start.y, struck.y + struck.size * 0.28);
});

test('nested emphasis combines bold and italic', async () => {
  const context = await renderWidgets(await markdownToWidgets('***both***'));
  assert.equal(context.drawTexts.length, 1);
  assert.equal(context.drawTexts[0].fontName, 'Helvetica-BoldOblique');
});

test('links get href annotations, underline, and the link color', async () => {
  const context = await renderWidgets(
    await markdownToWidgets('See [the docs](https://example.com/docs).'),
    createTheme({ colors: { link: fromHex('#0000EE') } })
  );

  assert.equal(context.drawTexts.length, 3);
  const linkCall = context.drawTexts[1];
  assert.equal(linkCall.text, 'the docs');
  assert.deepEqual(linkCall.color, fromHex('#0000EE'));

  assert.equal(context.linkAnnotations.length, 1);
  assert.equal(context.linkAnnotations[0].href, 'https://example.com/docs');
  // Underline over the link fragment only ('the docs' = 8 chars at 12pt).
  assert.equal(context.drawLines.length, 1);
  assert.equal(context.drawLines[0].start.x, linkCall.x);
  assert.equal(context.drawLines[0].end.x - context.drawLines[0].start.x, 8 * 12 * 0.6);
});

test('hard breaks split lines inside one paragraph', async () => {
  const context = await renderWidgets(await markdownToWidgets('line one  \nline two'));

  // One Text widget, two laid-out lines.
  assert.equal(context.drawTexts.length, 2);
  assert.equal(context.drawTexts[0].text, 'line one');
  assert.equal(context.drawTexts[1].text, 'line two');
  assert.ok(context.drawTexts[1].y < context.drawTexts[0].y);
});

test('unordered, ordered, nested, and task lists render markers', async () => {
  const widgets = await markdownToWidgets(
    '- alpha\n- beta\n  - nested\n\n1. one\n2. two\n\n- [x] done\n- [ ] todo'
  );
  const context = await renderWidgets(widgets);

  const texts = context.drawTexts.map((call) => call.text);
  assert.ok(texts.includes('•'));
  assert.ok(texts.includes('1.'));
  assert.ok(texts.includes('2.'));
  assert.ok(texts.includes('✓'));
  assert.ok(texts.includes('□'));
  assert.ok(texts.includes('alpha'));
  assert.ok(texts.includes('nested'));
  assert.ok(!texts.includes('[x]'));
  assert.ok(!texts.includes('[ ]'));

  // Nested item's marker is indented further right than the top-level one
  // (alpha, beta, nested — all unordered bullets).
  const markers = context.drawTexts.filter((call) => call.text === '•');
  assert.equal(markers.length, 3);
  assert.ok(markers[2].x > markers[0].x);
});

test('code blocks render mono text on a padded background', async () => {
  const widgets = await markdownToWidgets('```js\nconst x = 1;\n```');
  assert.equal(widgets.length, 1);
  assert.ok(widgets[0] instanceof ContainerWidget);

  const context = await renderWidgets(widgets);
  const codeCall = context.drawTexts.find((call) => call.text.includes('const x'));
  assert.ok(codeCall, 'code text not drawn');
  assert.equal(codeCall.fontName, 'Courier');
  // The fenced content's trailing \n is trimmed — no blank line at the
  // bottom of the block (it made the bottom padding look uneven).
  assert.equal(context.drawTexts.length, 1);
  assert.ok(
    context.drawRects.some((rect) => rect.color && JSON.stringify(rect.color) === JSON.stringify(fromHex('#F6F8FA'))),
    'code background not drawn'
  );
});

test('inline code uses the mono font at body size', async () => {
  const context = await renderWidgets(await markdownToWidgets('run `npm test` now'));
  const codeCall = context.drawTexts.find((call) => call.text === 'npm test');
  assert.ok(codeCall);
  assert.equal(codeCall.fontName, 'Courier');
});

test('blockquotes render a left rule with italic text', async () => {
  const widgets = await markdownToWidgets('> quoted text');
  const context = await renderWidgets(widgets);

  const quoteCall = context.drawTexts.find((call) => call.text === 'quoted text');
  assert.ok(quoteCall);
  assert.equal(quoteCall.fontName, 'Helvetica-Oblique');
  assert.ok(
    context.drawRects.some((rect) => JSON.stringify(rect.color) === JSON.stringify(fromHex('#DDDDDD'))),
    'blockquote rule not drawn'
  );
});

test('GFM tables render headers bold with per-column alignment', async () => {
  const widgets = await markdownToWidgets(
    '| Left | Right |\n|:-----|------:|\n| a | b |'
  );
  assert.equal(widgets.length, 1);
  assert.ok(widgets[0] instanceof TableWidget);

  const context = await renderWidgets(widgets);
  const texts = context.drawTexts.map((call) => call.text);
  assert.deepEqual(texts, ['Left', 'Right', 'a', 'b']);
  assert.equal(context.drawTexts[0].fontName, 'Helvetica-Bold');
  assert.equal(context.drawTexts[2].fontName, 'Helvetica');
});

test('markdown tables get cell padding from the merged theme defaults', async () => {
  const md = '| A | B |\n|---|---|\n| 1 | 2 |';
  const context = await renderWidgets(await markdownToWidgets(md), mergeMarkdownTheme());

  // First cell's text sits `cellPadding` (6pt) inside the cell rectangle.
  assert.ok(context.drawRects.length >= 4);
  assert.equal(context.drawTexts[0].text, 'A');
  assert.equal(context.drawTexts[0].x - context.drawRects[0].x, 6);

  // A user theme wins per key (fresh widgets — trees can't re-parent).
  const themed = await renderWidgets(
    await markdownToWidgets(md),
    mergeMarkdownTheme(createTheme({ table: { cellPadding: 9 } }))
  );
  assert.equal(themed.drawTexts[0].x - themed.drawRects[0].x, 9);
});

test('horizontal rules render a full-width line', async () => {
  const context = await renderWidgets(await markdownToWidgets('above\n\n---\n\nbelow'));
  assert.ok(context.drawTexts.some((call) => call.text === 'above'));
  assert.ok(context.drawTexts.some((call) => call.text === 'below'));
  const rule = context.drawLines.find((line) => line.end.x - line.start.x > 100);
  assert.ok(rule, 'no full-width rule drawn');
});

test('images are fetched, sniffed, and embedded; unsupported formats are skipped', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let widgets;
  try {
    widgets = await markdownToWidgets(`![logo](${PNG_DATA_URL})\n\n![bad](${GIF_DATA_URL})`);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(widgets.length, 1);
  assert.ok(widgets[0] instanceof ImageWidget);
  assert.ok(warnings.some((w) => w.includes('gif')), 'expected a skip warning');

  // e2e: the png embeds into a real PDF.
  const doc = await markdownToPdf(`![logo](${PNG_DATA_URL})`);
  const out = await doc.save();
  assert.ok(out.byteLength > 500);
});

// --- Theme merge ---

test('mergeMarkdownTheme: user values win per key, defaults fill the rest', () => {
  const merged = mergeMarkdownTheme(createTheme({
    text: { h1: { size: 99 } },
    colors: { link: fromHex('#123456') },
  }));

  assert.equal(merged.text.h1.size, 99);
  assert.equal(merged.text.h2.size, markdownThemeDefaults.text.h2.size);
  assert.deepEqual(merged.colors.link, fromHex('#123456'));
});

test('markdownToPdf applies the merged theme and paginates', async () => {
  const long = Array.from({ length: 120 }, (_, i) => `Paragraph ${i} with some text.`).join('\n\n');
  const doc = await markdownToPdf(`# Report\n\n${long}`, {
    theme: createTheme({ text: { h1: { size: 30 } } }),
    page: { dimensions: [300, 200], padding: 24 },
  });

  assert.ok((await doc.getPageCount()) > 1);
  const out = await doc.save();
  assert.ok(out.byteLength > 1000);
});

test('markdownToWidgets returns bare blocks (no spacing wrapper)', async () => {
  const widgets = await markdownToWidgets('# T\n\npara');
  assert.equal(widgets.length, 2);
  assert.ok(widgets[0] instanceof TextWidget);
  assert.ok(widgets[1] instanceof TextWidget);
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
