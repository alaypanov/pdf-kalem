/**
 * Preview seam tests (IDEAS.md I9 Stage 1): `renderToPng` rasterizes the
 * exact bytes `doc.save()` produced — right page, right size, real content.
 *
 * Run: node tests/preview.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { renderToPng } from '../dist/preview.js';
import { PdfDoc } from '../dist/index.js';
import { Page, Text } from '../dist/widgets.js';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG IHDR: width/height are big-endian uint32s at offsets 16/20. */
function pngDimensions(png) {
  return {
    width: (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19],
    height: (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23],
  };
}

async function twoPageDoc() {
  return new PdfDoc({
    children: [
      Page({ dimensions: [300, 200], children: [Text('page one', { size: 20 })] }),
      Page({ dimensions: [200, 300], children: [Text('page two', { size: 20 })] }),
    ],
  }).save();
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('rasterizes the first page at the requested DPI', async () => {
  const bytes = await twoPageDoc();
  const png = await renderToPng(bytes, { dpi: 72 });

  assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
  assert.deepEqual(pngDimensions(png), { width: 300, height: 200 });
});

test('page option selects the page (0-based)', async () => {
  const bytes = await twoPageDoc();
  const png = await renderToPng(bytes, { page: 1, dpi: 72 });

  assert.deepEqual(pngDimensions(png), { width: 200, height: 300 }, 'second page has its own dimensions');
});

test('the raster carries real content, not a blank page', async () => {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const bytes = await new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [Text('ink', { size: 48 })] })],
  }).save();

  const png = await renderToPng(bytes, { dpi: 72 });
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, image.width, image.height);

  // White page, dark text: count pixels meaningfully darker than the page.
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 128 && data[i + 1] < 128 && data[i + 2] < 128) dark++;
  }
  assert.ok(dark > 50, `expected rendered text pixels, got ${dark} dark pixels`);
});

test('default DPI is 144 (2x the PDF 72/inch)', async () => {
  const bytes = await twoPageDoc();
  const png = await renderToPng(bytes);
  assert.deepEqual(pngDimensions(png), { width: 600, height: 400 });
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
