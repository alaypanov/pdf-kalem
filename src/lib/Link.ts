import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';
import { MeasureMode } from 'yoga-layout';
import { RenderContext } from './RenderContext';
import { fromHex } from './utils/color-utils';
import { Widget, WidgetOptions } from './Widget';
import type { RenderColor } from './RenderContext';

type TextOverflow = 'visible' | 'clip' | 'ellipsis';

interface LinkLayoutLine {
  text: string;
  width: number;
}

interface LinkLayoutResult {
  lines: LinkLayoutLine[];
  maxLineWidth: number;
}

export interface LinkOptions extends WidgetOptions {
  href: string;
  size?: number;
  color?: string | RenderColor;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  font?: string;
  lineHeight?: number;
  maxLines?: number;
  overflow?: TextOverflow;
  whiteSpace?: PrepareOptions['whiteSpace'];
  wordBreak?: PrepareOptions['wordBreak'];
}

class LinkWidget extends Widget {
  private readonly text: string;
  private readonly href: string;
  private readonly size: number;
  private readonly color: RenderColor;
  private readonly underline: boolean;
  private readonly align: 'left' | 'center' | 'right';
  private readonly fontName?: string;
  private readonly lineHeight?: number;
  private readonly maxLines?: number;
  private readonly overflow: TextOverflow;
  private readonly whiteSpace: PrepareOptions['whiteSpace'];
  private readonly wordBreak: PrepareOptions['wordBreak'];
  private measureConfigured = false;
  private preparedText?: PreparedTextWithSegments;
  private preparedTextKey?: string;
  private readonly graphemeSegmenter =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : undefined;

  constructor(text: string, options: LinkOptions) {
    super(options);
    this.text = text;
    this.href = options.href;
    this.size = options.size ?? 12;
    this.color = typeof options.color === 'string'
      ? fromHex(options.color)
      : options.color ?? fromHex('#0000EE');
    this.underline = options.underline ?? true;
    this.align = options.align ?? 'left';
    this.fontName = options.font;
    this.lineHeight = options.lineHeight;
    this.maxLines = options.maxLines;
    this.overflow = options.overflow ?? 'visible';
    this.whiteSpace = options.whiteSpace ?? 'normal';
    this.wordBreak = options.wordBreak ?? 'normal';
  }

  private getLineHeight(): number {
    if (this.lineHeight !== undefined) {
      return this.lineHeight;
    }

    if (this.context) {
      return this.context.measureDefaultLineHeight(this.size, this.fontName);
    }

    return this.size * 1.2;
  }

  private getFontName(): string {
    return this.fontName ?? 'Helvetica';
  }

  private getCanvasFont(): string {
    const fontFamily = this.getFontName();
    const escapedFamily = fontFamily.replace(/"/g, '\\"');
    const quotedFamily = /\s|,/.test(fontFamily) ? `"${escapedFamily}"` : escapedFamily;
    return `${this.size}px ${quotedFamily}`;
  }

  private getPrepareOptions(): PrepareOptions {
    return {
      whiteSpace: this.whiteSpace,
      wordBreak: this.wordBreak,
    };
  }

  private canUsePretext(): boolean {
    return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
  }

  private ensurePreparedText(): PreparedTextWithSegments | undefined {
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

  private measureTextWidth(text: string): number {
    if (this.context) {
      return this.context.measureTextWidth(text, this.size, this.fontName);
    }

    return text.length * this.size * 0.6;
  }

  private getNaturalWidth(): number {
    const preparedText = this.ensurePreparedText();
    if (preparedText) {
      return measureNaturalWidth(preparedText);
    }

    return this.measureTextWidth(this.text);
  }

  private splitGraphemes(text: string): string[] {
    if (!this.graphemeSegmenter) {
      return Array.from(text);
    }

    return Array.from(this.graphemeSegmenter.segment(text), (segment) => segment.segment);
  }

  private ellipsizeLine(text: string, maxWidth: number): LinkLayoutLine {
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

  private appendFallbackLine(lines: LinkLayoutLine[], lineText: string): void {
    lines.push({ text: lineText, width: this.measureTextWidth(lineText) });
  }

  private breakLongToken(token: string, maxWidth: number): LinkLayoutLine[] {
    if (maxWidth <= 0) {
      return [{ text: token, width: this.measureTextWidth(token) }];
    }

    const graphemes = this.splitGraphemes(token);
    const lines: LinkLayoutLine[] = [];
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

  private layoutFallback(maxWidth: number): LinkLayoutLine[] {
    const normalizedText = this.text.replace(/\r\n?/g, '\n');
    const paragraphs = normalizedText.split('\n');
    const lines: LinkLayoutLine[] = [];

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

  private getHeightLineLimit(height: number): number | undefined {
    if (!Number.isFinite(height) || height <= 0) {
      return undefined;
    }

    return Math.max(0, Math.floor((height + 0.001) / this.getLineHeight()));
  }

  private getEffectiveMaxLines(heightLineLimit?: number): number | undefined {
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

  private layoutText(maxWidth: number, heightLineLimit?: number): LinkLayoutResult {
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

  override async prepareLayout(context: RenderContext): Promise<void> {
    await context.preloadFont(this.fontName);

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

  private addLinkAnnotation(context: RenderContext, rect: [number, number, number, number]): void {
    context.addLinkAnnotation({ href: this.href, rect });
  }

  async render(context: RenderContext): Promise<void> {
    const { x: baseX, y: baseY, width, height } = this.getLayoutBoxInPdfCoords(context);
    const maxWidth = width > 0 ? width : this.getWidth();
    const lineHeight = this.getLineHeight();
    const heightLineLimit = this.getHeightLineLimit(height);
    const layout = this.layoutText(maxWidth, heightLineLimit);
    const topY = baseY + height;

    // Clickable rect covers the whole layout box.
    this.addLinkAnnotation(context, [baseX, baseY, baseX + maxWidth, baseY + height]);

    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i];

      let x = baseX;
      if (this.align === 'center') {
        x = baseX + (maxWidth - line.width) / 2;
      } else if (this.align === 'right') {
        x = baseX + (maxWidth - line.width);
      }

      const y = topY - (i + 1) * lineHeight;

      await context.drawText({
        text: line.text,
        x,
        y,
        size: this.size,
        color: this.color,
        fontName: this.fontName,
      });

      if (this.underline) {
        const underlineY = y - Math.max(1, this.size * 0.08);
        context.drawLine({
          start: { x, y: underlineY },
          end: { x: x + line.width, y: underlineY },
          thickness: Math.max(0.5, this.size * 0.06),
          color: this.color,
        });
      }
    }
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

export function Link(text: string, options: LinkOptions): LinkWidget {
  return new LinkWidget(text, options);
}
