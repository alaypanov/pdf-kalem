/**
 * Regression tests for the 2026-10-11 review findings (IDEAS.md B8–B19):
 * document-lifecycle statelessness, page-size defaults, nested absolutes
 * under pagination, media sizing/stroke math, style/margin plumbing, and
 * edit-subpath AcroForm preservation.
 *
 * Run: node tests/review-fixes.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFDict, PDFName, decodePDFRawStream } from 'pdf-lib';

import { PdfDoc, createTheme } from '../dist/index.js';
import {
  Page,
  Text,
  Container,
  Row,
  Column,
  Stack,
  Icon,
  Image,
  ImageWidget,
  SVGPath,
  Spacer,
  FixedContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../dist/widgets.js';
import { markdownToWidgets } from '../dist/markdown.js';
import { fromHex } from '../dist/utils/color-utils.js';
import { loadPdf } from '../dist/edit.js';
import { FakeContext, plan } from './fake-context.mjs';

// A 1x1 black PNG (the image tests' fixture).
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const words = (count) => Array.from({ length: count }, () => 'word').join(' ');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Helpers ---

/** Loads saved bytes and resolves the first page's Font/XObject resources. */
async function pageResources(bytes) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[0];
  const resources = page.node.Resources();
  const dictOf = (obj) => (obj && obj.dict ? obj.dict : obj);
  const resolve = (dict) => {
    const out = [];
    for (const [, ref] of dict.entries()) out.push(dictOf(doc.context.lookup(ref)));
    return out;
  };
  const fonts = resources.lookup(PDFName.of('Font'), PDFDict);
  const xobjects = resources.lookup(PDFName.of('XObject'), PDFDict);
  return {
    doc,
    fonts: fonts ? resolve(fonts) : [],
    xobjects: xobjects ? resolve(xobjects) : [],
  };
}

const typeOf = (obj) => obj?.get(PDFName.of('Type'))?.toString();

/** Decompresses the page's content stream(s). */
async function contentStream(bytes) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[0];
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => doc.context.lookup(ref))
    : [doc.context.lookup(contents)];
  return streams.map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')).join('\n');
}

/** Collects fragments whose widget is `target`, anywhere in the plan trees. */
function findFragments(pages, target) {
  const found = [];
  const walk = (fragment) => {
    if (fragment.widget === target) found.push(fragment);
    fragment.children.forEach(walk);
  };
  for (const page of pages) {
    page.roots.forEach(walk);
    page.fixed.forEach(walk);
  }
  return found;
}

// --- B8: a second output from the same PdfDoc is valid ---

test('B8: saving the same doc twice yields valid font/image resources in both outputs', async () => {
  const build = () =>
    new PdfDoc({
      children: [
        Page({
          dimensions: [300, 200],
          children: [Text('hello double save'), Image.fromBytes(Buffer.from(PNG_1X1, 'base64'))],
        }),
      ],
    });
  const doc = build();
  const first = await doc.save();
  const second = await doc.save();

  for (const [label, bytes] of [['first', first], ['second', second]]) {
    const { fonts, xobjects } = await pageResources(bytes);
    assert.equal(fonts.length, 1, `${label} save has a font resource`);
    assert.equal(typeOf(fonts[0]), '/Font', `${label} save's font ref resolves to a font`);
    assert.equal(xobjects.length, 1, `${label} save has an image resource`);
    assert.equal(xobjects[0].get(PDFName.of('Subtype'))?.toString(), '/Image', `${label} save's image ref resolves to an image`);
  }
});

test('B8: a custom font first requested on the second save embeds (fontkit re-registered)', async () => {
  const inter = await readFile(new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url));
  const interBold = await readFile(new URL('../examples/fonts/Inter-Bold.ttf', import.meta.url));
  const { useFonts } = await import('../dist/index.js');
  const fonts = await useFonts(
    { body: 'inter' },
    { files: { inter: { regular: inter, bold: interBold } } },
  );

  const page = Page({ dimensions: [300, 200], children: [Text('regular only')] });
  const doc = new PdfDoc({ fonts, children: [page] });
  await doc.save();

  // A bold face is first requested on the second save — the fontkit flag
  // must have been reset with the document.
  page.appendWidgetChild(Text('bold now', { fontWeight: 700 }));
  const second = await doc.save();
  const { fonts: secondFonts } = await pageResources(second);
  assert.ok(secondFonts.length >= 1, 'second save embeds the late-requested face');
  assert.equal(typeOf(secondFonts[0]), '/Font');
});

