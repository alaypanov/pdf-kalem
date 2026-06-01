# Kalem

Kalem is a PDF-focused widget-tree UI library for document-style layout and generation.

The core idea is to describe content as a tree of widgets such as pages, containers, rows, columns, text, images, links, and SVG paths, then export that tree through a renderer-specific backend.

## What It Does

- Builds page-based layouts with Yoga.
- Supports PDF export through `pdf-lib`.
- Allows custom fonts to be registered on the document layer.

## Current Architecture

The project is split into two layers:

- Widget tree: `Doc`, `Page`, `Container`, `Text`, `Row`, `Column`, `Image`, `Link`, `FixedContainer`, `SVGPath`, and related layout primitives.
- PDF/render layer: the document and rendering context.

`Doc` is optimized around PDF output. The widget tree renders through a PDF-backed `RenderContext`, and `Doc.save()` handles PDF creation, metadata, rendering, and final byte generation.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Example

```ts
import {
  Doc,
  PageSize,
} from './src/lib';
import { Page, Text, Container } from './src/lib/widgets';
import { fromHex } from './src/lib/utils/color-utils';

const doc = new Doc({
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

Additional output helpers are available when you want a runtime-specific result:

```ts
const bytes = await doc.save();
const blob = await doc.getBlob();
await doc.download('invoice.pdf');
const buffer = await doc.getBuffer();
await doc.writeToFile('invoice.pdf');
```

`getBuffer()` and `writeToFile()` are intended for Node runtimes. `writeToFile()` uses `node:fs/promises`.

## Fonts

Kalem ships with a few built-in font aliases that work without registration:

```ts
import { BuiltinPdfFonts } from './src/lib';

const theme = createTheme({
  fonts: {
    body: 'sans',
    heading: 'sans-bold',
    code: 'mono',
  },
});
```

Available aliases: `sans`, `sans-bold`, `sans-italic`, `sans-bold-italic`, `serif`, `serif-bold`, `serif-italic`, `serif-bold-italic`, `mono`, `mono-bold`, `mono-italic`, `mono-bold-italic`.

You can register fonts at the document level:

```ts
await Doc.registerFonts({
  Inter: '/fonts/Inter-Regular.ttf',
});
```

If you want custom fonts in PDF output, `pdf-lib` requires `@pdf-lib/fontkit`.

```ts
import fontkit from '@pdf-lib/fontkit';

Doc.registerFontkit(fontkit);
```

## Theme

You can define document-scoped theme tokens and widget defaults on the document itself.

```ts
import { Doc, PageSize, createTheme } from './src/lib';
import { Page, Text, Table } from './src/lib/widgets';
import { fromHex } from './src/lib/utils/color-utils';

const theme = createTheme({
  fonts: {
    body: 'Inter',
    heading: 'Inter',
  },
  colors: {
    text: fromHex('#0f172a'),
    primary: fromHex('#1d4ed8'),
    border: fromHex('#cbd5e1'),
  },
  text: {
    body: { font: 'body', size: 12, color: 'text' },
    h1: { font: 'heading', size: 20, color: 'text' },
    link: { font: 'body', size: 12, color: 'primary', underline: true },
  },
  table: {
    borderColor: 'border',
    headBgColor: 'primary',
    cellPadding: 8,
  },
});

const doc = new Doc({
  size: PageSize.LETTER,
  theme,
  children: [
    Page({
      children: [
        Text('Quarterly report', { variant: 'h1' }),
        Text('Prepared with shared theme defaults', { variant: 'body' }),
        Table({
          width: '100%',
        }),
      ],
    }),
  ],
});
```

Widget props still override theme defaults, so the theme can stay focused on typography and visual tokens while layout remains explicit in the document tree.

## Project Status

The current direction is:

- keep the widget tree focused on document layout for PDF output
- keep PDF behavior explicit and first-class
- avoid widening the abstraction surface before there is a concrete need

There are still unrelated TypeScript issues in the current repo build outside the exporter work:

- `src/lib/Column.ts`
- `src/lib/Row.ts`
- `src/lib/types/padding.ts`

## Scripts

- `pnpm dev` starts Vite.
- `pnpm build` runs TypeScript and the Vite production build.
- `pnpm preview` serves the built app.