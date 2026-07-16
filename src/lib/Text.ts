import { MeasureMode } from 'yoga-layout';
import { resolveThemeColor, resolveThemeFont, resolveThemeTextStyle, type ThemeColorValue } from './Theme';
import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import type { RenderColor } from './RenderContext';
import { resolveBuiltinCanvasFont, resolveBuiltinPdfFont } from './types/doc-fonts';
import { fromHex } from './utils/color-utils';
import {
  TextLayoutEngine,
  type TextLayoutResult,
  type TextOverflow,
  type TextLayoutConfig,
} from './TextLayoutEngine';
import { TextPainter, type RenderedTextLayout } from './TextPainter';
import type { PrepareOptions } from '@chenglou/pretext';

export type { TextOverflow } from './TextLayoutEngine';

export interface TextOptions extends WidgetOptions {
  size?: number;
  color?: ThemeColorValue;
  align?: 'left' | 'center' | 'right';
  font?: string;
  lineHeight?: number;
  maxLines?: number;
  overflow?: TextOverflow;
  whiteSpace?: PrepareOptions['whiteSpace'];
  wordBreak?: PrepareOptions['wordBreak'];
  variant?: string;
}

export class TextWidget extends Widget {
  private readonly text: string;
  private readonly sizeOverride?: number;
  private readonly colorOverride?: ThemeColorValue;
  private readonly alignOverride?: 'left' | 'center' | 'right';
  private readonly fontNameOverride?: string;
  private readonly lineHeightOverride?: number;
  private readonly maxLines?: number;
  private readonly overflow: TextOverflow;
  private readonly whiteSpace: PrepareOptions['whiteSpace'];
  private readonly wordBreak: PrepareOptions['wordBreak'];
  private readonly variant?: string;
  private measureConfigured = false;
  private engine?: TextLayoutEngine;

  constructor(text: string, options: TextOptions) {
    super(options);
    this.text = text;
    this.sizeOverride = options.size;
    this.colorOverride = options.color;
    this.alignOverride = options.align;
    this.fontNameOverride = options.font;
    this.lineHeightOverride = options.lineHeight;
    this.maxLines = options.maxLines;
    this.overflow = options.overflow ?? 'visible';
    this.whiteSpace = options.whiteSpace ?? 'normal';
    this.wordBreak = options.wordBreak ?? 'normal';
    this.variant = options.variant;
  }

  protected getThemeVariantNames(): string[] {
    return ['body', this.variant ?? ''];
  }

  protected getVariantName(): string | undefined {
    return this.variant;
  }

  protected getThemeTextStyle() {
    return resolveThemeTextStyle(this.context?.getTheme(), this.getThemeVariantNames());
  }

  protected getFallbackColor(): RenderColor {
    return fromHex('#000000');
  }

  protected getFallbackLineHeightMultiplier(): number {
    return 1.15;
  }

  protected getSize(): number {
    return this.sizeOverride ?? this.getThemeTextStyle()?.size ?? 12;
  }

  protected getColor(): RenderColor {
    return resolveThemeColor(this.context?.getTheme(), this.colorOverride ?? this.getThemeTextStyle()?.color) ?? this.getFallbackColor();
  }

  protected getAlign(): 'left' | 'center' | 'right' {
    return this.alignOverride ?? this.getThemeTextStyle()?.align ?? 'left';
  }

  protected getLineHeight(): number {
    const resolvedLineHeight = this.lineHeightOverride ?? this.getThemeTextStyle()?.lineHeight;
    if (resolvedLineHeight !== undefined) {
      return resolvedLineHeight;
    }

    if (this.context) {
      return this.context.measureDefaultLineHeight(this.getSize(), this.getFontName());
    }

    return this.getSize() * this.getFallbackLineHeightMultiplier();
  }

  protected getFontName(): string {
    return resolveBuiltinPdfFont(
      resolveThemeFont(this.context?.getTheme(), this.fontNameOverride ?? this.getThemeTextStyle()?.font)
    ) ?? 'Helvetica';
  }

  protected getFontAscent(): number {
    if (this.context) {
      return this.context.measureFontAscent(this.getSize(), this.getFontName());
    }

    return this.getSize();
  }

