/**
 * Edit-module tests: loading existing PDFs as Page widgets (`pdf-kalem/edit`).
 *
 * Fixtures are synthesized with pdf-lib (no binary assets); content
 * assertions inflate the output's FlateDecode content streams and search the
 * text-showing operators. Run: node tests/edit.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { PDFArray, PDFDocument, StandardFonts, degrees } from 'pdf-lib';

import { loadPdf } from '../dist/edit.js';
import { PdfDoc } from '../dist/index.js';
import { FixedContainer, HLine, Page, Text } from '../dist/widgets.js';

// --- fixtures -----------------------------------------------------------------

const MARKER_ONE = 'PAGE-ONE-MARKER';
const MARKER_TWO = 'PAGE-TWO-MARKER';
const OVERLAY_MARKER = 'KALEM-OVERLAY-TOP';
const GENERATED_MARKER = 'GENERATED-PAGE';

/** Two pages with known sizes and searchable text: 300x400, 200x300. */
async function fixtureBytes() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const one = doc.addPage([300, 400]);
  one.drawText(MARKER_ONE, { x: 20, y: 200, size: 12, font });
  const two = doc.addPage([200, 300]);
  two.drawText(MARKER_TWO, { x: 20, y: 150, size: 12, font });
  return doc.save();
}

function decodeStream(pdf, stream) {
  const filter = stream.dict?.get(pdf.context.obj('Filter'));
  const bytes = Buffer.from(stream.contents);
  const decoded = filter?.toString().includes('FlateDecode') ? inflateSync(bytes) : bytes;
  // pdf-lib writes text-showing operators with hex literal strings
  // (<504147...> Tj) — decode them so assertions can search plain text.
  return decoded.toString('latin1').replace(/<([0-9A-Fa-f]+)>/g, (_, hex) =>
    Buffer.from(hex, 'hex').toString('latin1'),
  );
}

/** All text-drawing content of output page `index`, as one latin1 string. */
function pageText(pdf, index) {
  const contents = pdf.context.lookup(pdf.getPage(index).node.Contents());
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, i) => pdf.context.lookup(contents.get(i)))
      : [contents];
  return streams.map((s) => decodeStream(pdf, s)).join('');
}

let passed = 0;
async function test(label, fn) {
  await fn();
  passed++;
  console.log(`ok - ${label}`);
}

// --- loading ------------------------------------------------------------------

await test('loadPdf exposes one LoadedPage per page, sized from the file', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  assert.equal(pdf.pages.length, 2);
  // Dimensions are preset from the file, so the context is never consulted.
  const stubContext = { getDimensions: () => [0, 0] };
  assert.deepEqual(pdf.pages[0].getDimensions(stubContext), [300, 400]);
  assert.deepEqual(pdf.pages[1].getDimensions(stubContext), [200, 300]);
});

await test('PDFDocument escape hatch exposes the loaded pdf-lib document', async () => {
  const bytes = await fixtureBytes();
  const pdf = await loadPdf(bytes);
  assert.equal(pdf.PDFDocument.getPageCount(), 2);
  // Same document the pages adopt from.
  assert.equal(pdf.PDFDocument.getPage(0).getWidth(), 300);
});

await test('string sources are fetched (data URLs; http works the same)', async () => {
  const bytes = await fixtureBytes();
  const dataUrl = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
  const pdf = await loadPdf(dataUrl);
  assert.equal(pdf.pages.length, 2);
  assert.equal(pdf.PDFDocument.getPage(0).getWidth(), 300);
});

await test('failed fetches throw a loadPdf-branded error', async () => {
  await assert.rejects(
    loadPdf('not-a-url'),
    /loadPdf: failed to fetch 'not-a-url'/,
  );
});

await test('garbage bytes surface pdf-lib\'s parse error as-is', async () => {
  const garbage = `data:application/pdf;base64,${Buffer.from([0, 1, 2, 3]).toString('base64')}`;
  await assert.rejects(loadPdf(garbage), /No PDF header found/);
});

await test('encrypted documents fail with pdf-lib\'s load error (no decryption support)', async () => {
  // A truncated/garbage input must not be swallowed into an empty edit session.
  await assert.rejects(loadPdf(new Uint8Array([0, 1, 2, 3])));
});

await test('rotated pages throw a clear error at load time', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]).setRotation(degrees(90));
  await assert.rejects(
    loadPdf(await doc.save()),
    /page 0 is rotated 90/,
  );
});

// --- overlay ------------------------------------------------------------------

