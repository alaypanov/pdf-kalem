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

const FONT_URL = new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url);

// The Inter family, loaded the way consumers now load any family: bytes via
// `files` (the TTFs live in examples/fonts/).
const interFiles = {
  regular: fs.readFileSync(new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url)),
  bold: fs.readFileSync(new URL('../examples/fonts/Inter-Bold.ttf', import.meta.url)),
  italic: fs.readFileSync(new URL('../examples/fonts/Inter-Italic.ttf', import.meta.url)),
  boldItalic: fs.readFileSync(new URL('../examples/fonts/Inter-BoldItalic.ttf', import.meta.url)),
};
const interFontSet = () => useFonts({ body: 'inter' }, { files: { inter: interFiles } });

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

test('useFonts loads a family from files into a FontSet', async () => {
  const fonts = await interFontSet();

  assert.equal(fonts.tokens.body, 'inter');
  const bytes = fonts.families.get('inter')?.regular;
  assert.ok(bytes instanceof Uint8Array, 'expected family bytes in the FontSet');
  assert.ok(bytes.byteLength > 1000);
});

test('unknown family without files throws with guidance', async () => {
  await assert.rejects(useFonts({ body: 'nope' }), /nope/);
});

test('PdfDoc({ fonts }) embeds Inter with no registerFontkit/registerFont calls', async () => {
  const fonts = await interFontSet();
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
  const fonts = await interFontSet();

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

test('useFonts loads a family with all four faces from files', async () => {
  const fonts = await interFontSet();
  const inter = fonts.families.get('inter');

  assert.ok(inter, 'expected the inter family in the FontSet');
  for (const face of ['regular', 'bold', 'italic', 'boldItalic']) {
    const bytes = inter[face];
    assert.ok(bytes instanceof Uint8Array, `expected ${face} face bytes`);
    assert.ok(bytes.byteLength > 1000, `expected the ${face} face to be non-trivial`);
  }
});


test('face ids embed distinct faces per style', async () => {
  const fonts = await interFontSet();
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

// --- block/variant/run typography (fontWeight / fontStyle) ---

test('block fontWeight/fontStyle pick the family face', async () => {
  const fonts = await interFontSet();
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          Text('B', { font: 'inter', fontWeight: 700, size: 14 }),
          Text('I', { font: 'inter', fontStyle: 'italic', size: 14 }),
          Text('BI', { font: 'inter', fontWeight: 700, fontStyle: 'italic', size: 14 }),
        ],
      }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  const interFaces = [...embedded.filter((name) => name.includes('Inter'))];
  assert.ok(interFaces.some((name) => name.includes('Bold') && !name.includes('BoldItalic')), `no bold face: ${interFaces}`);
  assert.ok(interFaces.some((name) => name.includes('Italic') && !name.includes('BoldItalic')), `no italic face: ${interFaces}`);
  assert.ok(interFaces.some((name) => name.includes('BoldItalic')), `no bold-italic face: ${interFaces}`);
});

test('numeric weights snap to the two-weight family model', async () => {
  const fonts = await interFontSet();
  // 600–900 → bold; 100–500 → regular (CSS matching for a family offering
  // only 400 and 700). Separate docs so embeddings don't bleed across cases.
  const boldDoc = new PdfDoc({
    fonts,
    children: [Page({ dimensions: [300, 200], children: [Text('6', { font: 'inter', fontWeight: 600, size: 14 })] })],
  });
  const regularDoc = new PdfDoc({
    fonts,
    children: [Page({ dimensions: [300, 200], children: [Text('4', { font: 'inter', fontWeight: 400, size: 14 })] })],
  });

  const boldEmbedded = await embeddedBaseFonts(await boldDoc.save());
  assert.ok(
    boldEmbedded.some((name) => name.includes('Inter-Bold')),
    `expected Inter-Bold for weight 600, got: ${boldEmbedded.join(', ')}`,
  );

  const regularEmbedded = await embeddedBaseFonts(await regularDoc.save());
  assert.ok(
    regularEmbedded.some((name) => /Inter/.test(name)) && !regularEmbedded.some((name) => name.includes('Bold')),
    `weight 400 should embed only a regular face, got: ${regularEmbedded.join(', ')}`,
  );
});

test('theme variant fontWeight styles the variant; block value overrides it', async () => {
  const theme = createTheme({
    fonts: { body: 'inter' },
    text: { heading: { font: 'body', fontWeight: 700 } },
  });
  const fonts = await interFontSet();

  const variantDoc = new PdfDoc({
    theme,
    fonts,
    children: [Page({ dimensions: [300, 200], children: [Text('H', { variant: 'heading', size: 14 })] })],
  });
  const overrideDoc = new PdfDoc({
    theme,
    fonts,
    children: [Page({ dimensions: [300, 200], children: [Text('R', { variant: 'heading', fontWeight: 400, size: 14 })] })],
  });

  const variantEmbedded = await embeddedBaseFonts(await variantDoc.save());
  assert.ok(
    variantEmbedded.some((name) => name.includes('Inter-Bold')),
    `expected the variant's bold face, got: ${variantEmbedded.join(', ')}`,
  );

  // The block's explicit 400 replaces the variant's 700 (per-axis replace).
  const overrideEmbedded = await embeddedBaseFonts(await overrideDoc.save());
  assert.ok(
    overrideEmbedded.some((name) => /Inter/.test(name)) && !overrideEmbedded.some((name) => name.includes('Bold')),
    `block weight 400 should un-bold the variant, got: ${overrideEmbedded.join(', ')}`,
  );
});

test('run typography replaces its axis over the block style', async () => {
  const fonts = await interFontSet();
  const doc = new PdfDoc({
    fonts,
    children: [
      Page({
        dimensions: [300, 200],
        children: [
          // Block bold + run italic → bold-italic.
          Text([{ text: 'BI', fontStyle: 'italic' }], { font: 'inter', fontWeight: 700, size: 14 }),
          // Run weight 400 un-bolds the block's 700 (per-axis replace).
          Text([{ text: 'R', fontWeight: 400 }], { font: 'inter', fontWeight: 700, size: 14 }),
        ],
      }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  // Inter's italic faces carry 'InterItalic' PostScript names — match on the
  // style suffix, not the family prefix.
  assert.ok(
    embedded.some((name) => name.includes('BoldItalic')),
    `expected bold-italic from block bold + run italic, got: ${embedded.join(', ')}`,
  );
  assert.ok(
    embedded.some((name) => name.includes('Inter-Regular')),
    `expected the un-bolded run to embed a regular face, got: ${embedded.join(', ')}`,
  );
});

test('builtin fonts honor fontWeight (sans-bold → Helvetica-Bold)', async () => {
  const doc = new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('B', { fontWeight: 700, size: 14 })] }),
    ],
  });
  const out = await doc.save();

  const embedded = await embeddedBaseFonts(out);
  assert.ok(
    embedded.some((name) => name.includes('Helvetica-Bold')),
    `expected Helvetica-Bold, got: ${embedded.join(', ')}`,
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
