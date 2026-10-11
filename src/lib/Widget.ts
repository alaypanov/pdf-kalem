import type { RenderContext } from './RenderContextInterface';
import type { BreakUnit } from './pagination/types';
import { applyYogaStyle, type YogaStyle } from './yoga-style';
import Yoga, {
  Direction,
  FlexDirection,
  Node,
  PositionType,
} from 'yoga-layout';

export type { YogaStyle, YogaStyleValue, YogaDimensionValue } from './yoga-style';

export interface WidgetOptions {
  children?: Widget[];
  /**
   * Keep-together opt-out: never split this widget's box across pages; move
   * it whole to the next page (clip if it is taller than a full page).
   * Default: undefined — breakability is decided by structure.
   */
  breakable?: boolean;
position?: 'relative' | 'absolute';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export abstract class Widget {
  protected children: Widget[];
  protected node: Node;
  protected context?: RenderContext;
  protected parent?: Widget;
  protected readonly breakableOption: boolean | undefined;

  constructor(options: WidgetOptions = {}) {
    this.children = options.children || [];
    this.node = Yoga.Node.create();
    this.breakableOption = options.breakable;

    // Add child nodes to this node and wire parent pointers
    for (const child of this.children) {
      child.parent = this;
      this.node.insertChild(child.node, this.node.getChildCount());
    }
  }

  setContext(context: RenderContext): void {
    this.context = context;
    // Propagate context to children
    for (const child of this.children) {
      child.setContext(context);
    }
  }

  /**
   * Optional async hook to load assets / set intrinsic sizes before Yoga layout.
   * Default implementation recurses into children.
   */
  async prepareLayout(context: RenderContext): Promise<void> {
    for (const child of this.children) {
      await child.prepareLayout(context);
    }
  }

  /**
   * Runs Yoga layout for this subtree (typically called once at the Page root).
   * `undefined` dimensions mean auto/intrinsic sizing (the pagination flow pass).
   */
  calculateLayout(width?: number, height?: number, direction: Direction = Direction.LTR): void {
    this.node.calculateLayout(width, height, direction);
  }

  /**
   * The single styling entry — a thin delegation to the Yoga style
   * interpreter (src/lib/yoga-style.ts), which owns the dispatch and the
   * dimension parsing. Subclasses keep this ergonomic protected form.
   */
  protected setYogaStyle(style: YogaStyle): void {
    applyYogaStyle(this.node, style);
  }

  /**
   * Post-layout computed size (0 before layout). Widgets with meaningful
   * intrinsics override — Text (measured lines), Table (row sums), and their
   * pagination callers rely on that.
   */
  getWidth(): number {
    return this.node.getComputedWidth();
  }

  getHeight(): number {
    return this.node.getComputedHeight();
  }

  abstract render(context: RenderContext): Promise<void>;

  protected async renderChildren(context: RenderContext): Promise<void> {
    const placed = context.getRenderChildren?.(this);
    for (const child of placed ?? this.children) {
      await child.render(context);
    }
  }

  protected getAbsoluteTopLeft(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    let current: Widget | undefined = this;
    while (current) {
      x += current.node.getComputedLeft();
      y += current.node.getComputedTop();
      current = current.parent;
    }
    return { x, y };
  }

  getAbsoluteLayoutBox(): { x: number; y: number; width: number; height: number } {
    const { x, y } = this.getAbsoluteTopLeft();
    const width = this.node.getComputedWidth();
    const height = this.node.getComputedHeight();

    return { x, y, width, height };
  }

  // --- Package-internal accessors (used by the pagination module) ---

  getParent(): Widget | undefined {
    return this.parent;
  }

  getChildWidgets(): Widget[] {
    return this.children;
  }

  /**
   * @internal — package-internal: position this widget's node absolutely
   * within its parent (Stack aligns its non-positioned children this way).
   */
  positionAbsolute(): void {
    this.node.setPositionType(PositionType.Absolute);
  }

  /** @internal — package-internal: append a child after construction (edit module overlays). */
  appendWidgetChild(widget: Widget): void {
    widget.parent = this;
    this.children.push(widget);
    this.node.insertChild(widget.node, this.node.getChildCount());
  }

  /** Flow geometry from the last Yoga layout (positions are parent-border-box-relative). */
  getFlowGeometry(): {
    top: number;
    left: number;
    width: number;
    height: number;
    absolute: boolean;
  } {
    return {
      top: this.node.getComputedTop(),
      left: this.node.getComputedLeft(),
      width: this.node.getComputedWidth(),
      height: this.node.getComputedHeight(),
      absolute: this.node.getPositionType() === PositionType.Absolute,
    };
  }

  /**
   * Position edges this widget declared for absolute positioning, when it
   * anchors itself to the page box (e.g. FixedContainer). The pagination
   * walker uses them to re-anchor page-root fixed widgets against the real
   * page dimensions — the flow pass resolves `bottom`/`right` against the
   * auto-height flow canvas, which is not the page box. Default: undefined
   * (edges unknown — the flow-computed box is used as-is).
   */
  getPositionEdges(): { top?: number; bottom?: number; left?: number; right?: number } | undefined {
    return undefined;
  }

  /**
   * Break opportunities inside this widget's box, box-relative and sorted by
   * offset. null = atomic (move whole; clip if taller than a page).
   *
   * Default: a column-direction box breaks between its children (one unit
   * per child; offsets are Yoga computed tops, which include this box's
   * padding, so inter-child gaps ride on the offsets). Row-direction,
   * absolute-positioned, childless, and `breakable: false` widgets are
   * atomic. Only widgets whose content splits internally (Text, Table) need
   * to override.
   */
  getBreakUnits(): BreakUnit[] | null {
    if (this.breakableOption === false) return null;
    if (this.children.length === 0) return null;
    if (this.node.getFlexDirection() !== FlexDirection.Column) return null;

    const units: BreakUnit[] = [];
    for (const child of this.children) {
      const geometry = child.getFlowGeometry();
      if (geometry.absolute) continue;
      units.push({ offset: geometry.top, height: geometry.height, widget: child });
    }
    return units.length > 0 ? units : null;
  }
}