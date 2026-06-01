import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';
import { MeasureMode } from 'yoga-layout';
import { resolveThemeColor, resolveThemeFont, resolveThemeTextStyle, type ThemeColorValue } from './Theme';
import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import type { RenderColor } from './RenderContext';
import { resolveBuiltinCanvasFont, resolveBuiltinPdfFont } from './types/doc-fonts';
import { fromHex } from './utils/color-utils';

export type TextOverflow = 'visible' | 'clip' | 'ellipsis';

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

interface TextLayoutLine {
  text: string;
  width: number;
}

interface TextLayoutResult {
  lines: TextLayoutLine[];
  maxLineWidth: number;
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
  private preparedText?: PreparedTextWithSegments;
  private preparedTextKey?: string;
  private readonly graphemeSegmenter =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : undefined;

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

  protected getPrepareOptions(): PrepareOptions {
    return {
      whiteSpace: this.whiteSpace,
      wordBreak: this.wordBreak,
    };
  }

  protected canUsePretext(): boolean {
    return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
  }

  protected ensurePreparedText(): PreparedTextWithSegments | undefined {
    if (!this.canUsePretext()) {
      return undefined;
    }

    const key = JSON.stringify([
      this.text,
      this.getCanvasFont(),
      this.whiteSpace,
      this.wordBreak,
    ]);

    if (this.preparedText && this.preparedTextKey === key) {
      return this.preparedText;
    }

    this.preparedText = prepareWithSegments(this.text, this.getCanvasFont(), this.getPrepareOptions());
    this.preparedTextKey = key;
    return this.preparedText;
  }

  protected measureTextWidth(text: string): number {
    if (this.context) {
      return this.context.measureTextWidth(text, this.getSize(), this.getFontName());
    }

    return text.length * this.getSize() * 0.6;
  }

  protected getNaturalWidth(): number {
    const preparedText = this.ensurePreparedText();
    if (preparedText) {
      return measureNaturalWidth(preparedText);
    }

    return this.measureTextWidth(this.text);
  }

  protected splitGraphemes(text: string): string[] {
    if (!this.graphemeSegmenter) {
      return Array.from(text);
    }

    return Array.from(this.graphemeSegmenter.segment(text), (segment) => segment.segment);
  }

