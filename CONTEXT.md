# pdf-kalem — LLM Context

> Compact orientation for AI assistants. Read this first; open specific files only when you need implementation detail. Status: **early alpha**, API not stable.
>
> Architecture suggestions: [ARCHITECTURE.md](./ARCHITECTURE.md) · Bugs & ideas: [IDEAS.md](./IDEAS.md) · Roadmap: [PLAN.md](./PLAN.md).

## What it is

pdf-kalem is a **widget-tree UI library for document/PDF generation** (TypeScript). You describe a document as a tree of widgets (pages, containers, text, images, tables, links, SVG), lay it out with **Yoga (flexbox)**, and render through the **PDF backend (pdf-lib)**. **PDF is the only backend, deliberately** — no image/HTML backends are planned ([ADR 0001](./docs/adr/0001-pdf-only-focus.md)). The `RenderContext` seam stays because pagination composes through it (`PageScope`), not as a backend hook; PDF-only features get PDF-typed modules (e.g. `edit/`), never interface widening.

Mental model is borrowed from **Flutter**: declarative widget trees, theme tokens + per-widget overrides, flexbox layout.

## Three-layer architecture

1. **Widget tree** (`src/lib/*.ts`) — `Page`, `Container`, `Text`, `Row`, `Column`, `Image`, `Link`, `FixedContainer`, `SVGPath`, `Table`, `HLine`, `Icon`. Widgets depend only on the backend-neutral **`RenderContext` interface**, never on a concrete backend.
2. **Render layer** — `PdfRenderContext` implements `RenderContext` and drives `pdf-lib`. `PdfRenderer` walks the page tree and drives the context. **The PDF Y-flip (y grows up from bottom-left) lives inside `PdfRenderContext.getLayoutBox`** — widgets work in top-left-origin layout boxes, not PDF math.
3. **Shared services** — `FontRegistry` (singleton: font bytes + fontkit + browser `FontFace` loading), `TextLayoutEngine` (pure measure/wrap/truncate), `TextPainter` (draws a laid-out block via `RenderContext`). `TextLayoutEngine`/`TextPainter` are shared by `Text` and `Link`.

## Key rules / invariants

- **`PdfDoc` is NOT a `Widget`.** It's the document model: owns page tree, theme, metadata, hooks. Rendering is delegated to `PdfRenderer`. Output helpers (`save`/`getBlob`/`download`/`getBuffer`/`writeToFile`) live on `PdfDoc`.
- **`PdfDoc` children must be `PageWidget` instances** (enforced via `instanceof` in the constructor).
- **Layout runs once per Page widget** (`prepareLayout` → Yoga). Fitting content renders exactly as today; overflowing content goes through the **pagination transformation** (see §Pagination below).

## Pagination

> Implemented 2026-10-02 — `src/lib/pagination/`. Rationale + full interface:
> [ARCHITECTURE.md](./ARCHITECTURE.md) §2.

**Model.** A **Page widget** is a unit of flow — an encapsulated widget tree with a page
size — not a visual rectangle. An **output page** is a plan artifact. Pagination is a pure
transformation: layout produces a flow tree → the internal `Paginator` windows it into
content-height pages, decomposing widgets at break points → a forest of `PagePlan`s → each
plan is painted through a per-page `PageScope` (a `RenderContext` decorator). Widgets keep
`render(context)` + `getLayoutBox(this)` — the render path is unchanged; no fragments on
widgets, no `renderAt`, no mutable render state.

- **Break structure is data:** `Widget.getBreakUnits(): BreakUnit[] | null` (box-relative
  units). Generic default: vertical-flow containers break between children; row-direction,
  absolute-positioned, and `breakable: false` widgets are atomic. Only `Text` (line units)
  and `Table` (row units; head marked `repeat`) override. `repeat`/`keepWithNext` are data
  flags honored generically by the engine.
