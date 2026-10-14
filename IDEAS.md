# Ideas & bugs

> Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). Bugs are verified against the code —
> render-behaviour bugs by code reading unless marked otherwise. Roadmap-sized ideas live in
> [PLAN.md](./PLAN.md); this file holds what the review and recent sessions surfaced that
> isn't already there.

## Bugs

### B1 — `SVGPath` renders below its layout box (verified by code reading)

`src/lib/SVGPath.ts` L187–195 vs `src/lib/Icon.ts` L238–258.

pdf-lib's `drawSvgPath` applies `scale(s, -s)`: the passed `y` is where the SVG content's
**top** lands, and content extends downward from it. `Icon.drawIconAt` accounts for this
(`originY = y + boxH - offsetY` — the drawn area's top). `SVGPath.render` passes
`y + offsetY` — near the box **bottom** in PDF coords — so the path draws below its layout
box; for an exactly-fitting box, entirely below it. Latent because no example uses
`SVGPath`. Fix lands naturally with ARCHITECTURE #4 (one aspect-fit module owns the
placement math).

**Fixed 2026-10-07** with ARCHITECTURE #4: `aspectFitPlacement` returns the drawn area's
top edge and both `SVGPath` and `Icon` anchor there; pinned by `tests/aspect-fit.test.mjs`
and verified visually.

### B2 — `doc.getPageCount()` doesn't exist

`examples/playground/main.ts` L26 (the stash's copy has it too). `PdfDoc` has no such
method → `TypeError` in the `afterSave` hook; the example cannot run as written. Its
semantics (output pages vs page widgets) depend on the pagination design — decide during
ARCHITECTURE #2. Decided 2026-10-02: `getPageCount()` = Σ per-Page plan pages (memoized dry
run) — see ARCHITECTURE.md §2.

### B3 — Ungated `console.log` in the render path

- `src/lib/Page.ts` L75, L77 — `'Drawing Page'`, `'Page dimensions: …'` fire on every page render (observed in the Node smoke test).
- `src/lib/Image.ts` L74 — `'Measure image'` fires inside the Yoga measure function, i.e. on every measure pass during layout.

`src/lib/utils/debug.ts` provides `debugLog`, gated behind the backend's `debug` flag,
exactly for this — and has zero call sites. Route both through `debugLog`; keep the genuine
`console.error`/`console.warn` paths (font fallbacks, failed fetches) as they are.

**Fixed 2026-10-07:** the Page sites were already routed through `debugLog`; the Image
measure-func log is gone with ARCHITECTURE #4 (the shared `aspectFitMeasure` never logs).

### B4 — Comment rot in `PdfDoc`

`src/lib/PdfDoc.ts` L219 and L266: comments say "Default to A4" while the code uses
`PageSize.LETTER`. One is misleading, the other is dead wrong.

**Fixed 2026-10-07** — both comments now say LETTER.

### B5 — `PdfRenderer` typing wart

`src/lib/PdfRenderer.ts`: `renderPages` takes `ReadonlyArray<unknown>` and immediately
casts to `ReadonlyArray<PageWidget>`, while `PdfDoc.getChildren()` already returns
`Widget[]`. Type it directly.

**Fixed 2026-10-07** — param is `ReadonlyArray<Widget>` (the base type the render loop
needs); the `unknown` + cast is gone.

### B6 — Sub-point horizontal overflow from Yoga's integer rounding (verified by audit)

Yoga rounds computed sizes to whole points hierarchically, so fractional auto widths can
round inconsistently between a container and its child. Verified: a `labelValue` column
sizes to `max(79.8, 82.8) = 82.8` → rounds to **82**, while its label child (79.8) rounds
to **83** — the child ends up 1pt wider than its parent (`tests/layout.test.mjs` fixture
family). Visually negligible (1pt ≈ 0.35mm) and pre-existing. Candidate fix if it ever
matters: a finer `pointScale` on the Yoga config (per-doc), or rounding the measure
func's returned widths consistently. Not fixed — do not let the containment audit assert
horizontal containment tighter than ~1.5pt until then.

### B7 — `Container` border `radius` is a silent no-op (verified by code reading + visually)

`Container.getResolvedBorder` (`src/lib/Container.ts`) resolves `border.radius` from the
option or theme — then `render` never uses it: it draws the fill and border via
`drawRectangle`, and `DrawRectangleArgs` (`src/lib/RenderContextTypes.ts`) has no radius
field at all. So `Container({ border: { radius: 8 } })` typechecks, resolves, and renders
square corners with no warning. Found visually in the `lab/invoice` session (rounded card
corners and a circular badge both rendered square).

Fix is not a one-liner: pdf-lib's `drawRectangle` has no rounded-rect support, so this
needs a path-based rounded rectangle (e.g. via `drawSvgPath` or manual bezier corners) in
the render context. Until then, either drop `radius` from `BorderOptions` (honest
interface) or warn when it's set. The lab invoice works around it with square corners and
an `SVGPath` circle.

> Findings B8–B21 come from the 2026-10-11 full-project review (seven parallel area
> reviews over `src/`; every entry was repro-verified against the freshly built `dist/`
> unless marked code-reading). Baseline at review time: `pnpm typecheck` and the full
> `pnpm test` suite pass — none of these are covered by the current tests.

### B8 — A second output from the same `PdfDoc` is silently corrupt (verified by repro)

