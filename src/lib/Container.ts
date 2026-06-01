import { resolveThemeColor, type ThemeColorValue } from './Theme';
import { Widget, WidgetOptions } from './Widget';
import { RenderContext, type RenderColor } from './RenderContext';
import { fromHex } from './utils/color-utils';

interface BorderOptions {
  width?: number;
  color?: ThemeColorValue;
  radius?: number;
}

const borderDefaults: BorderOptions = {
  width: 1,
  color: '',
  radius: 0,
};

interface ContainerOptions extends WidgetOptions {
  bgColor?: ThemeColorValue;
  width?: number | string;
  height?: number | string;
  padding?: number;
  border?: BorderOptions;
  child?: Widget; // Accept single child for convenience
}

export class ContainerWidget extends Widget {
  private bgColor?: ThemeColorValue;
  private width: number | string;
  private height: number | string;
  private border?: BorderOptions;
  private padding?: number;

  constructor(options: ContainerOptions) {
    // If a single child is provided, add it to children array
    const children = options.children || [];
    if (options.child) {
      children.push(options.child);
    }
    super({ ...options, children });
    this.border = options.border;
    this.bgColor = options.bgColor;
    this.width = options.width || 100; // Default width
    this.height = options.height || 100; // Default height
    this.padding = options.padding;

    this.setYogaStyle({
      width: this.width as any,
      height: this.height as any,
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      alignSelf: 'flex-start',
      padding: options.padding ?? 0,
    });
  }

  private getThemeContainerStyle() {
    return this.context?.getTheme()?.container;
  }

  private getResolvedPadding(): number {
    return this.padding ?? this.getThemeContainerStyle()?.padding ?? 0;
  }

  private getResolvedBackgroundColor(): RenderColor {
    return resolveThemeColor(this.context?.getTheme(), this.bgColor ?? this.getThemeContainerStyle()?.bgColor) ?? fromHex('#FFFFFF');
  }

  private getResolvedBorder(): { width?: number; color?: RenderColor; radius?: number } | undefined {
    const themeBorder = this.getThemeContainerStyle();
    const width = this.border?.width ?? themeBorder?.borderWidth;
    const color = resolveThemeColor(this.context?.getTheme(), this.border?.color ?? themeBorder?.borderColor);
    const radius = this.border?.radius ?? themeBorder?.borderRadius;

    if (width === undefined && color === undefined && radius === undefined) {
      return undefined;
    }

    return { width, color, radius };
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    const resolvedPadding = this.getResolvedPadding();
    this.node.setPadding(0, resolvedPadding);
    this.node.setPadding(1, resolvedPadding);
    this.node.setPadding(2, resolvedPadding);
    this.node.setPadding(3, resolvedPadding);
    await super.prepareLayout(context);
  }

  getWidth(): number {
    return typeof this.width === 'number' ? this.width : 0;
  }

  getHeight(): number {
    return typeof this.height === 'number' ? this.height : 0;
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBoxInPdfCoords(this);

    // Draw background
    context.drawRectangle({
      x,
      y,
      width,
      height,
      color: this.getResolvedBackgroundColor(),
    });

    // Draw border if specified
    const border = this.getResolvedBorder();
    if (border) {
      const borderWidth = border.width || borderDefaults.width;
      const borderColor = border.color ?? fromHex('#000000');
      context.drawRectangle({
        x,
        y,
        width,
        height,
        borderWidth,
        borderColor,
        color: undefined, // No fill, just border
      });
    }

    // Render all children (now always uses children array)
    await this.renderChildren(context);
  }
}

export function Container(options: ContainerOptions): ContainerWidget {
  return new ContainerWidget(options);
}