# Getting started

> **Status: early alpha.** The API is not yet stable and may change between versions.

pdf-kalem is a widget-tree UI library for document-style layout and generation. You describe content as a tree of widgets — pages, containers, rows, columns, text, images, links, tables, and SVG paths — run [Yoga](https://github.com/facebook/yoga) for flexbox layout, and render the tree through a backend-specific renderer. The PDF backend is [pdf-lib](https://pdf-lib.js.org). The design is heavily inspired by [Flutter](https://flutter.dev)'s widget-tree model, adapted to the document/PDF domain.

## Install

```bash
pnpm add pdf-kalem
```

## Your first document

```ts
import { PdfDoc, PageSize } from 'pdf-kalem';
import { Page, Text, Container } from 'pdf-kalem/widgets';
import { fromHex } from 'pdf-kalem/utils/color-utils';

const doc = new PdfDoc({
  size: PageSize.LETTER,
  children: [
    Page({
      padding: 24,
      children: [
        Text('Hello world', { size: 18 }),
        Container({
          width: 200,
          height: 80,
          bgColor: fromHex('#FFCC00'),
        }),
      ],
    }),
  ],
});

const pdfBytes = await doc.save();
```

Widgets are created through plain factory functions (`Page(...)`, `Text(...)`) — no classes to instantiate, no `new` outside `PdfDoc`. Layout is Yoga flexbox: `Row`, `Column`, `gap`, `flexGrow`, `%` widths, and absolute positioning all work as you'd expect.

## Output helpers

`PdfDoc` is the document model: it owns the page tree, theme, metadata, and lifecycle hooks. Runtime helpers cover both browser and Node:

```ts
const bytes = await doc.save();               // Uint8Array
const blob = await doc.getBlob();             // browser Blob
await doc.download('invoice.pdf');            // browser download
const buffer = await doc.getBuffer();         // Node Buffer
await doc.writeToFile('invoice.pdf');         // Node fs
```

`getBuffer()` and `writeToFile()` are intended for Node runtimes; `download()` and `getBlob()` for the browser.

## Metadata

Pass document metadata at construction:

```ts
const doc = new PdfDoc({
  size: PageSize.LETTER,
  meta: {
    title: 'Q1 Report',
    author: 'Northwind Labs',
    subject: 'Platform, reliability, and delivery',
    language: 'en-US',
    keywords: ['report', 'q1'],
    creator: 'pdf-kalem',
    producer: 'pdf-lib',
  },
  children: [/* ... */],
});
```

## Next steps

- Try the [widget playground](/playground/widgets) — edit a live document in your browser.
- Skim the [widgets](/guide/widgets) and [theming](/guide/theming) guides.
- Converting markdown? Jump to the [markdown guide](/guide/markdown) or the [markdown playground](/playground/markdown).
- Copy an [example](https://github.com/alaypanov/pdf-kalem/tree/main/examples) — self-contained projects (hello-world, invoice, report, markdown converter) structured to be adapted to your own documents.
