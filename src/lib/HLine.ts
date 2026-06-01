import { RenderContext, type RenderColor } from './RenderContext';
import { resolveThemeColor, type ThemeColorValue } from './Theme';
import { fromHex } from './utils/color-utils';
import { Widget, WidgetOptions, YogaStyleValue } from './Widget';

export interface HLineOptions extends WidgetOptions {
  color?: ThemeColorValue;
  thickness?: number;
  width?: YogaStyleValue;
}

export class HLineWidget extends Widget {
  private color?: ThemeColorValue;
  private thickness: number;
  private width: YogaStyleValue;

  constructor(options: HLineOptions = {}) {
    super(options);
    this.color = options.color ?? fromHex('#000000');
    this.thickness = Number.isFinite(options.thickness) && (options.thickness as number) > 0
      ? options.thickness as number
      : 1;
    this.width = options.width ?? '100%';

    this.setYogaStyle({
      width: this.width,
      height: this.thickness,
      alignSelf: 'stretch',
    });
  }

  getWidth(): number {
    const computedWidth = this.node.getComputedWidth();
    return computedWidth > 0 ? computedWidth : typeof this.width === 'number' ? this.width : 0;
  }

  getHeight(): number {
    return this.thickness;
  }

  private getColor(): RenderColor {
    return resolveThemeColor(this.context?.getTheme(), this.color) ?? fromHex('#000000');
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBoxInPdfCoords(this);
    const lineY = y + height / 2;

    context.drawLine({
      start: { x, y: lineY },
      end: { x: x + width, y: lineY },
      thickness: this.thickness,
      color: this.getColor()
    });
  }
}

export function HLine(options: HLineOptions = {}): HLineWidget {
  return new HLineWidget(options);
}