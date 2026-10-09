import type { Widget } from '../Widget';

/** A box in top-left-origin, page-relative points (y grows down). */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A breakable unit inside a widget's own box. Data only — never renders.
 *
 * Offsets are relative to the widget's flow-box (border-box) top; for
 * container children that is Yoga's computed top, which includes the
 * container's padding, so gaps between children are carried by the offsets.
 */
export interface BreakUnit {
  /** Unit top relative to the widget's flow-box top (points, y down). */
  readonly offset: number;
  /** Unit height. */
  readonly height: number;
  /** Child widget that renders this unit. Omit for self-painted units (text lines). */
  readonly widget?: Widget;
  /** Re-emit at the top of every continuation page (repeating table head). */
  readonly repeat?: boolean;
  /** Never break directly after this unit. */
  readonly keepWithNext?: boolean;
}

/**
 * One widget occurrence on one output page: a vertical slice of its flow box.
 *
 * Descendants of a whole-placed widget are not expanded into fragments — the
 * scope translates their flow boxes by the placed ancestor's delta.
 */
export interface Fragment {
  readonly widget: Widget;
  /** Box on this page — top-left origin, page-relative points. */
  readonly box: LayoutBox;
  /** Where this slice starts inside the widget's own flow box (0 = whole widget). */
  readonly sliceTop: number;
  /** True when sliceTop > 0 (the widget continues from the previous page). */
  readonly continuation: boolean;
  /** True when this fragment is a re-emitted `repeat` unit (table head). */
  readonly repeated: boolean;
  /** Placed child fragments in paint order; PageScope serves them to renderChildren. */
  readonly children: Fragment[];
}

/** One output page: a window onto flow space. */
export interface PagePlan {
  /** 0-based within this Page widget's run. */
  readonly index: number;
  readonly pageSize: [number, number];
  /** In-flow fragment trees, in paint order. */
  readonly roots: Fragment[];
  /** Page-root fixed (absolute) widgets — re-emitted on every page. */
  readonly fixed: Fragment[];
  /** An atomic unit taller than one page was clipped. */
  readonly clipped: boolean;
}

export interface Pagination {
  readonly pages: PagePlan[];
  readonly pageCount: number;
  /**
   * False when the content fits one page: `pages` is empty and the driver
   * renders through the legacy path (byte-identical to pre-pagination
   * behavior) with the pass-1 geometry still on the nodes.
   */
  readonly overflow: boolean;
}