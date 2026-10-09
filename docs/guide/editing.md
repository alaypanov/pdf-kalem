# Editing existing PDFs

The `pdf-kalem/edit` subpath loads an existing PDF for editing. Every page becomes a real [`Page`](./widgets) widget — sized from the file — so editing and generation share one document model:

```ts
import { loadPdf } from 'pdf-kalem/edit';

const pdf = await loadPdf(bytes, {
  theme: myTheme,   // optional — for overlay widgets
  fonts,            // optional FontSet (see Fonts)
});
```

The source is bytes (`Uint8Array | ArrayBuffer`) or a **URL string** — fetched for you (browser and Node 18+ both have `fetch`), matching the `useFonts` source convention. Pass bytes from a file picker or Node's `fs` when they're already in hand:

```ts
const fromUrl = await loadPdf('https://example.com/contract.pdf');
const fromDisk = await loadPdf(await readFile('contract.pdf'));
const fromPicker = await loadPdf(await fileInput.files[0].arrayBuffer());
```

## Overlaying widgets

`page.add([...])` places widgets **on top of the original page content**. Widgets join a page-filling flow root (column, top-down): position with padding, alignment, and spacers; use `FixedContainer` for absolute placement. Repeated calls append in call order.

```ts
import { FixedContainer, HLine, Text } from 'pdf-kalem/widgets';
import { fromHex } from 'pdf-kalem/utils/color-utils';

pdf.pages[0].add([
  // Flow placement: a stamp block at the top of the page.
  Text([{ text: 'REVIEWED', bold: true, color: fromHex('#B45309') }], { size: 28 }),
  HLine({ thickness: 2 }),

  // Absolute placement: pinned to the page's bottom-right corner.
  FixedContainer({
    bottom: 24,
    right: 24,
    children: [Text('Edited with pdf-kalem', { size: 9 })],
  }),
]);
```

Overlays are declarative — the widget tree is the state, and painting happens at save time together with the rest of the document.

## Restructuring pages

`pdf.pages` is a plain array — native array operations are the API:

```ts
pdf.pages.splice(2, 1);                        // remove a page
pdf.pages.sort((a, b) => a.getSourceIndex() - b.getSourceIndex());   // reorder
pdf.pages.push(new Page({ children: [...] })); // blank or generated pages
```

Merging is composing: load both documents and concatenate their `pages` arrays.

## Saving

Two paths, one render pipeline:

```ts
// Sugar: a PdfDoc built from pdf.pages with the load-time fonts/theme.
const out = await pdf.save(); // Uint8Array

// Compose loaded pages alongside generated ones in your own document.
const doc = new PdfDoc({ children: [...pdf.pages, generatedPage], fonts });
await doc.save();
```

Loaded pages are **adopted** into the output document — the original page object is copied, so its content streams, annotations, links, and form fields are preserved, and your widgets draw on top. Nothing is re-drawn or flattened.

## Escape hatch

`pdf.PDFDocument` exposes the underlying pdf-lib document (read-write) for anything the editing API doesn't cover — metadata, form fields, raw pdf-lib drawing. Beyond `loadPdf`'s guarantees, you're on your own there.

::: warning Limitations
- **Rotated pages** (`/Rotate ≠ 0`) throw a clear error at `loadPdf` — overlaying them is not supported yet.
- **Encrypted PDFs** are not supported; the pdf-lib load error propagates.
- **Overlay overflow** is clipped with a warning — overlays belong to exactly one page and are never paginated across pages.
:::

## Try it live

The [editing playground](/playground/editing) loads a sample document (or your own PDF) and re-renders your overlay code as you type. For a starting point you own, copy the [`examples/edit/`](https://github.com/alaypanov/pdf-kalem/tree/main/examples/edit) project.
