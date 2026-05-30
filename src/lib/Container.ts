import { Widget, WidgetOptions } from './Widget';
import { RenderContext, type RenderColor } from './RenderContext';
import { fromHex } from './utils/color-utils';

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
  bgColor?: RenderColor;
  width?: number | string;
  height?: number | string;
  padding?: number;
  border?: BorderOptions;
  child?: Widget; // Accept single child for convenience
}

export class ContainerWidget extends Widget {
  private bgColor: RenderColor;
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
    this.bgColor = options.bgColor || fromHex('#FFFFFF');
    this.width = options.width || 100; // Default width
    this.height = options.height || 100; // Default height
    this.padding = options.padding ?? 0;

    console.log('container options', options);

    this.setYogaStyle({
      width: this.width as any,
      height: this.height as any,
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      alignSelf: 'flex-start',
      padding: this.padding,
    });
  }

  getWidth(): number {
    return typeof this.width === 'number' ? this.width : 0;
  }

  getHeight(): number {
    return typeof this.height === 'number' ? this.height : 0;
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = this.getLayoutBoxInPdfCoords(context);

    // Draw background
    context.drawRectangle({
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
      context.drawRectangle({
        x,
        y,
        width,
        height,
        borderWidth,
        borderColor: fromHex(borderColor),
        color: undefined, // No fill, just border
      });
    }

    console.log(
      `[ContainerWidget] x=${x}, y=${y}, width=${width}, height=${height}`
    );

    // Render all children (now always uses children array)
    await this.renderChildren(context);
  }
}

export function Container(options: ContainerOptions): ContainerWidget {
  return new ContainerWidget(options);
}