// --- B9: the getPageCount dry run must not poison the real save ---

test('B9: count-then-save renders identically to save-only', async () => {
  const build = () =>
    new PdfDoc({
      children: [Page({ dimensions: [200, 100], children: [Text(words(66), { size: 10 })] })],
    });
  const counted = build();
  const direct = build();

  const dryCount = await counted.getPageCount(); // estimate-based (fonts unembedded)
  const countedBytes = await counted.save();
  const directBytes = await direct.save();

  const countedPages = (await PDFDocument.load(countedBytes)).getPages().length;
  const directPages = (await PDFDocument.load(directBytes)).getPages().length;

  // Helvetica fits 66 words at 10pt on a 200x100 page; the 0.6em estimate
  // does not — so the dry count differs, but the saved output must not.
  assert.equal(directPages, 1);
  assert.notEqual(dryCount, directPages, 'the dry run is estimate-based (documented)');
  assert.equal(countedPages, directPages, 'the dry run must not poison the real save');

  // The memo is invalidated by save: the post-save count is exact.
  assert.equal(await counted.getPageCount(), countedPages);
});

// --- B10: a size-less Page uses the doc default, not the previous page ---

test('B10: a size-less page after a custom-sized page gets the doc default size', async () => {
  const doc = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('cover')] }),
      Page({ children: [Text('content at the doc default size')] }),
    ],
  });
  const bytes = await doc.save();
  const [first, second] = (await PDFDocument.load(bytes)).getPages();
  assert.deepEqual(
    { w: first.getWidth(), h: first.getHeight() },
    { w: 300, h: 200 },
  );
  assert.deepEqual(
    { w: second.getWidth(), h: second.getHeight() },
    { w: 612, h: 792 },
    'the size-less page must use the doc default (LETTER), not the previous page',
  );
});

// --- B11: absolute-positioned children survive a splitting parent ---

test('B11: a nested absolute child renders on the page its flow position lands on', async () => {
  const badge = FixedContainer({ top: 70, left: 0, width: 20, height: 10, bgColor: '#FF0000' });
  const card = Container({
    width: 100,
    children: [Spacer({ size: 60 }), badge, Spacer({ size: 60 })],
  });
  const page = Page({ dimensions: [200, 100], children: [card] });

  const { pages, pageCount } = await plan(page);
  assert.equal(pageCount, 2);

  const onFirst = findFragments([pages[0]], badge);
  const onSecond = findFragments([pages[1]], badge);

  // The card's flow splits at 60pt; the badge sits at flow offset 70, so it
  // belongs to the continuation page (previously it rendered nowhere).
  assert.equal(onFirst.length, 0, 'the badge is not on the first page');
  assert.equal(onSecond.length, 1, 'the badge is not dropped from the plan');
  assert.deepEqual(
    { x: onSecond[0].box.x, y: onSecond[0].box.y, width: onSecond[0].box.width, height: onSecond[0].box.height },
    { x: 0, y: 10, width: 20, height: 10 },
  );
});

test('B11: a nested absolute child within the first page slice stays there', async () => {
  const badge = FixedContainer({ top: 30, left: 0, width: 20, height: 10, bgColor: '#FF0000' });
  const card = Container({
    width: 100,
    children: [Spacer({ size: 60 }), badge, Spacer({ size: 60 })],
  });
  const page = Page({ dimensions: [200, 100], children: [card] });

  const { pages } = await plan(page);
  const onFirst = findFragments([pages[0]], badge);
  const onSecond = findFragments([pages[1]], badge);

  assert.equal(onFirst.length, 1, 'the badge renders on the first page');
  assert.equal(onFirst[0].box.y, 30);
  assert.equal(onSecond.length, 0, 'and is not duplicated on the continuation page');
});

