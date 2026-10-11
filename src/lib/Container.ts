import { type ThemeColorValue } from './Theme';
import { resolveColor } from './theme-resolve';
import { resolveSpacingEdges, type Spacing } from './utils/spacing';
import { Widget, WidgetOptions, type YogaStyle } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import { fromHex } from './utils/color-utils';
import { Edge } from 'yoga-layout';

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
  width?: YogaStyle['width'];
  height?: YogaStyle['height'];
  /** Inner spacing. A number for all sides, or per-side (I11). */
  padding?: Spacing;
  border?: BorderOptions;
  child?: Widget; // Accept single child for convenience
  /**
   * Per-key override of the Container's built-in Yoga style — the same
   * escape hatch FlexContainer has (I11). Applied after the defaults.
   */
  style?: YogaStyle;
}

export class ContainerWidget extends Widget {
  private bgColor?: ThemeColorValue;
  private border?: BorderOptions;
  private padding?: Spacing;

  constructor(options: ContainerOptions) {
    // If a single child is provided, add it to the children array
    const children = options.children || [];
    if (options.child) {
      children.push(options.child);
    }
    super({ ...options, children });
    this.border = options.border;
    this.bgColor = options.bgColor;
    this.padding = options.padding;

    // Size to content unless told otherwise — a fixed default box silently
    // overflows (or pads) whenever content differs from the default.
    // No alignSelf hardcode (I11): the container respects its parent's
    // alignItems like any other box; shrink-wrap explicitly via style.
    // Padding is applied in prepareLayout (per-side + theme fallback).
    this.setYogaStyle({
      width: options.width ?? 'auto',
      height: options.height ?? 'auto',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      ...options.style,
    });
  }

  private getThemeContainerStyle() {
    return this.context?.getTheme()?.container;
  }

  private getResolvedPaddingEdges(): { top: number; right: number; bottom: number; left: number } {
    return resolveSpacingEdges(this.padding, this.getThemeContainerStyle()?.padding ?? 0);
  }

  private getResolvedBackgroundColor(): RenderColor {
    return resolveColor(this.context?.getTheme(), this.bgColor, this.getThemeContainerStyle()?.bgColor, fromHex('#FFFFFF'));
  }

  private getResolvedBorder(): { width?: number; color?: RenderColor; radius?: number } | undefined {
    const themeBorder = this.getThemeContainerStyle();
    const width = this.border?.width ?? themeBorder?.borderWidth;
    const color = resolveColor(this.context?.getTheme(), this.border?.color, themeBorder?.borderColor);
    const radius = this.border?.radius ?? themeBorder?.borderRadius;

    if (width === undefined && color === undefined && radius === undefined) {
      return undefined;
    }

    return { width, color, radius };
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    const padding = this.getResolvedPaddingEdges();
    this.node.setPadding(Edge.Top, padding.top);
    this.node.setPadding(Edge.Right, padding.right);
    this.node.setPadding(Edge.Bottom, padding.bottom);
    this.node.setPadding(Edge.Left, padding.left);
    await super.prepareLayout(context);
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this);

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
