/**
 * Custom-font tests: FontSet/useFonts, family variants (faces), doc-scoped
 * resolution, lazy fontkit.
 *
 * Run: node tests/fonts.test.mjs (after `pnpm build`).
 *
 * NOTE: FontRegistry is a process-global singleton — tests use distinct
 * family keys to stay isolated.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';

import { PdfDoc, useFonts, createTheme } from '../dist/index.js';
import { Page, Text } from '../dist/widgets.js';

const FONT_URL = new URL('../public/fonts/Inter-Regular.ttf', import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

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

test('committed Inter font file exists and parses as TTF/OTF', () => {
  const bytes = fs.readFileSync(FONT_URL);
  assert.ok(bytes.byteLength > 1000, 'font file is suspiciously small');
  const magic = bytes.readUInt32BE(0);
  assert.ok(
    [0x00010000, 0x4f54544f, 0x74727565].includes(magic),
    `not a TTF/OTF file (magic: 0x${magic.toString(16)})`,
  );
});

test('registered font embeds via lazy fontkit (no explicit registerFontkit)', async () => {
  const bytes = fs.readFileSync(FONT_URL);
  PdfDoc.registerFont('Inter', bytes);
  // No registerFontkit call — the backend lazy-imports @pdf-lib/fontkit on
  // first embed of a custom font.
  const doc = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('Lazy fontkit', { font: 'Inter', size: 14 })] }),
    ],
  });
  const out = await doc.save();

  const fonts = await embeddedBaseFonts(out);
  assert.ok(
    fonts.some((name) => name.includes('Inter')),
    `expected Inter embedded, got: ${fonts.join(', ')}`,
  );
  assert.ok(
    !fonts.some((name) => name.includes('Helvetica')),
    `unexpected Helvetica fallback, got: ${fonts.join(', ')}`,
  );
});

test('explicitly registered fontkit is used when present', async () => {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  PdfDoc.registerFontkit(fontkit);

  const doc = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('Hello Inter', { font: 'Inter', size: 14 })] }),
    ],
  });
  const out = await doc.save();

  const fonts = await embeddedBaseFonts(out);
  assert.ok(
    fonts.some((name) => name.includes('Inter')),
    `expected Inter embedded, got: ${fonts.join(', ')}`,
  );
  assert.ok(
    !fonts.some((name) => name.includes('Helvetica')),
    `unexpected Helvetica fallback, got: ${fonts.join(', ')}`,
  );

  // Measurement uses the embedded font's real metrics.
  const width = doc.getContext().measureTextWidth('Hello Inter', 14, 'Inter');
  assert.ok(width > 0 && Number.isFinite(width));
});

// --- useFonts / FontSet / doc-scoped resolution ---

test('useFonts loads the shipped Inter family into a FontSet', async () => {
  const fonts = await useFonts({ body: 'inter' });

  assert.equal(fonts.tokens.body, 'inter');
  const bytes = fonts.families.get('inter')?.regular;
  assert.ok(bytes instanceof Uint8Array, 'expected family bytes in the FontSet');
  assert.ok(bytes.byteLength > 1000);
});

test('unknown family throws listing the shipped families', async () => {
  await assert.rejects(useFonts({ body: 'nope' }), /inter/);
});

test('PdfDoc({ fonts }) embeds Inter with no registerFontkit/registerFont calls', async () => {
  const fonts = await useFonts({ body: 'inter' });
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({ dimensions: [300, 200], children: [Text('Hello Inter', { font: 'inter', size: 14 })] }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  assert.ok(embedded.some((name) => name.includes('Inter')), `got: ${embedded.join(', ')}`);
  assert.ok(
    !embedded.some((name) => name.includes('Helvetica')),
    `unexpected fallback: ${embedded.join(', ')}`,
  );
});

test('FontSet tokens override theme.fonts without mutating the theme', async () => {
  const theme = createTheme({
    fonts: { body: 'Inter' },
    text: { body: { font: 'body', size: 14 } },
  });
  const fonts = await useFonts({ body: 'inter' });

  const doc = new PdfDoc({
    theme,
    fonts,
    children: [
      Page({ dimensions: [300, 200], children: [Text('Merged', { size: 14 })] }),
    ],
  });
  const out = await doc.save();

  assert.equal(theme.fonts.body, 'Inter'); // user's theme object untouched
  assert.equal(doc.getTheme().fonts.body, 'inter'); // doc-level won

  const embedded = await embeddedBaseFonts(out);
  assert.ok(embedded.some((name) => name.includes('Inter')), `got: ${embedded.join(', ')}`);
  assert.ok(!embedded.some((name) => name.includes('Helvetica')));
});

test('files escape hatch + doc-scoped resolution (second doc unaffected)', async () => {
  const bytes = fs.readFileSync(FONT_URL);
  const fontsA = await useFonts({ body: 'ScopeFont' }, { files: { ScopeFont: bytes } });

  const docA = new PdfDoc({
    fonts: fontsA,
    children: [
      Page({ dimensions: [300, 200], children: [Text('Scoped', { font: 'ScopeFont', size: 14 })] }),
    ],
  });
  const outA = await docA.save();

  // Doc B has no fonts: the same family name falls back (with a warning).
  const docB = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('Unscoped', { font: 'ScopeFont', size: 14 })] }),
    ],
  });
  const { result: outB, warnings } = await captureWarn(() => docB.save());

  const embeddedA = await embeddedBaseFonts(outA);
  assert.ok(embeddedA.some((name) => name.includes('Inter')), `got: ${embeddedA.join(', ')}`);
  assert.ok(!embeddedA.some((name) => name.includes('Helvetica')));

  const embeddedB = await embeddedBaseFonts(outB);
  assert.ok(embeddedB.some((name) => name.includes('Helvetica')), `got: ${embeddedB.join(', ')}`);
  assert.ok(
    warnings.some((message) => message.includes('not registered')),
    'expected an unregistered-font warning for doc B',
  );
});

// --- font family variants (faces) ---

test('useFonts loads the shipped Inter family with all four faces', async () => {
  const fonts = await useFonts({ body: 'inter' });
  const inter = fonts.families.get('inter');

  assert.ok(inter, 'expected the inter family in the FontSet');
  for (const face of ['regular', 'bold', 'italic', 'boldItalic']) {
    const bytes = inter[face];
    assert.ok(bytes instanceof Uint8Array, `expected ${face} face bytes`);
    assert.ok(bytes.byteLength > 1000, `expected the ${face} face to be non-trivial`);
  }
});


test('face ids embed distinct faces per style', async () => {
  const fonts = await useFonts({ body: 'inter' });
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          Text('R', { font: 'inter', size: 14 }),
          Text('B', { font: 'inter-bold', size: 14 }),
          Text('I', { font: 'inter-italic', size: 14 }),
          Text('BI', { font: 'inter-bold-italic', size: 14 }),
        ],
      }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  const interFaces = new Set(embedded.filter((name) => name.includes('Inter')));
  assert.ok(
    interFaces.size >= 4,
    `expected 4 distinct Inter faces, got: ${[...interFaces].join(', ')}`,
  );
  assert.ok(
    !embedded.some((name) => name.includes('Helvetica')),
    `unexpected fallback: ${embedded.join(', ')}`,
  );
});

test('missing face falls back to the regular face with a warning', async () => {
  const bytes = fs.readFileSync(FONT_URL);
  const fonts = await useFonts({ body: 'Partial' }, { files: { Partial: bytes } });
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({ dimensions: [300, 200], children: [Text('Fallback', { font: 'Partial-bold', size: 14 })] }),
    ],
  });

  const { result: out, warnings } = await captureWarn(() => doc.save());
  const embedded = await embeddedBaseFonts(out);

  assert.ok(embedded.some((name) => name.includes('Inter')), `got: ${embedded.join(', ')}`);
  assert.ok(!embedded.some((name) => name.includes('Helvetica')));
  assert.ok(
    warnings.some((message) => message.includes('Partial-bold') && message.includes('regular')),
    `expected a face-fallback warning, got: ${warnings.join(' | ')}`,
  );
});

test('exact family names win over face-id parsing', async () => {
  const bytes = fs.readFileSync(FONT_URL);
  // A family literally named 'probe-bold' must embed as itself, not as the
  // (nonexistent) bold face of a family named 'probe'.
  const fonts = await useFonts({ body: 'probe-bold' }, { files: { 'probe-bold': bytes } });
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({ dimensions: [300, 200], children: [Text('Exact', { font: 'probe-bold', size: 14 })] }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  assert.ok(
    embedded.some((name) => name.includes('Inter')),
    `expected the exact 'probe-bold' family (Inter bytes), got: ${embedded.join(', ')}`,
  );
  assert.ok(!embedded.some((name) => name.includes('Helvetica')));
});

test('globally registered families fall back for face ids (legacy registerFont)', async () => {
  const bytes = fs.readFileSync(FONT_URL);
  PdfDoc.registerFont('LegacyFace', bytes);
  const doc = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('Legacy', { font: 'LegacyFace-bold', size: 14 })] }),
    ],
  });

  const { result: out, warnings } = await captureWarn(() => doc.save());
  const embedded = await embeddedBaseFonts(out);

  assert.ok(embedded.some((name) => name.includes('Inter')), `got: ${embedded.join(', ')}`);
  assert.ok(!embedded.some((name) => name.includes('Helvetica')));
  assert.ok(
    warnings.some((message) => message.includes('single face')),
    `expected a single-face warning, got: ${warnings.join(' | ')}`,
  );
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
