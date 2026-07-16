import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

/**
 * A single laid-out line of text: the substring to draw and its measured
 * width in the configured font/size.
 */
export interface TextLayoutLine {
  text: string;
  width: number;
}

/**
 * Result of laying out a block of text into lines.
 */
export interface TextLayoutResult {
  lines: TextLayoutLine[];
  maxLineWidth: number;
}

/**
 * How a text block should behave when it overflows its box.
 * - `visible`: lines are not truncated.
 * - `clip`: lines beyond the limit are dropped.
 * - `ellipsis`: the last visible line is truncated with an ellipsis.
 */
export type TextOverflow = 'visible' | 'clip' | 'ellipsis';

/**
 * Pure configuration for {@link TextLayoutEngine}. Everything the engine
 * needs to measure and wrap text, with no dependency on theme, widgets, or
 * render context. Callers (e.g. {@link TextWidget}) are responsible for
 * resolving theme tokens into concrete values before constructing an engine.
 */
export interface TextLayoutConfig {
  /** The raw text to lay out. */
  text: string;
  /** Font size in PDF points. */
  size: number;
  /** Line height in PDF points. */
  lineHeight: number;
  /** Horizontal alignment of lines within the layout width. */
  align: 'left' | 'center' | 'right';
  /** Font ascent in PDF points, used to position the baseline. */
  ascent: number;
  /** `whiteSpace` mode forwarded to pretext. */
  whiteSpace: PrepareOptions['whiteSpace'];
  /** `wordBreak` mode forwarded to pretext. */
  wordBreak: PrepareOptions['wordBreak'];
  /** Max visible lines before overflow handling kicks in. */
  maxLines?: number;
  /** Overflow behavior when content exceeds `maxLines` / height. */
  overflow: TextOverflow;
  /**
   * Measures the width of a string in the configured font/size.
   * Implementations typically delegate to `RenderContext.measureTextWidth`.
   */
  measureTextWidth: (text: string) => number;
  /**
   * Returns the natural (unwrapped) width of the text. Optional; defaults to
   * measuring the full string. Provided separately because pretext can
   * compute this more accurately than a naive measurement.
   */
  measureNaturalWidth?: () => number;
}

/**
 * Pure text layout engine: measures, wraps, and truncates text into lines.
 *
 * This is the shared core that used to be duplicated between `TextWidget`
 * and `LinkWidget`. It has no knowledge of themes, widgets, yoga, or render
 * contexts — it only knows how to turn a {@link TextLayoutConfig} into a
 * {@link TextLayoutResult}. Painting the result is the job of
 * {@link TextPainter}.
 */
export class TextLayoutEngine {
  private readonly config: TextLayoutConfig;
  private readonly graphemeSegmenter: Intl.Segmenter | undefined;
  private preparedText?: PreparedTextWithSegments;
  private preparedTextKey?: string;

  constructor(config: TextLayoutConfig) {
    this.config = config;
    this.graphemeSegmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : undefined;
  }

  private canUsePretext(): boolean {
    return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
  }

  /**
   * Lazily prepares the text with pretext (grapheme-aware segmentation) for
   * accurate wrapping. Cached by (text, font, whiteSpace, wordBreak).
   */
  ensurePreparedText(canvasFont: string): PreparedTextWithSegments | undefined {
    if (!this.canUsePretext()) {
      return undefined;
    }

    const key = JSON.stringify([
      this.config.text,
      canvasFont,
      this.config.whiteSpace,
      this.config.wordBreak,
    ]);

    if (this.preparedText && this.preparedTextKey === key) {
      return this.preparedText;
    }

    this.preparedText = prepareWithSegments(
      this.config.text,
      canvasFont,
      { whiteSpace: this.config.whiteSpace, wordBreak: this.config.wordBreak }
    );
    this.preparedTextKey = key;
    return this.preparedText;
  }

  /** Natural (unwrapped) width of the text. */
  getNaturalWidth(canvasFont: string): number {
    const preparedText = this.ensurePreparedText(canvasFont);
    if (preparedText) {
      return measureNaturalWidth(preparedText);
    }
    return this.config.measureTextWidth(this.config.text);
  }

