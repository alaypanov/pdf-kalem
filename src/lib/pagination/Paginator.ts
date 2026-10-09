import type { PageWidget } from '../Page';
import type { RenderContext } from '../RenderContextInterface';
import type { Widget } from '../Widget';
import type { BreakUnit, Fragment, LayoutBox, PagePlan, Pagination } from './types';

const EPS = 0.001;

export interface BreakRules {
  /** Re-emit `repeat` units on continuation pages. Default: true. */
  repeatTableHeaders?: boolean;
}

/** Internal per-page accumulation state (fragment builders). */
interface FragmentBuilder {
  widget: Widget;
  box: LayoutBox;
  sliceTop: number;
  repeated: boolean;
  children: FragmentBuilder[];
}

interface PageAcc {
  index: number;
  pageSize: [number, number];
  roots: FragmentBuilder[];
  clipped: boolean;
  /** True once flow content (not counting re-emitted repeats) landed here. */
  hasFlowContent: boolean;
}

/**
 * One splitting widget's state on the current page. `origin` is the
 * page-relative y where the widget's flow offset 0 (its border-box top)
 * lands on THIS page — negative when a continuation slice starts above the
 * page's content top. Every placement derives from it:
 * `pageY(unit) = origin + unit.offset`.
 */
interface Frame {
  widget: Widget;
  origin: number;
  x: number;
  width: number;
  flowHeight: number;
  /** Flow-space page-relative y of the widget's border-box top. */
  absY: number;
  frag: FragmentBuilder | null;
  units: BreakUnit[] | null;
  isPageRoot: boolean;
}

/**
 * The pagination transformation: flow tree → `PagePlan` forest.
 *
 * Pure with respect to rendering — no drawing, no `addPage`, no pagination
 * state on widgets. Deterministic: same tree + context ⇒ same plan.
 *
 * Pass 1 lays out at the real page height; when the content fits, the result
 * is `overflow: false` and the driver renders through the legacy path with
 * the pass-1 geometry still on the nodes. Only on overflow does pass 2
 * (height auto) feed the fragmentation walk, which reads computed geometry
 * only — Yoga never runs during the walk.
 *
 * Break policy: splittable fills the page then splits at a unit boundary;
 * atomic moves whole to the next page; atomic taller than a full page is
 * clipped. `repeat` units re-emit atop every continuation page;
 * `keepWithNext` units never strand at a page bottom.
 */
export class Paginator {
  private readonly repeatEnabled: boolean;
  private unitsCache = new WeakMap<Widget, BreakUnit[] | null>();

  private pagesAcc: PageAcc[] = [];
  private current!: PageAcc;
  private content!: LayoutBox;
  private pageSize: [number, number] = [0, 0];

  constructor(rules: BreakRules = {}) {
    this.repeatEnabled = rules.repeatTableHeaders ?? true;
  }

  async paginate(page: PageWidget, context: RenderContext): Promise<Pagination> {
    this.unitsCache = new WeakMap();
    this.pagesAcc = [];
    await page.prepareLayout(context);

    const dimensions = page.getDimensions(context);
    this.pageSize = dimensions;

    // Pass 1: real page height (today's semantics — grow works, fitting
    // documents render byte-identically through the legacy path).
    page.runFlowLayout(dimensions[0], dimensions[1]);
    this.content = page.getContentBox(dimensions);
    const contentBottom = this.content.y + this.content.height;

    if (this.flowExtent(page) <= contentBottom + EPS) {
      return { pages: [], pageCount: 1, overflow: false };
    }

    // Pass 2: natural flow layout (height auto) — the fragmentation input.
    page.runFlowLayout(dimensions[0], undefined);

    this.current = {
      index: 0,
      pageSize: dimensions,
      roots: [],
      clipped: false,
      hasFlowContent: false,
    };

    const pageFrame: Frame = {
      widget: page,
      origin: 0,
      x: 0,
      width: dimensions[0],
      flowHeight: dimensions[1],
      absY: 0,
      frag: null,
      units: null,
      isPageRoot: true,
    };

    const fixedWidgets: Widget[] = [];
    const flowUnits: BreakUnit[] = [];
    for (const child of page.getChildWidgets()) {
      const geometry = child.getFlowGeometry();
      if (geometry.absolute) {
        fixedWidgets.push(child);
        continue;
      }
      flowUnits.push({ offset: geometry.top, height: geometry.height, widget: child });
    }

    this.placeUnits(pageFrame, flowUnits, [pageFrame]);
    this.closePage([pageFrame]);

    const fixed = fixedWidgets.map((widget) => this.fixedFragment(widget));
    const pages = this.pagesAcc.map((acc) => this.freezePage(acc, fixed));

    return { pages, pageCount: pages.length, overflow: true };
  }

  /** Page-relative flow extent of the page's in-flow children (pass-1 geometry). */
  private flowExtent(page: PageWidget): number {
    let extent = 0;
    for (const child of page.getChildWidgets()) {
      const geometry = child.getFlowGeometry();
      if (geometry.absolute) continue;
      extent = Math.max(extent, geometry.top + geometry.height);
    }
    return extent;
  }