- **Break policy:** splittable fills the page then splits at a unit boundary; atomic moves
  whole to the next page; atomic taller than a full page is clipped (`plan.clipped`).
- **Grow follows CSS:** free space is distributed only inside definite heights. Flow
  content is auto-height (grow no-ops); page-filling furniture (footers, full-height bands)
  belongs in the page template, laid out per page at the real page box.
- **Two layout passes, lazily:** pass 1 at the real page height — byte-identical to today
  when content fits; pass 2 (height auto → fragmentation) only on overflow.
- **Page count** is `plan.pages.length`; `doc.getPageCount()` is a memoized dry run (no
  drawing). Continuation pages inherit the Page widget's size + template; page numbering is
  doc-global across Page widgets.
- **Opt out per page:** `Page({ overflow: false })` = legacy single-page path,
  byte-identical to today. Per text block: `Text(..., { breakable: false })`.
- **`prepareLayout(context)`** is the async hook to load assets / set intrinsic sizes (images, fonts) and install Yoga measure functions *before* layout.
- **Widget constructors must NOT use `this.context`** — context isn't wired until `setContext()` runs after the whole tree is built. Set Yoga styles directly on `this.node` or via `setYogaStyle`/`setProperty` (which tolerate a missing context).
- **Coordinate systems:** Yoga = top-left origin, y down. PDF = bottom-left origin, y up. The flip lives in `PdfRenderContext.mapContentBox` (extracted from `getLayoutBox`); `PageScope` composes plan boxes with the backend mapping. `getLayoutBox(widget)` still returns the box in the *backend's* coordinate system.

## File map (src/lib)

