/**
 * Image source tests (I13): file paths work in Node, formats sniff from
 * magic bytes, and a lying declared format loses to the bytes.
 *
 * Run: node tests/image.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Container, Image, ImageSizing, Page } from '../dist/widgets.js';
import { PdfDoc } from '../dist/index.js';
import { sniffImageFormat } from '../dist/internals.js';
import { createCanvas } from '@napi-rs/canvas';

// A 1x1 black PNG (the markdown tests' fixture).
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

/** Saves a one-page document whose content is `image`. */
async function saveWith(image) {
  return new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [image] })],
  }).save();
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('Image.png reads a file path in Node (I13)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-kalem-image-'));
  const path = join(dir, 'logo.png');
  await writeFile(path, Buffer.from(PNG_1X1, 'base64'));
  try {
    const bytes = await saveWith(Image.png(path));
    assert.ok(bytes.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Image.png reads a relative path from the process cwd', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-kalem-image-'));
  const path = join(dir, 'logo.png');
  await writeFile(path, Buffer.from(PNG_1X1, 'base64'));
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    const bytes = await saveWith(Image.png('./logo.png'));
    assert.ok(bytes.length > 0);
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test('Image.png reads a file:// URL in Node', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-kalem-image-'));
  const path = join(dir, 'logo.png');
  await writeFile(path, Buffer.from(PNG_1X1, 'base64'));
  try {
    const bytes = await saveWith(Image.png(`file://${path}`));
    assert.ok(bytes.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fromBytes sniffs the format when none is given', async () => {
  const png = Buffer.from(PNG_1X1, 'base64');
  assert.equal(sniffImageFormat(png), 'png');

  const bytes = await saveWith(Image.fromBytes(png));
  assert.ok(bytes.length > 0);
});

test('fromBytes throws with guidance on unrecognizable bytes', () => {
  assert.throws(() => Image.fromBytes(Buffer.from('GIF89a')), /could not sniff the format/);
});

test('a lying declared format loses to the sniffed bytes (with a warning)', async () => {
  const png = Buffer.from(PNG_1X1, 'base64');
  const { result, warnings } = await captureWarn(() => saveWith(Image.jpeg('', { bytes: png })));
  assert.ok(result.length > 0, 'embed succeeded with the sniffed format');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /sniffed 'png'/);
});

test('data URLs still fetch (unchanged path)', async () => {
  const bytes = await saveWith(Image.png(`data:image/png;base64,${PNG_1X1}`));
  assert.ok(bytes.length > 0);
});

test('Fit constrains against the parent-provided box (no intrinsic pin)', async () => {
  // The old behavior pinned the intrinsic size onto the Yoga node when no
  // width/height was given — a node with definite dimensions never consults
  // its measure func, so a 360pt image overflowed a Container({ width: 180,
  // height: 50 }) at natural size. Fit scale = min(180/360, 50/200) = 0.25.
  const canvas = createCanvas(360, 200);
  canvas.getContext('2d').fillRect(0, 0, 360, 200);
  const image = Image.fromBytes(canvas.toBuffer('image/png'), 'png', { sizing: ImageSizing.Fit });
  const box = Container({ width: 180, height: 50, child: image });
  await new PdfDoc({
    children: [Page({ dimensions: [400, 300], children: [box] })],
  }).save();
  assert.equal(image.getWidth(), 90);
  assert.equal(image.getHeight(), 50);
});

test('Fit never scales up on ambient space (a small logo stays intrinsic)', async () => {
  // A 1x1 image as a direct child of Page (alignItems: stretch): the removed
  // pin used to guarantee the intrinsic size; without it, the AtMost cap in
  // the fit measure keeps the image intrinsic instead of scaling up to the
  // full content width (which overflowed the page and moved the image to
  // page 2).
  const image = Image.fromBytes(Buffer.from(PNG_1X1, 'base64'));
  const doc = new PdfDoc({
    children: [Page({ dimensions: [300, 200], children: [image] })],
  });
  await doc.save();
  assert.equal(image.getWidth(), 1);
  assert.equal(image.getHeight(), 1);
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
