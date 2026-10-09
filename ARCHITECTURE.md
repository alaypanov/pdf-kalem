# Architecture — deepening opportunities

> From the 2026-10-02 architecture review, updated after the RenderContext seam landed.
>
> Vocabulary: **module** = anything with an interface + implementation · **interface** = everything a caller must know to use it correctly · **depth** = behaviour per unit of interface a caller must learn · **seam** = where a module's interface lives · **adapter** = a concrete thing satisfying an interface at a seam · **leverage** = what callers get · **locality** = what maintainers get · **deletion test** = delete the module: does complexity vanish (pass-through) or reappear across callers (earning its keep)?
>
> Companion docs: [IDEAS.md](./IDEAS.md) (bugs + ideas) · [CONTEXT.md](./CONTEXT.md) (domain glossary) · [PLAN.md](./PLAN.md) (roadmap).

## Status board

| # | Candidate | Strength | Status |
|---|---|---|---|
| 1 | Finish the RenderContext seam | Strong | ✅ Done — `2638966` |
| 2 | Give pagination one home | Strong | ✅ Done — `src/lib/pagination/` landed; template layer pending |
| 3 | Stand up the verification seam | Strong | ✅ Done — `tests/` suite runs in `pnpm test`; FontRegistry test-isolation hook still open (I3) |
| 4 | Collapse the aspect-fit triplication | Strong | ✅ Done — `src/lib/aspect-fit.ts`; B1 fixed, Image measure no longer logs |
| 5 | Retire the string-keyed `setProperty` interpreter | Strong | ✅ Done — `setYogaStyle` is the only styling entry; dead accessors dropped |
| 6 | Extract the theme-resolution policy | Worth exploring | Open |
| 7 | Un-glue `PdfDoc` | Worth exploring | Open — shrunk by #1 |

Suggested order: 2 → 4 → 5 → 3 landed; remaining: **6 → 7**.

---

## 1 ✅ Finish the RenderContext seam — done (`2638966`)

The backend-neutral seam existed only on paper: every widget and `PdfDoc` bound to a stale
pre-refactor concrete class, the real adapter `PdfRenderContext` was dead code, and font
registration bypassed `FontRegistry`.

Landed: `RenderContext.ts` is now a re-export hub (types + interface + `PdfRenderContext`);
the stale class is deleted; `PdfDoc` defaults to `PdfRenderContext` and types its context
concretely; fonts delegate to `FontRegistry`; widgets import the interface via direct type
imports (importing the type through the hub creates a circular chunk in the DTS build);
deprecated `getLayoutBoxInPdfCoords` dropped; hub exported from both entries;
`splitting: true` restored.

---

## 2 — Give pagination one home `Strong` · ✅ landed 2026-10-02

**Files:** `CONTEXT.md` §Pagination · `stash@{0}` (`Page`, `Widget`, `Text`, `Table`, …) ·
HEAD fossils: `src/lib/Icon.ts` `renderAt`, `src/lib/utils/debug.ts` (0 call sites)

**Problem.** The roadmap's priority-1 feature exists as a glossary describing one design
(fragments + `widget.paginate` + `renderPageIndex/Shift/Clip` fields), a stash containing a
different design (`Placement` / `computePlacements` / `renderAt`, no fragments), and HEAD
fossils of the stash design — while HEAD itself has zero pagination code
(`grep paginate|WidgetFragment|breakable src/` → 0 matches). Every trace of "the Text
pagination contract" dead-ends three times.

**Decision — 2026-10-02.** Chosen after a four-way interface review (minimal contract /
flexible seam / common-case-first / pure tree transformation). Pagination is a **pure tree
transformation**: layout produces a flow tree; a pure `Paginator` transforms it into a
`PagePlan` forest; each plan is painted through a per-page `PageScope` — a `RenderContext`
decorator answering the queries widgets already ask. The render path (`render(context)` +
`getLayoutBox(this)`) is untouched: no `renderAt`, no fragments on widgets, no mutable
render-state fields.