| File | Role |
|---|---|
| `Widget.ts` | Abstract base: children, Yoga node, `setYogaStyle`/`setProperty` (string-keyed Yoga applier), `getAbsoluteLayoutBox`. |
| `PdfDoc.ts` | Document model + lifecycle hooks + runtime output helpers. Static font-registration delegates to `FontRegistry`. |
| `PdfRenderer.ts` | Walks pages and calls `page.render(context)`. Thin. |
| `PdfRenderContext.ts` | PDF backend: embeds fonts (fontkit), draws primitives on `PDFPage`, applies Y-flip in `getLayoutBox`. Font/text-width caches. |
| `RenderContextInterface.ts` | The backend-neutral interface widgets depend on. 3 concerns: theme/debug, measurement, drawing+page lifecycle. |
| `RenderContext.ts` | Re-exports `RenderContextTypes` + the interface + `PdfRenderContext`. Import hub for public entries — internal modules import from `RenderContextInterface`/`RenderContextTypes` directly (importing the type through this hub creates a circular chunk in the DTS build). |
| `RenderContextTypes.ts` | Shared arg/option types (`DrawTextArgs`, `RenderColor`, etc.). `RenderImage = PDFImage` (still PDF-typed; v2 will neutralize). |
| `pagination/types.ts` | `BreakUnit`, `Fragment`, `PagePlan`, `Pagination`, `LayoutBox` — the plan data vocabulary. |
| `pagination/Paginator.ts` | The pure transformation: flow tree → `PagePlan` forest. Owns all break rules (fill-then-split / move-whole / clip, `repeat`, `keepWithNext`). |
| `pagination/PageScope.ts` | Per-output-page `RenderContext` decorator: answers `getLayoutBox`/`getFlowOffset`/`getRenderChildren` from the plan, delegates the rest. |
| `FontRegistry.ts` | Singleton: registered font bytes, fontkit, browser `FontFace` loading, `isStandardFontName`. Global fallback — doc-scoped families live on the doc's `FontSet`. |
| `fonts/types.ts` | `FontSet` (tokens + `families: Map<family, FontVariants>`) and `FontVariants` (regular + optional bold/italic/boldItalic faces). Created by `useFonts`, consumed via `new PdfDoc({ fonts })`. |
| `fonts/face.ts` | Face ids (`inter`, `inter-bold`, `inter-italic`, `inter-bold-italic` — same suffix convention as the builtins) + the fallback chain (bold-italic → bold → italic → regular). |
| `fonts/face.ts` | Face ids (`inter`, `inter-bold`, `inter-italic`, `inter-bold-italic` — same suffix convention as the builtins) + the fallback chain (bold-italic → bold → italic → regular). |
| `fonts/useFonts.ts` | `useFonts(families, options?)` — loads families once from `files` per-face sources (bytes, or URLs fetched in the browser), returns a reusable `FontSet`. Loading is async; configuration is sync at doc construction. |
| `TextLayoutEngine.ts` | Pure text measure/wrap/truncate (grapheme-aware via `@chenglou/pretext`, with a no-canvas fallback). Also lays out rich **runs**: tokenizes runs into words that may span run boundaries, wraps greedily per-run font, emits lines with `fragments` (`runIndex` → run). Runs measure via `measureRunWidth` (the embedded font that draws), not pretext. No widget/theme/context knowledge. |
| `TextPainter.ts` | Positions + paints a laid-out text block via `RenderContext`. |
| `Theme.ts` | `Theme`, `createTheme`, `resolveThemeColor/Font/TextStyle`. Tokens: colors, fonts, text variants, table/container defaults. |
| `Page.ts` | `PageWidget` — page root; runs layout once; `addPage` on context. |
| `Container.ts` / `FlexContainer.ts` / `Row.ts` / `Column.ts` | Layout primitives. `Row`/`Column` = `FlexContainer` + flexDirection + alignment statics. |
| `Table.ts` | `Table`/`TableHead`/`TableBody`/`TableRow`/`TableCell` + `Table.fromRows` helper. |
| `Text.ts` / `Link.ts` | `TextWidget` (theme variants, maxLines/ellipsis, rich **runs**: `Text(string \| Run[])` — per-run face/color/strike/href resolved against the base family); `LinkWidget` extends it (whole-box annotation for plain text, per-fragment annotations for runs). |
| `Image.ts` / `SVGPath.ts` / `Icon.ts` / `HLine.ts` / `FixedContainer.ts` | Leaf widgets. `Image`/`SVGPath`/`Icon` share aspect-fit measure logic. `Icon` has a `materialIcons` registry + `Icon.register`. |
| `types/doc-fonts.ts` | `BuiltinPdfFonts` aliases (`sans`, `serif`, `mono`, +bold/italic) → pdf-lib StandardFonts + canvas font stacks. Reverse lookup (`builtinPdfNameFace`) decomposes a pdf name back into family + style. |
| `markdown/` | Markdown → widgets (`pdf-kalem/markdown` subpath). `convert.ts` holds the entry points (`markdownToWidgets` deep seam, `markdownToPdf` sugar); `render.ts` walks marked's block tokens; `inline.ts` folds inline tokens into `Run`s (images hoisted out); `styles.ts` resolves `MarkdownStyles` defaults; `types.ts` styles + `markdownThemeDefaults` fragment; `format.ts` sniffs png/jpeg magic bytes. |
| `edit/` | Existing-PDF editing (`pdf-kalem/edit` subpath). `loadPdf` opens bytes into a `LoadedPdf` whose `pages` are `LoadedPage` widgets (`PageWidget` subclass, dimensions preset from the file) — editing is array manipulation + `page.add([...])` overlays; `save()` sugar builds a `PdfDoc`. Loaded pages are **adopted** into the output at render time via `RenderContext.adoptPage` (pdf-lib `copyPages`), preserving annotations/links/form fields. |
| `types/doc-sizes.ts` | `PageSize` enum + `PDFDocSize` point dimensions (A4/A3/A5/LETTER). |
| `types/styles.ts` | Flex/alignment string constants (`justifyBetween`, `alignCenter`, …) + `Row.justifyBetween` statics source. |
| `utils/color-utils.ts` | `ColorValue` (rgb), `fromHex`, `fromRGB`, `toPdfLibColor`. |
| `utils/debug.ts` | `debugLog` gated behind the `debug` flag. |