`PdfRenderContext.setDocument` (`src/lib/PdfRenderContext.ts` L131–133) only swaps the
document reference — `fontCache` (L47), `textWidthCache`, and `fontkitRegisteredOnDoc`
(L49) survive the swap. `savePdf()` (`src/lib/PdfDoc.ts` L247–266) creates a fresh
`PDFDocument` per call, so on the second save `getFont()` returns `PDFFont` objects whose
refs point into the discarded first document, and pdf-lib writes those stale refs into
the new doc's page resources. Repro: after save #2 the page's `/Font` entry resolves to a
*page* object (ref-number collision); with custom fonts the refs dangle outright. Two
sibling causes: `ImageWidget.loadImage` (`src/lib/Image.ts` L89–90) caches `pdfImage`
forever (same cross-document ref problem for images), and `fontkitRegisteredOnDoc` stays
`true`, so a custom font first requested during save #2 throws pdf-lib's "no fontkit
instance found".

Contradicts the documented invariant ("two saves produce two valid documents") and the
README's own example, which chains `save`/`getBlob`/`download`/`getBuffer`/`writeToFile`
side by side — any two in sequence produce a broken second file. The existing double-save
test greps content streams without validating resources, so it can't catch this.

**Fix:** reset per-document state in `setDocument()` (`fontCache.clear()`,
`fontkitRegisteredOnDoc = false`, `page = null`, `dimensions = undefined`); re-embed
images when `context.getDocument()` changed; add an e2e test that saves twice and asserts
each output's `/Font` + `/XObject` refs resolve inside that document.

