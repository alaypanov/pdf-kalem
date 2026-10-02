# pdf-kalem

> **For AI assistants:** read [`LLM_CONTEXT.md`](./LLM_CONTEXT.md) for a compact codebase orientation before diving into the source.

> **Status: early alpha.** The API is not yet stable and may change between versions. Not recommended for production use yet — feedback and bug reports are welcome.

pdf-kalem is a widget-tree UI library for document-style layout and generation.

The core idea is to describe content as a tree of widgets — pages, containers, rows, columns, text, images, links, tables, and SVG paths — run [Yoga](https://github.com/facebook/yoga) for flexbox layout, and render the tree through a backend-specific renderer. The PDF backend (`pdf-lib`).

The design is heavily inspired by [Flutter](https://flutter.dev)'s widget-tree model — the idea of composing documents from declarative widget trees with flexbox layout, theme tokens, and per-widget overrides. pdf-kalem adapts that mental model to the document/PDF domain.

## What It Does

- Builds page-based layouts with Yoga (flexbox: `Row`, `Column`, `gap`, `flexGrow`, `%` widths, absolute positioning).
- **Pagination**: content taller than one page automatically flows onto additional pages. Text blocks split by line, table rows stay whole and headers repeat, and each `Page` re-renders its chrome per output page. Opt out per page with `Page({ overflow: false })` or keep a text block together with `Text(..., { breakable: false })`.
- Exports PDFs through `pdf-lib` with metadata, custom fonts, link annotations, and SVG paths.
- Provides a shared text engine (powered by [`@chenglou/pretext`](https://github.com/chenglou/pretext)) with grapheme-aware wrapping, `maxLines`, and `ellipsis` overflow.
- Supports document-scoped themes (color tokens, font aliases, text variants, table/container defaults) with per-widget overrides.
- Runs in browser and Node (output helpers: `save`, `getBlob`, `download`, `getBuffer`, `writeToFile`).

## Architecture

The project is split into three layers:

1. **Widget tree** — `PdfDoc`, `Page`, `Container`, `Text`, `Row`, `Column`, `Image`, `Link`, `FixedContainer`, `SVGPath`, `Table`, `HLine`, and related layout primitives. Widgets depend on a backend-neutral `RenderContext` interface, not on any concrete backend.
2. **Render layer** — `PdfRenderContext` (implements `RenderContext`) drives `pdf-lib`; `PdfRenderer` walks the page tree and drives the context. The PDF coordinate flip (y grows up from the bottom-left) is applied inside `PdfRenderContext`, so widgets deal in layout boxes, not PDF math.
3. **Shared services** — `FontRegistry` (singleton) owns registered font bytes, the fontkit instance, and browser `FontFace` loading. It's backend-neutral: any future backend reuses the same registered fonts. `TextLayoutEngine` (pure text measurement/wrapping/truncation) and `TextPainter` (draws a laid-out text block via a `RenderContext`) are shared by `Text` and `Link`.

`PdfDoc` is the document model: it owns the page tree, theme, metadata, and lifecycle hooks. It is intentionally **not** a `Widget` — a document is not a layout node. Rendering is delegated to `PdfRenderer`, and runtime helpers (`save`/`getBlob`/`download`/`getBuffer`/`writeToFile`) live on `PdfDoc` as convenience methods.

## Install

From npm:

```bash
pnpm add pdf-kalem
```

For local development in this repository:

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

`pnpm dev` runs the local Vite invoice demo.

## Build

```bash
pnpm build
```

`pnpm build` emits the publishable library into `dist/`.

To build the local demo app instead:

```bash
pnpm build:demo
```

`pnpm build:demo` emits the example site into `dist-examples/`.

## Example

```ts
import {
  PdfDoc,
  PageSize,
} from 'pdf-kalem';
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

Additional output helpers are available when you want a runtime-specific result:

```ts
const bytes = await doc.save();
const blob = await doc.getBlob();
await doc.download('invoice.pdf');
const buffer = await doc.getBuffer();
await doc.writeToFile('invoice.pdf');
```

`getBuffer()` and `writeToFile()` are intended for Node runtimes. `writeToFile()` uses `node:fs/promises`.

### Pagination

When a page's content is taller than the page, pdf-kalem splits it across additional pages. It does this with a three-pass approach (layout → paginate → render), similar to react-pdf:

1. **Layout** — the whole page tree is laid out once on a single tall canvas.
2. **Paginate** — the laid-out tree is walked and split into per-page *fragment* trees. Each fragment is a lightweight view onto a widget for one output page (it reuses the same Yoga node, so there's no re-layout).
3. **Render** — each output page adds a PDF page and renders its fragments, shifting coordinates by `-pageIndex × pageHeight` so each slice lands correctly.

Splitting rules by widget:

- **Text** splits line-by-line (`breakable: true` by default). Use `{ breakable: false }` to keep a block together.
- **Table rows** stay whole (never split mid-row), and the **header repeats** on each page that shows body rows.
- **Containers/columns** pass the boundary to their children.

```ts
Page({
  padding: 24,
  children: [
    Text(longReport, { variant: 'body' }),        // flows across pages by line
    Table.fromRows(rows, { header: true }),       // rows stay whole, header repeats
  ],
});
```

To disable pagination for a page (legacy single-page, overflow is clipped):

```ts
Page({ overflow: false, children: [...] });
```

### Tables

For the common case of a table where every cell is plain text, use `Table.fromRows`:

```ts
import { Table, Text } from 'pdf-kalem/widgets';

Table.fromRows(
  [
    ['KPI', 'Value', 'Change'],
    ['Quarterly revenue', '$42k', '+12%'],
    ['Customer retention', '93%', '+4%'],
  ],
  {
    width: '100%',
    columnWeights: [2, 1, 1],
    header: true,
  }
);
```

Cells accept either strings (auto-wrapped in `Text`) or arbitrary widgets for custom content. For full control over headers, cell padding, or mixed cell content, use the explicit `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell` constructors.

## Fonts

pdf-kalem ships with a few built-in font aliases that work without registration:

```ts
import { BuiltinPdfFonts } from 'pdf-kalem';

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
await PdfDoc.registerFonts({
  Inter: '/fonts/Inter-Regular.ttf',
});
```

If you want custom fonts in PDF output, `pdf-lib` requires `@pdf-lib/fontkit`.

```ts
import fontkit from '@pdf-lib/fontkit';

PdfDoc.registerFontkit(fontkit);
```

Font registration is handled by a shared `FontRegistry` singleton, so any future backend (image, HTML) sees the same registered fonts.

## Theme

You can define document-scoped theme tokens and widget defaults on the document itself.

```ts
import { PdfDoc, PageSize, createTheme } from 'pdf-kalem';
import { Page, Text, Table } from 'pdf-kalem/widgets';
import { fromHex } from 'pdf-kalem/utils/color-utils';

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

const doc = new PdfDoc({
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

- keep the widget tree focused on document layout
- keep PDF behavior explicit and first-class via `PdfDoc` / `PdfRenderContext`
- prepare the abstraction surface for additional backends (image, HTML) without widening it prematurely

The v2 plan is to add `ImageDoc` and `EmailDoc` that share the widget tree, theme, and `FontRegistry` but supply their own `RenderContext` implementation and renderer. The three pieces that were refactored to enable this:

- `FontRegistry` — shared font bytes + browser `FontFace` loading, no longer stuck on PDF-specific classes.
- `RenderContext` interface — widgets depend on the interface, not on `PdfRenderContext`. A `CanvasRenderContext` or `HtmlRenderContext` can slot in.
- `getLayoutBox` — widgets call the backend-neutral `getLayoutBox(widget)`; the PDF Y-flip lives inside `PdfRenderContext`.

## Scripts

- `pnpm dev` starts Vite.
- `pnpm build` builds the npm package into `dist/`.
- `pnpm build:demo` builds the local Vite demo.
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm preview` serves the built app.

## Special Thanks

pdf-kalem stands on the shoulders of several excellent open-source projects:

- [Flutter](https://flutter.dev) — the widget-tree mental model that inspired pdf-kalem's design.
- [pdf-lib](https://github.com/Hopding/pdf-lib) — the PDF generation engine that powers the PDF backend.
- [Yoga](https://github.com/facebook/yoga) — the flexbox layout engine (from Meta/Facebook) that handles all layout computation.
- [`@chenglou/pretext`](https://github.com/chenglou/pretext) — the grapheme-aware text measurement and wrapping engine.
- [@mdi/js](https://github.com/Templarian/MaterialDesign-JS) — Material Design Icons path data, used by the `Icon` widget.
- [@pdf-lib/fontkit](https://github.com/Hopding/pdf-lib/tree/master/fontkit) — custom font subsetting and embedding for PDFs.

# Tools
- Zed Editor
- GLM LLM Model