  protected ellipsizeLine(text: string, maxWidth: number): TextLayoutLine {
    if (maxWidth <= 0) {
      return { text: '', width: 0 };
    }

    const ellipsis = '…';
    const ellipsisWidth = this.measureTextWidth(ellipsis);
    if (ellipsisWidth > maxWidth) {
      return { text: '', width: 0 };
    }

    const trimmedText = text.replace(/\s+$/u, '');
    const graphemes = this.splitGraphemes(trimmedText);
    let low = 0;
    let high = graphemes.length;
    let best = ellipsis;
    let bestWidth = ellipsisWidth;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const prefix = graphemes.slice(0, mid).join('').replace(/\s+$/u, '');
      const candidate = prefix ? `${prefix}${ellipsis}` : ellipsis;
      const candidateWidth = this.measureTextWidth(candidate);

      if (candidateWidth <= maxWidth) {
        best = candidate;
        bestWidth = candidateWidth;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return { text: best, width: bestWidth };
  }

  protected appendFallbackLine(lines: TextLayoutLine[], lineText: string): void {
    lines.push({ text: lineText, width: this.measureTextWidth(lineText) });
  }

  protected breakLongToken(token: string, maxWidth: number): TextLayoutLine[] {
    if (maxWidth <= 0) {
      return [{ text: token, width: this.measureTextWidth(token) }];
    }

    const graphemes = this.splitGraphemes(token);
    const lines: TextLayoutLine[] = [];
    let current = '';

    for (const grapheme of graphemes) {
      const candidate = current + grapheme;
      if (!current || this.measureTextWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      lines.push({ text: current, width: this.measureTextWidth(current) });
      current = grapheme;
    }

    if (current) {
      lines.push({ text: current, width: this.measureTextWidth(current) });
    }

    return lines;
  }

  protected layoutFallback(maxWidth: number): TextLayoutLine[] {
    const normalizedText = this.text.replace(/\r\n?/g, '\n');
    const paragraphs = normalizedText.split('\n');
    const lines: TextLayoutLine[] = [];

    for (const paragraph of paragraphs) {
      const normalizedParagraph = this.whiteSpace === 'pre-wrap'
        ? paragraph.replace(/\t/g, '        ')
        : paragraph.trim().replace(/\s+/g, ' ');

      if (!normalizedParagraph) {
        this.appendFallbackLine(lines, '');
        continue;
      }

      const words = normalizedParagraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (maxWidth <= 0 || this.measureTextWidth(candidate) <= maxWidth) {
          currentLine = candidate;
          continue;
        }

        if (currentLine) {
          this.appendFallbackLine(lines, currentLine);
          currentLine = '';
        }

        if (this.measureTextWidth(word) <= maxWidth || maxWidth <= 0) {
          currentLine = word;
          continue;
        }

        const brokenWordLines = this.breakLongToken(word, maxWidth);
        lines.push(...brokenWordLines.slice(0, -1));
        currentLine = brokenWordLines[brokenWordLines.length - 1]?.text ?? '';
      }

      if (currentLine || normalizedParagraph.length === 0) {
        this.appendFallbackLine(lines, currentLine);
      }
    }

    if (paragraphs.length === 0) {
      return [];
    }

    return lines;
  }

  protected getHeightLineLimit(height: number): number | undefined {
    if (!Number.isFinite(height) || height <= 0) {
      return undefined;
    }

    return Math.max(0, Math.floor((height + 0.001) / this.getLineHeight()));
  }

  protected getEffectiveMaxLines(heightLineLimit?: number): number | undefined {
    const limits: number[] = [];

    if (typeof this.maxLines === 'number' && Number.isFinite(this.maxLines) && this.maxLines >= 0) {
      limits.push(Math.floor(this.maxLines));
    }

    if (this.overflow !== 'visible' && heightLineLimit !== undefined) {
      limits.push(heightLineLimit);
    }

    if (limits.length === 0) {
      return undefined;
    }

    return Math.max(0, Math.min(...limits));
  }

  protected layoutText(maxWidth: number, heightLineLimit?: number): TextLayoutResult {
    const lineHeight = this.getLineHeight();
    const preparedText = this.ensurePreparedText();
    const effectiveWidth = maxWidth > 0 ? maxWidth : this.getNaturalWidth();
    const rawLines = preparedText
      ? layoutWithLines(preparedText, effectiveWidth, lineHeight).lines.map((line) => ({ text: line.text, width: line.width }))
      : this.layoutFallback(effectiveWidth);

    const effectiveMaxLines = this.getEffectiveMaxLines(heightLineLimit);
    const visibleLines = effectiveMaxLines === undefined ? rawLines : rawLines.slice(0, effectiveMaxLines);
    const wasTruncated = effectiveMaxLines !== undefined && rawLines.length > visibleLines.length;
    const lines = [...visibleLines];

    if (wasTruncated && this.overflow === 'ellipsis' && lines.length > 0) {
      lines[lines.length - 1] = this.ellipsizeLine(lines[lines.length - 1].text, effectiveWidth);
    }

    return {
      lines,
      maxLineWidth: lines.reduce((max, line) => Math.max(max, line.width), 0),
    };
  }

  protected getRenderedTextLayout(context: RenderContext): {
    box: { x: number; y: number; width: number; height: number };
    lines: Array<TextLayoutLine & { x: number; y: number }>;
    maxWidth: number;
  } {
    const box = context.getLayoutBoxInPdfCoords(this);
    const maxWidth = box.width > 0 ? box.width : this.getWidth();
    const lineHeight = this.getLineHeight();
    const ascent = this.getFontAscent();
    const heightLineLimit = this.getHeightLineLimit(box.height);
    const layout = this.layoutText(maxWidth, heightLineLimit);
    const topY = box.y + box.height;

    return {
      box,
      maxWidth,
      lines: layout.lines.map((line, index) => {
        let x = box.x;
        if (this.getAlign() === 'center') {
          x = box.x + (maxWidth - line.width) / 2;
        } else if (this.getAlign() === 'right') {
          x = box.x + (maxWidth - line.width);
        }

        return {
          ...line,
          x,
          y: topY - index * lineHeight - ascent,
        };
      }),
    };
  }

  protected async drawRenderedTextLayout(
    context: RenderContext,
    renderedLayout: ReturnType<TextWidget['getRenderedTextLayout']>,
    options?: { underline?: boolean; underlineColor?: RenderColor },
  ): Promise<void> {
    for (const line of renderedLayout.lines) {
      await context.drawText({
        text: line.text,
        x: line.x,
        y: line.y,
        size: this.getSize(),
        color: this.getColor(),
        fontName: this.getFontName(),
      });

      if (options?.underline) {
        const underlineY = line.y - Math.max(1, this.getSize() * 0.08);
        context.drawLine({
          start: { x: line.x, y: underlineY },
          end: { x: line.x + line.width, y: underlineY },
          thickness: Math.max(0.5, this.getSize() * 0.06),
          color: options.underlineColor ?? this.getColor(),
        });
      }
    }
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    await context.preloadFont(this.getFontName());

    if (typeof document !== 'undefined' && 'fonts' in document) {
      await document.fonts.load(this.getCanvasFont(), this.text);
    }

    this.ensurePreparedText();

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