  private placeUnits(frame: Frame, units: BreakUnit[], chain: Frame[]): void {
    const contentBottom = this.content.y + this.content.height;

    let i = 0;
    while (i < units.length) {
      const u = units[i];
      const uPageY = frame.origin + u.offset;
      const uBottom = uPageY + u.height;

      if (uBottom <= contentBottom + EPS) {
        // keep-with-next: don't strand u at a page bottom when the
        // successor's first chunk would not fit after it.
        if (u.keepWithNext && i + 1 < units.length && this.current.hasFlowContent) {
          const next = units[i + 1];
          const needed = next.offset - u.offset + this.firstChunkHeight(next);
          const pairFitsFreshPage = needed <= this.content.height + EPS;
          if (pairFitsFreshPage && uBottom + needed - u.height > contentBottom + EPS) {
            this.breakPage(chain, frame, u.offset);
            continue;
          }
        }
        this.placeWholeUnit(frame, u, uPageY, chain);
        i++;
        continue;
      }

      // Doesn't fit. A splittable child may still partially fit.
      if (u.widget) {
        const childUnits = this.unitsOf(u.widget);
        if (childUnits && childUnits.length > 0) {
          const abs = u.widget.getAbsoluteLayoutBox();
          const childFrame: Frame = {
            widget: u.widget,
            origin: uPageY,
            x: abs.x,
            width: abs.width,
            flowHeight: u.height,
            absY: abs.y,
            frag: null,
            units: childUnits,
            isPageRoot: false,
          };
          this.placeUnits(childFrame, childUnits, [...chain, childFrame]);
          i++;
          continue;
        }
      }

      if (this.current.hasFlowContent) {
        this.breakPage(chain, frame, u.offset);
        continue;
      }
      // Alone at the top of an empty page: place clipped.
      this.placeWholeUnit(frame, u, uPageY, chain, true);
      i++;
    }

    // Frame completed: finalize its fragment at the widget's true end
    // (clipped to the content box).
    if (frame.frag) {
      const bottom = Math.min(frame.origin + frame.flowHeight, contentBottom);
      frame.frag.box.height = Math.max(0, bottom - frame.frag.box.y);
    }
  }

  private placeWholeUnit(
    frame: Frame,
    u: BreakUnit,
    uPageY: number,
    chain: Frame[],
    clipped = false,
  ): void {
    const contentBottom = this.content.y + this.content.height;
    if (u.widget) {
      const abs = u.widget.getAbsoluteLayoutBox();
      const frag: FragmentBuilder = {
        widget: u.widget,
        box: {
          x: abs.x,
          y: uPageY,
          width: abs.width,
          // Clipped when the unit alone exceeds a full page.
          height: Math.max(0, Math.min(u.height, contentBottom - uPageY)),
        },
        sliceTop: 0,
        repeated: false,
        children: [],
      };
      this.attach(frag, frame, chain);
    } else {
      // Self-painted unit (text line): the frame's own fragment carries the
      // slice — ensure it exists (its box derives from origin + flowHeight).
      // Page-level units always have widgets, so this never runs for the
      // page root frame.
      this.ensureFrameFrag(frame, chain);
    }
    if (clipped) this.current.clipped = true;
    this.current.hasFlowContent = true;
  }

  private attach(frag: FragmentBuilder, frame: Frame, chain: Frame[]): void {
    if (frame.isPageRoot) {
      this.current.roots.push(frag);
      return;
    }
    this.ensureFrameFrag(frame, chain).children.push(frag);
  }

  /**
   * The frame's fragment on the current page, created lazily so a frame with
   * no content on a page emits no node. The box derives from the frame's
   * origin and flow height, clipped to the content box:
   * `[max(origin, contentTop), min(origin + flowHeight, contentBottom)]`.
   */
  private ensureFrameFrag(frame: Frame, chain: Frame[]): FragmentBuilder {
    if (frame.frag) return frame.frag;

    const contentTop = this.content.y;
    const contentBottom = this.content.y + this.content.height;
    const top = Math.max(frame.origin, contentTop);
    const bottom = Math.min(frame.origin + frame.flowHeight, contentBottom);
    const frag: FragmentBuilder = {
      widget: frame.widget,
      box: {
        x: frame.x,
        y: top,
        width: frame.width,
        height: Math.max(0, bottom - top),
      },
      sliceTop: Math.max(0, contentTop - frame.origin),
      repeated: false,
      children: [],
    };
    frame.frag = frag;

    const idx = chain.indexOf(frame);
    const parentFrame = idx > 0 ? chain[idx - 1] : null;
    if (parentFrame && !parentFrame.isPageRoot) {
      this.ensureFrameFrag(parentFrame, chain).children.push(frag);
    } else {
      this.current.roots.push(frag);
    }
    return frag;
  }