// --- B12: one-sided width/height scales the media ---

test('B12: Image with one explicit dimension derives the other from the aspect ratio', async () => {
  const image = Image.fromBytes(Buffer.from(PNG_1X1, 'base64'), undefined, { width: 100 });
  await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [image] })],
  }).save();
  assert.equal(image.getWidth(), 100);
  assert.equal(image.getHeight(), 100, 'a 1x1 image at width 100 must be 100 tall, not intrinsic-sized');
});

test('B12: SVGPath with one explicit dimension derives the other', async () => {
  const path = SVGPath('M0 0 H24 V24 H0 Z', {
    viewBoxWidth: 24,
    viewBoxHeight: 48,
    width: 48,
  });
  await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [path] })],
  }).save();
  assert.equal(path.getWidth(), 48);
  assert.equal(path.getHeight(), 96, 'a 24x48 viewBox at width 48 must be 96 tall');
});

test('B12: Icon with one explicit dimension derives the other', async () => {
  const icon = Icon({ name: 'home', width: 48 });
  await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [icon] })],
  }).save();
  assert.equal(icon.getWidth(), 48);
  assert.equal(icon.getHeight(), 48, 'a square icon at width 48 must be 48 tall, not 24');
});

// --- B13: strokeWidth scales exactly once ---

test('B13: SVGPath strokeWidth is not double-scaled by the CTM', async () => {
  const bytes = await new PdfDoc({
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          SVGPath('M0 0 H24 V24 H0 Z', {
            viewBoxWidth: 24,
            viewBoxHeight: 24,
            width: 48,
            height: 48,
            stroke: '#FF0000',
            strokeWidth: 2,
          }),
        ],
      }),
    ],
  }).save();
  const stream = await contentStream(bytes);
  // Scale is 2 (24 -> 48); the emitted line width must be the raw 2, which
  // the ×2 CTM turns into an effective 4 — not a pre-multiplied 4 (→ 8).
  assert.match(stream, /2 w/);
  assert.doesNotMatch(stream, /4 w/);
});

// --- B14: the style escape hatch is the last word on Row/Column/Flex ---

test('B14: Row style justifyContent overrides the prop default', async () => {
  const box = () => Container({ width: 10, height: 10 });
  const row = Row({ style: { justifyContent: 'center' }, children: [box(), box()] });
  await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [row] })],
  }).save();
  assert.equal(row.getChildWidgets()[0].getAbsoluteLayoutBox().x, 90, 'children must be centered, not packed at flex-start');
});

test('B14: Column style gap overrides the prop default', async () => {
  const first = Container({ width: 10, height: 10 });
  const second = Container({ width: 10, height: 10 });
  const column = Column({ style: { gap: 20 }, children: [first, second] });
  await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [column] })],
  }).save();
  assert.equal(second.getAbsoluteLayoutBox().y, 30, 'the styled gap must apply (10 height + 20 gap)');
});

test('B14: Flex style width overrides the width prop', async () => {
  const { Flex } = await import('../dist/widgets.js');
  const flex = Flex({ width: 100, style: { width: 50 } });
  await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [flex] })],
  }).save();
  assert.equal(flex.getWidth(), 50);
});

// --- B15: Stack and Icon honor margin ---

test('B15: Stack margin pushes the stack away from its siblings', async () => {
  const stack = Stack({ margin: 25, children: [Container({ width: 50, height: 50 })] });
  await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [stack] })],
  }).save();
  assert.equal(stack.getAbsoluteLayoutBox().y, 25, 'the typed margin option must apply');
});

test('B15: Icon margin pushes the icon away from its siblings', async () => {
  const icon = Icon({ name: 'home', margin: 20 });
  await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [icon] })],
  }).save();
  assert.equal(icon.getAbsoluteLayoutBox().y, 20, 'the typed margin option must apply');
});

