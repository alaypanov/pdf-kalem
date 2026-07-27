# Kalem — LLM Context

> Compact orientation for AI assistants. Read this first; open specific files only when you need implementation detail. Status: **early alpha**, API not stable.

## What it is

Kalem is a **widget-tree UI library for document/PDF generation** (TypeScript). You describe a document as a tree of widgets (pages, containers, text, images, tables, links, SVG), lay it out with **Yoga (flexbox)**, and render through a backend. The **PDF backend (pdf-lib) ships today**; the architecture is set up for future image/HTML backends.

Mental model is borrowed from **Flutter**: declarative widget trees, theme tokens + per-widget overrides, flexbox layout.

## Three-layer architecture

1. **Widget tree** (`src/lib/*.ts`) — `Page`, `Container`, `Text`, `Row`, `Column`, `Image`, `Link`, `FixedContainer`, `SVGPath`, `Table`, `HLine`, `Icon`. Widgets depend only on the backend-neutral **`RenderContext` interface**, never on a concrete backend.
2. **Render layer** — `PdfRenderContext` implements `RenderContext` and drives `pdf-lib`. `PdfRenderer` walks the page tree and drives the context. **The PDF Y-flip (y grows up from bottom-left) lives inside `PdfRenderContext.getLayoutBox`** — widgets work in top-left-origin layout boxes, not PDF math.
3. **Shared services** — `FontRegistry` (singleton: font bytes + fontkit + browser `FontFace` loading), `TextLayoutEngine` (pure measure/wrap/truncate), `TextPainter` (draws a laid-out block via `RenderContext`). `TextLayoutEngine`/`TextPainter` are shared by `Text` and `Link`.

## Key rules / invariants

- **`PdfDoc` is NOT a `Widget`.** It's the document model: owns page tree, theme, metadata, hooks. Rendering is delegated to `PdfRenderer`. Output helpers (`save`/`getBlob`/`download`/`getBuffer`/`writeToFile`) live on `PdfDoc`.
- **`PdfDoc` children must be `PageWidget` instances** (enforced via `instanceof` in the constructor).
- **Layout runs once per page** at the Page root (`PageWidget.render` → `prepareLayout` → `calculateLayout` → render). Then a **pagination** pass splits overflowing content across pages (see below).

## Pagination

Three passes (react-pdf pattern): **layout** (once, on a tall canvas) → **paginate** (`widget.paginate(flowOffsetY, contentHeight)` returns per-page `WidgetFragment`s) → **render** (`widget.renderFragment` per page, coordinates shifted by `-pageIndex * renderPageShift` inside `PdfRenderContext.getLayoutBox`).

