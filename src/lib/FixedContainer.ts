import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import { RenderContext, type RenderColor } from './RenderContext';
import { Edge, PositionType } from 'yoga-layout';

interface FixedContainerOptions extends WidgetOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  bgColor?: RenderColor;
}

export class FixedContainerWidget extends Widget {
  private top?: number;
  private bottom?: number;
  private left?: number;
  private right?: number;
  private width?: YogaStyleValue;
  private height?: YogaStyleValue;
  private bgColor?: RenderColor;

  constructor(options: FixedContainerOptions) {
    super(options);
    this.top = options.top;
    this.bottom = options.bottom;
    this.left = options.left;
    this.right = options.right;
    this.width = options.width;
    this.height = options.height;
    this.bgColor = options.bgColor;

    // Yoga absolute positioning. Set directly on the node — the context is
    // not wired up until setContext() runs (after the whole tree is built),
    // so we must not route these through setProperty(context, ...).
    this.node.setPositionType(PositionType.Absolute);
    if (this.top !== undefined) this.node.setPosition(Edge.Top, this.top);
    if (this.right !== undefined) this.node.setPosition(Edge.Right, this.right);
    if (this.bottom !== undefined) this.node.setPosition(Edge.Bottom, this.bottom);
    if (this.left !== undefined) this.node.setPosition(Edge.Left, this.left);
    if (this.width !== undefined) this.setYogaStyle({ width: this.width });
    if (this.height !== undefined) this.setYogaStyle({ height: this.height });
  }

  getWidth(): number {
    return typeof this.width === 'number' ? this.width : 0;
  }

  getHeight(): number {
    return typeof this.height === 'number' ? this.height : 0;
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBoxInPdfCoords(this);

    if (this.bgColor) {
      context.drawRectangle({
        x,
        y,
        width,
        height,
        color: this.bgColor,
      });
    }

    await this.renderChildren(context);
  }
}

export function FixedContainer(options: FixedContainerOptions): FixedContainerWidget {
  return new FixedContainerWidget(options);
}