// --- B16: late appends see the document context/theme ---

test('B16: appendWidgetChild propagates the context (theme padding applies)', async () => {
  const theme = createTheme({ container: { padding: 15 } });
  const page = Page({ dimensions: [300, 200] });
  const doc = new PdfDoc({ theme, children: [page] });

  const late = Container({ child: Text('appended later') });
  page.appendWidgetChild(late);
  await doc.save();

  assert.ok(late.context, 'the appended subtree must receive the context');
  assert.equal(late.getChildWidgets()[0].getAbsoluteLayoutBox().y, 15, 'theme padding must resolve for late appends');
});

// --- B19: duplicate widget instances fail with a readable error ---

test('B19: the same instance twice in one children array throws instead of aborting', () => {
  const text = Text('shared');
  assert.throws(() => Column({ children: [text, text] }), /cannot be shared or re-parented/);
});

test('B19: the same instance in two parents throws instead of aborting', () => {
  const text = Text('shared');
  Column({ children: [text] });
  assert.throws(() => Row({ children: [text] }), /cannot be shared or re-parented/);
});

/** Counts ImageWidgets anywhere in a widget forest. */
function countImages(widgets) {
  let count = 0;
  const walk = (widget) => {
    if (widget instanceof ImageWidget) count++;
    for (const child of widget.getChildWidgets?.() ?? []) walk(child);
  };
  for (const widget of widgets) walk(widget);
  return count;
}

// --- B20: minor findings ---

test('B20: pre-wrap whitespace-only paragraph survives the Node fallback wrapper', async () => {
  const plain = Text('a\n   \nb', { whiteSpace: 'pre-wrap', size: 10, lineHeight: 10 });
  const rich = Text([{ text: 'a\n   \nb' }], { whiteSpace: 'pre-wrap', size: 10, lineHeight: 10 });
  await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [plain, rich] })],
  }).save();
  assert.equal(plain.getHeight(), 30, '3 lines: a, the blank-ish line, b');
  assert.equal(rich.getHeight(), 30, 'plain and rich paths agree');
});

test('B20: rich ellipsis shows on a blank last visible line', async () => {
  const { TextLayoutEngine } = await import('../dist/widgets.js');
  const engine = new TextLayoutEngine({
    text: 'aaa\n\nccc',
    size: 10,
    lineHeight: 10,
    align: 'left',
    ascent: 10,
    whiteSpace: 'normal',
    wordBreak: 'normal',
    maxLines: 2,
    overflow: 'ellipsis',
    measureTextWidth: (t) => t.length * 6,
    runs: [{ text: 'aaa\n\nccc', fontName: 'Helvetica' }],
    measureRunWidth: (t) => t.length * 6,
  });
  const result = engine.layoutText(200);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[1].text, '…', 'the blank last line still carries the ellipsis');
});

test('B20: run-href annotation rects cover the full line box', async () => {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const text = Text([{ text: 'link', href: 'https://example.com' }], { size: 10, lineHeight: 12 });
  const bytes = await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [text] })],
  }).save();

  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[0];
  const annotsArray = doc.context.lookup(page.node.get(PDFName.of('Annots')));
  const annot = doc.context.lookup(annotsArray.get(0));
  const rectArray = doc.context.lookup(annot.get(PDFName.of('Rect')));
  const [x0, y0, x1, y1] = rectArray.asArray().map((v) => v.asNumber());

  // The block's top edge in PDF coords — the first line box's top.
  const box = text.getAbsoluteLayoutBox();
  const boxTop = 100 - box.y; // page height - layout y
  assert.equal(y1, boxTop, 'the rect top reaches the line box top (half-leading included)');
  assert.equal(y1 - y0, 12, 'the rect spans the full line height');
  assert.ok(x1 > x0);
});

