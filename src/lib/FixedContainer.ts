import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import { rgb, Color } from 'pdf-lib';
import { convertToPDFColor } from './utils/color-utils';

interface FixedContainerOptions extends WidgetOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
  bgColor?: string;
}

export class FixedContainerWidget extends Widget {
  private top?: number;
  private bottom?: number;
  private left?: number;
  private right?: number;
  private width?: number;
  private height?: number;
  private bgColor: Color;

  constructor(options: FixedContainerOptions) {
    super(options);
    this.top = options.top;
    this.bottom = options.bottom;
    this.left = options.left;
    this.right = options.right;
    this.width = options.width;
    this.height = options.height;
    this.bgColor = convertToPDFColor(options.bgColor) || rgb(1, 1, 1); // Default white
  }

  getWidth(): number {
    return this.width || 0;
  }

  getHeight(): number {
    return this.height || 0;
  }

  async render(context: RenderContext): Promise<void> {
    const page = context.getCurrentPage();
    const [pageWidth, pageHeight] = context.getDimensions()
    // const pageHeight = page.getHeight();

    // Compute width and height if not set
    let width = this.width;
    let height = this.height;
    if (width === undefined) {
      if (this.left !== undefined && this.right !== undefined) {
        width = pageWidth - this.left - this.right;
      }
    }
    if (height === undefined) {
      if (this.top !== undefined && this.bottom !== undefined) {
        height = pageHeight - this.top - this.bottom;
      }
    }
    width = width ?? 0;
    height = height ?? 0;

    // Compute x and y (PDF coordinate system: y=0 is bottom)
    let x = 0;
    let y = 0;
    if (this.left !== undefined) {
      x = this.left;
    } else if (this.right !== undefined && width) {
      x = pageWidth - this.right - width;
    }
    if (this.bottom !== undefined) {
      y = this.bottom;
    } else if (this.top !== undefined && height) {
      y = pageHeight - this.top - height;
    }

    // Set computed position for layout/render
    this.node.computed.x = x;
    this.node.computed.y = y;
    this.node.computed.width = width;
    this.node.computed.height = height;

    // Draw background rectangle if bgColor is set (optional)
    if (this.bgColor) {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: this.bgColor,
      });
    }

    // Render children at offset (x, y)
    for (const child of this.children) {
      child.node.computed.x = x;
      child.node.computed.y = y;
      child.node.computed.width = child.getWidth();
      child.node.computed.height = child.getHeight();
      await child.render(context);
    }
  }
}

export function FixedContainer(options: FixedContainerOptions): FixedContainerWidget {
  return new FixedContainerWidget(options);
}