## Entry points (public API)

- `src/index.ts` → `src/lib/index.ts` → `PdfDoc`, `PdfRenderer`, `RenderContext` (hub: interface + types + `PdfRenderContext`), `FontRegistry`, `Theme`, `types/*`.
- `src/widgets.ts` → `src/lib/widgets.ts` → all widgets + the `RenderContext` seam (interface, types, `PdfRenderContext`) + text engine/painter.
- `src/markdown.ts` → `src/lib/markdown/` → `markdownToWidgets`, `markdownToPdf`, `MarkdownStyles`, `markdownThemeDefaults`, `sniffImageFormat`.
- `src/edit.ts` → `src/lib/edit/` → `loadPdf`, `LoadedPdf`, `LoadedPage`.
- `src/lib/utils/color-utils.ts` → published as `pdf-kalem/utils/color-utils`.

Built by **tsup** (ESM only) into `dist/`. **`splitting: true` is required** — with multiple entries and no shared chunks, classes get duplicated per entry and `instanceof` breaks across entry points (this was a real shipped bug).

## Data flow (render)

```
new PdfDoc({ children: [Page({ children: [...] })] })
  -> constructor wires context down the tree (setContext)
doc.save()
  -> savePdf(): run beforeCreate hooks -> PDFDocument.create() -> applyMeta
     -> context.setDocument(pdfDoc) -> new PdfRenderer(doc).render()
        -> per PageWidget: Paginator.paginate (prepareLayout -> flow layout -> fragmentation)
           -> per PagePlan: addPage -> PageScope(backend, plan) -> plan roots .render(scope)
     -> pdfDoc.save() -> afterSave hooks -> Uint8Array
```

> Diagram shows the pagination model as implemented (see §Pagination).

## Conventions

- **Factory functions** for widgets: `Text(...)`, `Page({...})`, `Container({...})`, `Row({...})`, `Table.fromRows(...)`. Classes are `XWidget` (`TextWidget`, `PageWidget`).
- **Options interfaces** named `XOptions`, extend `WidgetOptions` (`{ children?: Widget[] }`).
- **Theme overrides:** widget props override theme defaults; theme tokens resolved via `resolveThemeColor/Font/TextStyle` against `context.getTheme()`.
- **Colors** are `ColorValue` objects; use `fromHex('#RRGGBB')`. Theme colors can be token strings.
- **Fonts:** builtin aliases (`sans`/`serif`/`mono` + bold/italic) work unregistered. For custom families, load once and pass to the doc: `const fonts = await useFonts({ body: 'inter' }); new PdfDoc({ fonts, ... })` — the FontSet's tokens override `theme.fonts` (the theme object is never mutated) and family bytes resolve doc-scoped before the global registry. A family carries faces (`regular` + optional `bold`/`italic`/`boldItalic`); a face is named by suffixing the family (`inter-bold`) and missing faces fall back at embed time with a warning (bold-italic → bold → italic → regular). Exact family names always win over suffix parsing. Fontkit loads lazily on first embed — no `registerFontkit` call. Legacy paths (`PdfDoc.registerFont`/`registerFontkit`/`registerFonts`) still work as global fallbacks.
- **Runs:** `Text([{ text, bold?, italic?, strike?, href?, mono?, font?, color?, underline? }])` — style flags combine bitwise with the base face (base `bold` + run italic → `boldItalic`); `mono` switches to the builtin `mono` family; `font` overrides the family (theme token or name). A word may span run boundaries (no break inserted between `he` + `**llo**`); whitespace collapses across runs to one space owned by the first run contributing it. Runs with `href` get one link annotation per line fragment (a run can wrap); `Link` passes its href as the default for runs without one.
- **Markdown:** `markdownToWidgets(md)` returns bare blocks (no spacing wrapper — wrap in `Column({ gap })` when embedding); `markdownToPdf(md)` wraps them in a paginated Page (48pt padding) and merges `markdownThemeDefaults` (h1–h6 sizes, `link` color, table `cellPadding: 6`) under the user theme — user keys win, neither input mutates. Headings emit `h1`..`h6` variants with bold runs; links emit runs with `href` + the `link` color token + underline; code emits `mono`-family runs/blocks. Images are fetched once at conversion time to sniff the format (png/jpeg only; others warn + skip), then render from bytes via `Image.fromBytes` (no re-fetch). Task-list markers are ✓/□ (U+2713/U+25A1) — real (embedded) fonts have these glyphs, builtin WinAnsi aliases do not (they throw at encode; see gotchas).
- **Text line boxes follow the CSS model:** the baseline sits `halfLeading + ascent` below the line top, where `halfLeading = (lineHeight - fontHeight) / 2` — extra leading splits half above / half below the text, so single-line text is optically centered in its line box (this is what keeps table cells and code blocks visually even). Custom-font ascent/descent come from the font's `hhea` table (pdf-lib's `heightAtSize(descender: false)` returns the bbox yMax, which is not the typographic ascender — for Inter it sits ~0.25em below it); standard fonts use their AFM metrics, which are already typographic.

