import { MeasureMode } from 'yoga-layout';
import { resolveThemeColor, resolveThemeFont, resolveThemeTextStyle, type ThemeColorValue } from './Theme';
import { Widget, WidgetOptions } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import {
  builtinPdfNameFace,
  resolveBuiltinCanvasFont,
  resolveBuiltinPdfFont,
} from './types/doc-fonts';
import { combineFaceStyle, faceId, parseFaceId } from './fonts/face';
import type { FontStyle } from './fonts/types';
import { fromHex } from './utils/color-utils';
import {
  TextLayoutEngine,
  type EngineRun,
  type TextLayoutResult,
  type TextOverflow,
  type TextLayoutConfig,
} from './TextLayoutEngine';
import { TextPainter, type PaintRun, type RenderedTextLayout } from './TextPainter';
import type { BreakUnit } from './pagination/types';
import type { PrepareOptions } from '@chenglou/pretext';

export type { TextOverflow } from './TextLayoutEngine';

/**
 * A styled inline run inside a `Text`. Style flags combine with the text's
 * base font: `bold`/`italic` pick the matching face of the run's family
 * (falling back down the face chain when missing), `mono` switches to the
 * builtin `mono` family, and `font` overrides the family outright (theme
 * token or family name).
 */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  href?: string;
  mono?: boolean;
  font?: string;
  color?: ThemeColorValue;
  underline?: boolean;
}

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

/**
 * Quotes a single font family for a canvas font string. Comma-separated
 * lists (the builtin canvas stacks) are already valid font-family lists and
 * stay unquoted; only single names containing whitespace get quoted.
 */
function toCanvasFontFamily(family: string): string {
  if (!/\s/.test(family) || family.includes(',')) {
    return family;
  }
  return `"${family.replace(/"/g, '\\"')}"`;
}

/** A run fully resolved to concrete fonts and colors for measure/draw. */
interface ResolvedRun extends PaintRun {
  text: string;
  canvasFont: string;
  href?: string;
}

export class TextWidget extends Widget {
  private readonly runs?: readonly Run[];
  private readonly plainText: string;
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
  private engineRuns?: readonly EngineRun[];
  private paintRuns?: readonly ResolvedRun[];