test('B20: run font override resolves through the override name\'s own face style', async () => {
  const { readFile } = await import('node:fs/promises');
  const inter = await readFile(new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url));
  const interBold = await readFile(new URL('../examples/fonts/Inter-Bold.ttf', import.meta.url));
  const { useFonts } = await import('../dist/index.js');
  const fonts = await useFonts(
    { body: 'inter' },
    { files: { inter: { regular: inter, bold: interBold } } },
  );

  // A run asking for the bold face with an explicit 400 un-bolds it — the
  // override name's own style is the base its axes replace.
  const text = Text([{ text: 'unbold', font: 'inter-bold', fontWeight: 400 }], { size: 12 });
  const doc = new PdfDoc({ fonts, children: [Page({ dimensions: [300, 200], children: [text] })] });
  await doc.save();

  // The run resolved to the regular face ('inter'), not 'inter-bold'.
  const paintRuns = text.paintRuns; // private field, runtime access
  assert.equal(paintRuns[0].fontName, 'inter');
});

test('B20: Container style padding survives prepareLayout', async () => {
  const container = Container({ style: { padding: 20 }, child: Text('padded via style') });
  await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [container] })],
  }).save();
  assert.equal(container.getChildWidgets()[0].getAbsoluteLayoutBox().y, 20);
});

test('B20: Container({ children, child }) does not mutate the caller\'s array', () => {
  const kids = [Text('a')];
  Container({ children: kids, child: Text('b') });
  assert.equal(kids.length, 1, 'the caller\'s array must be copied');
});

test('B20: Container border.width 0 draws no border', async () => {
  const bytes = await new PdfDoc({
    children: [
      Page({
        dimensions: [300, 200],
        children: [Container({ width: 50, height: 50, border: { width: 0, color: '#FF0000' } })],
      }),
    ],
  }).save();
  const stream = await contentStream(bytes);
  assert.doesNotMatch(stream, /RG/, 'no stroking color op — the 0-width border is not drawn');
});

test('B20: unknown color tokens warn once per theme', async () => {
  const { resetThemeWarningsForTests } = await import('../dist/internals.js');
  const { createTheme } = await import('../dist/index.js');
  resetThemeWarningsForTests();

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const build = (theme) =>
      new PdfDoc({ theme, children: [Page({ dimensions: [200, 100], children: [Container({ width: 10, height: 10, bgColor: 'nope' })] })] });
    await build(createTheme({})).save();
    await build(createTheme({})).save(); // a different theme object — warns again
    await build(createTheme({})).save(); // same-token third doc on theme 3
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 3, 'each theme warns once for its own missing token');
  resetThemeWarningsForTests();
});

test('B20: fromHex rejects invalid hex characters', () => {
  assert.throws(() => fromHex('#ZZZZZZ'), /Invalid hex color/);
  assert.throws(() => fromHex('#1G2G3G'), /Invalid hex color/);
  assert.equal(fromHex('#FF0000').red, 255);
});

test('B20: Table.fromRows([], { header: true }) does not crash', async () => {
  const bytes = await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [Table.fromRows([], { header: true })] })],
  }).save();
  assert.ok(bytes.length > 0);
});

test('B20: Table({ children }) throws with guidance', () => {
  assert.throws(() => Table({ children: [TableRow()] }), /head\/body/);
});

test('B20: Image scale must be a positive number', () => {
  const png = Buffer.from(PNG_1X1, 'base64');
  assert.throws(() => Image.fromBytes(png, 'png', { scale: 0 }), /scale must be a positive number/);
  assert.throws(() => Image.fromBytes(png, 'png', { scale: -2 }), /scale must be a positive number/);
});

test('B20: Windows drive-letter paths read from disk, not fetch', async () => {
  await assert.rejects(
    Image.png('C:\\definitely-missing\\img.png').prepareLayout(new FakeContext()),
    /ENOENT|no such file|operation not permitted/i,
    'a drive-letter path must reach the fs, not fetch'
  );
});