**Fixed 2026-10-11** — `setDocument` resets the per-document state (font cache,
width cache, fontkit flag, current page/dimensions, image cache); `ImageWidget` no
longer caches its embed (the backend dedupes per document). Pinned by
`tests/review-fixes.test.mjs` (both saves' resources resolve in-document; a face first
requested on save #2 embeds).

### B9 — `getPageCount()` before `save()` poisons text measurement for the real save (verified by repro)

`measureTextWidth` (`src/lib/PdfRenderContext.ts` L358–362) caches unconditionally —
even when the font isn't embedded and it returned the `text.length × size × 0.6`
estimate. `getPageCount()` (`src/lib/PdfDoc.ts` L185–197) is a dry run that paginates
before any document exists, so `preloadFont` no-ops and every string is measured with the
estimate — and cached. The later `save()` embeds the real fonts but keeps hitting the
poisoned cache: wrapping, line counts, page counts, and the rendered output are computed
from estimates while the glyphs draw with the real font. Repro: identical documents
render 1 page vs 2 pages depending on whether `getPageCount()` ran first.

Two aggravating layers: `TextWidget.getEngine()` (`src/lib/Text.ts` L351–355) memoizes
the engine with ascent/lineHeight captured pre-embed, and `cachedPageCount` (`PdfDoc.ts`
L124) is never invalidated — stale after tree mutation too (the public `getChildren()`
array, `LoadedPage.add()`).

**Fix:** don't write (or read) the cache when the font isn't embedded; drop the memoized
engine after the `preloadFont` awaits; clear `cachedPageCount` in `savePdf()`.

**Fixed 2026-10-11** — all three layers. Pinned by `tests/review-fixes.test.mjs`
(count-then-save renders identically to save-only; the post-save count is exact).

### B10 — A size-less `Page` inherits the previous page's dimensions instead of the doc default (verified by repro)

`PageWidget.getDimensions` (`src/lib/Page.ts` L53–54) falls back to
`context.getDimensions()`, which prefers the current-page cache that `setCurrentPage`
overwrites on every `addPage` (`src/lib/PdfRenderContext.ts` L152–155, L177–186). A
default-size page following a custom-sized page (e.g. a small cover) is laid out,
paginated, and emitted at the *previous* page's size; the dry run (no pages added yet)
uses the doc default, so `getPageCount()` and `save()` disagree.

**Fix:** read the doc defaults (`context.getOptions().width/height`, set by
`setDefaultDimensions`) in the fallback instead of the mutable current-page state.

**Fixed 2026-10-11** — the fallback reads the doc defaults via `context.getOptions()`.
Pinned by `tests/review-fixes.test.mjs` (cover page 300×200, following page LETTER).

### B11 — Absolute-positioned children vanish when their parent splits across pages (verified by repro)

`Widget.getBreakUnits` skips absolute children (`src/lib/Widget.ts` L210–214), and the
Paginator collects fixed widgets only at the page root (`src/lib/pagination/Paginator.ts`
L134–137). A `FixedContainer` nested inside a `Container`/`Column` that crosses a page
boundary gets no break unit, is never placed, and is missing from every output page.
Page-root absolutes re-emit fine; nested ones disappear exactly when the parent splits
(e.g. a corner badge pinned to a card that happens to cross the boundary).

**Fix:** mirror the page-root fixed collection at every frame — when `placeUnits`
recurses into a widget, gather its absolute-positioned descendants and re-emit them as
fixed fragments anchored to that frame's box.

**Fixed 2026-10-11** — the Paginator re-emits a splitting frame's absolute children as
fragments on each page whose *consumed* flow range contains them (emitted at break time
and at frame completion, so nothing double-renders). Pinned by
`tests/review-fixes.test.mjs` (a badge at flow offset 70 lands on exactly the
continuation page, at the right box; one at offset 30 stays on page 1 only).

### B12 — One-sided `width`/`height` doesn't scale `Image`/`SVGPath`/`Icon` (verified by repro)

`ImageWidget.loadImage` (`src/lib/Image.ts` L105–111) and `SVGPathWidget` (L90–97) pin
each *unset* dimension to the intrinsic size. With one dim user-set, both Yoga
dimensions become definite, the aspect-fit measure function never runs, and
`Image(png 40×20, { width: 100 })` draws at 40×20 inside a 100×20 box. The shared
`aspectFitMeasure` (and its unit tests) is dead wiring — the widget constructors bypass
it. `Icon` defaults each unset dim to `size` (`src/lib/Icon.ts` L102–103), same effect.

**Fix:** pin the intrinsic size only when *both* dims are unset, leaving the other auto
so the measure derives it; forward `width`/`height` as given in `Icon`.

**Fixed 2026-10-11** — intrinsic size is pinned only when *neither* dimension is
explicit; `Icon` forwards `width`/`height` as given. Pinned by
`tests/review-fixes.test.mjs` (1×1 image at width 100 → 100×100; 24×48 viewBox at
width 48 → 48×96; square icon at width 48 → 48×48).

### B13 — `SVGPath`/`Icon` `strokeWidth` is double-scaled (verified by repro)

`SVGPathWidget.render` (`src/lib/SVGPath.ts` L138–141) pre-multiplies
`strokeWidth × placement.scale`, but pdf-lib's `drawSvgPath` emits `setLineWidth` *after*
`scale(s, -s)`, so the CTM scales it again — the rendered stroke is `strokeWidth ×
scale²`. Repro: `strokeWidth: 1` at scale 2 shows `2 w` inside a ×2 CTM → 4pt effective.

**Fix:** pass `strokeWidth` raw and let pdf-lib's CTM apply the scale.

**Fixed 2026-10-11** — `strokeWidth` is passed raw. Pinned by
`tests/review-fixes.test.mjs` (scale 2 emits `2 w` inside a ×2 CTM, not `4 w`).

### B14 — The `style` escape hatch is inverted on `FlexContainer`/`Row`/`Column` (verified by repro)

`FlexContainer` (`src/lib/FlexContainer.ts` L22–26) spreads `...options.style` *first*,
then hardcodes `width`/`height` after — so `style.width`/`style.height` can never take
effect. `Row` (L49–54) and `Column` (L47–53) additionally clobber
`style.justifyContent`, `style.alignItems`, and (Column) `style.gap`. `Container`
(L58–65) gets the order right (style last) — the Flex family contradicts the same
documented contract (I11).

**Fix:** spread `...options.style` last.

**Fixed 2026-10-11** — `style` spreads last on `FlexContainer`; `Row`/`Column` put the
prop-derived values first and keep `flexDirection` pinned (the widget's identity). Pinned
by `tests/review-fixes.test.mjs` (Row justify, Column gap, Flex width).

### B15 — `Stack` and `Icon` silently drop `margin` (verified by repro)

`StackWidget` (`src/lib/Stack.ts` L63–64) passes only `children` to `super`;
`IconWidget` (`src/lib/Icon.ts` L97–109) hand-builds its super call without `margin`. The
typed `WidgetOptions.margin` is accepted then discarded — outer spacing silently goes
missing. (`SVGPath` forwards the whole options object and works.)

**Fix:** `super(options)` in `Stack`; forward `margin` in `Icon`.

**Fixed 2026-10-11** — both. Pinned by `tests/review-fixes.test.mjs`.

### B16 — `appendWidgetChild` never propagates context (verified by repro)

`Widget.appendWidgetChild` (`src/lib/Widget.ts` L157–162) pushes the child and inserts
its Yoga node but never calls `widget.setContext(this.context)`. `setContext` runs only
in the `PdfDoc` constructor, so widgets appended after construction silently lose the
theme: token colors warn + fall back, theme padding vanishes. Flows that build the doc at
save time (`LoadedPdf.save()`) are safe; composing into an existing `PdfDoc` is not.

**Fix:** `if (this.context) widget.setContext(this.context);`

**Fixed 2026-10-11** — exactly that (plus the B19 guard). Pinned by
`tests/review-fixes.test.mjs` (theme padding resolves for a late append).

### B17 — Browser canvas measurement ignores `fontWeight`/`fontStyle` (verified by code reading)

`TextWidget.getCanvasFont` (`src/lib/Text.ts` L307–312) resolves the family token only —
the canvas font string carries no weight/style. The PDF font is the fully-styled face
(`inter-bold`, `Helvetica-Bold`), but pretext measures with the regular face (browser
`FontFace`s are registered per face id), so bold/italic text wraps ~5–10% too wide in
browser-rendered docs. Node is unaffected (no canvas → the pdf-lib fallback measures the
right face). `resolveRunFont` (L238) has the same flaw, which also mis-targets the
`document.fonts.load` preload in `prepareLayout` (L480–482).

**Fix:** build the canvas font from the resolved face — decompose `getFontName()` into
(family, style) and use the face id as the canvas family for custom fonts, plus
`bold`/`italic` keywords for the builtin stacks.

**Fixed 2026-10-11** — `getCanvasFont`/`resolveRunFont` build the canvas font from the
resolved face id via a shared `canvasFontForFace` helper. Browser-only path — not
covered by the Node test suite.

### B18 — The edit subpath drops AcroForm (verified by repro)

`PdfRenderContext.adoptPage` (`src/lib/PdfRenderContext.ts` L163–167) uses
`doc.copyPages`, which copies only the object graph reachable from the page dict — the
catalog-level `/AcroForm` is not reachable, so it's silently dropped. Widget annotations
survive, so a loaded form *looks* intact but is dead (`getForm().getFields().length ===
0` after a loadPdf → save round-trip). Contradicts the stated guarantee in `LoadedPage.ts`
L10–14, `PdfPageSurface.ts` L22–29, and `loadPdf.ts` L9–12 ("form fields preserved").

**Fix:** copy the source `/AcroForm` into the output catalog after `copyPages` (via
`PDFObjectCopier`), or correct the docs to say annotations/links survive but interactive
forms do not.

**Fixed 2026-10-11** — `adoptPage` mirrors `copyPages` with one `PDFObjectCopier` per
source document (reset with the document) and copies the catalog `/AcroForm` through the
same copier, so field refs dedupe against the copies the pages' widget annotations
pulled in. Side benefit: shared resources no longer duplicate once per adopted page.
Pinned by `tests/review-fixes.test.mjs` (a text field survives loadPdf → save with its
name and value).

### B19 — A duplicate widget instance aborts the process, uncatchably (verified by repro)

The `Widget` constructor loop (`src/lib/Widget.ts` L44–47) inserts each child's Yoga
node without guarding against the same instance appearing twice in one `children`
array (or in two parents). Yoga's WASM aborts the whole Node process ("Child already has
a owner… Aborted()") — `try/catch` cannot intercept it, and the same-array duplicate
(an easy mistake when building children lists programmatically) is documented nowhere.

**Fix:** throw a descriptive `Error` before touching the Yoga node — a `Set` within the
loop catches same-parent duplicates; `child.parent` catches cross-tree re-parenting.

**Fixed 2026-10-11** — the `Widget` constructor and `appendWidgetChild` throw a readable
error before touching the Yoga node. Pinned by `tests/review-fixes.test.mjs`.

### B20 — Minor findings from the 2026-10-11 review (repro-verified unless noted)

Small but real; grouped by area:

**Text engine** (`TextLayoutEngine.ts`, `Text.ts`):

- Pre-wrap whitespace-only paragraph vanishes in the Node fallback wrapper (L354–356):
  `Text('a\n   \nb', { whiteSpace: 'pre-wrap' })` yields 2 lines plain vs 3 rich.
- `maxLines` clamps even under `overflow: 'visible'`, contradicting the `TextOverflow`
  doc (L48–54 vs L221–227); since `'visible'` is the default, `Text(s, { maxLines: 2 })`
  silently discards content with no indicator.
- Rich ellipsis is dropped when the last visible line is blank or nothing fits
  (`ellipsizeRichLine` L697–700, L734–736); the plain path keeps one.
- Run-href annotation rects sit one half-leading below their line box
  (`addRunLinkAnnotations`, `Text.ts` L427 ff.).
- Run-level `font`/`mono` overrides ignore the base name's own face style
  (`resolveRunFont` L217–221) — the documented precedence chain breaks at its last link.
- `Text('')` occupies one line box (CSS gives height 0) — possibly intended;
  self-consistent across plain/rich paths.

**Layout/theme:**

- `Container.prepareLayout` unconditionally resets all four padding edges, clobbering
  `style.padding*` (`Container.ts` L93–100).
- `Container({ children, child })` mutates the caller's `children` array (`Container.ts`
  L44–47).
- `border.width: 0` renders a 1pt border — `||` where it should be `??`
  (`Container.ts` L117).
- The warn-once partition is module-global (`Theme.ts` L55–64): the same missing token
  warns once per process, across different docs/themes.

**Content widgets:**

- `fromHex` accepts invalid hex → NaN colors with a cryptic late pdf-lib error
  (`utils/color-utils.ts` L19–49).
- `Table.fromRows([], { header: true })` crashes with an opaque `TypeError`
  (`Table.ts` L461).
- `Table({ children })` silently discards the children (`Table.ts` L291).
- `Image` `scale: 0` silently becomes 1; negative silently draws nothing (`Image.ts`
  L57).
- Windows drive-letter paths (`C:\img.png`) are misdetected as URL schemes (`Image.ts`
  L132).
- `SVGPath` with `fill` + `strokeWidth` but no `stroke` draws an unintended black
  outline (`SVGPath.ts` L136–141).
- A repeated table head is re-emitted unclipped on continuation pages (`Paginator.ts`
  L341–353) — draws past the page edge when taller than the content box.

**Markdown:**

- Images inside list items, headings, and table cells are silently dropped — only the
  `runs` half of `inlineToRuns` is consumed (`markdown/render.ts` L173, L86, L219).
- `MarkdownStyles.blockquote.color` is a documented no-op (`markdown/styles.ts` L16,
  L39; never consumed by `renderBlockquote`).
- A truncated-but-sniffable PNG passes conversion, then crashes `save()` with an
  unrelated pdf-lib error (`markdown/render.ts` L241–253).
- Markdown images can't use relative paths or `file://` in Node, unlike `Image` widgets
  (`markdown/render.ts` L242 uses bare `fetch`).
- An image inside a link silently loses the link (`markdown/inline.ts` L90–105).

**Edit/preview/backend:**

- Non-zero MediaBox origin misplaces overlays (`edit/loadPdf.ts` L38; `mapContentBox`
  assumes origin (0,0)).
- Adopted pages duplicate shared resources once per page (`PdfRenderContext.ts`
  L163–167 — a fresh copier per call): file bloat, not corruption.
- `renderToPng()` detaches a caller-owned `ArrayBuffer` (`preview.ts` L148–149).
- `renderToPng`'s `page` option has no bounds guard — bare pdfjs error (`preview.ts`
  L128, L157).