  protected getCanvasFont(): string {
    const fontFamily = resolveBuiltinCanvasFont(
      resolveThemeFont(this.context?.getTheme(), this.fontNameOverride ?? this.getThemeTextStyle()?.font)
    ) ?? this.getFontName();
    const escapedFamily = fontFamily.replace(/"/g, '\\"');
    const quotedFamily = /\s|,/.test(fontFamily) ? `"${escapedFamily}"` : escapedFamily;
    return `${this.getSize()}px ${quotedFamily}`;
  }

  /**
   * Builds (and caches) the pure {@link TextLayoutEngine} for this widget's
   * resolved theme/style. The engine is rebuilt only when the context is
   * first available; once built it captures concrete values so callers don't
   * need to re-resolve theme tokens per layout pass.
   */
  private getEngine(): TextLayoutEngine {
    if (this.engine) {
      return this.engine;
    }

    const context = this.context;
    const size = this.getSize();
    const fontName = this.getFontName();

    const config: TextLayoutConfig = {
      text: this.text,
      size,
      lineHeight: this.getLineHeight(),
      align: this.getAlign(),
      ascent: this.getFontAscent(),
      whiteSpace: this.whiteSpace,
      wordBreak: this.wordBreak,
      maxLines: this.maxLines,
      overflow: this.overflow,
      measureTextWidth: (text: string) =>
        context
          ? context.measureTextWidth(text, size, fontName)
          : text.length * size * 0.6,
    };

    this.engine = new TextLayoutEngine(config);
    return this.engine;
  }

  protected getNaturalWidth(): number {
    return this.getEngine().getNaturalWidth(this.getCanvasFont());
  }

  protected getHeightLineLimit(height: number): number | undefined {
    return this.getEngine().getHeightLineLimit(height);
  }

  protected layoutText(maxWidth: number, heightLineLimit?: number): TextLayoutResult {
    return this.getEngine().layoutText(maxWidth, heightLineLimit, this.getCanvasFont());
  }

  protected getRenderedTextLayout(context: RenderContext): RenderedTextLayout {
    const box = context.getLayoutBoxInPdfCoords(this);
    const maxWidth = box.width > 0 ? box.width : this.getWidth();
    const heightLineLimit = this.getHeightLineLimit(box.height);
    const layout = this.layoutText(maxWidth, heightLineLimit);

    return TextPainter.position(box, layout.lines, maxWidth, {
      lineHeight: this.getLineHeight(),
      ascent: this.getFontAscent(),
      align: this.getAlign(),
    });
  }

  protected async drawRenderedTextLayout(
    context: RenderContext,
    renderedLayout: RenderedTextLayout,
    options?: { underline?: boolean; underlineColor?: RenderColor },
  ): Promise<void> {
    await TextPainter.paint(context, renderedLayout, {
      size: this.getSize(),
      color: this.getColor(),
      fontName: this.getFontName(),
      underline: options?.underline,
      underlineColor: options?.underlineColor,
    });
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    await context.preloadFont(this.getFontName());

    if (typeof document !== 'undefined' && 'fonts' in document) {
      await document.fonts.load(this.getCanvasFont(), this.text);
    }

    // Prime the engine + pretext cache.
    this.getEngine().ensurePreparedText(this.getCanvasFont());

    if (!this.measureConfigured) {
      this.node.setMeasureFunc((width, widthMode, height, heightMode) => {
        const maxWidth =
          widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost
            ? width
            : this.getNaturalWidth();

        const heightLineLimit =
          heightMode === MeasureMode.Exactly || heightMode === MeasureMode.AtMost
            ? this.getHeightLineLimit(height)
            : undefined;

        const layout = this.layoutText(Math.max(0, maxWidth), heightLineLimit);
        const measuredHeight = layout.lines.length * this.getLineHeight();

        const measuredWidth =
          widthMode === MeasureMode.Exactly
            ? Math.max(0, width)
            : layout.maxLineWidth;

        return { width: measuredWidth, height: measuredHeight };
      });
      this.measureConfigured = true;
    }

    await super.prepareLayout(context);
  }

  async render(context: RenderContext): Promise<void> {
    await this.drawRenderedTextLayout(context, this.getRenderedTextLayout(context));
  }

  getWidth(): number {
    const w = this.node.getComputedWidth();
    return w > 0 ? w : this.getNaturalWidth();
  }

  getHeight(): number {
    const computedW = this.node.getComputedWidth();
    const maxWidth = computedW > 0 ? computedW : this.getWidth();
    return this.layoutText(maxWidth).lines.length * this.getLineHeight();
  }
}

export function Text(text: string, options: TextOptions = {}): TextWidget {
  return new TextWidget(text, options);
}