  /**
   * Maximum number of lines that fit in `height`, or `undefined` if height
   * is unbounded.
   */
  getHeightLineLimit(height: number): number | undefined {
    if (!Number.isFinite(height) || height <= 0) {
      return undefined;
    }
    return Math.max(0, Math.floor((height + 0.001) / this.config.lineHeight));
  }

  private getEffectiveMaxLines(heightLineLimit?: number): number | undefined {
    const limits: number[] = [];

    if (
      typeof this.config.maxLines === 'number' &&
      Number.isFinite(this.config.maxLines) &&
      this.config.maxLines >= 0
    ) {
      limits.push(Math.floor(this.config.maxLines));
    }

    if (this.config.overflow !== 'visible' && heightLineLimit !== undefined) {
      limits.push(heightLineLimit);
    }

    if (limits.length === 0) {
      return undefined;
    }

    return Math.max(0, Math.min(...limits));
  }

  private splitGraphemes(text: string): string[] {
    if (!this.graphemeSegmenter) {
      return Array.from(text);
    }
    return Array.from(this.graphemeSegmenter.segment(text), (segment) => segment.segment);
  }

  private ellipsizeLine(text: string, maxWidth: number): TextLayoutLine {
    if (maxWidth <= 0) {
      return { text: '', width: 0 };
    }

    const ellipsis = '…';
    const ellipsisWidth = this.config.measureTextWidth(ellipsis);
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
      const candidateWidth = this.config.measureTextWidth(candidate);

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

  private appendFallbackLine(lines: TextLayoutLine[], lineText: string): void {
    lines.push({ text: lineText, width: this.config.measureTextWidth(lineText) });
  }

  private breakLongToken(token: string, maxWidth: number): TextLayoutLine[] {
    if (maxWidth <= 0) {
      return [{ text: token, width: this.config.measureTextWidth(token) }];
    }

    const graphemes = this.splitGraphemes(token);
    const lines: TextLayoutLine[] = [];
    let current = '';

    for (const grapheme of graphemes) {
      const candidate = current + grapheme;
      if (!current || this.config.measureTextWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      lines.push({ text: current, width: this.config.measureTextWidth(current) });
      current = grapheme;
    }

    if (current) {
      lines.push({ text: current, width: this.config.measureTextWidth(current) });
    }

    return lines;
  }

  private layoutFallback(maxWidth: number): TextLayoutLine[] {
    const normalizedText = this.config.text.replace(/\r\n?/g, '\n');
    const paragraphs = normalizedText.split('\n');
    const lines: TextLayoutLine[] = [];

    for (const paragraph of paragraphs) {
      const normalizedParagraph = this.config.whiteSpace === 'pre-wrap'
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
        if (maxWidth <= 0 || this.config.measureTextWidth(candidate) <= maxWidth) {
          currentLine = candidate;
          continue;
        }

        if (currentLine) {
          this.appendFallbackLine(lines, currentLine);
          currentLine = '';
        }

        if (this.config.measureTextWidth(word) <= maxWidth || maxWidth <= 0) {
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

  /**
   * Lays out the text into lines constrained to `maxWidth` (and optionally a
   * height-derived line limit). Applies `overflow` truncation.
   */
  layoutText(maxWidth: number, heightLineLimit?: number, canvasFont?: string): TextLayoutResult {
    const preparedText = canvasFont ? this.ensurePreparedText(canvasFont) : undefined;
    const effectiveWidth = maxWidth > 0 ? maxWidth : this.getNaturalWidth(canvasFont ?? '');
    const rawLines = preparedText
      ? layoutWithLines(preparedText, effectiveWidth, this.config.lineHeight).lines.map((line) => ({
          text: line.text,
          width: line.width,
        }))
      : this.layoutFallback(effectiveWidth);

    const effectiveMaxLines = this.getEffectiveMaxLines(heightLineLimit);
    const visibleLines = effectiveMaxLines === undefined ? rawLines : rawLines.slice(0, effectiveMaxLines);
    const wasTruncated = effectiveMaxLines !== undefined && rawLines.length > visibleLines.length;
    const lines = [...visibleLines];

    if (wasTruncated && this.config.overflow === 'ellipsis' && lines.length > 0) {
      lines[lines.length - 1] = this.ellipsizeLine(lines[lines.length - 1].text, effectiveWidth);
    }

    return {
      lines,
      maxLineWidth: lines.reduce((max, line) => Math.max(max, line.width), 0),
    };
  }
}
