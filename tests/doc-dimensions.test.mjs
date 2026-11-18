import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { PageSize, PdfDoc } from '../dist/index.js';
import { Page } from '../dist/widgets.js';

async function assertDimensions(doc, expectedDocSize, expectedPageSizes = [expectedDocSize]) {
  assert.deepEqual([doc.getWidth(), doc.getHeight()], expectedDocSize);
  const pdf = await PDFDocument.load(await doc.save());
  assert.deepEqual(pdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), expectedPageSizes);
}

test('PdfDoc defaults to portrait Letter', async () => {
  await assertDimensions(new PdfDoc({ children: [Page()] }), [612, 792]);
});

test('PdfDoc uses the named size when dimensions are omitted', async () => {
  await assertDimensions(new PdfDoc({ size: PageSize.A4, children: [Page()] }), [595, 842]);
});

test('explicit document dimensions take precedence over a named size', async () => {
  const doc = new PdfDoc({
    size: PageSize.A4,
    dimensions: [320, 240],
    layout: 'portrait',
    children: [Page()],
  });
  await assertDimensions(doc, [320, 240]);
});

test('landscape swaps explicit dimensions even when a named size is supplied', async () => {
  await assertDimensions(new PdfDoc({
    size: PageSize.A4,
    dimensions: [320, 240],
    layout: 'landscape',
    children: [Page()],
  }), [240, 320]);
});

test('unsized pages inherit the landscape document size, not the previous page size', async () => {
  const doc = new PdfDoc({
    size: PageSize.A4,
    layout: 'landscape',
    children: [Page(), Page({ size: PageSize.A5 }), Page({ dimensions: [300, 400] }), Page()],
  });
  await assertDimensions(doc, [842, 595], [[842, 595], [420, 595], [300, 400], [842, 595]]);
});
