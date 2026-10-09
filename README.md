# pdf-kalem

> **For AI assistants:** read [`CONTEXT.md`](./CONTEXT.md) for a compact codebase orientation before diving into the source.

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

## Examples

The [`examples/`](./examples) folder holds self-contained, copyable projects — a one-file hello-world, an invoice, a multi-page report, and a markdown-to-PDF CLI. Each is a plain ESM TypeScript folder (no per-example npm setup) with its own theme, components, and data, structured so you can lift one into your own project and adapt it:

```bash
pnpm build      # examples import the built library
pnpm examples   # run every example; each writes its PDF next to its code
```

See [`examples/README.md`](./examples/README.md) for what each one demonstrates and how to copy one.

## Build

```bash
pnpm build
```

`pnpm build` emits the publishable library into `dist/`.

## Docs

```bash
pnpm docs:dev
```

`pnpm docs:dev` runs the VitePress documentation site (Vue 3 + UnoCSS, in `docs/`) with a guide and dedicated playground pages for the widget-tree API and the markdown converter (both playgrounds are live workbenches). `pnpm docs:build` emits the static site into `docs/.vitepress/dist/`.

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

### Rich text (runs)

`Text` accepts an array of styled runs instead of a plain string. Each run carries its own style flags, which combine with the text's base font:

```ts
import { Text, Link } from 'pdf-kalem/widgets';

Text(
  [
    { text: 'Revenue grew ' },
    { text: '12%', bold: true },
    { text: ' quarter over quarter' },
    { text: ' (audited)', italic: true, color: '#666666' },
  ],
  { size: 12 }
);

// Runs can carry their own links — each line fragment of the run gets its
// own clickable annotation, so a run that wraps stays clickable everywhere.
Text([{ text: 'Read the ' }, { text: 'full report', href: 'https://example.com' }]);

// `mono` switches the run to the builtin monospace family; `font` overrides
// the family outright (theme token or family name).
Text([{ text: 'const x = 1', mono: true }]);
```

Run flags: `bold`, `italic`, `strike`, `href`, `mono`, `font`, `color`. Faces resolve through the run's family with the usual fallback chain, so `{ bold: true }` in an `inter` text uses `inter-bold` when loaded and falls back with a warning otherwise. Words that span run boundaries (`he` + `**llo**`) never break internally; wrapping, `maxLines`, and `ellipsis` all work across runs.

## Fonts

Built-in aliases work without registration: `sans`, `sans-bold`, `sans-italic`, `sans-bold-italic`, `serif` (+ variants), `mono` (+ variants).

For real typography, load a font set once and pass it to the document. One family ships with the package — `inter` (regular, bold, italic, bold-italic) — so common documents need no font files at all. Code falls back to the builtin `mono` alias (Courier); load a real mono family via `files` when you need one:

```ts
import { PdfDoc, useFonts } from 'pdf-kalem';

const fonts = await useFonts({
  body: 'inter',
});

const doc = new PdfDoc({ fonts, children: [/* ... */] });
```

A family carries faces: `regular` plus optional `bold`, `italic`, and `boldItalic`. A face is referenced by suffixing the family name — `inter-bold`, `inter-italic`, `inter-bold-italic` — the same convention the builtin aliases use. Missing faces fall back at embed time (bold-italic → bold → italic → regular) with a console warning, so a family can ship incrementally.

Bring your own fonts per face; entries merge over the shipped faces of the same family:

```ts
const fonts = await useFonts(
  { body: 'inter' },
  {
    files: {
      inter: { bold: '/fonts/MyInter-Bold.ttf' }, // override one face
      'my-serif': {
        regular: '/fonts/MySerif.ttf',
        italic: '/fonts/MySerif-Italic.ttf',
      },
    },
  },
);
```

No `registerFontkit` call is needed — fontkit loads lazily on the first custom-font embed. Legacy global registration (`PdfDoc.registerFont` / `registerFonts` / `registerFontFromUrl`) still works as a process-wide fallback; doc-scoped `FontSet`s always resolve first.

## Markdown

The `pdf-kalem/markdown` subpath converts markdown (GFM, powered by [`marked`](https://github.com/markedjs/marked)) into widgets or a ready-to-save document:

```ts
import { markdownToPdf, markdownToWidgets } from 'pdf-kalem/markdown';

// Sugar: one paginated Page, markdown theme defaults merged under your theme.
const doc = await markdownToPdf('# Report\n\nBody text with **emphasis**.', {
  theme: myTheme,      // optional — user values win over the defaults
  fonts,               // optional FontSet (see Fonts above)
  page: { padding: 48 },
});
await doc.save();

// Deep seam: bare blocks you embed in your own Page (wrap in a Column with a
// gap for spacing).
const blocks = await markdownToWidgets(md, { styles: { spacing: 8 } });
```

Supported: headings (`h1`..`h6` theme variants, bold), emphasis (`**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``), links (clickable per line fragment, underlined, `link` color token), ordered/unordered/nested/task lists (tasks render as `✓`/`□`), fenced code blocks (monospace, `pre-wrap`, background), blockquotes (left rule + italic), GFM tables (per-column alignment, padded cells, header row), horizontal rules, and images (png/jpeg — the format is sniffed from the fetched bytes; other formats are skipped with a warning).

Styling is theme-driven: headings resolve the `h1`..`h6` text variants, links resolve the `link` color token, and `MarkdownStyles` overrides the rest (code font/colors, blockquote rule, list indent, spacing, image width, table options). `markdownThemeDefaults` is exported so custom docs can merge the same baseline.

A copyable converter project ships in [`examples/markdown/`](./examples/markdown) — a small CLI that turns any markdown file (or an embedded sample) into a paginated PDF.

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

- `pnpm build` builds the npm package into `dist/`.
- `pnpm examples` builds the package and runs every example (each writes its PDF next to its code).
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm docs:dev` runs the documentation site.

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
