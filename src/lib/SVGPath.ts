import { Widget, WidgetOptions, YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import {
  ImageSizing,
  aspectFitMeasure,
  aspectFitPlacement,
  type FitSpec,
} from './aspect-fit';
import { resolveThemeColor, type ThemeColorValue } from './Theme';
import type { ColorValue } from './utils/color-utils';

export interface SVGPathOptions extends WidgetOptions {
  d: string;

  /**
   * Size of the path coordinate system (like an SVG viewBox).
   * Used to compute scaling when the widget is constrained by Yoga.
   */
  viewBoxWidth: number;
  viewBoxHeight: number;

  /** Optional Yoga sizing overrides. Defaults to the intrinsic viewBox size. */
  width?: YogaStyleValue;
  height?: YogaStyleValue;

  /** Additional multiplier applied on top of fit/cover scaling. Defaults to 1. */
  scale?: number;

  /** How to scale into the layout box when both width/height are constrained. */
  sizing?: ImageSizing;

  /** Fill color — hex string or theme token. */
  fill?: ThemeColorValue;

  /** Stroke color — hex string or theme token. */
  stroke?: ThemeColorValue;

  /**
   * Stroke width in SVG/user units (viewBox units). It will be multiplied by the final scale.
   * (This matches typical SVG semantics where stroke scales with the shape.)
   */
  strokeWidth?: number;
}

export class SVGPathWidget extends Widget {
  private d: string;
  private viewBoxWidth: number;
  private viewBoxHeight: number;
  private baseScale: number;
  private sizing: ImageSizing;
  private fill?: ThemeColorValue;
  private stroke?: ThemeColorValue;
  private strokeWidth?: number;

  private explicitWidth: boolean;
  private explicitHeight: boolean;

  constructor(options: SVGPathOptions) {
    super(options);

    this.d = options.d;
    this.viewBoxWidth = options.viewBoxWidth;
    this.viewBoxHeight = options.viewBoxHeight;
    this.baseScale = options.scale ?? 1;
    this.sizing = options.sizing ?? ImageSizing.Fit;
    this.fill = options.fill;
    this.stroke = options.stroke;
    this.strokeWidth = options.strokeWidth;

    this.explicitWidth = options.width !== undefined;
    this.explicitHeight = options.height !== undefined;

    if (!Number.isFinite(this.viewBoxWidth) || this.viewBoxWidth <= 0) {
      throw new Error('SVGPath: viewBoxWidth must be a positive number');
    }
    if (!Number.isFinite(this.viewBoxHeight) || this.viewBoxHeight <= 0) {
      throw new Error('SVGPath: viewBoxHeight must be a positive number');
    }
    if (!Number.isFinite(this.baseScale) || this.baseScale <= 0) {
      throw new Error('SVGPath: scale must be a positive number');
    }

    if (options.width !== undefined) {
      this.setYogaStyle({ width: options.width });
    }
    if (options.height !== undefined) {
      this.setYogaStyle({ height: options.height });
    }

    // If consumer didn't explicitly size the widget, set intrinsic size for Yoga.
    if (!this.explicitWidth) {
      this.node.setWidth(this.intrinsicWidth);
    }
    if (!this.explicitHeight) {
      this.node.setHeight(this.intrinsicHeight);
    }

    this.node.setMeasureFunc(aspectFitMeasure(() => this.spec()));
  }

  private get intrinsicWidth(): number {
    return this.viewBoxWidth * this.baseScale;
  }

  private get intrinsicHeight(): number {
    return this.viewBoxHeight * this.baseScale;
  }

  private spec(): FitSpec {
    return {
      intrinsicWidth: this.viewBoxWidth,
      intrinsicHeight: this.viewBoxHeight,
      baseScale: this.baseScale,
      sizing: this.sizing,
    };
  }

  protected resolveFillColor(): ColorValue | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.fill);
  }

  protected resolveStrokeColor(): ColorValue | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.stroke);
  }

  async render(context: RenderContext): Promise<void> {
    const box = context.getLayoutBox(this);
    const placement = aspectFitPlacement(this.spec(), box);

    context.drawSvgPath({
      d: this.d,
      x: placement.left,
      y: placement.top,
      scale: placement.scale,
      color: this.resolveFillColor(),
      borderColor: this.resolveStrokeColor(),
      borderWidth:
        this.strokeWidth !== undefined && Number.isFinite(this.strokeWidth)
          ? this.strokeWidth * placement.scale
          : undefined,
    });
  }
}

export function SVGPath(d: string, options: Omit<SVGPathOptions, 'd'>): SVGPathWidget {
  return new SVGPathWidget({ ...options, d });
}