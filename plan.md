# TODO Tasks

- Fix build and typing baseline.
- Implement pagination and overflow rules.
- Harden text measurement and fonts.
- Upgrade tables.
- Build online design editor.
- Add template helpers and styling system.
- Page breaks
- MD files to pdf converter
- Form widgets and data binding
- Printing and PDF export
- Add reusable document helpers.
- Add tests and richer examples.
- Documentation
- Design Theme system
- Export MD and HTML
- Package into npm module

## Feature: Markdown → PDF

Convert markdown to a widget tree (and PDF) via a `pdf-kalem/markdown` subpath. Four increments, in dependency order:

1. ✅ **Font family variants** — `FontSet.families` maps family → faces (`regular` + `bold`/`italic`/`boldItalic`); face ids (`inter-bold`) resolve through the family with fallback (bold-italic → bold → italic → regular, warn on fallback); shipped `inter` (4 faces) + `jetbrains-mono` (2 faces). Landed 2026-10-05.
2. ✅ **Rich runs in `Text`** — `Text(string | Run[])`, `Run = { text, bold?, italic?, strike?, href?, mono?, font?, color? }`; engine wraps across run boundaries (incl. mid-word, grapheme-aware); painter draws per-run faces/colors, strikethrough, per-fragment link annotations (a run wrapping across lines gets one rect per line fragment). Runs measure through `measureRunWidth` (the same embedded font that draws) rather than pretext. Landed 2026-10-05.
3. ✅ **Markdown module** — `markdownToWidgets(md, opts?)` (deep seam: marked GFM tokens → widget blocks) + `markdownToPdf(md, opts?)` (sugar: paginated Page + theme defaults merged under the user's theme, returns a `PdfDoc`); `pdf-kalem/markdown` subpath. Supports headings (h1..h6 variants, bold), emphasis runs (bold/italic/strikethrough/inline code), links (per-fragment annotations + underline), ordered/unordered/nested/task lists, fenced code blocks (mono, pre-wrap, bg), blockquotes (left rule + italic), GFM tables (per-column alignment), horizontal rules, and images (fetched once, format sniffed from magic bytes, png/jpeg only). Landed 2026-10-05.
4. ✅ **Example + docs** — `examples/markdown/`: live two-pane converter (editable markdown → debounced PDF preview, download, page-count badge) on the shipped `inter`/`jetbrains-mono` families, with a "Load CONTEXT.md" button that converts this repo's own context doc (inlined via a `?raw` import, so it works in dev and build). Wired into `vite.config.ts` inputs + the examples index. Landed 2026-10-05.

## Feature: Live examples

Every example page is a live two-pane workbench: editable source on the left, debounced PDF preview on the right, page-count badge, download link, error surfacing in a strip under the editor. The look is a light proof-sheet workbench — warm paper, ink text, amber accent, mono UI type with a serif wordmark, hairline dividers instead of cards, and a custom light CodeMirror syntax theme.

1. ✅ **Shared live shell** — `examples/shared/live.ts` owns the two-pane DOM/CSS/wiring (debounce, object-URL lifecycle, error badge with the failure message, Cmd/Ctrl+Enter to render now); hosts supply a `render(source)` callback and call `renderNow()` after async setup (fonts). The editor is a minimal hand-picked CodeMirror 6 setup (line numbers, history, auto-indent, syntax highlighting, line wrapping — no autocompletion/search/folding) with `javascript` mode for widget-code examples and `markdown` mode for the converter. `examples/shared/sandbox.ts` evaluates widget-code editors: the code is the body of a plain-JS function returning `Page[]`, with the widget factories, `theme`, `fromHex`, and `PageSize` injected as function parameters — no in-browser transpiler, works in dev and build:demo. Landed 2026-10-06.
2. ✅ **Invoice / report / playground converted** — each prefilled with its widget tree (types stripped); fonts, theme, and document setup stay fixed scaffolding so the editor owns just the Page tree. The markdown example was refactored onto the same shell (same look, one implementation). Landed 2026-10-06.

> 2026-10-08: the live-edit examples were replaced by copyable plain-ESM projects under
> `examples/` (basic, invoice, report, markdown — run with `node`, no per-example npm setup;
> see `examples/README.md`). The live-edit experience now lives in the docs playgrounds
> (`docs/.vitepress/components/`); `examples/shared/` and the Vite demo build are gone.

## Feature: PDF editing (`pdf-kalem/edit`)

Load an existing PDF, restructure its pages, and edit pages by adding widgets on top — all in code, both runtimes, bytes in / bytes out. The design (settled 2026-10-09):

**Unified model.** `loadPdf(bytes, { fonts, theme })` → `LoadedPdf` whose `pages` is a plain mutable array of `LoadedPage` widgets (`LoadedPage extends PageWidget`, dimensions preset from the original file). Editing and generation share one document model — there is no separate editor universe:

- overlay widgets → `page.add([/* widgets */])` — declarative, painted at save time
- remove / reorder pages → native array ops on `pdf.pages` (`splice`, `sort`)
- blank / generated pages → `pdf.pages.push(new Page({ ... }))`
- merge two PDFs → compose both `pages` arrays in one `PdfDoc`
- quick edit → `await pdf.save()` (sugar: builds a `PdfDoc` from `pdf.pages` with the load-time `fonts`/`theme` wired)
- escape hatch → `pdf.PDFDocument` (the raw pdf-lib document; read-write, documented as "you're on your own here" — this also gives day-one form-field access)

**Fidelity — adopt the real page.** At render time each `LoadedPage` is adopted into the output document via pdf-lib `copyPages`, and overlay widgets draw directly on the adopted page. Content streams, annotations, links, and form fields are preserved (this rules out the `embedPage`-as-background approach, which silently drops them). The seam is `RenderContext.adoptPage(source, pageIndex)` — page-lifecycle concern, like `addPage`.

**Overlay semantics.** `add` appends to a page-filling flow root (column, top-down): position with padding/alignment/spacers, `FixedContainer` for absolute placement. Repeated calls append in call order. Overlay content is never paginated across pages — overflow is clipped with a warning (consistent with atomic-overflow behavior).

**Limitations (documented, honest failures).** Rotated pages (`/Rotate ≠ 0`) throw a clear error at `loadPdf` — handling is postponed. Encrypted PDFs propagate pdf-lib's load error — no decryption support.

**Pieces:** `src/lib/edit/` (`loadPdf`, `LoadedPdf`, `LoadedPage`), `pdf-kalem/edit` subpath, `tests/edit.test.mjs` (synthesized pdf-lib fixtures + `public/pdf-sample.pdf`), `examples/edit/` (load sample → add text/drawing → save; plus restructure/merge on a synthesized multi-page doc).

## Feature: Documentation site

VitePress (Vue 3) + UnoCSS docs in `docs/`, built with `pnpm docs:build`.

1. ✅ **Scaffold** — VitePress 1.6 + UnoCSS 66 (presetWind3) over the default theme with amber brand accents; guide pages ported from the README (getting started, widgets, theming, fonts, pagination, markdown). Docs build target bumped to es2022 — yoga-layout's ESM build loads its WASM with top-level await. Landed 2026-10-07.
2. ✅ **Markdown playground (live)** — `/playground/markdown` hosts the real workbench: `docs/.vitepress/components/MarkdownPlayground.vue` mounts a CodeMirror editor (markdown mode) over a debounced `markdownToPdf` preview with the shipped `inter`/`jetbrains-mono` families — page-count badge, download, reset, error strip — mounted via `<ClientOnly>` inside the open layout. The TLA blocker is solved in the config, not worked around: VitePress's esbuild targets (build, source transform, dev dep pre-bundle) are raised to es2022 because yoga-layout's ESM entry loads its WASM with top-level await and VitePress's defaults (chrome87/es2020) reject it; modern browsers support TLA. Landed 2026-10-07.
3. ✅ **Widget + editing playgrounds (live)** — `/playground/widgets` hosts the widget-tree workbench (`WidgetPlayground.vue`): CodeMirror (javascript mode) over a debounced render, the editor holding the body of a plain-JS function returning `Page[]` with factories/`theme`/`fromHex`/`PageSize` injected as parameters (`sandbox.ts`, `new Function` — no transpiler); starter tree is the invoice example. `/playground/editing` hosts the PDF-editing workbench (`EditPlayground.vue`): the editor holds a function receiving `pages` (the loaded document as Page widgets) — overlays via `pages[i].add([...])`, restructure by array mutation; the sample document is synthesized with pdf-lib (no binary assets) and a file input loads the visitor's own PDF. Landed 2026-10-09.

## Feature: Form widgets (`pdf-kalem/forms`)

Generate AcroForm forms from the widget tree. Authoring first — filling existing
PDFs is postponed (it stays a candidate under *Focus: PDF-only* below). The
design (settled 2026-10-12):

**Field set.** `TextField` (single-line ~24pt default, `multiline`, `maxLength`),
`CheckBox` (~13pt square), `RadioGroup` + `Radio` children (one field; each child
places an option at its own box), `Dropdown` (options + selected value), `Button`
(visual only — pdf-lib has no action API; the widget paints its own centered
label via the shared text painter), `Signature` (visual placeholder built on the
SVG/text primitives — pdf-lib can read but not create signature fields). All
accept `name`, `value`, `readOnly`.

**Seam.** The `edit/` pattern (ADR 0001): a small `PdfFormSurface` (`getForm()` +
`getCurrentPage()`) with a structural guard; `PdfRenderContext` implements it;
form widgets narrow the context at render time (`LoadedPage` precedent). No
`RenderContext` widening. Fields are created fresh each render walk — a second
save builds a fresh `PDFDocument`, so nothing is cached on widgets. Placement is
`context.getLayoutBox(widget)` — already Y-flipped PDF coords, exactly what
pdf-lib's `addToPage` wants — so pagination (`PageScope`) and `FixedContainer`
compose for free. Form widgets are atomic leaves (childless → `getBreakUnits()`
null); `RadioGroup` forces `breakable: false`.

**Data binding.** `new PdfDoc({ children, formData })` — a flat
`Record<string, string | boolean>` keyed by field name (names are the binding
keys; keep them simple — AcroForm reads dots as hierarchy), applied in the
constructor via a tree walk (type-only imports — avoids the DTS circular
chunk). Precedence: `formData` wins over per-widget `value`. Duplicate names
throw (they would silently collide in the AcroForm); unknown keys warn; values
are validated per field type (checkbox wants a boolean, radio/dropdown values
must be declared options).

**Styling.** Per-widget options with sensible defaults (font size, text/border/
background colors, border width); the default appearance font is Helvetica —
embedded-font faces can come later. No theme tokens yet — `theme.form.*` once
the shape settles. Flatten is postponed; when it lands it is a root property
(`new PdfDoc({ flattenForms: true })`).

**Pieces:** `src/lib/forms/` (`FormWidget` base, field widgets, `surface.ts`,
binding walk), `src/forms.ts` → `pdf-kalem/forms` subpath (tsup entry +
`package.json` exports), `tests/forms.test.mjs` (save → reload via pdf-lib →
assert names/types/values/positions; binding; pagination atomicity),
`examples/forms/` (auto-discovered by `examples/run.mjs` — needs only a
`main.ts`), docs guide page, CHANGELOG + version bump.

1. ✅ **Form surface + leaf fields** — `PdfFormSurface` + guard on
   `PdfRenderContext`; `FormWidget` base (name, readOnly, default sizing,
   placement); `TextField` (+ multiline), `CheckBox`, `Dropdown`; the subpath
   entry; round-trip tests. Landed 2026-10-12. Unset appearance options are
   omitted (not passed as undefined) so pdf-lib's `addToPage` defaults apply
   (black text, white background, black 1pt border — a visible box); the
   widget rect straddles the layout box by borderWidth/2; `setFontSize` must
   follow `addToPage` (it needs the /DA entry `addToPage` creates).
   Post-landing fix from the playground: percent-width fields (`TextField`,
   `Dropdown`, `Signature`) default to fill-with-a-120pt-floor — `Column`
   shrink-wraps its children (alignItems: flex-start), so a bare '100%'
   resolved against the wrapped parent and collapsed to an invisible sliver;
   the samples wrap label + field in `Column({ width: '100%' })` (the
   documented convention) and a regression test pins floor + fill.
2. ✅ **Composite + remaining fields** — `RadioGroup`/`Radio` (the group creates
   the field, children add options through their parent group); `Button`
   (painted label); `Signature`; pagination atomicity test (a field moves whole
   to page 2, its annotation lands on that page). Landed 2026-10-12.
   Adjustments discovered in code: pdf-lib's `PDFButton.addToPage` takes the
   caption itself — no manual label painting; `Radio` finds its group through
   the parent chain, so options nested in Rows (for labels) work; the group
   selects its initial value AFTER children render (pdf-lib validates against
   the added options); and `PageScope` forwards `getForm`/`getCurrentPage` to
   its backend — form widgets render through scopes on paginated pages, so the
   PDF-typed surface must pass through (with the same honest error when the
   backend lacks it).
3. ✅ **Data binding** — `formData` on `PdfDoc` + the walk; duplicate-throw /
   unknown-warn / per-type validation; example renders one tree with two
   datasets. Landed 2026-10-12. The walk (`forms/bind.ts`, called from the
   PdfDoc constructor) applies values through `FormWidget.bindValue` — the
   tree is the state, so binding mutates widgets exactly like option values
   would, with `formData` winning. Per-type validation: text wants a string,
   checkbox a boolean, dropdown a declared option (validated at bind time —
   pdf-lib's `select` silently turns unknown values into editable combo
   boxes, so the constructor `value` is validated too); radio groups validate
   at render against the options their Radio children added (early
   validation would need the Radio class, and Radio.ts imports the group).
   Duplicate names stay pdf-lib's to catch at save; unknown keys warn; the
   walk reads `formData` with `Object.hasOwn` (prototype keys must not bind).
4. ✅ **Example + docs + release** — `examples/forms/` (registration-style form:
   text fields, consent checkbox, plan radio group, country dropdown, submit
   button, signature line), docs guide page, README/CONTEXT/ARCHITECTURE
   updates, CHANGELOG + version bump. Landed 2026-10-12 (0.5.0). The docs
   playgrounds were consolidated first: `CodePdfWorkbench.vue` + `workbench.ts`
   own the editor/preview shell (render-callback contract), the widget and
   editing playgrounds became thin wrappers, and the new forms playground
   (`/playground/forms`) is the first feature consumer — the form factories
   joined the shared sandbox so every playground can render fields.

## Focus: PDF-only — and what it unlocks

Decision 2026-10-09 ([ADR 0001](./docs/adr/0001-pdf-only-focus.md)): no image/HTML backends;
the widget tree, pagination, theme, and markdown modules stay as they are; PDF-specific
features get PDF-typed modules (the `pdf-kalem/edit` pattern) instead of widening
`RenderContext`. Candidates this unblocks, in rough value order:

1. **Form filling** — typed read/write over AcroForm fields (today: the `pdf.PDFDocument`
   escape hatch), plus data binding so a filled form is a template + data. The editing
   feature already leans here.
2. **Annotations** — first-class stamp/free-text/highlight APIs beyond the `Link` widget;
   pairs naturally with overlays on loaded pages.
3. **Outlines / bookmarks** — document outline generation from heading levels or explicit
   trees.
4. **Text extraction** — read text back with positions; verifies overlays in tests and
   enables building on existing documents.
5. **Save options / compression** — object streams, image downsampling, pdf-lib save flags.

## Priority 1

Pagination and page-breaking. This is the biggest viability feature. You need predictable overflow handling, explicit page breaks, keep-together behavior, repeated headers/footers, and rules for splitting text, tables, and containers across pages.
Text engine quality. Fonts, measurement accuracy, line wrapping, alignment, line height, truncation, and inline emphasis need to become reliable. If text is unstable, the whole layout system feels untrustworthy.
Stable table/layout primitives. Tables are a core document feature. Add column sizing rules, row splitting, repeating table headers, borders/backgrounds, and cell padding/alignment.
Build correctness. Fix the current TypeScript blockers in Column.ts:27, Row.ts:44, and padding.ts:2. A library is not viable if the baseline build is broken.

## Priority 2

Template helpers and document DSL. This is where you can differentiate. Add higher-level helpers like Section, Header, Footer, Divider, KeyValue, Card, Stack, and invoice/report primitives.
Reusable styling system. Add a coherent styling layer instead of ad hoc widget options everywhere. You want shared spacing, font presets, colors, borders, and typography tokens.
Asset and font loading model. Make font and image loading explicit and predictable. Browser-only fetch is not enough long term; define a clean loader story.
Debugging and inspection tools. Keep the existing debug direction and expand it with layout boxes, overflow warnings, page-break traces, and maybe a layout tree dump.

## Priority 3

Schema and serialization. If you still want long-term live builder potential, define a serializable document schema now, even if authoring stays code-first for the moment.
Template data binding. Let users pass data into templates cleanly so this becomes useful for invoices, statements, reports, and letters.
Test coverage for rendering behavior. Add snapshot-style PDF assertions where practical and focused layout tests for text wrapping, page breaks, and table splitting.
Documentation and examples. Add 3 to 5 serious examples: invoice, report, letterhead, certificate, and multi-page table.


Text.ts:391 and Link.ts:405 duplicate nearly the same text measurement, wrapping, layout, and drawing flow. That is the highest-ROI simplification target. I’d extract a shared TextLayoutEngine plus a small TextPainter, then make Link just “text + annotation + underline”.
Widget.ts:288 is supposed to be the generic base widget, but it already knows about PDF coordinates via getLayoutBoxInPdfCoords. That couples the whole widget tree to one renderer. Move coordinate conversion behind the render layer so widgets deal in layout boxes, not PDF math.
PdfDoc.ts mixes document model, PDF export lifecycle, browser font loading, Node file output, hooks, and runtime helpers. That makes it hard to reason about what PdfDoc actually is. Split it into: Doc as the tree/root model, PdfExporter or PdfSession for rendering, and small browser/Node helper modules for download, writeToFile, font URL loading.
RenderContext.ts is carrying backend state, font registry, measurement, page state, and primitive drawing. It wants to be at least three pieces: FontRegistry, PageCanvas, and PdfRenderContext.
Widget.ts also has a large stringly-typed Yoga property switch. That makes style behavior hard to audit and easy to break. A typed style applier layer would reduce hidden behavior and make Row, Column, Container, and Table easier to follow.

Extract shared text/link layout code.
Move renderer-specific coordinate conversion out of Widget.
Split PdfDoc runtime helpers from document/export logic.
Break RenderContext into smaller backend-focused services.
Tighten the public API and update the README to match it.
