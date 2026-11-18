import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PdfDoc } from '../dist/index.js';
import { renderToPng } from '../dist/preview.js';
import { Page, Table, TableBody, TableRow, TableCell, Text } from '../dist/widgets.js';

const text = Array.from({ length: 15 }, () => 'visible line').join('\n');
const bytes = await new PdfDoc({ children: [Page({ dimensions: [200, 100], padding: 10, children: [
  Table({ width: 100, body: TableBody({ rows: [TableRow({ children: [TableCell({ child: Text(text, { size: 10, lineHeight: 10, whiteSpace: 'pre-wrap' }) })] })] }) }),
] })] }).save();
const image = await loadImage(await renderToPng(bytes, { dpi: 72 }));
const canvas = createCanvas(image.width, image.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0);
const { data } = ctx.getImageData(0, 90, 200, 10);
let dark = 0;
for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 1] < 128 && data[i + 2] < 128) dark++;
assert.equal(dark, 0, `text painted ${dark} dark pixels in bottom padding`);
console.log('ok - oversized atomic row is clipped to page content');