await test('overlay widgets paint on top of the adopted page at save time', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages[0].add([
    Text(OVERLAY_MARKER, { size: 24 }),
    HLine({ thickness: 2 }),
  ]);

  const out = await PDFDocument.load(await pdf.save());
  assert.equal(out.getPageCount(), 2);
  // Original content preserved on the adopted page, overlay added on top.
  assert.ok(pageText(out, 0).includes(MARKER_ONE), 'original page-one content survives');
  assert.ok(pageText(out, 0).includes(OVERLAY_MARKER), 'overlay text painted on page one');
  assert.ok(!pageText(out, 1).includes(OVERLAY_MARKER), 'overlay stays on its own page');
  assert.ok(pageText(out, 1).includes(MARKER_TWO), 'page two untouched');
});

await test('repeated add calls append in call order', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages[0].add([Text('FIRST-ADD')]);
  pdf.pages[0].add([Text('SECOND-ADD')]);

  const out = await PDFDocument.load(await pdf.save());
  const text = pageText(out, 0);
  assert.ok(text.includes('FIRST-ADD') && text.includes('SECOND-ADD'));
  assert.ok(text.indexOf('FIRST-ADD') < text.indexOf('SECOND-ADD'), 'call order preserved');
});

await test('overlay overflow is clipped, never paginated into new pages', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  // Far taller than the 400pt page — a Text block of many lines.
  const words = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');
  pdf.pages[0].add([Text(words, { size: 12, lineHeight: 12 })]);

  const out = await PDFDocument.load(await pdf.save());
  assert.equal(out.getPageCount(), 2, 'no extra pages from overlay overflow');
  assert.ok(pageText(out, 0).includes(MARKER_ONE));
});

// --- restructuring ------------------------------------------------------------

await test('pages is a plain mutable array: remove and reorder via splice', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages.splice(0, 1); // drop page one
  const removed = pdf.pages.splice(0, 1); // take the remaining page...
  pdf.pages.splice(0, 0, ...removed); // ...and put it back (no-op reorder)

  const out = await PDFDocument.load(await pdf.save());
  assert.equal(out.getPageCount(), 1);
  assert.ok(pageText(out, 0).includes(MARKER_TWO));
});

await test('reordering flips which content lands on which output page', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages.reverse();

  const out = await PDFDocument.load(await pdf.save());
  assert.equal(out.getPageCount(), 2);
  assert.ok(pageText(out, 0).includes(MARKER_TWO), 'source page two is now first');
  assert.ok(pageText(out, 1).includes(MARKER_ONE), 'source page one is now second');
  // Adopted pages keep their original sizes in their new positions.
  assert.equal(out.getPage(0).getSize().width, 200);
  assert.equal(out.getPage(1).getSize().width, 300);
});

await test('blank and generated pages compose via push', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages.push(
    Page({ dimensions: [150, 150], children: [Text(GENERATED_MARKER)] }),
  );

  const out = await PDFDocument.load(await pdf.save());
  assert.equal(out.getPageCount(), 3);
  assert.ok(pageText(out, 2).includes(GENERATED_MARKER));
  assert.equal(out.getPage(2).getSize().width, 150);
});

await test('save() is stateless: two saves produce two valid documents', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages[0].add([Text(OVERLAY_MARKER)]);

  const first = await PDFDocument.load(await pdf.save());
  const second = await PDFDocument.load(await pdf.save());
  assert.equal(first.getPageCount(), 2);
  assert.equal(second.getPageCount(), 2);
  assert.ok(pageText(second, 0).includes(OVERLAY_MARKER), 'second save re-adopts from the source');
});

// --- composition with generated documents --------------------------------------

await test('loaded pages compose into a user PdfDoc alongside generated ones', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  const doc = new PdfDoc({
    children: [
      pdf.pages[1],
      Page({ dimensions: [150, 150], children: [Text(GENERATED_MARKER)] }),
    ],
  });

  const out = await PDFDocument.load(await doc.save());
  assert.equal(out.getPageCount(), 2);
  assert.ok(pageText(out, 0).includes(MARKER_TWO), 'loaded page adopted into the generated doc');
  assert.equal(out.getPage(0).getSize().width, 200, 'loaded page keeps its preset size');
  assert.ok(pageText(out, 1).includes(GENERATED_MARKER), 'generated page follows');
});

await test('absolute overlay placement via FixedContainer', async () => {
  const pdf = await loadPdf(await fixtureBytes());
  pdf.pages[0].add([
    FixedContainer({ top: 20, left: 20, children: [Text('STAMPED')] }),
  ]);

  const out = await PDFDocument.load(await pdf.save());
  assert.ok(pageText(out, 0).includes('STAMPED'));
});

console.log(`ok - ${passed} edit assertions passed (load, overlay, restructure, compose)`);