  constructor(text: string | Run[], options: TextOptions) {
    super(options);
    this.runs = Array.isArray(text) ? text : undefined;
    this.plainText = Array.isArray(text) ? text.map((run) => run.text).join('') : text;
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

  /**
   * Resolves a run to the pdf font name + canvas font that measure and draw
   * it. `font`/`mono` overrides start fresh from `regular`; otherwise the
   * base font is decomposed into family + style (builtin pdf names first,
   * then custom face ids) and the run's flags combine with that style.
   */
  private resolveRunFont(run: Run): { fontName: string; canvasFont: string } {
    let family: string;
    let baseStyle: FontStyle;

    if (run.font || run.mono) {
      family = run.font
        ? resolveThemeFont(this.context?.getTheme(), run.font) ?? run.font
        : 'mono';
      baseStyle = 'regular';
    } else {
      const basePdfName = this.getFontName();
      const builtin = builtinPdfNameFace(basePdfName);
      if (builtin) {
        family = builtin.family;
        baseStyle = builtin.style;
      } else {
        const parsed = parseFaceId(basePdfName);
        family = parsed?.family ?? basePdfName;
        baseStyle = parsed?.style ?? 'regular';
      }
    }

    const face = faceId(family, combineFaceStyle(baseStyle, run.bold, run.italic));
    const pdfFamily = resolveBuiltinPdfFont(face) ?? face;
    // Browser FontFaces register under the family name, not the face id.
    const canvasFamily = resolveBuiltinCanvasFont(family) ?? family;
    return { fontName: pdfFamily, canvasFont: `${this.getSize()}px ${toCanvasFontFamily(canvasFamily)}` };
  }

  /** Runs as the engine sees them (text + measuring font), memoized. */
  private getEngineRuns(): readonly EngineRun[] | undefined {
    if (!this.runs) {
      return undefined;
    }
    if (this.engineRuns) {
      return this.engineRuns;
    }
    this.engineRuns = this.runs.map((run) => ({
      text: run.text,
      fontName: this.resolveRunFont(run).fontName,
    }));
    return this.engineRuns;
  }

  /** Runs fully resolved for painting (fonts, colors, strike, hrefs). */
  private getPaintRuns(): readonly ResolvedRun[] {
    if (!this.runs) {
      return [];
    }
    if (this.paintRuns) {
      return this.paintRuns;
    }
    this.paintRuns = this.runs.map((run) => {
      const { fontName, canvasFont } = this.resolveRunFont(run);
      return {
        text: run.text,
        fontName,
        canvasFont,
        color: resolveThemeColor(this.context?.getTheme(), run.color) ?? this.getColor(),
        strike: run.strike ?? false,
        underline: run.underline ?? false,
        href: run.href,
      };
    });
    return this.paintRuns;
  }

  /** True when this text was built from runs (even if currently empty). */
  protected hasRuns(): boolean {
    return this.runs !== undefined && this.runs.length > 0;
  }

  /** The flattened plain text (runs concatenated in order). */
  getText(): string {
    return this.plainText;
  }

  protected getFontAscent(): number {
    if (this.context) {
      return this.context.measureFontAscent(this.getSize(), this.getFontName());
    }

    return this.getSize();
  }

  /** Full font height (ascent + descent) — half-leading derives from it. */
  protected getFontHeight(): number {
    if (this.context) {
      return this.context.measureFontHeight(this.getSize(), this.getFontName());
    }

    return this.getSize();
  }

  protected getCanvasFont(): string {
    const fontFamily = resolveBuiltinCanvasFont(
      resolveThemeFont(this.context?.getTheme(), this.fontNameOverride ?? this.getThemeTextStyle()?.font)
    ) ?? this.getFontName();
    return `${this.getSize()}px ${toCanvasFontFamily(fontFamily)}`;
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
    const runs = this.getEngineRuns();

    const config: TextLayoutConfig = {
      text: this.plainText,
      size,
      lineHeight: this.getLineHeight(),
      align: this.getAlign(),
      ascent: this.getFontAscent(),
      whiteSpace: this.whiteSpace,
      wordBreak: this.wordBreak,
      maxLines: this.maxLines,
      overflow: this.overflow,
      runs,
      measureTextWidth: (text: string) =>
        context
          ? context.measureTextWidth(text, size, fontName)
          : text.length * size * 0.6,
      measureRunWidth: runs
        ? (text: string, runFontName: string) =>
          context
            ? context.measureTextWidth(text, size, runFontName)
            : text.length * size * 0.6
        : undefined,
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
    const box = context.getLayoutBox(this);
    const maxWidth = box.width > 0 ? box.width : this.getWidth();
    const lineHeight = this.getLineHeight();
    const flowOffset = context.getFlowOffset(this);
    const flowHeight = this.node.getComputedHeight();

    // A pagination slice: a continuation (flowOffset > 0), or a first slice
    // whose fragment box is shorter than the block's flow height. Sliced
    // blocks draw a window of the full layout — no overflow truncation, the
    // block continues on the next page.
    if (lineHeight > 0 && (flowOffset > 0 || box.height + 0.01 < flowHeight)) {
      const block = this.layoutText(maxWidth);
      const skip = Math.max(0, Math.floor((flowOffset + 0.001) / lineHeight));
      const visible = Math.max(0, Math.floor((box.height + 0.001) / lineHeight));
      const lines = block.lines.slice(skip, skip + visible);

      return TextPainter.position(box, lines, maxWidth, {
        lineHeight,
        ascent: this.getFontAscent(),
        fontHeight: this.getFontHeight(),
        align: this.getAlign(),
      });
    }

    const heightLineLimit = this.getHeightLineLimit(box.height);
    const layout = this.layoutText(maxWidth, heightLineLimit);

    return TextPainter.position(box, layout.lines, maxWidth, {
      lineHeight,
      ascent: this.getFontAscent(),
      fontHeight: this.getFontHeight(),
      align: this.getAlign(),
    });
  }

  protected async drawRenderedTextLayout(
    context: RenderContext,
    renderedLayout: RenderedTextLayout,
    options?: { underline?: boolean; underlineColor?: RenderColor; linkHref?: string },
  ): Promise<void> {
    const paintRuns = this.getPaintRuns();

    await TextPainter.paint(context, renderedLayout, {
      size: this.getSize(),
      color: this.getColor(),
      fontName: this.getFontName(),
      underline: options?.underline,
      underlineColor: options?.underlineColor,
      runs: paintRuns.length > 0 ? paintRuns : undefined,
    });

    this.addRunLinkAnnotations(context, renderedLayout, options?.linkHref);
  }

  /**
   * Link annotations for run hrefs: one rect per line fragment, since a run
   * can wrap across lines (a whole-box rect would cover unrelated text).
   * `defaultHref` (set by Link) applies to runs without their own href.
   */
  private addRunLinkAnnotations(
    context: RenderContext,
    renderedLayout: RenderedTextLayout,
    defaultHref?: string,
  ): void {
    if (!this.runs) {
      return;
    }

    const paintRuns = this.getPaintRuns();
    const lineHeight = this.getLineHeight();
    const ascent = this.getFontAscent();

    for (const line of renderedLayout.lines) {
      if (!line.fragments) {
        continue;
      }
      for (const fragment of line.fragments) {
        const href = paintRuns[fragment.runIndex]?.href ?? defaultHref;
        if (!href) {
          continue;
        }
        context.addLinkAnnotation({
          href,
          rect: [
            fragment.x,
            line.y - (lineHeight - ascent),
            fragment.x + fragment.width,
            line.y + ascent,
          ],
        });
      }
    }
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    const paintRuns = this.getPaintRuns();
    const fontNames = paintRuns.length > 0
      ? [...new Set(paintRuns.map((run) => run.fontName))]
      : [this.getFontName()];
    await Promise.all(fontNames.map((fontName) => context.preloadFont(fontName)));

    if (typeof document !== 'undefined' && 'fonts' in document) {
      if (paintRuns.length > 0) {
        const textByCanvasFont = new Map<string, string>();
        for (const run of paintRuns) {
          textByCanvasFont.set(run.canvasFont, (textByCanvasFont.get(run.canvasFont) ?? '') + run.text);
        }
        await Promise.all(
          [...textByCanvasFont].map(([canvasFont, text]) => document.fonts.load(canvasFont, text))
        );
      } else {
        await document.fonts.load(this.getCanvasFont(), this.plainText);
      }
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

  /**
   * Line units: one break opportunity per laid-out line, so the paginator
   * never splits mid-line. `breakable: false` (inherited option) makes the
   * block atomic via the base-class check.
   */
  override getBreakUnits(): BreakUnit[] | null {
    if (this.breakableOption === false) return null;
    const lineHeight = this.getLineHeight();
    if (lineHeight <= 0) return null;

    const computedWidth = this.node.getComputedWidth();
    const maxWidth = computedWidth > 0 ? computedWidth : this.getWidth();
    const lines = this.layoutText(maxWidth).lines;
    if (lines.length === 0) return null;

    return lines.map((_, index) => ({ offset: index * lineHeight, height: lineHeight }));
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

export function Text(text: string | Run[], options: TextOptions = {}): TextWidget {
  return new TextWidget(text, options);
}
