import type { RenderContext } from './RenderContextInterface';
import type { BreakUnit } from './pagination/types';
import Yoga, {
  Align,
  Direction,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Node,
  PositionType,
} from 'yoga-layout';

export interface WidgetOptions {
  children?: Widget[];
  /**
   * Keep-together opt-out: never split this widget's box across pages; move
   * it whole to the next page (clip if it is taller than a full page).
   * Default: undefined — breakability is decided by structure.
   */
  breakable?: boolean;
}

export type YogaStyleValue = number | 'auto' | `${number}%`;

/** Dimension value for min/max constraints — Yoga rejects 'auto' there. */
export type YogaDimensionValue = number | `${number}%`;

export interface YogaStyle {
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  minWidth?: YogaDimensionValue;
  minHeight?: YogaDimensionValue;
  maxWidth?: YogaDimensionValue;
  maxHeight?: YogaDimensionValue;

  flexDirection?: 'row' | 'column';
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';

  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: YogaStyleValue;

  gap?: number | `${number}%`;

  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;

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
   * The single styling entry: typed dispatch on `YogaStyle` keys. Unknown
   * keys are a compile error at typed call sites (no silent no-ops);
   * undefined/null values are skipped.
   */
  protected setYogaStyle(style: YogaStyle): void {
    for (const key of Object.keys(style) as (keyof YogaStyle)[]) {
      const value = style[key];
      if (value === undefined || value === null) continue;
      this.applyStyle(key, value);
    }
  }

  private applyStyle(key: keyof YogaStyle, value: YogaStyle[keyof YogaStyle]): void {
    switch (key) {
      case 'width':
        this.setDimension(
          value as YogaStyleValue,
          (v) => this.node.setWidth(v),
          (v) => this.node.setWidthPercent(v),
          () => this.node.setWidthAuto(),
        );
        return;
      case 'height':
        this.setDimension(
          value as YogaStyleValue,
          (v) => this.node.setHeight(v),
          (v) => this.node.setHeightPercent(v),
          () => this.node.setHeightAuto(),
        );
        return;
      case 'flexBasis':
        this.setDimension(
          value as YogaStyleValue,
          (v) => this.node.setFlexBasis(v),
          (v) => this.node.setFlexBasisPercent(v),
          () => this.node.setFlexBasisAuto(),
        );
        return;

      // Yoga's min/max setters accept numbers and percent strings natively.
      case 'minWidth':
        this.node.setMinWidth(value as YogaDimensionValue);
        return;
      case 'minHeight':
        this.node.setMinHeight(value as YogaDimensionValue);
        return;
      case 'maxWidth':
        this.node.setMaxWidth(value as YogaDimensionValue);
        return;
      case 'maxHeight':
        this.node.setMaxHeight(value as YogaDimensionValue);
        return;

      case 'flexDirection':
        this.node.setFlexDirection(value === 'row' ? FlexDirection.Row : FlexDirection.Column);
        return;
      case 'justifyContent': {
        const map: Record<string, Justify> = {
          'flex-start': Justify.FlexStart,
          center: Justify.Center,
          'flex-end': Justify.FlexEnd,
          'space-between': Justify.SpaceBetween,
          'space-around': Justify.SpaceAround,
          'space-evenly': Justify.SpaceEvenly,
        };
        this.node.setJustifyContent(map[value as string] ?? Justify.FlexStart);
        return;
      }
      case 'alignItems': {
        const map: Record<string, Align> = {
          'flex-start': Align.FlexStart,
          center: Align.Center,
          'flex-end': Align.FlexEnd,
          stretch: Align.Stretch,
        };
        this.node.setAlignItems(map[value as string] ?? Align.FlexStart);
        return;
      }
      case 'alignSelf': {
        const map: Record<string, Align> = {
          auto: Align.Auto,
          'flex-start': Align.FlexStart,
          center: Align.Center,
          'flex-end': Align.FlexEnd,
          stretch: Align.Stretch,
        };
        this.node.setAlignSelf(map[value as string] ?? Align.Auto);
        return;
      }

      case 'flexGrow':
        this.node.setFlexGrow(value as number);
        return;
      case 'flexShrink':
        this.node.setFlexShrink(value as number);
        return;

      case 'gap': {
        if (typeof value === 'string' && value.endsWith('%')) {
          const pct = Number(value.slice(0, -1));
          if (Number.isFinite(pct)) {
            (this.node as any).setGapPercent?.(Gutter.All, pct);
          }
          return;
        }
        this.node.setGap(Gutter.All, value as number);
        return;
      }

      case 'padding':
        this.node.setPadding(Edge.All, value as number);
        return;
      case 'paddingTop':
        this.node.setPadding(Edge.Top, value as number);
        return;
      case 'paddingRight':
        this.node.setPadding(Edge.Right, value as number);
        return;
      case 'paddingBottom':
        this.node.setPadding(Edge.Bottom, value as number);
        return;
      case 'paddingLeft':
        this.node.setPadding(Edge.Left, value as number);
        return;

      case 'margin':
        this.node.setMargin(Edge.All, value as number);
        return;
      case 'marginTop':
        this.node.setMargin(Edge.Top, value as number);
        return;
      case 'marginRight':
        this.node.setMargin(Edge.Right, value as number);
        return;
      case 'marginBottom':
        this.node.setMargin(Edge.Bottom, value as number);
        return;
      case 'marginLeft':
        this.node.setMargin(Edge.Left, value as number);
        return;

      case 'position':
        this.node.setPositionType(value === 'absolute' ? PositionType.Absolute : PositionType.Relative);
        return;
      case 'top':
        this.node.setPosition(Edge.Top, value as number);
        return;
      case 'right':
        this.node.setPosition(Edge.Right, value as number);
        return;
      case 'bottom':
        this.node.setPosition(Edge.Bottom, value as number);
        return;
      case 'left':
        this.node.setPosition(Edge.Left, value as number);
        return;
    }
  }

  /**
   * The one shared dimension parser: `number` | `` `${number}%` `` | 'auto'
   * routed to the matching Yoga setter. Percent/auto only apply where the
   * caller passed a setter for them.
   */
  private setDimension(
    value: YogaStyleValue,
    set: (v: number) => void,
    setPercent?: (v: number) => void,
    setAuto?: () => void,
  ): void {
    if (value === 'auto') {
      setAuto?.();
      return;
    }
    if (typeof value === 'string' && value.endsWith('%')) {
      const pct = Number(value.slice(0, -1));
      if (Number.isFinite(pct) && setPercent) {
        setPercent(pct);
      }
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      set(value);
    }
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