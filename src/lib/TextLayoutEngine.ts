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
 *
 * For rich-run text, `fragments` maps each styled piece of the line back to
 * its run (`runIndex` into the config's runs); the painter draws per-fragment
 * fonts/colors from it. Plain text lines carry no fragments.
 */
export interface TextLayoutLine {
  text: string;
  width: number;
  fragments?: LineFragment[];
}

/** A styled piece of a laid-out line, belonging to run `runIndex`. */
export interface LineFragment {
  runIndex: number;
  text: string;
  width: number;
}

/**
 * A run as the engine sees it: fully resolved down to a concrete font name.
 * Style flags (bold/italic/mono) are the caller's concern — the engine only
 * needs text plus the font that measures and draws it.
 */
export interface EngineRun {
  text: string;
  fontName: string;
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
   * Rich runs to lay out instead of `text`. When present, the engine wraps
   * across run boundaries (including mid-word) and emits per-run fragments;
   * `text` is ignored for layout (it stays the flattened plain text for
   * font preloading and back-compat).
   */
  runs?: ReadonlyArray<EngineRun>;
  /**
   * Measures the width of a string in a specific run's font. Required when
   * `runs` is set; falls back to a per-character estimate otherwise.
   */
  measureRunWidth?: (text: string, fontName: string) => number;
  /**
   * Returns the natural (unwrapped) width of the text. Optional; defaults to
   * measuring the full string. Provided separately because pretext can
   * compute this more accurately than a naive measurement.
   */
  measureNaturalWidth?: () => number;
}

/** A piece of styled text: `runIndex` indexes into the config's runs. */
interface RichPiece {
  runIndex: number;
  text: string;
}

/** A word: consecutive non-whitespace pieces, possibly spanning several runs. */
interface RichWord {
  /** Whitespace pieces preceding the word (collapsed or preserved). */
  pre: RichPiece[];
  pieces: RichPiece[];
}

/** A hard-break segment (`\n`) of rich text: words separated by whitespace. */
interface RichParagraph {
  words: RichWord[];
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
    if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
      return false;
    }
    // Pretext measures through a canvas (OffscreenCanvas or DOM canvas).
    // Without one (e.g. Node) it throws, so fall back to the built-in wrapper.
    return (
      typeof OffscreenCanvas !== 'undefined' ||
      (typeof document !== 'undefined' && typeof document.createElement === 'function')
    );
  }

  /**
   * Lazily prepares the text with pretext (grapheme-aware segmentation) for
   * accurate wrapping. Cached by (text, font, whiteSpace, wordBreak).
   */
  ensurePreparedText(canvasFont: string): PreparedTextWithSegments | undefined {
    // Rich runs bypass pretext: they measure through `measureRunWidth` (the
    // same font that draws), so no canvas-backed preparation is needed.
    if (this.config.runs) {
      return undefined;
    }

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
    if (this.config.runs) {
      return this.getRichNaturalWidth();
    }

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

  // --- Rich-run layout ---

  /** Lays out rich runs into lines constrained to `maxWidth`. */
  private layoutRichText(maxWidth: number, heightLineLimit?: number): TextLayoutResult {
    const effectiveWidth = maxWidth > 0 ? maxWidth : this.getRichNaturalWidth();
    let lines = this.layoutRichLines(effectiveWidth);

    const effectiveMaxLines = this.getEffectiveMaxLines(heightLineLimit);
    const visibleLines = effectiveMaxLines === undefined ? lines : lines.slice(0, effectiveMaxLines);
    const wasTruncated = effectiveMaxLines !== undefined && lines.length > visibleLines.length;

    if (wasTruncated && this.config.overflow === 'ellipsis' && visibleLines.length > 0) {
      const last = visibleLines.length - 1;
      visibleLines[last] = this.ellipsizeRichLine(visibleLines[last], effectiveWidth);
    }

    return {
      lines: visibleLines,
      maxLineWidth: visibleLines.reduce((max, line) => Math.max(max, line.width), 0),
    };
  }

  /**
   * Lays out the text into lines constrained to `maxWidth` (and optionally a
   * height-derived line limit). Applies `overflow` truncation.
   */
  layoutText(maxWidth: number, heightLineLimit?: number, canvasFont?: string): TextLayoutResult {
    if (this.config.runs) {
      return this.layoutRichText(maxWidth, heightLineLimit);
    }

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

  // --- Rich-run layout internals ---

  private richParagraphs?: RichParagraph[];

  /** The font name that measures and draws run `runIndex`. */
  private runFontName(runIndex: number): string {
    return this.config.runs![runIndex].fontName;
  }

  private measureRunWidthFor(runIndex: number, text: string): number {
    const measure = this.config.measureRunWidth;
    if (measure) {
      return measure(text, this.runFontName(runIndex));
    }
    return text.length * this.config.size * 0.6;
  }

  private measureRichPiece(piece: RichPiece): number {
    return this.measureRunWidthFor(piece.runIndex, piece.text);
  }

  /**
   * Tokenizes the runs into paragraphs (split at `\n`), words (maximal
   * non-whitespace spans, possibly spanning several runs), and the whitespace
   * pieces preceding each word.
   *
   * `normal` whiteSpace collapses each whitespace span to a single space
   * owned by the first run contributing to it and drops paragraph-edge
   * spaces, matching the plain-text fallback. `pre-wrap` preserves
   * whitespace literally (tabs expand to 8 spaces), including at edges.
   */
  private getRichParagraphs(): RichParagraph[] {
    if (this.richParagraphs) {
      return this.richParagraphs;
    }

    const runs = this.config.runs ?? [];
    const preWrap = this.config.whiteSpace === 'pre-wrap';
    const paragraphs: RichParagraph[] = [];
    let words: RichWord[] = [];
    let word: RichPiece[] | null = null;
    let pendingPre: RichPiece[] = [];

    const flushWord = () => {
      if (word && word.length > 0) {
        words.push({ pre: pendingPre, pieces: word });
        pendingPre = [];
      }
      word = null;
    };

    const flushParagraph = () => {
      flushWord();
      if (preWrap && pendingPre.length > 0) {
        // pre-wrap keeps paragraph-edge whitespace as a space-only word.
        words.push({ pre: [], pieces: pendingPre });
      }
      pendingPre = [];
      paragraphs.push({ words });
      words = [];
    };

    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      let text = runs[runIndex].text.replace(/\r\n?/g, '\n');
      if (preWrap) {
        text = text.replace(/\t/g, '        ');
      }

      const segments = text.split('\n');
      for (let s = 0; s < segments.length; s++) {
        if (s > 0) {
          flushParagraph();
        }

        const chunks = segments[s].split(/([^\S\n]+)/);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (!chunk) {
            continue;
          }

          if (i % 2 === 1) {
            flushWord();
            if (preWrap) {
              const last = pendingPre[pendingPre.length - 1];
              if (last && last.runIndex === runIndex) {
                last.text += chunk;
              } else {
                pendingPre.push({ runIndex, text: chunk });
              }
            } else if (pendingPre.length === 0) {
              // Collapse the span to one space, owned by the first run
              // that contributed whitespace.
              pendingPre.push({ runIndex, text: ' ' });
            }
          } else if (word) {
            word.push({ runIndex, text: chunk });
          } else {
            word = [{ runIndex, text: chunk }];
          }
        }
      }
    }
    flushParagraph();

    this.richParagraphs = paragraphs;
    return paragraphs;
  }

  /** Natural (unwrapped) width: every piece measured in its own run's font. */
  private getRichNaturalWidth(): number {
    let total = 0;
    for (const paragraph of this.getRichParagraphs()) {
      for (const word of paragraph.words) {
        for (const piece of word.pre) {
          total += this.measureRichPiece(piece);
        }
        for (const piece of word.pieces) {
          total += this.measureRichPiece(piece);
        }
      }
    }
    return total;
  }

  /**
   * Greedy word-wrap across runs. A word's whitespace pieces travel with it;
   * when the word starts a fresh line they are dropped in `normal` mode
   * (trailing spaces never paint at line ends) and kept in `pre-wrap`.
   */
  private layoutRichLines(maxWidth: number): TextLayoutLine[] {
    const preWrap = this.config.whiteSpace === 'pre-wrap';
    const lines: TextLayoutLine[] = [];

    for (const paragraph of this.getRichParagraphs()) {
      let current: RichPiece[] = [];
      let currentWidth = 0;
      let producedLine = false;

      const startWithWord = (word: RichWord): void => {
        const pieces = preWrap ? [...word.pre, ...word.pieces] : [...word.pieces];
        const width = pieces.reduce((sum, piece) => sum + this.measureRichPiece(piece), 0);

        if (maxWidth <= 0 || width <= maxWidth) {
          current = pieces;
          currentWidth = width;
          return;
        }

        const broken = this.breakRichWord(pieces, maxWidth);
        for (const brokenPieces of broken.lines) {
          lines.push(this.finishRichLine(brokenPieces));
          producedLine = true;
        }
        current = broken.tail;
        currentWidth = broken.tail.reduce((sum, piece) => sum + this.measureRichPiece(piece), 0);
      };

      for (const word of paragraph.words) {
        if (current.length === 0) {
          startWithWord(word);
          continue;
        }

        const preWidth = word.pre.reduce((sum, piece) => sum + this.measureRichPiece(piece), 0);
        const wordWidth = word.pieces.reduce((sum, piece) => sum + this.measureRichPiece(piece), 0);

        if (maxWidth <= 0 || currentWidth + preWidth + wordWidth <= maxWidth) {
          current.push(...word.pre, ...word.pieces);
          currentWidth += preWidth + wordWidth;
          continue;
        }

        lines.push(this.finishRichLine(current));
        producedLine = true;
        current = [];
        currentWidth = 0;
        startWithWord(word);
      }

      if (current.length > 0) {
        lines.push(this.finishRichLine(current));
        producedLine = true;
      }

      if (!producedLine) {
        // Empty paragraph (no words after collapsing) — one blank line,
        // matching the plain-text fallback.
        lines.push({ text: '', width: 0 });
      }
    }

    return lines;
  }

  /**
   * Splits an over-long word into lines that fit `maxWidth`, breaking at
   * graphemes across piece (run) boundaries. The final partial line comes
   * back as `tail` so the caller can keep filling it with more words.
   */
  private breakRichWord(pieces: RichPiece[], maxWidth: number): { lines: RichPiece[][]; tail: RichPiece[] } {
    const lines: RichPiece[][] = [];
    let line: RichPiece[] = [];
    let lineWidth = 0;

    const flushLine = () => {
      if (line.length > 0) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
    };

    for (const piece of pieces) {
      // Pending text of the piece being walked; committed to the line when
      // it overflows or the piece ends. Kept per-piece so committed text
      // always carries the run it came from.
      let builtText = '';
      let builtTextWidth = 0;

      for (const grapheme of this.splitGraphemes(piece.text)) {
        const candidate = builtText + grapheme;
        const candidateWidth = this.measureRunWidthFor(piece.runIndex, candidate);

        if (line.length === 0 || maxWidth <= 0 || lineWidth + candidateWidth <= maxWidth) {
          builtText = candidate;
          builtTextWidth = candidateWidth;
          continue;
        }

        if (builtText) {
          line.push({ runIndex: piece.runIndex, text: builtText });
          lineWidth += builtTextWidth;
          builtText = '';
          builtTextWidth = 0;
        }
        flushLine();
        builtText = grapheme;
        builtTextWidth = this.measureRunWidthFor(piece.runIndex, grapheme);
      }

      if (builtText) {
        line.push({ runIndex: piece.runIndex, text: builtText });
        lineWidth += builtTextWidth;
      }
    }

    return { lines, tail: line };
  }

  /** Merges consecutive same-run pieces into fragments and measures the line. */
  private finishRichLine(pieces: RichPiece[]): TextLayoutLine {
    const fragments: LineFragment[] = [];
    let width = 0;

    for (const piece of pieces) {
      const pieceWidth = this.measureRichPiece(piece);
      width += pieceWidth;
      const last = fragments[fragments.length - 1];
      if (last && last.runIndex === piece.runIndex) {
        last.text += piece.text;
        last.width += pieceWidth;
      } else {
        fragments.push({ runIndex: piece.runIndex, text: piece.text, width: pieceWidth });
      }
    }

    return { text: pieces.map((piece) => piece.text).join(''), width, fragments };
  }

  /**
   * Truncates a rich line to fit `maxWidth`, appending `…` in the font of
   * the fragment it truncates. Walks fragments left to right and keeps the
   * cut that preserves the most text.
   */
  private ellipsizeRichLine(line: TextLayoutLine, maxWidth: number): TextLayoutLine {
    const fragments = line.fragments ?? [];
    if (fragments.length === 0 || maxWidth <= 0) {
      return { text: '', width: 0 };
    }

    let prefixWidth = 0;
    let best: { index: number; keep: string } | undefined;

    for (let index = 0; index < fragments.length; index++) {
      const fragment = fragments[index];
      const ellipsisWidth = this.measureRunWidthFor(fragment.runIndex, '…');
      if (ellipsisWidth > maxWidth) {
        continue;
      }

      const graphemes = this.splitGraphemes(fragment.text);
      let low = 0;
      let high = graphemes.length;
      let found = -1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const kept = graphemes.slice(0, mid).join('');
        const keptWidth = this.measureRunWidthFor(fragment.runIndex, kept);
        if (prefixWidth + keptWidth + ellipsisWidth <= maxWidth) {
          found = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (found >= 0) {
        best = { index, keep: graphemes.slice(0, found).join('') };
      }
      prefixWidth += fragment.width;
    }

    if (!best) {
      return { text: '', width: 0 };
    }

    const kept: LineFragment[] = [];
    for (let index = 0; index <= best.index; index++) {
      const fragment = fragments[index];
      if (index < best.index) {
        kept.push({ ...fragment });
        continue;
      }
      const text = `${best.keep}…`;
      kept.push({ runIndex: fragment.runIndex, text, width: this.measureRunWidthFor(fragment.runIndex, text) });
    }

    return {
      text: kept.map((fragment) => fragment.text).join(''),
      width: kept.reduce((sum, fragment) => sum + fragment.width, 0),
      fragments: kept,
    };
  }
}
