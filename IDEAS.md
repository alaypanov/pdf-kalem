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

### I5 — Decide `PdfRenderer`'s fate with #2

`PdfRenderer` is 24 lines: `render()` → `renderPages()` → `for (page of pages)
page.render(context)`. Deletion test: delete it and the loop moves into `savePdf` —
complexity vanishes. It's a hypothetical seam (one caller, zero alternatives) *today*.
Keep it only if pagination introduces a genuine second render strategy; otherwise fold it
into `savePdf` and revisit when #2 lands. #2 decided 2026-10-02 (pure transformation —
ARCHITECTURE.md §2): revisit at implementation.

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

### I11 — Inconsistent option surfaces across widgets

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

### I12 — Silent layout and token failures

Two classes of silent failure, both hit in the lab session:

- **Layout collapse.** Percentage heights against an auto-height parent resolve to
  nothing (Yoga treats them as auto → 0), and the `alignSelf` hardcode above defeats
  stretch. The widget renders with zero height and nothing tells the user why.
- **Token typos.** `bgColor: 'brnad'` doesn't error: `resolveThemeColor` returns
  undefined and call sites fall back silently (Container → white, Table borderColor →
  black). A misspelled theme token produces wrong colors with no warning.

Candidate: throw (or `console.warn` once) on unknown theme tokens; a debug mode that
draws zero-height/overflowing boxes (extends I7).

### I13 — Local image files require manual loading

`Image.png('./logo.png')` calls `fetch()` on the URL, which fails for file paths in Node.
A regular user's first attempt breaks; the working path is `readFile` +
`Image.fromBytes(bytes, 'png')` with `format` specified explicitly even though it's
sniffable from magic bytes. Candidate: in Node, treat non-URL paths as files (the output
side already sniffs runtime for `writeToFile`); sniff format from the byte signature.

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