- `WidgetFragment = { widget, pageIndex, children }` — a lightweight view reusing the same Yoga node (no re-layout).
- `Widget.renderPageIndex` / `renderPageHeight` / `renderPageShift` / `renderPageClipTop` / `renderPageClipBottom` are set during fragment render so page-aware widgets (Text) slice themselves. `renderPageShift` is the **content-box height** (page height minus padding/border), so each output page's slice aligns with the padded content area, not the page edges. The clip fields give the content box's PDF-y bounds so Text can drop lines that fall in the padding.
- `Widget.renderFragment` calls `renderSelf` (chrome only, no children) then recurses into child fragments — so containers must NOT render children inside `renderSelf` (they'd be drawn twice). Containers override `renderSelf` for bg/border and keep `render` = `renderSelf` + `renderChildren`.
- `Widget.paginate` default: generic walk, one fragment per page the widget crosses. Overrides: `Text.paginate` (leaf; breakable → one fragment per page crossed, line-slicing draws only that page's lines; `breakable:false` → single fragment on the page the top lands on), `TableWidget`/`TableSectionWidget`/`TableRowWidget` (rows stay whole, header repeats per page), `PageWidget` (paginates its content flow, computes page count from content extent).
- Opt out per page: `Page({ overflow: false })`. Per text block: `Text(..., { breakable: false })`.
- Page count comes from the content extent measured from the content-box top (prefers Yoga `computedHeight`, falls back to `getHeight()` only when Yoga didn't measure one), not the page node's clamped height.
- **`prepareLayout(context)`** is the async hook to load assets / set intrinsic sizes (images, fonts) and install Yoga measure functions *before* layout.
- **Widget constructors must NOT use `this.context`** — context isn't wired until `setContext()` runs after the whole tree is built. Set Yoga styles directly on `this.node` or via `setYogaStyle`/`setProperty` (which tolerate a missing context).
- **Coordinate systems:** Yoga = top-left origin, y down. PDF = bottom-left origin, y up. `getLayoutBox(widget)` returns the box in the *backend's* coordinate system (flipped for PDF).

## File map (src/lib)

| File | Role |
|---|---|
| `Widget.ts` | Abstract base: children, Yoga node, `setYogaStyle`/`setProperty` (string-keyed Yoga applier), `getAbsoluteLayoutBox`. |
| `PdfDoc.ts` | Document model + lifecycle hooks + runtime output helpers. Static font-registration delegates to `FontRegistry`. |
| `PdfRenderer.ts` | Walks pages and calls `page.render(context)`. Thin. |
| `PdfRenderContext.ts` | PDF backend: embeds fonts (fontkit), draws primitives on `PDFPage`, applies Y-flip in `getLayoutBox`. Font/text-width caches. |
| `RenderContextInterface.ts` | The backend-neutral interface widgets depend on. 3 concerns: theme/debug, measurement, drawing+page lifecycle. |
| `RenderContext.ts` | Re-exports `RenderContextTypes` + the interface + `PdfRenderContext`. Import hub. |
| `RenderContextTypes.ts` | Shared arg/option types (`DrawTextArgs`, `RenderColor`, etc.). `RenderImage = PDFImage` (still PDF-typed; v2 will neutralize). |
| `FontRegistry.ts` | Singleton: registered font bytes, fontkit, browser `FontFace` loading, `isStandardFontName`. |
| `TextLayoutEngine.ts` | Pure text measure/wrap/truncate (grapheme-aware via `@chenglou/pretext`, with a no-canvas fallback). No widget/theme/context knowledge. |
| `TextPainter.ts` | Positions + paints a laid-out text block via `RenderContext`. |
| `Theme.ts` | `Theme`, `createTheme`, `resolveThemeColor/Font/TextStyle`. Tokens: colors, fonts, text variants, table/container defaults. |
| `Page.ts` | `PageWidget` — page root; runs layout once; `addPage` on context. |
| `Container.ts` / `FlexContainer.ts` / `Row.ts` / `Column.ts` | Layout primitives. `Row`/`Column` = `FlexContainer` + flexDirection + alignment statics. |
| `Table.ts` | `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell` + `Table.fromRows` helper. |
| `Text.ts` / `Link.ts` | `TextWidget` (theme variants, maxLines/ellipsis); `LinkWidget` extends it (adds annotation + underline). |
| `Image.ts` / `SVGPath.ts` / `Icon.ts` / `HLine.ts` / `FixedContainer.ts` | Leaf widgets. `Image`/`SVGPath`/`Icon` share aspect-fit measure logic. `Icon` has a `materialIcons` registry + `Icon.register`. |
| `types/doc-fonts.ts` | `BuiltinPdfFonts` aliases (`sans`, `serif`, `mono`, +bold/italic) → pdf-lib StandardFonts + canvas font stacks. |
| `types/doc-sizes.ts` | `PageSize` enum + `PDFDocSize` point dimensions (A4/A3/A5/LETTER). |
| `types/styles.ts` | Flex/alignment string constants (`justifyBetween`, `alignCenter`, …) + `Row.justifyBetween` statics source. |
| `utils/color-utils.ts` | `ColorValue` (rgb), `fromHex`, `fromRGB`, `toPdfLibColor`. |
| `utils/debug.ts` | `debugLog` gated behind the `debug` flag. |

## Entry points (public API)

- `src/index.ts` → `src/lib/index.ts` → `PdfDoc`, `PdfRenderer`, `FontRegistry`, `Theme`, `types/*`.
- `src/widgets.ts` → `src/lib/widgets.ts` → all widgets + `RenderContext` types + text engine/painter.
- `src/lib/utils/color-utils.ts` → published as `kalem/utils/color-utils`.

Built by **tsup** (ESM only) into `dist/`. **`splitting: true` is required** — with multiple entries and no shared chunks, classes get duplicated per entry and `instanceof` breaks across entry points (this was a real shipped bug).

## Data flow (render)

```
new PdfDoc({ children: [Page({ children: [...] })] })
  └─ constructor wires context down the tree (setContext)
doc.save()
  └─ savePdf(): run beforeCreate hooks → PDFDocument.create() → applyMeta
     → context.setDocument(pdfDoc) → new PdfRenderer(doc).render()
        └─ per PageWidget: addPage → prepareLayout (load assets, install measure fns)
           → calculateLayout (Yoga) → renderChildren → each widget.render(context)
     → pdfDoc.save() → afterSave hooks → Uint8Array
```

## Conventions

- **Factory functions** for widgets: `Text(...)`, `Page({...})`, `Container({...})`, `Row({...})`, `Table.fromRows(...)`. Classes are `XWidget` (`TextWidget`, `PageWidget`).
- **Options interfaces** named `XOptions`, extend `WidgetOptions` (`{ children?: Widget[] }`).
- **Theme overrides:** widget props override theme defaults; theme tokens resolved via `resolveThemeColor/Font/TextStyle` against `context.getTheme()`.
- **Colors** are `ColorValue` objects; use `fromHex('#RRGGBB')`. Theme colors can be token strings.
- **Fonts:** builtin aliases work unregistered; custom fonts need bytes + `@pdf-lib/fontkit` via `PdfDoc.registerFontkit(fontkit)`.

## Runtime notes / gotchas

- **Text measurement needs a canvas.** pretext uses `OffscreenCanvas`/DOM canvas. In Node there's no canvas, so `TextLayoutEngine.canUsePretext()` returns false and it falls back to the built-in wrapper. Don't remove that canvas guard.
- **Node output:** `getBuffer()`/`writeToFile()` use dynamic `node:fs/promises` + `Buffer` detection; `download()`/`getBlob()` are browser-only.
- **`pdf-lib` is effectively unmaintained** — acceptable now, long-term supply-chain risk.
- Tests live in `tests/*.test.mjs` and run against the built `dist/`. Run `pnpm test` (builds first). Verify changes with `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Commands

```bash
pnpm dev          # Vite invoice demo (examples/invoice)
pnpm build        # tsup → dist/
pnpm build:demo   # Vite demo → dist-examples/
pnpm typecheck    # tsc --noEmit
pnpm test         # build + run tests/*.test.mjs against dist/
```

## Roadmap (from plan.md / README)

Priority 1: pagination & page-breaking (biggest gap), text-engine quality, stable table primitives (row splitting, repeating headers). V2: `ImageDoc` + `EmailDoc` sharing widget tree/theme/`FontRegistry` with their own `RenderContext`.
