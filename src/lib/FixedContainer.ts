import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
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
  private bgColor?: RenderColor;

  constructor(options: FixedContainerOptions) {
    super(options);
    this.top = options.top;
    this.bottom = options.bottom;
    this.left = options.left;
    this.right = options.right;
    this.bgColor = options.bgColor;

    // Yoga absolute positioning. Set directly on the node — the context is
    // not wired up until setContext() runs (after the whole tree is built).
    this.node.setPositionType(PositionType.Absolute);
    if (this.top !== undefined) this.node.setPosition(Edge.Top, this.top);
    if (this.right !== undefined) this.node.setPosition(Edge.Right, this.right);
    if (this.bottom !== undefined) this.node.setPosition(Edge.Bottom, this.bottom);
    if (this.left !== undefined) this.node.setPosition(Edge.Left, this.left);
    if (options.width !== undefined) this.setYogaStyle({ width: options.width });
    if (options.height !== undefined) this.setYogaStyle({ height: options.height });
  }

  override getPositionEdges(): { top?: number; bottom?: number; left?: number; right?: number } {
    return { top: this.top, bottom: this.bottom, left: this.left, right: this.right };
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this);

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