test('B20: SVGPath with fill + strokeWidth but no stroke draws no outline', async () => {
  const bytes = await new PdfDoc({
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          SVGPath('M0 0 H24 V24 H0 Z', {
            viewBoxWidth: 24,
            viewBoxHeight: 24,
            fill: '#FF0000',
            strokeWidth: 2,
          }),
        ],
      }),
    ],
  }).save();
  const stream = await contentStream(bytes);
  assert.match(stream, /1 0 0 rg/, 'the fill is drawn');
  assert.doesNotMatch(stream, /RG/, 'no stroking color op — no black outline');
});

test('B20: a repeated table head is clipped to the content box', async () => {
  const tallCell = Container({ height: 120, child: Text('tall head') });
  const head = TableHead({ rows: [TableRow({ children: [TableCell({ child: tallCell })] })] });
  const body = TableBody({ rows: [TableRow({ children: [TableCell({ child: Text('body row') })] })] });
  const table = Table({ head, body, width: 100 });
  const page = Page({ dimensions: [200, 100], children: [table] });

  const { pages } = await plan(page);
  assert.ok(pages.length >= 2);
  const repeated = findFragments([pages[1]], head).find((f) => f.repeated);
  assert.ok(repeated, 'the head repeats on the continuation page');
  assert.ok(repeated.box.height <= 100, 'the repeated head is clipped to the content box');
});

test('B20: markdown images render inside list items', async () => {
  const dataUrl = `data:image/png;base64,${PNG_1X1}`;
  const blocks = await markdownToWidgets(`- ![logo](${dataUrl})`);
  const images = countImages(blocks);
  assert.equal(images, 1, 'the list item\'s image is not dropped');
});

test('B20: markdown images render inside headings and table cells', async () => {
  const dataUrl = `data:image/png;base64,${PNG_1X1}`;
  const headingBlocks = await markdownToWidgets(`# ![logo](${dataUrl})`);
  assert.equal(countImages(headingBlocks), 1, 'the heading\'s image is not dropped');

  const cellBlocks = await markdownToWidgets(`| a | b |\n|---|---|\n| ![logo](${dataUrl}) | c |`);
  assert.equal(countImages(cellBlocks), 1, 'the table cell\'s image is not dropped');
});

test('B20: blockquote color styles the quote text', async () => {
  const { markdownToPdf } = await import('../dist/markdown.js');
  const doc = await markdownToPdf('> quoted text', { styles: { blockquote: { color: '#FF0000' } } });
  const stream = await contentStream(await doc.save());
  assert.match(stream, /1 0 0 rg/, 'the blockquote text draws in the configured color');
});

test('B20: a truncated PNG is skipped at conversion, not at save', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    // PNG signature + garbage: passes the old sniff, fails the IHDR check.
    const truncated = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('garbage')]);
    const dataUrl = `data:image/png;base64,${truncated.toString('base64')}`;
    const blocks = await markdownToWidgets(`![broken](${dataUrl})`);
    assert.equal(countImages(blocks), 0, 'the broken image is skipped at conversion');
    assert.ok(warnings.some((w) => /only png\/jpeg/.test(w)), 'with a warning');
  } finally {
    console.warn = originalWarn;
  }
});

test('B20: markdown images resolve relative paths in Node', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'pdf-kalem-md-img-'));
  await writeFile(join(dir, 'logo.png'), Buffer.from(PNG_1X1, 'base64'));
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    const blocks = await markdownToWidgets('![logo](./logo.png)');
    assert.equal(countImages(blocks), 1, 'a relative-path image loads from disk');
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test('B20: an image inside a link warns and still renders', async () => {
  const dataUrl = `data:image/png;base64,${PNG_1X1}`;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const blocks = await markdownToWidgets(`[![alt](${dataUrl})](https://example.com)`);
    assert.equal(countImages(blocks), 1, 'the image still renders');
    assert.ok(warnings.some((w) => /renders unlinked/.test(w)), 'with a warning about the lost link');
  } finally {
    console.warn = originalWarn;
  }
});