- A doc-scoped family named after a builtin alias (`useFonts({ files: { sans: … } })`)
  loads, then is silently unreachable — alias resolution wins (`PdfRenderContext.ts`
  L229 vs L242).
- `toPdfLibColor` silently drops `ColorValue.alpha` (`utils/color-utils.ts` L61–67).
- `FontRegistry.loadBrowserFont` memoizes failed loads forever (`FontRegistry.ts`
  L82–102).
- The `Widget` base class appears in public signatures but isn't exported from any entry
  (`src/lib/widgets.ts`).
- `new PdfDoc({})` silently saves a pageless PDF (`PdfDoc.ts` L152, L163–168).

**Fixed 2026-10-11** (same session as B8–B19; pinned in `tests/review-fixes.test.mjs`):

- All items above are fixed, except three resolved by decision:
  - `maxLines` under `overflow: 'visible'` — the clamping is CSS line-clamp semantics
    and stays; the `TextOverflow` doc was corrected instead (`overflow` chooses the
    indicator; `maxLines` always clamps).
  - `Text('')` occupying one line box — kept by design (self-consistent across the
    plain/rich paths; it's the degenerate case of the `'a\n\nb'` blank-line rule).
  - `FontRegistry.loadBrowserFont` failed-load retry — fixed, but browser-only and
    therefore untestable in the Node suite.
- Found and fixed while in here: **builtin styled text measured with the estimate** —
  `getFont` cached embedded fonts under the alias-resolved pdf name (`Helvetica-Bold`)
  while `measureTextWidth` looked the caller's id up raw (`sans-bold`), so every
  bold/italic builtin text block wrapped using the `0.6em/char` estimate. `getFont` now
  caches under the caller's name, and doc-scoped resolution also maps builtin pdf names
  back into alias-named families (`Helvetica` → a family registered as `sans`).
- Yoga quirk discovered on the way: explicit per-edge values (even `0`) take precedence
  over the `Edge.All` slot — an `All` set after per-edge sets is silently defeated.
  `Container.prepareLayout`'s style re-apply sets edges individually for that reason.

### B21 — Doc rot from the 2026-10-11 review

- `CONTEXT.md` references `PdfRenderer` in five places (L16, L21, L65, L95, L110) — the
  class was folded into `savePdf` (I5, resolved the same day) and no longer exists.
- `TextOverflow`'s `'visible'` doc ("lines are not truncated") contradicts `maxLines`
  behavior (see B20).
- The edit subpath's "form fields preserved" claim is false as shipped (see B18).

**Fixed 2026-10-11** — the `CONTEXT.md` references now describe the `savePdf` walk; the
`TextOverflow` doc is corrected (see B20); "form fields preserved" is true as of B18's
fix.

### Fixed (for the record)

- **`canUsePretext` Node fallback** — checked only `Intl.Segmenter`, so on modern Node the
  engine picked pretext, which throws without a canvas. Fixed in `cadadd9`: also requires an
  actual canvas source (`OffscreenCanvas` or DOM `document`), restoring the documented
  fallback to the built-in wrapper.
- **`splitting: false`** — had silently reverted the tsup setting whose absence once shipped
  a real `instanceof` bug across entry points. Fixed in `2638966`.
- **Stale `RenderContext` fork** — the pre-refactor concrete class was the runtime backend,
  `PdfRenderContext` was dead code, and font registration bypassed `FontRegistry`. Fixed in
  `2638966`.

## Ideas

### I1 — Per-instance lifecycle hooks (part of ARCHITECTURE #7)

`PdfDoc.globalBeforeCreate` / `globalAfterSave` + `clearHooks()` are process-global: two
documents in one process share hooks, and ordering across docs is caller-beware. The
constructor already accepts per-instance `beforeCreate`/`afterSave` — the statics are a
redundant second channel. Drop the statics (or keep them as deprecated aliases for one
release).

### I2 — Standalone output module (part of ARCHITECTURE #7)

`getBlob` / `download` / `getBuffer` / `writeToFile` are ~60 lines of runtime sniffing
(`globalThis.Buffer`, `new Function("return import('node:fs/promises')")`, anchor-click
download) glued onto the document model. A small `output.ts` module keeps `PdfDoc` a pure
document model and makes runtime support an explicit seam.

### I3 — Test strategy for after v1 (part of ARCHITECTURE #3)

Sequencing that falls out of the module shapes:

1. `TextLayoutEngine` first — pure, injectable `measureTextWidth`; wrap/truncate/ellipsis
   need zero mocks.
2. `TextPainter.position` — pure math over a laid-out block.
3. Pagination tests once #2 lands (the two files `package.json` already promises).
4. Snapshot-style PDF assertions last (PLAN.md P3 already calls for these).

Prerequisite: `FontRegistry` needs a reset/`forTests` hook to be test-isolable, and the
theme resolvers (#6) should be pure functions by then.

### I4 — v2: split the `RenderContext` interface concerns

The interface carries three concerns (theme/debug, measurement, drawing + page lifecycle);
widgets call ~15 of its 26 methods, and page lifecycle (`addPage`/`getCurrentPage`/
`setCurrentPage`, typed `unknown`) is renderer-layer business, not widget business. In v2,
split so widgets see Measurement + Drawing and the renderer layer sees page lifecycle.
Also neutralize `RenderImage` (still `PDFImage`-typed today).

**Rejected 2026-10-09** — the PDF-only pivot ([ADR 0001](./docs/adr/0001-pdf-only-focus.md))
removed the backend pressure that motivated the split. The seam stays as pagination's
composition point; revisit only if its width actually hurts.

### I5 — `PdfRenderer` folded into `savePdf` — RESOLVED (2026-10-11)

`PdfRenderer` was 24 lines: `render()` → `renderPages()` → `for (page of pages)
page.render(context)`. Deletion test: delete it and the loop moves into `savePdf` —
complexity vanishes. It's a hypothetical seam (one caller, zero alternatives).

**Resolved 2026-10-11** — the walk is now inline in `PdfDoc.savePdf` (with the comment
explaining why there is no separate module); `PdfRenderer.ts` deleted and its
package-root export removed. Pagination did not introduce the second render strategy
that would have made the seam real.

### I6 — Start an ADR practice

No `docs/adr/` exists yet. When a candidate gets rejected for a load-bearing reason (not
"not now"), record a short ADR so future architecture reviews don't re-suggest it. First
likely candidate: whatever #2 decides about fragments-vs-placement.

**Started 2026-10-09** — `docs/adr/0001-pdf-only-focus.md` records the PDF-only pivot
(the multi-backend plan's rejection).

### I7 — Debug/inspection tooling (PLAN.md P2)

The `debug` flag already draws outline boxes; `debugLog` exists but is unused (B3). Once
B3 is fixed, natural extensions: overflow warnings, page-break traces, a layout-tree dump.
Depends on #2 for anything page-break related.

### I8 — `lab/` scratch directory

Untracked `lab/` holds old copies of `PdfDoc.ts` / `PdfRenderContext.ts` with broken
relative imports (`./Widget` doesn't resolve there). Not built, not typechecked. Delete it
or move it under `examples/` if anything in it is still wanted — it will confuse future
explorers (and AI assistants) otherwise.

Update 2026-10-10: `lab/invoice/` now holds a working self-contained example (freight
invoice replica, own fonts) — the "delete lab/" suggestion no longer holds as written.

---

The following were surfaced by the 2026-10-10 session that built `lab/invoice/` — the
first use of the library as a regular user would (replicate a screenshot of a real
document). Ordered roughly by pain.

### I9 — No fast visual feedback loop

The dominant cost of the session was the gap between "code changed" and "I saw the
result": run `node main.ts`, then rasterize the PDF with external tools (`sips` failed
on the output, `qlmanage` can't run sandboxed, poppler/magick not installed). There is no
render-to-image API, no dev preview, no way to snapshot-test a user's own document
(golden-plan tests exist internally but assert geometry, not pixels). Adjacent to I7
(debug tooling) but distinct: I7 inspects layout, this wants a `doc.toPNG(pageIndex)`-style
API or a watch-mode previewer. Without it, every visual tweak is a full run + external
toolchain.

**Design direction (2026-10-10):** put the seam at the *bytes* level, not the
`RenderContext` level — a `renderToPng(pdfBytes, { page, dpi })`-style module that
rasterizes the produced PDF (WYSIWYG by construction, no second drawing path that can
drift, and no violation of ADR 0001's PDF-only pivot). A canvas `RenderContext` adapter
was considered and rejected for now: it resurrects the multi-backend pressure ADR 0001
rejected, and canvas-vs-PDF text drift would make the preview lie. Revisit only if
rasterization latency measurably hurts or I7 needs in-process overlays.

**Rasterizer candidates evaluated 2026-10-10:**

- **`pdf-raster`** (MIT, joshxfi) — Rust napi-rs addon embedding PDFium;
  `convert(bytes, { pages, dpi, outputFormat })` maps almost 1:1 onto the proposed
  interface; ~10 ms/page claimed (12.7–17.6× pdfjs-dist + `@napi-rs/canvas` at 300 DPI);
  prebuilt binaries for macOS/Linux/Windows x64+arm64 incl. musl; provenance-attested
  publishes. Concerns: requires **Node ≥ 24** (pdf-kalem declares `>=18` — must ship as
  an optional peer dep, never a required one); Node/Bun only, no browser/WASM (the docs
  playground would still need a pdfjs adapter); young (v0.2.0, single maintainer, first
  release 2026-03) — acceptable for a dev-loop tool, pin the version if it becomes
  load-bearing for CI golden tests.
- **`pdfjs-dist` + canvas provider** — the common, battle-tested path; one engine covers
  Node and browser; slower (~177 ms/page claimed by pdf-raster's benchmark) but plenty
  for a dev loop.
- Disqualified: **mupdf wasm** (AGPL/commercial — incompatible with an MIT library);
  `pdf2pic`-style wrappers (external Ghostscript/GraphicsMagick binaries).

**Decision:** ship Stage 1 on pdfjs-dist (the common path) behind the small
bytes-in/PNG-out interface; record `pdf-raster` as the fast Node-only adapter to add
once the preview seam gets its second adapter (browser/playground), at which point the
seam is real rather than hypothetical. `lab/invoice/preview.mjs` is the working spike.

**Shipped 2026-10-11 — Stage 1 done:** `pdf-kalem/preview` subpath exports
`renderToPng(pdfBytes, { page, dpi })` (`src/lib/preview.ts`); `pdfjs-dist` +
`@napi-rs/canvas` are optional peer deps loaded lazily on first call. Two findings from
the promotion: pdfjs's Node standard-font factory reads with `fs.readFile`, so
`standardFontDataUrl` must be a plain filesystem path (a `file://` string fails
silently — warning only); and it resolves through `createRequire` so pnpm's symlink
layout works. Pinned by `tests/preview.test.mjs` (dimensions, page selection, ink-on-
page, default DPI). Stage 2 (pdf-raster adapter, playground/browser adapter) remains
open until the seam gets its second adapter.

### I10 — Bold is runs-only; theme variants carry no weight

The most common styling need requires the runs API: `Text([{ text: 'Total', bold: true }],
opts)` — `Text('Total', { bold: true })` doesn't exist, and theme text variants have no
bold/weight field (`Theme.ts`). The lab session needed a local `bold()` helper within the
first 30 lines; every user will write the same one.

**Decided and implemented 2026-10-10** — CSS-like typography at every level, one
vocabulary, no boolean sugar:

- `ThemeTextStyle` and `TextOptions` gain `fontWeight` (100–900, 'normal', 'bold') and
  `fontStyle` ('normal', 'italic'). Named `fontWeight`/`fontStyle`, not `weight`/`style`
  — `style` already means the Yoga style object on Row/Column options.
- Numeric weights snap per CSS matching for a two-weight family: 100–500 → regular,
  600–900 → bold (`snapFontWeight` in `fonts/face.ts`). Spec behavior, not silent
  failure — and when the font model grows real per-weight faces, the same call sites
  hit them unchanged.
- `Run.bold`/`Run.italic` were **removed** (breaking, v0.1.x) in favor of
  `Run.fontWeight`/`Run.fontStyle` — one typographic vocabulary at every level;
  `strike`/`underline`/`href`/`mono` stay flags (decorations/links, not typography).
- Per-axis replace semantics (CSS inheritance): an explicit weight of 400 un-bolds a
  bold base; block typography carries into run `font`/`mono` family overrides.
  Precedence: run value → block option → theme variant → the base name's own style
  (so `font: 'inter-bold'` keeps working, now as a documented consequence).
- Implementation routes through the existing face machinery (`resolveFaceStyle` →
  `faceId` → the embed path's face-id decomposition); `combineFaceStyle` (OR-semantics,
  couldn't un-bold) was replaced by `resolveFaceStyle`.
- Pinned by five new tests in `tests/fonts.test.mjs` (faces, snap table, variant +
  block override, run axis-replacement, builtin Helvetica-Bold); runs/markdown tests
  and examples migrated. Note: Inter's italic faces carry `InterItalic-*`
  PostScript names — assert on style suffixes, not family prefixes.

### I11 — Inconsistent option surfaces across widgets — RESOLVED (2026-10-11)

- `Row`/`Column` (FlexContainer) accept a `style` override; `Container` does not — its
  yoga style is hardcoded in the constructor. The lab invoice's vertical divider needed
  `alignSelf: 'stretch'` on a Container and couldn't get it; workaround was a
  fixed-height row + percentage-height child (fragile).
- `Container` hardcodes `alignSelf: 'flex-start'`, silently defeating a parent's
  `alignItems: 'stretch'` — children that should stretch don't, with no error.
- `Container.padding` is a single number; no per-side padding. No `margin` on any widget,
  so all external spacing must be expressed as parent `gap` — which forces structural
  contortions when two siblings need different outer spacing.
- Type drift: `FixedContainer.bgColor` takes `RenderColor`, `Container.bgColor` takes
  `ThemeColorValue`.

**Resolved 2026-10-11** (proposal approved in-session; four decisions):

1. **`Container.style?: YogaStyle`** — the same escape hatch FlexContainer has; caller
   keys spread after the built-in defaults (per-key override).
2. **`alignSelf` hardcode removed (breaking, option a)** — Containers respect their
   parent's `alignItems` like any other box. Fill behavior appears under stretching
   parents (`Page`, `Flex`); `Row`/`Column` default their own `crossAxisAlignment` to
   `flex-start`, so they never stretched their children and still don't. Shrink-wrap is
   explicit: `style: { alignSelf: 'flex-start' }` (or any non-stretching parent).
   Root-cause fix for I12's "layout collapse" — the hardcode was the defeat mechanism.
3. **`Spacing` vocabulary** (`utils/spacing.ts`) — `number | { top?, right?, bottom?,
   left? }`, unset sides falling back to the caller's default. `Container.padding`
   accepts it (number stays valid; theme default fills unset sides); `margin` added to
   **`WidgetOptions`** — margins are a box feature, so every widget gets the same
   vocabulary from the base. No margin collapsing (Yoga resolves plain geometry;
   pagination break offsets already carry margins). No `horizontal`/`vertical` sugar.
4. **`FixedContainer.bgColor: ThemeColorValue`** — routed through `resolveColor` (#6
   seam); theme tokens work there like everywhere else.

Pinned by `tests/spacing.test.mjs` (10 tests: style override, fill/shrink-wrap matrix,
per-side padding + theme fallback, base margins, token resolution).

### I12 — Silent layout and token failures

Two classes of silent failure, both hit in the lab session:

- **Layout collapse.** Percentage heights against an auto-height parent resolve to
  nothing (Yoga treats them as auto → 0), and the `alignSelf` hardcode above defeats
  stretch. The widget renders with zero height and nothing tells the user why.
- **Token typos.** `bgColor: 'brnad'` doesn't error: `resolveThemeColor` returns
  undefined and call sites fall back silently (Container → white, Table borderColor →
  black). A misspelled theme token produces wrong colors with no warning.

**Token half fixed 2026-10-11:** `resolveThemeColor` warns once per unknown token
(`warnUnknownColorToken` in `Theme.ts`; `resetThemeWarningsForTests` for isolation) —
the choke point is `theme-resolve.ts`/`Theme.ts` since ARCHITECTURE #6, so one warn
covers every call site. Colors only: variant names are a legitimate cascade and font
names pass through as family names, so misses there stay silent. The warning caught a
real latent typo on day one (`tests/layout.test.mjs` used an undefined `panel` token).
The three docs playgrounds surface warnings in their UI (`captureWarnings` in
`sandbox.ts` hooks `console.warn`; `PlaygroundStrip.vue` renders it as an amber pill on
the Source strip + amber badge state) — not just DevTools. The layout-collapse half
(debug-drawing zero-height boxes) stays open as I7 territory.

### I13 — Local image files require manual loading — RESOLVED (2026-10-11)

`Image.png('./logo.png')` calls `fetch()` on the URL, which fails for file paths in Node.
A regular user's first attempt breaks; the working path is `readFile` +
`Image.fromBytes(bytes, 'png')` with `format` specified explicitly even though it's
sniffable from magic bytes. Candidate: in Node, treat non-URL paths as files (the output
side already sniffs runtime for `writeToFile`); sniff format from the byte signature.

**Fixed 2026-10-11** in `src/lib/Image.ts`:

- In Node, a bare path (`./logo.png`) or `file://` URL reads from disk (`readNodeFile`
  via the `new Function` escape hatch — no node types in src/); real URLs
  (http/https/data/blob) fetch as before, in every runtime.
- The bytes are ground truth: `sniffImageFormat` (moved to `utils/image-format.ts`,
  shared with markdown) runs on every load; a sniffed format overrides a disagreeing
  declared one, with a warning. Unrecognizable signatures fall through to the declared
  format (embedImage reports unsupported formats).
- `Image.fromBytes(bytes, format?)` — format is now optional when the signature sniffs;
  throws with guidance when it doesn't and none was given.
- Pinned by `tests/image.test.mjs` (absolute/relative/file:// paths, sniffing, mismatch
  warning, data-URL path unchanged).

### I14 — Missing everyday widgets — RESOLVED (2026-10-10)

Resolved in `src/lib/Stack.ts`, `src/lib/Spacer.ts`, `src/lib/VLine.ts` (tests:
`tests/widgets.test.mjs`):

- **Stack** — overlay composition, painted in order. Non-positioned children align per
  `alignment` (Yoga aligns inset-less absolute children via justifyContent/alignItems);
  `FixedContainer` children keep their own insets. Sizes to its largest non-positioned
  child (measured in prepareLayout), else explicit `width`/`height` (throws with guidance
  if only positioned children and no size). Atomic under pagination.
- **Spacer** — `size` for a fixed gap, `grow` (default 1) to absorb free main-axis space.
- **VLine** — vertical sibling of `HLine` (`color`, `thickness`, `height`, stretches to
  the row by default).
- **PageBreak** — rejected by design: pagination is automatic and opaque; an explicit
  break would fight the paginator's model. Revisit only if a real document demands it.
- **SizedBox** — rejected as sugar: `Container({ height })` already says it.

### I15 — Icon registry too small to be useful

`materialIcons` in `Icon.ts` ships ~30 curated icons; the map pin the invoice needed
(`place`) wasn't there, so the session pasted raw SVG path data into source. Regular
users don't have path data memorized. Note: `@mdi/js` is already a devDependency —
either generate a larger registry from it at build time or document the
`Icon.register`/inline-`path` escape hatch prominently in the docs.

## I16 - Barcodes and QR code genertors

## I17 -  include charts

## I18 - SEO for docs, LLM.txt  file, agentic (mcp) methods

## I19 - Watermarks

## I20 — Per-side borders on `TableCell`

From external-agent feedback (2026-10-14): `TableCell.borderWidth` is a single number,
so collapsed grids, top-only rules, and per-edge emphasis are out of reach from the
public API. Accept `number | { top, right, bottom, left }` (the `Spacing` shape) and
render per-side lines instead of one stroked rectangle when per-side values are given.
`Container`'s border could take the same shape later.

## I21 — `KeyValue` widget

From external-agent feedback (2026-10-14): label/value rows (what the agent hand-rolled
as a `fieldTable`) are extremely common in form/document PDFs. A built-in
`KeyValue({ pairs, labelWidth })` with muted-label styling (theme `text.label` variant)
would save every consumer the ceremony. Design alongside the template-helper layer
(PLAN.md Priority 2).

## I22 — Page footer / page-number callback

From external-agent feedback (2026-10-14): `FixedContainer` gives per-page furniture,
but the page count is only known after pagination — "Page 1 of 3" has no clean path.
A `Page({ footer: ({ index, count }) => children })` callback evaluated per output
page (the paginator knows `count` after planning; the render walk evaluates the
callback per plan) would make it trivial. Same shape could serve `header`.

## I23 — `Table.fromRows` cell descriptors

From external-agent feedback (2026-10-14): beyond plain strings, `fromRows` users must
drop to the verbose `Table/TableRow/TableCell` ceremony. Accept
`{ value, align, variant, color }` cell objects (and per-column defaults) — covers
right-aligned numbers and muted text, the 90% case.

## I24 — `Container` clip option

From external-agent feedback (2026-10-14), alongside the Image-fit fix: a
`clip: true` option on `Container` as a safety valve for overflowing children.
Implementation is PDF mechanics: push a clip rect (`W n`) around the children's
drawing — a `pushClip`/`popClip` pair on the render surface (PDF-typed per ADR 0001,
or neutral if clipping is considered generic drawing).
