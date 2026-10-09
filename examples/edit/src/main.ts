import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfDoc } from 'pdf-kalem';
import { fromHex } from 'pdf-kalem/utils/color-utils';
import { FixedContainer, HLine, Page, Text } from 'pdf-kalem/widgets';
import { loadPdf } from 'pdf-kalem/edit';

// Usage: node src/main.ts [input.pdf] [output.pdf]
// With no arguments, edits the repo's sample PDF (public/pdf-sample.pdf).
const [input = '../../../public/pdf-sample.pdf', output = 'edited.pdf'] = process.argv.slice(2);

const bytes = await readFile(new URL(input, import.meta.url));

// --- 1. Load: every page becomes a Page widget, sized from the file ----------

const pdf = await loadPdf(bytes);
const first = pdf.pages[0];
console.log(`Loaded ${pdf.pages.length} page(s); first page is ${pdf.PDFDocument.getPage(0).getWidth()}pt wide`);

// --- 2. Overlay: widgets on top of the original content ----------------------

first.add([
  // Flow placement: a stamp block at the top of the page.
  Text([{ text: 'REVIEWED', bold: true, color: fromHex('#B45309') }], { size: 28 }),
  HLine({ thickness: 2, color: fromHex('#B45309') }),
  // Absolute placement: pinned to the page's bottom-right corner.
  FixedContainer({
    bottom: 24,
    right: 24,
    children: [Text('Edited with pdf-kalem', { size: 9, color: fromHex('#92400E') })],
  }),
]);

await writeFile(new URL(output, import.meta.url), await pdf.save());
console.log(`Wrote ${output} (overlay on the original page)`);

// --- 3. Restructure: pages are a plain array of Page widgets ------------------

// Synthesize a second document to merge with.
const extra = await PDFDocument.create();
const font = await extra.embedFont(StandardFonts.Helvetica);
const cover = extra.addPage([300, 400]);
cover.drawText('COVER PAGE', { x: 40, y: 200, size: 18, font, color: rgb(0.7, 0.4, 0.1) });
const annex = extra.addPage([300, 400]);
annex.drawText('ANNEX', { x: 40, y: 200, size: 18, font, color: rgb(0.7, 0.4, 0.1) });

const other = await loadPdf(await extra.save());

// Compose freely: cover first, then the edited original. Remove/reorder are
// plain array ops (`splice`, `sort`) — the array is the edit surface.
const merged = [...other.pages.slice(0, 1), ...pdf.pages];
await writeFile(
  new URL('merged.pdf', import.meta.url),
  await new PdfDoc({ children: merged }).save(),
);
console.log('Wrote merged.pdf (cover + edited sample, composed as one document)');
