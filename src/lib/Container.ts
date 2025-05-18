import { Widget, WidgetOptions } from './Widget';
import { rgb, Color } from 'pdf-lib';
import { RenderContext } from './RenderContext';
import { convertToPDFColor } from './utils/color-utils';

interface BorderOptions {
  width?: number;
  color?: string;
  radius?: number;
}

const borderDefaults: BorderOptions = {
  width: 1,
  color: '',
  radius: 0,
};

interface ContainerOptions extends WidgetOptions {
  bgColor?: string;
  width?: number | string;
  height?: number | string;
  padding?: number;
  border?: BorderOptions;
  child?: Widget; // Accept single child for convenience
}

export class ContainerWidget extends Widget {
  private bgColor: Color;
  private width: number | string;
  private height: number | string;
  private border?: BorderOptions;
  private padding: number = 0; // Default padding

  constructor(options: ContainerOptions) {
    // If a single child is provided, add it to children array
    const children = options.children || [];
    if (options.child) {
      children.push(options.child);
    }
    super({ ...options, children });
    this.border = options.border;
    this.bgColor = convertToPDFColor(options.bgColor) || rgb(1, 0, 1); // Default color
    this.width = options.width || 100; // Default width
    this.height = options.height || 100; // Default height
    this.node.style.width = this.width;
    this.node.style.height = this.height;
    this.node.style.flexDirection = 'column';
    this.node.style.alignItems = 'flex-start';
    this.node.style.alignSelf = 'flex-start';
    this.node.style.justifyContent = 'flex-start';
    this.node.style.padding = this.padding || 0;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  async render(context: RenderContext): Promise<void> {
    const page = context.getCurrentPage();
    const x = this.node.computed.x;
    const y = this.node.computed.flippedY || 0;
    const width = this.node.computed.width;
    const height = this.node.computed.height;

    // Draw background
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: this.bgColor,
    });

    // Draw border if specified
    if (this.border) {
      const borderWidth = this.border.width || borderDefaults.width;
      const borderColor = this.border.color || borderDefaults.color;
      const borderRadius = this.border.radius || borderDefaults.radius;
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderWidth,
        borderColor: convertToPDFColor(borderColor),
        color: undefined, // No fill, just border
      });
    }

    console.log(
      `[ContainerWidget] computed.x=${x}, computed.y=${y}, width=${this.node.computed.width}, height=${this.node.computed.height}`
    );

    // Render all children (now always uses children array)
    await this.renderChildren(context);
  }
}

export function Container(options: ContainerOptions): ContainerWidget {
  return new ContainerWidget(options);
}