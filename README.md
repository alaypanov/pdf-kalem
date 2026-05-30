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

## Fonts

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