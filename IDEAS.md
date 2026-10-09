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
