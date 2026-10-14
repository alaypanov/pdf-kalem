/**
 * Regression test: Yoga's default pointScaleFactor = 1 rounds every node's
 * computed box to integer points independently — abutting boxes with
 * fractional sizes (table rows are the visible case) round their shared
 * edges apart, and each cell's own border stroke lands ~1pt from its
 * neighbor's: the boundary reads as a doubled ~2pt line.
 *
 * The fix runs Yoga with pointScaleFactor = 0 (no rounding — PDF is a
 * vector format), so vertically adjacent cells' shared edges stay
 * bit-identical and the strokes overlap exactly. Asserted on the content
 * stream: each cell is a `cm` translate (the cell's PDF bottom-left) plus a
 * closed path whose first `l` carries the cell height.
 *
 * Run: node tests/table-borders.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { PDFArray, PDFDocument } from 'pdf-lib';

import { PdfDoc, PageSize } from '../dist/index.js';
import { Page, Table, TableHead, TableBody, TableRow, TableCell } from '../dist/widgets.js';

let passed = 0;
async function test(label, fn) {
  await fn();
  passed++;
  console.log(`ok - ${label}`);
}

function decodeStream(pdf, stream) {
  const filter = stream.dict?.get(pdf.context.obj('Filter'));
  const bytes = Buffer.from(stream.contents);
  const decoded = filter?.toString().includes('FlateDecode') ? inflateSync(bytes) : bytes;
  return decoded.toString('latin1');
}

/** All content of output page `index` as one latin1 string. */
function pageContent(pdf, index) {
  const contents = pdf.context.lookup(pdf.getPage(index).node.Contents());
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, i) => pdf.context.lookup(contents.get(i)))
      : [contents];
  return streams.map((s) => decodeStream(pdf, s)).join('');
}

/** Cell boxes from the stream: `{ x, yBottom, height }` per stroked rectangle. */
function cellBoxes(content) {
  const boxes = [];
  const group = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm(?:(?! [qQ] ).)*?0 (-?[\d.]+) l/s;
  for (const match of content.matchAll(new RegExp(group.source, 'gs'))) {
    boxes.push({
      x: parseFloat(match[1]),
      yBottom: parseFloat(match[2]),
      height: parseFloat(match[3]),
    });
  }
  return boxes;
}

await test('vertically adjacent cells share bit-identical edges (no rounding gaps)', async () => {
  // Fractional row heights are the rounding trigger: integer heights round
  // to the same edge either way, so the trigger must be load-bearing here.
  const ROW = 25.32;
  const row = () => TableRow({ minHeight: ROW, children: [TableCell({}), TableCell({}), TableCell({})] });
  const doc = new PdfDoc({
    size: PageSize.LETTER,
    children: [Page({
      padding: 48,
      children: [Table({
        width: '100%',
        borderWidth: 1,
        columnWeights: [1, 1, 1],
        head: TableHead({ rows: [row()] }),
        body: TableBody({ rows: [row(), row()] }),
      })],
    })],
  });
  const pdf = await PDFDocument.load(await doc.save());
  const boxes = cellBoxes(pageContent(pdf, 0));
  assert.equal(boxes.length, 9, '3x3 table strokes 9 cell rectangles');

  // Group by column (same x), sort top-down (PDF y grows up), and require
  // each lower cell's top edge (yBottom + height) to equal the upper cell's
  // bottom edge (yBottom) to float precision — the two border strokes then
  // overlap exactly and the boundary renders as one 1pt line.
  const columns = new Map();
  for (const box of boxes) {
    const key = box.x.toFixed(4);
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(box);
  }
  assert.equal(columns.size, 3, 'three columns');
  for (const [x, cells] of columns) {
    cells.sort((a, b) => b.yBottom - a.yBottom);
    assert.equal(cells.length, 3, `column ${x} has three cells`);
    for (let i = 0; i < cells.length - 1; i++) {
      const upper = cells[i];
      const lower = cells[i + 1];
      const gap = Math.abs(upper.yBottom - (lower.yBottom + lower.height));
      assert.ok(
        gap < 0.001,
        `column ${x}: shared edge between rows disagrees by ${gap}pt ` +
        `(upper bottom ${upper.yBottom} vs lower top ${lower.yBottom + lower.height}) — rounded layout splits abutting boxes`,
      );
    }
  }
});

console.log(`\ntable-borders.test.mjs: ${passed} passed`);