- **`Paginator`** (internal, `src/lib/pagination/`): runs `prepareLayout`, lays out —
  pass 1 at the real page height (today's semantics; byte-identical when content fits),
  pass 2 at height auto only on overflow — then walks **computed geometry only**: no Yoga
  during the walk, no drawing, no pagination state on widgets.
- **`PageScope`** (one per output page): `getLayoutBox` (plan box →
  `backend.mapContentBox`), `getFlowOffset` (slice top, for self-slicing widgets),
  `getRenderChildren` (placed children only); everything else delegates to the backend.
  The Y-flip stays inside `PdfRenderContext`.
- **Break structure is data.** `Widget.getBreakUnits(): BreakUnit[] | null`; generic
  default: vertical-flow container → one unit per child; row-direction, absolute, or
  `breakable: false` → `null` (atomic). Only `Text` (lines) and `Table` (rows; head marked
  `repeat`) override — 2 of 15 widget classes. `repeat`/`keepWithNext` are data flags the
  engine honors generically; widows/orphans land later as the same kind of flag.
- **Web grow rule.** Free space is distributed only inside **definite** heights (CSS).
  Flow content is auto-height → grow no-ops there; page-filling furniture (footer pinned
  to the page bottom, full-height bands) belongs in the **page template**, laid out per
  page at the real page box. No pagination-specific grow logic anywhere.
- **Break policy.** Splittable fills the page then splits at a unit boundary; atomic moves
  whole to the next page; atomic taller than a full page is clipped (`plan.clipped`).
  Continuation pages inherit the originating Page widget's size and template; page
  numbering is doc-global across Page widgets.
- **`Page({ overflow: false })`** keeps the legacy single-page path byte-identical.

Superseded when this lands: the fragments glossary (mutable `renderPageIndex/Shift/Clip*`
fields) and the placement stash (`computePlacements` + `renderAt`, PDF math in `Page`) —
drop `stash@{0}` at implementation time. Unblocks IDEAS.md B2 (`getPageCount`) and I5
(`PdfRenderer`'s fate).

**Interface (implementation target).**

```ts
// ── src/lib/pagination/types.ts (internal — not in package.json exports) ──

export interface LayoutBox { x: number; y: number; width: number; height: number }

/** A breakable unit inside a widget's own box. Data only — never renders. */
export interface BreakUnit {
  /** Unit top relative to the widget's flow-box top (points, y down). */
  readonly offset: number;
  /** Unit height, including any trailing gap/margin that belongs to it. */
  readonly height: number;
  /** Child widget that renders this unit. Omit for self-painted units (text lines). */
  readonly widget?: Widget;
  /** Re-emit at the top of every continuation page (repeating table head). */
  readonly repeat?: boolean;
  /** Never break directly after this unit. */
  readonly keepWithNext?: boolean;
}

/** One widget occurrence on one output page: a vertical slice of its flow box. */
export interface Fragment {
  readonly widget: Widget;
  /** Box on this page — top-left origin, page-relative points. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where this slice starts inside the widget's own flow box (0 = whole widget). */
  readonly sliceTop: number;
  readonly continuation: boolean; // sliceTop > 0
  readonly repeated: boolean;     // re-emitted `repeat` unit (table head)
  /** Placed child fragments in paint order; PageScope serves them to renderChildren. */
  readonly children: Fragment[];
}

/** One output page: a window onto flow space. */
export interface PagePlan {
  /** 0-based within this Page widget's run; the driver adds the doc-global offset. */
  readonly index: number;
  readonly pageSize: [number, number];
  readonly roots: Fragment[];   // in-flow fragment trees, paint order
  readonly fixed: Fragment[];   // page-root FixedContainers, re-emitted on every page
  readonly clipped: boolean;    // an atomic unit taller than one page was cut
}

export interface Pagination {
  readonly pages: PagePlan[];
  readonly pageCount: number;   // === pages.length
}
```

```ts
// ── src/lib/pagination/Paginator.ts ──

export interface BreakRules {
  /** Re-emit `repeat` units on continuation pages. Default: true. */
  repeatTableHeaders?: boolean;
  // future policy knobs: widow/orphan minimums, …
}

export class Paginator {
  constructor(rules?: BreakRules);
  /**
   * Pure transformation: prepareLayout (async assets) → flow layout →
   * fragmentation walk. No drawing, no addPage, no pagination state on
   * widgets. Deterministic: same tree + context ⇒ same plan.
   */
  paginate(
    page: PageWidget,
    context: RenderContext,
    opts?: { firstPageIndex?: number },
  ): Promise<Pagination>;
}
```

```ts
// ── src/lib/pagination/PageScope.ts ──

/**
 * One output page's view of the backend. Implements RenderContext by answering
 * geometry from the page's plan and delegating everything else.
 */
export class PageScope implements RenderContext {
  constructor(backend: RenderContext, plan: PagePlan);
  getLayoutBox(w: Widget): LayoutBox;       // plan box → backend.mapContentBox; miss → backend
  getFlowOffset(w: Widget): number;         // fragment.sliceTop, else 0
  getRenderChildren(w: Widget): Widget[];   // placed children, else the widget's real children
  // every other member: delegate to backend
}
```

```ts
// ── RenderContextInterface.ts — three additions ──

/** Map a top-left-origin, page-relative box into the backend's coordinate system. */
mapContentBox(box: LayoutBox): LayoutBox;
// PdfRenderContext: the Y-flip, extracted from getLayoutBox;
// getLayoutBox(w) becomes mapContentBox(w.getAbsoluteLayoutBox())

/** How much of `widget`'s own content lies above the slice being rendered (flow points). */
getFlowOffset(widget: Widget): number;      // PdfRenderContext: return 0

/** Children to render for `widget` in the current scope; absent = its real children. */
getRenderChildren?(widget: Widget): Widget[];
```

```ts
// ── Widget.ts — the entire widget-side surface ──

export interface WidgetOptions {
  children?: Widget[];
  /** Keep-together: never split this widget's box. Default: undefined (structure decides). */
  breakable?: boolean;
}

export abstract class Widget {
  /**
   * Break opportunities inside this widget's box, box-relative and sorted.
   * null = atomic (move whole; clip if taller than a page). Default:
   * vertical-flow container → one unit per child (pitch includes gaps);
   * row-direction / absolute / breakable:false → null.
   */
  getBreakUnits(): BreakUnit[] | null;
}
```

```ts
// ── Text.ts — ~10 data lines + one render query (Link inherits both) ──

getBreakUnits(): BreakUnit[] | null {
  if (this.breakable === false) return null;
  const lh = this.getLineHeight();
  return this.layoutText(this.getWidth()).lines.map((_, i) => ({ offset: i * lh, height: lh }));
}

protected getRenderedTextLayout(context: RenderContext): RenderedTextLayout {
  const box = context.getLayoutBox(this);                    // sliced, page-mapped box
  const skip = Math.floor(context.getFlowOffset(this) / this.getLineHeight());
  const maxWidth = box.width > 0 ? box.width : this.getWidth();
  const block = this.layoutText(maxWidth);                   // full block; maxLines/ellipsis apply
  const visible = Math.floor(box.height / this.getLineHeight());
  const lines = block.lines.slice(skip, skip + visible);     // one code path, never per page
  return TextPainter.position(box, lines, maxWidth, { /* unchanged */ });
}
```

```ts
// ── Table.ts — one data method; render side untouched (pieces are real widgets) ──

getBreakUnits(): BreakUnit[] | null {
  const units: BreakUnit[] = [];
  const top = this.getAbsoluteLayoutBox().y;
  if (this.head) {
    units.push({ offset: 0, height: this.head.getHeight(), widget: this.head,
                 repeat: true, keepWithNext: true });        // never orphan a header
  }
  for (const row of this.body?.getRows() ?? []) {
    units.push({ offset: row.getAbsoluteLayoutBox().y - top,
                 height: row.getHeight(), widget: row });
  }
  return units.length > 0 ? units : null;
}
```

```ts
// ── Page.ts — the driver ──

export interface PageOptions {
  overflow?: boolean;       // default true; false = legacy single-page path
  template?: PageTemplate;
}

override async render(context: RenderContext): Promise<void> {
  const dimensions = this.getDimensions(context);
  if (this.overflow === false) return this.renderUnpaginated(context, dimensions);
  const pagination = await new Paginator().paginate(this, context);
  for (const plan of pagination.pages) {
    context.addPage(plan.pageSize);
    const scope = new PageScope(context, plan);
    for (const root of [...plan.fixed, ...plan.roots]) await root.widget.render(scope);
  }
}
```

```ts
// ── Page template (minimal v1 — headers/footers/page numbers) ──

export interface PageInfo {
  readonly pageIndex: number;   // doc-global, 0-based
  readonly pageCount: number;   // doc-global total
}

export interface PageTemplate {
  /** Flow space consumed on every page (a running header pushes content down). */
  inset?: { top?: number; bottom?: number; left?: number; right?: number };
  /**
   * Called once per output page after all runs are planned (pageCount known).
   * Chrome widgets are laid out at the real page box — definite height, so
   * grow works here. Painted before flow content.
   */
  chrome(info: PageInfo): Widget[];
}
```

```ts
// ── PdfDoc.ts ──

class PdfDoc {
  /**
   * Memoized dry run: paginate every Page widget, no drawing. Plans are pure,
   * so save() reuses them; doc-global numbering comes from summing runs before
   * rendering. No invalidation until a tree-mutation API exists.
   */
  async getPageCount(): Promise<number>;
}
```

**Rollout.** Land `src/lib/pagination/` + the three `RenderContext` additions → switch
`PageWidget.render` → golden tests over `Pagination` data (pure — no pdf-lib; injectable
`measureTextWidth`) → drop `stash@{0}` → `CONTEXT.md` §Pagination already describes the
model.

**Landed (2026-10-02).** Core is implemented and green (`tests/pagination.test.mjs`: 9
golden plan tests + one end-to-end page-count invariant). Deltas from the interface above,
all justified during implementation:

- `Pagination` carries `overflow: boolean` — false when the content fits, so the driver
  renders the legacy path (byte-identical) instead of routing through scopes.
- `Fragment` boxes are `box: LayoutBox` (one field) rather than loose x/y/width/height.
- `paginate(page, context)` takes no options — `firstPageIndex` arrives with the template
  layer (doc-global page numbers).
- Package-internal accessors back the walker: `Widget.getBreakUnits()` (generic default),
  `getFlowGeometry()`, `getParent()`, `getChildWidgets()`; `PageWidget.runFlowLayout()`,
  `getContentBox()`.
- `src/internals.ts` builds `dist/internals.js` — a test-only surface (Paginator/PageScope/
  plan types) shipped in dist but NOT in package.json `exports`, so consumers can't import
  it while tests assert plans without pdf-lib.
- `PdfRenderContext.preloadFont` no-ops without a document (dry-run measurement);
  `PdfDoc.getPageCount()` is exact after `save()`, estimated before, and trees with images
  need a created document (image embedding requires one).

Remaining from the rollout: drop `stash@{0}` (bookkeeping, destructive — owner's call);
template layer (`PageTemplate`) is the next increment, not part of #2's core.

---

## 3 ✅ Stand up the verification seam — landed (the `tests/` suite)

**Files:** `package.json` (test script) · `tsup.config.ts` · `tests/*.test.mjs`

**Problem (historical).** Nothing exercised the built output: `pnpm test` pointed at a
`tests/` directory that didn't exist, the playground called a nonexistent method, and until
`2638966` the build had silently reverted `splitting: true` (the setting that once shipped
a real `instanceof` bug). Several interfaces made the first tests harder than necessary:
style resolvers were private, `FontRegistry` is a singleton with no reset, `PdfDoc` hooks
are global statics.

**Landed.** Six suites run against `dist/` in `pnpm test`: pagination golden plans + e2e
page-count invariant, custom-font embedding, container-containment invariants, rich-run
wrapping/painting, markdown conversion, and the shared aspect-fit measure/placement math
(pins B1).

**Still open (from I3).** The pure-interface `TextLayoutEngine` unit tests (injectable
`measureTextWidth`, zero mocks), a `FontRegistry` reset/`forTests` hook for test isolation,
and snapshot-style PDF assertions (a P3 item).

---

## 4 ✅ Collapse the aspect-fit triplication `Strong` · landed 2026-10-07

**Files:** `src/lib/aspect-fit.ts` (new) · `src/lib/Icon.ts` · `src/lib/SVGPath.ts` · `src/lib/Image.ts`

**Landed as:** one `aspect-fit` module owning the shared Yoga measure function
(`aspectFitMeasure`, spec re-read per call so Image's late-embedding intrinsic
size fits in) and the fit/cover placement math (`aspectFitPlacement`, returning
drawn size + left/bottom/**top** edges in PDF coords — `top` is the drawSvgPath
origin because pdf-lib flips y, which fixes B1). `IconWidget` is now a thin
subclass of `SVGPathWidget` (registry + square default box + black fill
fallback); `SVGPath` fill/stroke widened to `ThemeColorValue` (hex strings still
work); `Image` centers its drawn area instead of anchoring bottom-left.
`ImageSizing` moved to the module (re-exported from `Image` for compat). Dead
`Icon.renderAt` dropped. Pinned by `tests/aspect-fit.test.mjs` (30 assertions,
via `internals.ts`).

---

## 5 ✅ Retire the string-keyed `setProperty` interpreter `Strong` · landed 2026-10-07

**Files:** `src/lib/Widget.ts` · call sites `src/lib/Icon.ts`, `src/lib/Image.ts`,
`src/lib/SVGPath.ts`, `src/lib/Container.ts`, `src/lib/FlexContainer.ts`,
`src/lib/FixedContainer.ts`, `src/lib/HLine.ts`, `src/lib/Page.ts`, `src/lib/Table.ts`,
`src/lib/markdown/types.ts`, `src/lib/markdown/styles.ts`

**Landed as:** `setYogaStyle(style: YogaStyle)` is the only styling entry — typed dispatch
(`applyStyle`) with one shared dimension parser (`setDimension`: number / percent / auto
for width, height, flexBasis; Yoga's min/max setters take percent natively so their type
widened to `YogaDimensionValue`). No context parameter, no string-keyed switch, no silent
unknown keys — typos fail at compile time. `drawAt`, FlexContainer's dead `drawWithOffset`,
and the `as any` casts are gone; option `width`/`height` types tightened to
`YogaStyleValue` across Container/FlexContainer/Image/MarkdownStyles.

**Adaptation:** the "drop the abstract `getWidth`/`getHeight` pair" half of this candidate
collided with reality — pagination gave them real callers (Table break units read
`head.getHeight()`/`row.getHeight()`; Text falls back to them for flow slicing). They are
now concrete base methods returning the post-layout computed size, so the widgets that
only implemented them to satisfy `abstract` (Container, FlexContainer, FixedContainer,
HLine, Page, SVGPath, Image, TableCell, plus the redundant `getWidth`s in Table) dropped
their overrides; Text and the Table family keep the overrides with real fallback logic.

---

## 6 — Extract the theme-resolution policy `Worth exploring`

**Files:** `src/lib/Container.ts` L58–81 · `src/lib/Text.ts` L82–128 · `src/lib/Table.ts`
L117–139, L211–224, L322–356 · `src/lib/HLine.ts` L41–43 · `src/lib/Icon.ts` L183–192 ·
`src/lib/Link.ts` L22–36

**Problem.** The same `override ?? theme ?? fallback` policy is re-implemented as private
methods in seven-plus places with ad-hoc fallback colors (`#000000` vs `#FFFFFF` vs
`#0000EE` chosen per widget). Precedence drifts and is verified by nothing — every resolver
is private, so testing it means instantiating widgets with a wired context.

**Direction.** Pure resolver functions returning plain style objects; widgets consume them
in `render`. Testable with no widget, no context, no Yoga.

**Wins.**
- locality: precedence policy in one module
- tests need no widget tree
- fallback colors stop drifting

---

## 7 — Un-glue `PdfDoc` `Worth exploring` · shrunk by #1

**Files:** `src/lib/PdfDoc.ts` (statics L103–146, IO L258–348)

**Problem.** Three modules under one name, each with a different lifetime: the document
model (per-instance), lifecycle hooks (process-global statics with a `clearHooks()` escape
hatch — the tell that isolation was already needed), and runtime IO (~60 lines of
browser/Node sniffing). Two documents in one process share hooks. The font façade part of
this candidate is already fixed (`2638966`).

**Direction.** Hooks become per-instance options (the constructor already accepts
`beforeCreate`/`afterSave` — the statics are a redundant second channel). IO becomes a small
standalone output module.

**Wins.**
- two docs in one process stop colliding
- document model interface shrinks
- IO becomes an explicit seam
