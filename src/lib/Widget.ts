import { RenderContext } from './RenderContext';
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
}

export type YogaStyleValue = number | 'auto' | `${number}%`;

export interface YogaStyle {
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;

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

  constructor(options: WidgetOptions = {}) {
    this.children = options.children || [];
    this.node = Yoga.Node.create();

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
   */
  calculateLayout(width: number, height: number, direction: Direction = Direction.LTR): void {
    this.node.calculateLayout(width, height, direction);
  }

  protected setYogaStyle(style: YogaStyle): void {
    for (const [key, value] of Object.entries(style)) {
      this.setProperty(this.context as RenderContext, key, value);
    }
  }

  abstract render(context: RenderContext): Promise<void>;

  protected async renderChildren(context: RenderContext): Promise<void> {
    for (const child of this.children) {
      await child.render(context);
    }
  }

  abstract getWidth(): number;

  abstract getHeight(): number;

  async drawAt(_context: RenderContext, _x: number, _y: number): Promise<void> {
  }

  setProperty(_context: RenderContext, key: string, value: any): void {
    if (value === undefined || value === null) return;

    const setDim = (setter: (v: number) => void, setterPct: (v: number) => void, setterAuto: () => void, v: YogaStyleValue) => {
      if (v === 'auto') {
        setterAuto();
        return;
      }
      if (typeof v === 'string' && v.endsWith('%')) {
        const pct = Number(v.slice(0, -1));
        if (!Number.isFinite(pct)) return;
        setterPct(pct);
        return;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        setter(v);
      }
    };

    switch (key) {
      case 'width':
        setDim(this.node.setWidth.bind(this.node), this.node.setWidthPercent.bind(this.node), this.node.setWidthAuto.bind(this.node), value);
        return;
      case 'height':
        setDim(this.node.setHeight.bind(this.node), this.node.setHeightPercent.bind(this.node), this.node.setHeightAuto.bind(this.node), value);
        return;
      case 'minWidth':
        this.node.setMinWidth(value);
        return;
      case 'minHeight':
        this.node.setMinHeight(value);
        return;
      case 'maxWidth':
        this.node.setMaxWidth(value);
        return;
      case 'maxHeight':
        this.node.setMaxHeight(value);
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
        this.node.setJustifyContent(map[value] ?? Justify.FlexStart);
        return;
      }
      case 'alignItems': {
        const map: Record<string, Align> = {
          'flex-start': Align.FlexStart,
          center: Align.Center,
          'flex-end': Align.FlexEnd,
          stretch: Align.Stretch,
        };
        this.node.setAlignItems(map[value] ?? Align.FlexStart);
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
        this.node.setAlignSelf(map[value] ?? Align.Auto);
        return;
      }

      case 'flexGrow':
        this.node.setFlexGrow(value);
        return;
      case 'flexShrink':
        this.node.setFlexShrink(value);
        return;
      case 'flexBasis':
        setDim(this.node.setFlexBasis.bind(this.node), this.node.setFlexBasisPercent.bind(this.node), this.node.setFlexBasisAuto.bind(this.node), value);
        return;

      case 'gap': {
        // Yoga supports row/column gaps via Gutter.
        if (typeof value === 'string' && value.endsWith('%')) {
          const pct = Number(value.slice(0, -1));
          if (!Number.isFinite(pct)) return;
          (this.node as any).setGapPercent?.(Gutter.All, pct);
          return;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          (this.node as any).setGap?.(Gutter.All, value);
        }
        return;
      }

      case 'padding':
        this.node.setPadding(Edge.All, value);
        return;
      case 'paddingTop':
        this.node.setPadding(Edge.Top, value);
        return;
      case 'paddingRight':
        this.node.setPadding(Edge.Right, value);
        return;
      case 'paddingBottom':
        this.node.setPadding(Edge.Bottom, value);
        return;
      case 'paddingLeft':
        this.node.setPadding(Edge.Left, value);
        return;

      case 'margin':
        this.node.setMargin(Edge.All, value);
        return;
      case 'marginTop':
        this.node.setMargin(Edge.Top, value);
        return;
      case 'marginRight':
        this.node.setMargin(Edge.Right, value);
        return;
      case 'marginBottom':
        this.node.setMargin(Edge.Bottom, value);
        return;
      case 'marginLeft':
        this.node.setMargin(Edge.Left, value);
        return;

      case 'position':
        this.node.setPositionType(value === 'absolute' ? PositionType.Absolute : PositionType.Relative);
        return;
      case 'top':
        this.node.setPosition(Edge.Top, value);
        return;
      case 'right':
        this.node.setPosition(Edge.Right, value);
        return;
      case 'bottom':
        this.node.setPosition(Edge.Bottom, value);
        return;
      case 'left':
        this.node.setPosition(Edge.Left, value);
        return;
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

  protected getLayoutBoxInPdfCoords(context: RenderContext): { x: number; y: number; width: number; height: number } {
    const { x, y } = this.getAbsoluteTopLeft();
    console.log(`Widget absolute top-left in Yoga coords: (${x}, ${y})`);
    const width = this.node.getComputedWidth();
    const height = this.node.getComputedHeight();

    // Yoga is top-left origin with +y downward. pdf-lib is bottom-left origin with +y upward.
    const pageHeight = context.getPageHeight();
    const pdfY = pageHeight - y - height;
    console.log('height=', height, 'pageHeight=', pageHeight);

    return { x, y: pdfY, width, height };
  }
}