import { MeasureMode } from 'yoga-layout';
import { Widget, WidgetOptions, YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import { fromHex } from './utils/color-utils';
import { ImageSizing } from './Image';

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

  /** Fill color (maps to pdf-lib `color`). */
  fill?: string;

  /** Stroke color (maps to pdf-lib `borderColor`). */
  stroke?: string;

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
  private fill?: string;
  private stroke?: string;
  private strokeWidth?: number;

  private explicitWidth: boolean;
  private explicitHeight: boolean;
  private measureConfigured = false;

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
      this.setProperty(this.context as any, 'width', options.width);
    }
    if (options.height !== undefined) {
      this.setProperty(this.context as any, 'height', options.height);
    }

    // If consumer didn't explicitly size the widget, set intrinsic size for Yoga.
    const intrinsicW = this.viewBoxWidth * this.baseScale;
    const intrinsicH = this.viewBoxHeight * this.baseScale;

    if (!this.explicitWidth) {
      this.node.setWidth(intrinsicW);
    }
    if (!this.explicitHeight) {
      this.node.setHeight(intrinsicH);
    }

    this.configureMeasureFunc();
  }

  private configureMeasureFunc(): void {
    if (this.measureConfigured) return;

    const vbW = this.viewBoxWidth;
    const vbH = this.viewBoxHeight;

    this.node.setMeasureFunc((width, widthMode, height, heightMode) => {
      const widthConstrained =
        widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost;
      const heightConstrained =
        heightMode === MeasureMode.Exactly || heightMode === MeasureMode.AtMost;

      const intrinsicW = vbW * this.baseScale;
      const intrinsicH = vbH * this.baseScale;

      if (this.sizing === ImageSizing.None || (!widthConstrained && !heightConstrained)) {
        return { width: intrinsicW, height: intrinsicH };
      }

      const aspect = vbW / vbH;

      let targetW = intrinsicW;
      let targetH = intrinsicH;

      if (widthConstrained && heightConstrained) {
        const scale = this.sizing === ImageSizing.Cover
          ? Math.max(width / intrinsicW, height / intrinsicH)
          : Math.min(width / intrinsicW, height / intrinsicH);
        targetW = intrinsicW * scale;
        targetH = intrinsicH * scale;
      } else if (widthConstrained) {
        targetW = width;
        targetH = width / aspect;
      } else if (heightConstrained) {
        targetH = height;
        targetW = height * aspect;
      }

      return { width: targetW, height: targetH };
    });

    this.measureConfigured = true;
  }

  getWidth(): number {
    return this.viewBoxWidth * this.baseScale;
  }

  getHeight(): number {
    return this.viewBoxHeight * this.baseScale;
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this);

    const boxW = width > 0 ? width : this.getWidth();
    const boxH = height > 0 ? height : this.getHeight();

    const vbW = this.viewBoxWidth;
    const vbH = this.viewBoxHeight;

    let scale = this.baseScale;

    if (this.sizing !== ImageSizing.None) {
      if (boxW > 0 && boxH > 0) {
        const fitScale = this.sizing === ImageSizing.Cover
          ? Math.max(boxW / (vbW * this.baseScale), boxH / (vbH * this.baseScale))
          : Math.min(boxW / (vbW * this.baseScale), boxH / (vbH * this.baseScale));
        scale = this.baseScale * fitScale;
      } else if (boxW > 0) {
        scale = this.baseScale * (boxW / (vbW * this.baseScale));
      } else if (boxH > 0) {
        scale = this.baseScale * (boxH / (vbH * this.baseScale));
      }
    }

    const drawnW = vbW * scale;
    const drawnH = vbH * scale;

    const offsetX = boxW > 0 ? (boxW - drawnW) / 2 : 0;
    const offsetY = boxH > 0 ? (boxH - drawnH) / 2 : 0;

    const borderWidth =
      this.strokeWidth !== undefined && Number.isFinite(this.strokeWidth)
        ? this.strokeWidth * scale
        : undefined;

    context.drawSvgPath({
      d: this.d,
      x: x + offsetX,
      y: y + offsetY,
      scale,
      color: this.fill ? fromHex(this.fill) : undefined,
      borderColor: this.stroke ? fromHex(this.stroke) : undefined,
      borderWidth,
    });
  }
}

export function SVGPath(d: string, options: Omit<SVGPathOptions, 'd'>): SVGPathWidget {
  return new SVGPathWidget({ ...options, d });
}
