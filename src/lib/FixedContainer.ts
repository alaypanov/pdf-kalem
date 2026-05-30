import { Widget, WidgetOptions } from './Widget';
import { RenderContext, type RenderColor } from './RenderContext';
import { PositionType } from 'yoga-layout';

interface FixedContainerOptions extends WidgetOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
  bgColor?: RenderColor;
}

export class FixedContainerWidget extends Widget {
  private top?: number;
  private bottom?: number;
  private left?: number;
  private right?: number;
  private width?: number;
  private height?: number;
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

    // Yoga absolute positioning
    this.node.setPositionType(PositionType.Absolute);
    if (this.top !== undefined) this.setProperty(this.context as any, 'top', this.top);
    if (this.right !== undefined) this.setProperty(this.context as any, 'right', this.right);
    if (this.bottom !== undefined) this.setProperty(this.context as any, 'bottom', this.bottom);
    if (this.left !== undefined) this.setProperty(this.context as any, 'left', this.left);
    if (this.width !== undefined) this.setProperty(this.context as any, 'width', this.width);
    if (this.height !== undefined) this.setProperty(this.context as any, 'height', this.height);
  }

  getWidth(): number {
    return this.width || 0;
  }

  getHeight(): number {
    return this.height || 0;
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = this.getLayoutBoxInPdfCoords(context);

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