test('B20: overlays offset by a non-zero MediaBox origin', async () => {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const source = await PDFDocument.create();
  const page = source.addPage([612, 792]);
  page.node.set(PDFName.of('MediaBox'), source.context.obj([10, 20, 622, 812]));
  const sourceBytes = await source.save();

  const loaded = await loadPdf(sourceBytes);
  loaded.pages[0].add([
    FixedContainer({ top: 0, left: 0, width: 50, height: 20, bgColor: '#FF0000' }),
  ]);
  const bytes = await loaded.save();

  const stream = await contentStream(bytes);
  // The visible box starts at user-space (10, 20); the overlay at layout
  // (0,0) lands at x=10, y=812-20=792 (pdf-lib emits the rect as a path
  // under a `cm` transform).
  assert.match(stream, /1 0 0 1 10 792 cm/, 'the overlay sits inside the visible box');
});

test('B20: a doc-scoped family named after a builtin alias is reachable', async () => {
  const { readFile } = await import('node:fs/promises');
  const inter = await readFile(new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url));
  const { useFonts } = await import('../dist/index.js');
  const fonts = await useFonts(
    { body: 'sans' },
    { files: { sans: inter } },
  );

  const bytes = await new PdfDoc({
    fonts,
    children: [Page({ dimensions: [300, 200], children: [Text('inter via the sans alias', { font: 'sans' })] })],
  }).save();

  const { fonts: embedded } = await pageResources(bytes);
  assert.ok(embedded.length >= 1);
  const subtype = embedded[0].get(PDFName.of('Subtype'))?.toString();
  assert.notEqual(subtype, '/Type1', 'the custom Inter bytes embed, not standard Helvetica');
});

test('B20: builtin styled text measures with the embedded font, not the estimate', async () => {
  const doc = new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [Text('bold text here', { fontWeight: 700 })] })],
  });
  const ctx = doc.getContext();
  await doc.save();
  const measured = ctx.measureTextWidth('bold text here', 12, 'sans-bold');
  assert.notEqual(measured, 100.8, 'not the 0.6em/char estimate');
  assert.ok(measured > 0 && measured < 100.8, 'real Helvetica-Bold metrics');
});

test('B20: ColorValue.alpha warns instead of silently rendering opaque', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await new PdfDoc({
      children: [Page({ dimensions: [200, 100], children: [Container({ width: 10, height: 10, bgColor: fromHex('#FF000080') })] })],
    }).save();
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(warnings.some((w) => /alpha is not supported/.test(w)));
});

test('B20: an empty PdfDoc throws with guidance', () => {
  assert.throws(() => new PdfDoc({}), /at least one Page/);
  assert.throws(() => new PdfDoc({ children: [] }), /at least one Page/);
});

test('B20: renderToPng does not detach a caller-owned ArrayBuffer', async () => {
  const { renderToPng } = await import('../dist/preview.js');
  const saved = await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [Text('preview')] })],
  }).save();
  const buffer = saved.slice().buffer; // an ArrayBuffer the caller owns
  await renderToPng(buffer);
  assert.ok(buffer.byteLength > 0, 'the buffer must not be detached by pdfjs');
});

test('B20: renderToPng validates the page index with a branded error', async () => {
  const { renderToPng } = await import('../dist/preview.js');
  const saved = await new PdfDoc({
    children: [Page({ dimensions: [200, 100], children: [Text('preview')] })],
  }).save();
  await assert.rejects(renderToPng(saved, { page: 5 }), /out of range/);
  await assert.rejects(renderToPng(saved, { page: -1 }), /out of range/);
});

// --- B18: the edit subpath preserves AcroForm ---

test('B18: loadPdf → save preserves form fields', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage([300, 200]);
  const form = source.getForm();
  const field = form.createTextField('review-field');
  field.setText('hello');
  field.addToPage(page);
  const sourceBytes = await source.save();

  const loaded = await loadPdf(sourceBytes);
  const outputBytes = await loaded.save();

  const output = await PDFDocument.load(outputBytes);
  const fields = output.getForm().getFields();
  assert.equal(fields.length, 1, 'the AcroForm must survive adoption');
  assert.equal(fields[0].getName(), 'review-field');
  assert.equal(output.getForm().getTextField('review-field').getText(), 'hello');
});

// --- Runner ---

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
