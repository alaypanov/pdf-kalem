
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
 * Style flags (bold/italic/mono) are the caller's concern - the engine only
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
 * - `visible`: no height-derived truncation - lines beyond the box stay
 *   laid out. An explicit `maxLines` still clamps (CSS line-clamp
 *   semantics); `overflow` only chooses the indicator for that clamp.
 * - `clip`: lines beyond the limit are dropped.
 * - `ellipsis`: the last visible line is truncated with an ellipsis.
 */
export type TextOverflow = 'visible' | 'clip' | 'ellipsis';

/** Collapse whitespace (`normal`) or preserve it (`pre-wrap`, tabs expand to eight spaces). */
export type TextWhiteSpace = 'normal' | 'pre-wrap';

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
  whiteSpace: TextWhiteSpace;
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
   * `text` is ignored for layout.
   */
  runs?: ReadonlyArray<EngineRun>;
  /**
   * Measures the width of a string in a specific run's font. Required when
   * `runs` is set for exact per-font metrics; otherwise uses measureTextWidth.
   */
  measureRunWidth?: (text: string, fontName: string) => number;
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
 * contexts - it only knows how to turn a {@link TextLayoutConfig} into a
 * {@link TextLayoutResult}. Painting the result is the job of
 * {@link TextPainter}.
 */
export class TextLayoutEngine {
  private readonly config: TextLayoutConfig;
  private readonly graphemeSegmenter: Intl.Segmenter | undefined;

  constructor(config: TextLayoutConfig) {
    this.config = config;
    this.graphemeSegmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : undefined;
  }

  /** Natural width is the widest normalized hard-break paragraph. */
  getNaturalWidth(): number {
    return this.getRichNaturalWidth();
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

  // --- Rich-run layout ---

  /** Lays out rich runs into lines constrained to `maxWidth`. */
  private layoutRichText(maxWidth: number, heightLineLimit?: number): TextLayoutResult {
    const effectiveWidth = maxWidth > 0 ? maxWidth : this.getRichNaturalWidth();
    const lines = this.layoutRichLines(effectiveWidth);

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
  layoutText(maxWidth: number, heightLineLimit?: number): TextLayoutResult {
    const result = this.layoutRichText(maxWidth, heightLineLimit);
    if (!this.config.runs) {
      // Keep the public plain-text shape and whole-line painting path.
      result.lines = result.lines.map(({ text, width }) => ({ text, width }));
    }
    return result;
  }

  // --- Rich-run layout internals ---

  private richParagraphs?: RichParagraph[];

  /** The font name that measures and draws run `runIndex`. */
  private runFontName(runIndex: number): string {
    return this.config.runs?.[runIndex]?.fontName ?? '';
  }

  private measureRunWidthFor(runIndex: number, text: string): number {
    if (!this.config.runs) {
      return this.config.measureTextWidth(text);
    }
    const measure = this.config.measureRunWidth;
    if (measure) {
      return measure(text, this.runFontName(runIndex));
    }
    return this.config.measureTextWidth(text);
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

    const runs = this.config.runs ?? [{ text: this.config.text, fontName: '' }];
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
    let widest = 0;
    const preWrap = this.config.whiteSpace === 'pre-wrap';
    for (const paragraph of this.getRichParagraphs()) {
      const pieces = paragraph.words.flatMap((word, index) =>
        index === 0 && !preWrap ? word.pieces : [...word.pre, ...word.pieces]
      );
      widest = Math.max(widest, this.finishRichLine(pieces).width);
    }
    return widest;
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
      let producedLine = false;

      const startWithWord = (word: RichWord): void => {
        const pieces = preWrap ? [...word.pre, ...word.pieces] : [...word.pieces];
        const width = this.finishRichLine(pieces).width;

        if (maxWidth <= 0 || width <= maxWidth) {
          current = pieces;
          return;
        }

        const broken = this.breakRichWord(pieces, maxWidth);
        for (const brokenPieces of broken.lines) {
          lines.push(this.finishRichLine(brokenPieces));
          producedLine = true;
        }
        current = broken.tail;
      };

      for (const word of paragraph.words) {
        if (current.length === 0) {
          startWithWord(word);
          continue;
        }

        const candidateWidth = this.finishRichLine([...current, ...word.pre, ...word.pieces]).width;

        if (maxWidth <= 0 || candidateWidth <= maxWidth) {
          current.push(...word.pre, ...word.pieces);
          continue;
        }

        lines.push(this.finishRichLine(current));
        producedLine = true;
        current = [];
        startWithWord(word);
      }

      if (current.length > 0) {
        lines.push(this.finishRichLine(current));
        producedLine = true;
      }

      if (!producedLine) {
        // Empty paragraph (no words after collapsing) - one blank line,
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

        if ((line.length === 0 && !builtText) || maxWidth <= 0 || lineWidth + candidateWidth <= maxWidth) {
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

    for (const piece of pieces) {
      const pieceWidth = this.measureRichPiece(piece);
      const last = fragments[fragments.length - 1];
      if (last && last.runIndex === piece.runIndex) {
        last.text += piece.text;
        last.width = this.measureRunWidthFor(last.runIndex, last.text);
      } else {
        fragments.push({ runIndex: piece.runIndex, text: piece.text, width: pieceWidth });
      }
    }

    const width = fragments.reduce((sum, fragment) => sum + fragment.width, 0);
    return { text: pieces.map((piece) => piece.text).join(''), width, fragments };
  }

  /**
   * Truncates a rich line to fit `maxWidth`, appending `…` in the font of
   * the fragment it truncates. Walks fragments left to right and keeps the
   * cut that preserves the most text.
   */
  private ellipsizeRichLine(line: TextLayoutLine, maxWidth: number): TextLayoutLine {
    const fragments = line.fragments ?? [];
    if (maxWidth <= 0) {
      return { text: '', width: 0 };
    }

    // A blank last line (no fragments) still shows the ellipsis, in the
    // first run's font - matching the plain path (B20).
    if (fragments.length === 0) {
      const ellipsisWidth = this.measureRunWidthFor(0, '…');
      if (ellipsisWidth <= maxWidth) {
        return {
          text: '…',
          width: ellipsisWidth,
          fragments: [{ runIndex: 0, text: '…', width: ellipsisWidth }],
        };
      }
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
        const kept = graphemes.slice(0, mid).join('').replace(/\s+$/u, '');
        const keptWidth = this.measureRunWidthFor(fragment.runIndex, `${kept}…`);
        if (prefixWidth + keptWidth <= maxWidth) {
          found = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (found >= 0) {
        best = { index, keep: graphemes.slice(0, found).join('').replace(/\s+$/u, '') };
      }
      prefixWidth += fragment.width;
    }

    if (!best) {
      // No cut fits under the accumulated prefixes - fall back to a bare
      // ellipsis in the first fragment's font (the plain path keeps one).
      const ellipsisWidth = this.measureRunWidthFor(fragments[0].runIndex, '…');
      if (ellipsisWidth <= maxWidth) {
        const runIndex = fragments[0].runIndex;
        return {
          text: '…',
          width: ellipsisWidth,
          fragments: [{ runIndex, text: '…', width: ellipsisWidth }],
        };
      }
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
