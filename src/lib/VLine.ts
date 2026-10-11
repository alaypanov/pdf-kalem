import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import { resolveThemeColor, type ThemeColorValue } from './Theme';
import { fromHex } from './utils/color-utils';
import { Widget, WidgetOptions, YogaStyleValue } from './Widget';

export interface VLineOptions extends WidgetOptions {
  color?: ThemeColorValue;
  thickness?: number;
  height?: YogaStyleValue;
}

export class VLineWidget extends Widget {
  private color?: ThemeColorValue;
  private thickness: number;

  constructor(options: VLineOptions = {}) {
    super(options);
    this.color = options.color ?? fromHex('#000000');
    this.thickness = Number.isFinite(options.thickness) && (options.thickness as number) > 0
      ? options.thickness as number
      : 1;

    this.setYogaStyle({
      width: this.thickness,
      height: options.height ?? '100%',
      alignSelf: 'stretch',
    });
  }

  private getColor(): RenderColor {
    return resolveThemeColor(this.context?.getTheme(), this.color) ?? fromHex('#000000');
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this);
    const lineX = x + width / 2;

    context.drawLine({
      start: { x: lineX, y },
      end: { x: lineX, y: y + height },
      thickness: this.thickness,
      color: this.getColor()
    });
  }
}

export function VLine(options: VLineOptions = {}): VLineWidget {
  return new VLineWidget(options);
}