  /**
   * Closes the current page mid-flow: finalizes in-progress fragments
   * (clipped to the content box), pushes the page, opens the next one,
   * re-emits the deepest frame's `repeat` units at the top, and re-anchors
   * every open frame's origin for the continuation.
   */
  private breakPage(chain: Frame[], deepest: Frame, resumeOffset: number): void {
    const contentBottom = this.content.y + this.content.height;

    for (const f of chain) {
      if (f.frag) {
        f.frag.box.height = Math.max(0, contentBottom - f.frag.box.y);
      }
    }
    this.pagesAcc.push(this.current);

    this.current = {
      index: this.current.index + 1,
      pageSize: this.current.pageSize,
      roots: [],
      clipped: false,
      hasFlowContent: false,
    };
    for (const f of chain) f.frag = null;

    // Re-emit repeat units (e.g. a table head) at the top of the new page.
    // They do not count as flow content: a unit that cannot fit below them
    // takes the clip path instead of breaking again (loop guard).
    let repeatExtent = 0;
    if (this.repeatEnabled && deepest.units && !deepest.isPageRoot) {
      let repeatBase: number | null = null;
      for (const u of deepest.units) {
        if (!u.repeat || u.offset >= resumeOffset - EPS) continue;
        if (!u.widget) continue;
        if (repeatBase === null) repeatBase = u.offset;
        const abs = u.widget.getAbsoluteLayoutBox();
        const frag: FragmentBuilder = {
          widget: u.widget,
          box: {
            x: abs.x,
            y: this.content.y + (u.offset - repeatBase),
            width: abs.width,
            height: u.height,
          },
          sliceTop: 0,
          repeated: true,
          children: [],
        };
        this.ensureFrameFrag(deepest, chain).children.push(frag);
        repeatExtent = u.offset + u.height - repeatBase;
      }
    }

    // Re-anchor: the deepest frame's flow offset `resumeOffset` lands at
    // contentTop + repeatExtent; ancestors translate by their flow distance
    // to the deepest widget.
    deepest.origin = this.content.y + repeatExtent - resumeOffset;
    const deepestIdx = chain.indexOf(deepest);
    for (let idx = deepestIdx - 1; idx >= 0; idx--) {
      const f = chain[idx];
      const deeper = chain[idx + 1];
      f.origin = deeper.origin - (deeper.absY - f.absY);
    }
  }

  private closePage(chain: Frame[]): void {
    const contentBottom = this.content.y + this.content.height;
    for (const f of chain) {
      if (f.frag) {
        f.frag.box.height = Math.max(0, contentBottom - f.frag.box.y);
      }
    }
    this.pagesAcc.push(this.current);
  }

  private unitsOf(widget: Widget): BreakUnit[] | null {
    const cached = this.unitsCache.get(widget);
    if (cached !== undefined) return cached;
    const units = widget.getBreakUnits();
    this.unitsCache.set(widget, units);
    return units;
  }

  /** Height of the successor's first piece, for keep-with-next checks. */
  private firstChunkHeight(u: BreakUnit): number {
    if (u.widget) {
      const units = this.unitsOf(u.widget);
      if (units && units.length > 0) return units[0].height;
    }
    return u.height;
  }

  private fixedFragment(widget: Widget): Fragment {
    const abs = widget.getAbsoluteLayoutBox();
    let { x, y, width, height } = abs;

    // Re-anchor page furniture against the real page box: the flow pass
    // resolves `bottom`/`right` (and top+bottom/left+right stretches) against
    // the auto-height flow canvas, which is not the page.
    const edges = widget.getPositionEdges();
    if (edges) {
      const [pageW, pageH] = this.pageSize;
      if (edges.top !== undefined && edges.bottom !== undefined) {
        y = edges.top;
        height = Math.max(0, pageH - edges.top - edges.bottom);
      } else if (edges.top === undefined && edges.bottom !== undefined) {
        y = Math.max(0, pageH - edges.bottom - height);
      }
      if (edges.left !== undefined && edges.right !== undefined) {
        x = edges.left;
        width = Math.max(0, pageW - edges.left - edges.right);
      } else if (edges.left === undefined && edges.right !== undefined) {
        x = Math.max(0, pageW - edges.right - width);
      }
    }

    return {
      widget,
      box: { x, y, width, height },
      sliceTop: 0,
      continuation: false,
      repeated: false,
      children: [],
    };
  }

  private freezePage(acc: PageAcc, fixed: Fragment[]): PagePlan {
    const freeze = (b: FragmentBuilder): Fragment => ({
      widget: b.widget,
      box: b.box,
      sliceTop: b.sliceTop,
      continuation: b.sliceTop > EPS,
      repeated: b.repeated,
      children: b.children.map(freeze),
    });
    return {
      index: acc.index,
      pageSize: acc.pageSize,
      roots: acc.roots.map(freeze),
      fixed,
      clipped: acc.clipped,
    };
  }
}