## Runtime notes / gotchas

- **Widget trees can't re-parent.** A widget instance belongs to one Page/doc; moving it into another tree aborts the Yoga WASM heap. Build fresh widgets instead.
- **Container children shrink-wrap horizontally.** `Container` sets `alignItems: 'flex-start'`, so a child Row/Column sizes to content unless it sets `width: '100%'` (or an explicit width). A `justifyBetween` Row without `width: '100%'` inside a Container packs its children together instead of spreading them. Direct children of `Page`/`Column` stretch by default (Page sets `alignItems: stretch`).

- **Text measurement needs a canvas.** pretext uses `OffscreenCanvas`/DOM canvas. In Node there's no canvas, so `TextLayoutEngine.canUsePretext()` returns false and it falls back to the built-in wrapper. Don't remove that canvas guard. Rich runs never use pretext — they measure through `measureRunWidth` (pdf-lib's embedded-font metrics, the same font that draws), so run layout is identical in Node and the browser.
- **Builtin font aliases are WinAnsi-only.** `sans`/`serif`/`mono` (pdf-lib standard fonts) cannot encode characters outside WinAnsi — pdf-lib throws at draw (e.g. ✓, □, →, emoji). Real fonts (user-loaded via `useFonts` `files`) have full coverage via fontkit. Code blocks default to the `mono` alias (Courier), so non-WinAnsi characters inside fenced code throw too — load a custom mono family for such content. Markdown task-list markers use ✓/□, so converting task lists with only builtin aliases will throw — load a font set for symbol-heavy documents.
- **Node output:** `getBuffer()`/`writeToFile()` use dynamic `node:fs/promises` + `Buffer` detection; `download()`/`getBlob()` are browser-only.
- **`pdf-lib` is effectively unmaintained** — acceptable now, long-term supply-chain risk.
- Tests live in `tests/*.test.mjs` and run against the built `dist/`. Run `pnpm test` (builds first). Verify changes with `pnpm typecheck`, `pnpm build`, `pnpm test`.

## Commands

```bash
pnpm build        # tsup -> dist/
pnpm typecheck    # tsc --noEmit
pnpm test         # build + run tests/*.test.mjs against dist/
pnpm examples     # build + run every example (writes PDFs next to example code)
```

## Roadmap (from PLAN.md / README)

Priority 1: pagination & page-breaking (biggest gap), text-engine quality, stable table primitives (row splitting, repeating headers). V2: `ImageDoc` + `EmailDoc` sharing widget tree/theme/`FontRegistry` with their own `RenderContext`.
