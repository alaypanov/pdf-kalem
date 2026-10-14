# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — while in `0.x`, breaking changes bump the minor version.

## [0.5.1] — 2026-10-14

### Fixed

- **`Image`/`SVGPath` fit into the parent-provided box** — the widgets pinned their intrinsic size onto the Yoga node when no width/height was given, and a node with definite dimensions never consults its measure function: a 360pt image inside `Container({ width: 180, height: 50 })` drew at natural size, overflowing the container. The pin is gone — the fit measure owns sizing — with two semantic rules: **Fit never scales up on ambient space** (an `AtMost` constraint only ever shrinks; a small logo in a full-width `Page` stays intrinsic instead of blowing up to the column width), and media widgets **shrink-wrap by default** (`alignSelf: flex-start` — a stretching parent no longer stretches their boxes). Explicit `width`/`height` still scale up freely (`Exactly` demand).
- **Whitespace-only pages are dropped** — a trailing `Spacer` overflowing onto a fresh page emitted a fully blank page; the paginator now discards plans whose content paints nothing (Spacers, and pure layout containers whose whole subtree is whitespace) and renumbers, unless the page carries fixed furniture (a footer paints on every page) or the document would be left with no pages at all.
- **`lineHeightMultiplier` — the CSS-like line height** — `lineHeight` is POINTS (the docs' "CSS line-box model" refers to the half-leading distribution, not the unit), so `lineHeight: 1.4` piled lines 1.4pt apart. `TextOptions` and theme text variants now accept `lineHeightMultiplier` (CSS `line-height: 1.4` — a multiplier of the font size); user-level values (either form) beat the theme variant, and explicit points win over the multiplier within a level. `lineHeight`'s unit is now documented loudly on the option.
- **Unthemed table borders are soft gray** — the default border color was pure black (`#000000`), harsh against the slate-ish palettes most documents use; the fallback is now `#d1d5db`. Theme `table.borderColor` and per-table/cell overrides are unchanged.

### Added

- `renderToPng(bytes, { all: true })` — rasterizes every page, resolving to an array of PNGs in page order (the single-page signature is unchanged).

## [0.5.0] — 2026-10-12

### Fixed

- **Abutting boxes no longer render doubled borders** — Yoga ran with the default `pointScaleFactor = 1`, which rounds every node's computed box to integer points independently; boxes with fractional sizes (content-driven table rows are the visible case) rounded their shared edges apart, and each cell's own border stroke landed ~1pt from its neighbor's — the boundary read as a ~2pt double line. The library's Yoga config now runs with `pointScaleFactor = 0` (rounding disabled — PDF is a vector format, there is no pixel grid to round to), so shared edges stay bit-identical and strokes overlap exactly. Output-changing fix: boxes are no longer snapped to integer points. A companion fix in `TextWidget.layoutText` tolerates sub-0.01pt overflow when re-wrapping at Yoga's float32-stored width — a shrink-wrapped block whose stored width sat a float32 hair under its own measured width (e.g. the `1.` list marker) used to phantom-wrap at paint time.

### Added

- **`pdf-kalem/forms`** — form widgets that create real AcroForm fields, laid out by the widget tree: `TextField` (`value`, `multiline`, `maxLength`), `CheckBox` (`checked`), `Dropdown` (`options`, `value`), `RadioGroup` + `Radio` (one field spread over the children's boxes; options may nest in Rows for labels), `Button` (`label` — visual only: pdf-lib exposes no action API), and `Signature` (a drawn signing line + caption — pdf-lib can read but not create signature fields). Every field takes a unique `name` (the AcroForm field name), ships a usable default size, honors `readOnly` and appearance options (`fontSize`, `textColor`, `backgroundColor`, `borderColor`, `borderWidth`; unset options fall back to pdf-lib's visible-box defaults), and is atomic under pagination — a field moves whole to the next page, never splits. Percent-width fields (`TextField`, `Dropdown`, `Signature`) default to filling the available width with a **120pt floor**: inside a shrink-wrapping `Column` a bare `'100%'` resolves against the wrapped parent and collapses to an invisible sliver — wrap label + field in a `Column({ width: '100%' })` to make fields fill the page.
- **Data binding** — `new PdfDoc({ children, formData })` applies values to the tree's form fields by name, winning over per-widget `value`/`checked` options: the same tree-builder with different `formData` produces filled variants of one template. Type mismatches throw at construction (text wants a string, checkbox a boolean, dropdown/radio a declared option); keys matching no field warn; duplicate field names fail at save (pdf-lib refuses them).
- `PdfFormSurface` — the PDF-typed form seam (ADR 0001 pattern, same as `PdfPageSurface`): `getForm()` + `getCurrentPage()` with a structural guard; form widgets narrow at render time. `PageScope` forwards the members so fields render through paginated scopes.
- `examples/forms/` — a registration form (blank template + filled variant via `formData`), and a forms guide page + live forms playground on the docs site.

### Internal

- The docs playgrounds share one shell now (`CodePdfWorkbench.vue` + `workbench.ts`): editor, preview, debounce, status, and the CodeMirror/font setup are extracted; the widget/editing playgrounds became thin wrappers around it (no behavior change). The forms playground is the first new consumer.
- pdf-lib quirks pinned by tests: unset field-appearance options must be omitted (not passed as `undefined`) for pdf-lib's defaults to apply; the widget rect straddles the layout box by `borderWidth/2`; `setFontSize` must follow `addToPage` (it needs the `/DA` entry that call creates); `PDFDropdown.select` silently enables editing for unknown values, so values are validated before it runs.

## [0.4.0] — 2026-10-11

### Fixed

Full-project review fixes (IDEAS.md B8–B19); each is pinned by a regression test in `tests/review-fixes.test.mjs`.

- **A second output from the same `PdfDoc` is no longer corrupt** (B8). `save()`/`getBlob()`/`download()`/`getBuffer()`/`writeToFile()`/`print()` can now be combined freely: the render context resets its per-document font/image state on every document swap, and images re-embed per output document. Previously the second file referenced the first document's font/image objects and rendered broken.
- **`getPageCount()` before `save()` no longer poisons text measurement** (B9). The dry run's estimated widths are no longer cached, the text engine rebuilds with real metrics once fonts embed, and the page-count memo resets on save — count-then-save now renders identically to save-only.
- **A `Page` without an explicit size uses the doc default** instead of inheriting the previous output page's dimensions (B10).
- **Absolute-positioned children (`FixedContainer`) inside a splitting container no longer vanish** — they render on the page their flow position lands on, anchored to their parent's fragment (B11).
- **One-sided `width`/`height` on `Image`/`SVGPath`/`Icon` now scales the media** — the aspect-fit measure derives the other dimension — instead of drawing at the intrinsic size (B12). Output-changing fix.
- **`SVGPath`/`Icon` `strokeWidth` scales exactly once**: it is passed in raw user units and pdf-lib's CTM applies the fit scale; previously the effective stroke was `strokeWidth × scale²` (B13). Output-changing fix.
- **The `style` escape hatch is the last word on `FlexContainer`/`Row`/`Column`** (B14) — `style.width`/`height`/`justifyContent`/`alignItems`/`gap` now take effect (they were silently clobbered); `flexDirection` stays pinned to the widget's identity. Output-changing fix.
- **`Stack` and `Icon` honor `margin`** (B15) — the typed option was accepted and silently dropped.
- **Widgets appended after `PdfDoc` construction receive the context** (B16) — `appendWidgetChild` propagates it, so theme tokens/padding resolve for late appends (edit overlays included).
- **Browser text measurement uses the styled face** (B17) — canvas measurement carries the resolved weight/style (builtin stacks get `bold`/`italic` keywords; custom families measure under the face id), so bold/italic text no longer wraps ~5–10% too wide in the browser.
- **The edit subpath preserves AcroForm** (B18) — `loadPdf` → `save()` keeps interactive form fields, as documented; adopted pages also stop duplicating shared resources once per page.
- **Sharing a widget instance fails with a readable error** (B19) — the same instance twice in one `children` array (or in two parents) throws instead of aborting the process inside Yoga's WASM heap.
- **Minor fixes from the review's B20 list** — pre-wrap whitespace-only paragraphs survive the Node fallback wrapper; rich ellipsis shows on a blank last visible line; run-href annotation rects cover the full line box (half-leading included); run `font`/`mono` overrides resolve through the override name's own face style; `Container` `style.padding` survives `prepareLayout`, `border.width: 0` draws nothing, and `children`/`child` no longer mutates the caller's array; unknown color tokens warn once **per theme**; `fromHex` rejects invalid hex characters; `Table.fromRows([], { header: true })` no longer crashes and `Table({ children })` throws with guidance; `Image` validates `scale`; Windows drive-letter paths read from disk; `SVGPath` with `fill` + `strokeWidth` but no `stroke` draws no outline; repeated table heads clip to the content box; markdown images render inside list items/headings/table cells and resolve relative paths in Node, an image inside a link warns instead of silently dropping it, `blockquote.color` styles the quote text, and a truncated PNG is skipped at conversion instead of crashing `save()`; overlays offset by a non-zero MediaBox origin; a doc-scoped family named after a builtin alias (`sans`) is reachable; `ColorValue.alpha` warns instead of silently rendering opaque; `renderToPng` no longer detaches a caller-owned `ArrayBuffer` and validates the page index; `new PdfDoc({})` throws with guidance instead of saving a pageless PDF; `Widget`/`WidgetOptions` are exported (type-only) from `pdf-kalem/widgets`.
- **Builtin styled text measures with the embedded font** (found during the fix session) — `sans-bold` and friends used to wrap with the `0.6em/char` estimate because the font cache was keyed by the alias-resolved pdf name while measurement looked the caller's id up raw.
- **Doc rot** (B21) — `CONTEXT.md` no longer references the removed `PdfRenderer`; the `TextOverflow` doc matches `maxLines` semantics.

### Internal

- `tests/review-fixes.test.mjs` — 47 regression tests covering the fixes above.
- Yoga quirk worth knowing: explicit per-edge values (even `0`) take precedence over the `Edge.All` slot in `setPadding`/`setMargin`.

## [0.3.0] — 2026-10-11

### Added

- `Stack` — overlay composition: children painted in order in one box, non-positioned children aligned per `alignment`, `FixedContainer` children keeping their own insets. Sizes to its largest non-positioned child unless `width`/`height` are given; atomic under pagination.
- `Spacer` — invisible flow space: `size` for a fixed gap, `grow` (default 1) to absorb free main-axis space.
- `VLine` — vertical rule, the sibling of `HLine` (`color`, `thickness`, `height`; stretches to the row by default).
- `pdf-kalem/preview` — `renderToPng(pdfBytes, { page, dpi })` rasterizes produced PDF bytes to PNG (Node-only; `pdfjs-dist` + `@napi-rs/canvas` as optional peer deps, loaded lazily). The fast visual feedback loop (I9 Stage 1).
- `Image.png('/path/to/logo.png')` reads local file paths in Node (bare paths and `file://` URLs; URLs still fetch) — no more manual `readFile` + `fromBytes` (I13).
- `Image.fromBytes(bytes, format?)` — `format` is optional when the png/jpeg signature sniffs from the bytes; a declared format that disagrees with the bytes is overridden (with a warning).

### Changed

- **Breaking:** removed the process-global `PdfDoc.beforeCreate`/`afterSave`/`clearHooks` statics — two documents in one process shared hook state, and the constructor's `beforeCreate`/`afterSave` options are the supported channel. No in-repo callers; the statics were undocumented.
- Runtime output mechanics (blob/download/print/buffer/file) moved from `PdfDoc` to `src/lib/doc-output.ts`; the `PdfDoc` methods remain as delegates — the public interface is otherwise unchanged.
- **Breaking (internal surface):** the `PdfRenderer` class is removed — its render walk is inline in `PdfDoc.savePdf` (I5: one caller, zero alternatives). It was exported from the package root but undocumented.
- **Breaking (internal surface):** `RenderContext` no longer declares page lifecycle (`addPage`/`getCurrentPage`/`setCurrentPage`/`adoptPage`) — those move to the PDF-typed `PdfPageSurface` (ARCHITECTURE #10, per ADR 0001's "never interface widening"). Custom `RenderContext` implementations that implemented those members keep working unchanged; code that *calls* them through the neutral type narrows via `isPdfPageSurface`/`canAddPages` from `pdf-kalem/internals`.
- **Breaking:** `Container` no longer hardcodes `alignSelf: 'flex-start'` (I11). Under a stretching parent (`Page`, `Flex` with `alignItems: 'stretch'`) an unsized Container now fills the available width; `Row`/`Column` children still shrink-wrap (they default to `flex-start`). Restore the old behavior explicitly with `style: { alignSelf: 'flex-start' }`.
- `Container` gains `style?: YogaStyle` (per-key override of its built-in flex defaults) and per-side `padding` (`number | { top, right, bottom, left }`; the number form and the theme default are unchanged) (I11).
- Every widget gains `margin` (`number | { top, right, bottom, left }`) on the base options — outer spacing without structural contortions. No margin collapsing (I11).
- `FixedContainer.bgColor` now accepts theme tokens (`ThemeColorValue`), matching `Container` (I11).
- I14 resolved: `PageBreak` rejected by design (pagination stays automatic and opaque); `SizedBox` rejected as sugar for `Container({ height })`.
- Playground sandboxes expose the new widgets.

### Internal

- Theme-resolution policy extracted to `src/lib/theme-resolve.ts` (18 duplicated `override ?? theme ?? fallback` sites collapsed); Yoga style interpreter extracted to `src/lib/yoga-style.ts` (`Widget.ts` 424 → 201 lines); test `FakeContext` shared via `tests/fake-context.mjs`. No public interface changes.
- Repo scripts: `pnpm test` runs every `tests/*.test.mjs` via `tests/run-all.mjs`; `pnpm example [names…]` runs one, several, or all examples via `examples/run.mjs`.

## [0.2.0] — 2026-10-10

### Changed

- **Breaking:** `Run.bold` and `Run.italic` are replaced by CSS-like `Run.fontWeight` (100–900, `'normal'`, `'bold'`) and `Run.fontStyle` (`'normal'`, `'italic'`). Weights snap to the family's two-face model (100–500 → regular, 600–900 → bold); an explicit value replaces its axis on the base style, so `fontWeight: 400` un-bolds a bold base. `TextOptions` and `ThemeTextStyle` gain matching block-level `fontWeight`/`fontStyle`, and `font`/`mono` run overrides now inherit the block's typography instead of resetting to regular. See `src/lib/Text.ts` and `src/lib/fonts/face.ts`.

### Fixed

- Homepage links under the GitHub Pages subpath (docs-site infra).

## [0.1.1] — 2026-10-09

Maintenance release; no user-facing package changes recorded.

## [0.1.0] — 2026-10-09

Initial public release: widget-tree PDF generation on pdf-lib + yoga-layout, text layout and pagination, custom font embedding, markdown subpath, `PdfDoc.print()`, and the `pdf-kalem/edit` subpath for loading existing PDFs as widget trees.
