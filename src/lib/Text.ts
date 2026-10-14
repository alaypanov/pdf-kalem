import { MeasureMode } from 'yoga-layout';
import { resolveThemeFont, resolveThemeTextStyle, type ThemeColorValue } from './Theme';
import { resolveColor, resolveFont } from './theme-resolve';
import { Widget, WidgetOptions } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import {
  BuiltinPdfFonts,
  builtinPdfNameFace,
  resolveBuiltinPdfFont,
  type BuiltinPdfFontName,
} from './types/doc-fonts';
import { faceId, parseFaceId, resolveFaceStyle } from './fonts/face';
import type { FontStyle, FontStyleValue, FontWeightValue } from './fonts/types';
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
 * A styled inline run inside a `Text`. Typography is CSS-like: `fontWeight`
 * (100–900, 'normal', 'bold') and `fontStyle` ('normal', 'italic') pick the
 * matching face of the run's family, replacing the base style per axis and
 * falling back down the face chain when a face is missing. `mono` switches
 * to the builtin `mono` family, and `font` overrides the family outright
 * (theme token or family name) while inheriting the block's typography.
 */
export interface Run {
  text: string;
  fontWeight?: FontWeightValue;
  fontStyle?: FontStyleValue;
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
  /** Block-level weight, overriding the theme variant's. Runs replace it per axis. */
  fontWeight?: FontWeightValue;
  /** Block-level style, overriding the theme variant's. Runs replace it per axis. */
  fontStyle?: FontStyleValue;
  /**
   * Line height in POINTS — the vertical distance between line baselines.
   * This is not a CSS multiplier: `lineHeight: 1.4` means 1.4pt (lines pile
   * on top of each other). For the CSS `line-height: 1.4` behavior use
   * {@link lineHeightMultiplier}.
   */
  lineHeight?: number;
  /**
   * Line height as a CSS-like multiplier of the font size — `1.4` at size 12
   * gives a 16.8pt line height. Ignored when {@link lineHeight} (points) is
   * set; the theme variant's value applies when neither is.
   */
  lineHeightMultiplier?: number;
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

/**
 * The canvas font string that measures the same face `face` draws: builtin
 * faces get the weight/style keywords over their canvas stack; custom
 * families measure under the face id — browser `FontFace`s register per face
 * id (`inter-bold`), so measuring under the plain family name would use the
 * regular face for styled text (B17).
 */
function canvasFontForFace(face: string, size: number): string {
  const builtin = BuiltinPdfFonts[face as BuiltinPdfFontName];
  if (builtin) {
    const style = parseFaceId(face)?.style ?? 'regular';
    const bold = style === 'bold' || style === 'boldItalic';
    const italic = style === 'italic' || style === 'boldItalic';
    const prefix = `${bold ? 'bold ' : ''}${italic ? 'italic ' : ''}`;
    return `${prefix}${size}px ${builtin.canvas}`;
  }
  return `${size}px ${toCanvasFontFamily(face)}`;
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
  private readonly fontWeightOverride?: FontWeightValue;
  private readonly fontStyleOverride?: FontStyleValue;
  private readonly lineHeightOverride?: number;
  private readonly lineHeightMultiplierOverride?: number;
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
    this.fontWeightOverride = options.fontWeight;
    this.fontStyleOverride = options.fontStyle;
    this.lineHeightOverride = options.lineHeight;
    this.lineHeightMultiplierOverride = options.lineHeightMultiplier;
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
    return resolveColor(this.context?.getTheme(), this.colorOverride, this.getThemeTextStyle()?.color, this.getFallbackColor());
  }

  protected getAlign(): 'left' | 'center' | 'right' {
    return this.alignOverride ?? this.getThemeTextStyle()?.align ?? 'left';
  }

  protected getLineHeight(): number {
    const theme = this.getThemeTextStyle();
    // User-level (either form) beats the theme variant; within a level,
    // explicit points win over the multiplier.
    if (this.lineHeightOverride !== undefined) {
      return this.lineHeightOverride;
    }
    if (this.lineHeightMultiplierOverride !== undefined) {
      return this.lineHeightMultiplierOverride * this.getSize();
    }
    if (theme?.lineHeight !== undefined) {
      return theme.lineHeight;
    }
    if (theme?.lineHeightMultiplier !== undefined) {
      return theme.lineHeightMultiplier * this.getSize();
    }

    if (this.context) {
      return this.context.measureDefaultLineHeight(this.getSize(), this.getFontName());
    }

    return this.getSize() * this.getFallbackLineHeightMultiplier();
  }

  protected getFontName(): string {
    const base = resolveBuiltinPdfFont(
      resolveFont(this.context?.getTheme(), this.fontNameOverride, this.getThemeTextStyle()?.font)
    ) ?? 'Helvetica';
    return this.applyBlockTypography(base);
  }

  /** The face style implied by block/variant typography over `base`. */
  private blockFaceStyle(base: FontStyle = 'regular'): FontStyle {
    const variant = this.getThemeTextStyle();
    return resolveFaceStyle(
      base,
      this.fontWeightOverride ?? variant?.fontWeight,
      this.fontStyleOverride ?? variant?.fontStyle,
    );
  }

  /**
   * Applies block/variant typography onto a resolved font name. Each axis is
   * replaced when set (block wins over variant); unset axes keep the base
   * name's own style — so `font: 'inter-bold'` keeps working, and a block
   * `fontStyle: 'italic'` on it yields `inter-bold-italic`.
   */
  private applyBlockTypography(base: string): string {
    const variant = this.getThemeTextStyle();
    const weight = this.fontWeightOverride ?? variant?.fontWeight;
    const style = this.fontStyleOverride ?? variant?.fontStyle;
    if (weight === undefined && style === undefined) {
      return base;
    }

    const builtin = builtinPdfNameFace(base);
    const parsed = builtin ?? parseFaceId(base);
    const family = parsed?.family ?? base;
    const baseStyle = parsed?.style ?? 'regular';
    return faceId(family, resolveFaceStyle(baseStyle, weight, style));
  }

  /**
   * Resolves a run to the pdf font name + canvas font that measure and draw
   * it. `font`/`mono` overrides swap the family but inherit the block's
   * typography (CSS inheritance); otherwise the base font — already styled
   * by the block — is decomposed into family + style and the run's
   * weight/style replace their axis (an explicit weight of 400 un-bolds a
   * bold base), falling back down the face chain when a face is missing.
   */
  private resolveRunFont(run: Run): { fontName: string; canvasFont: string } {
    let family: string;
    let baseStyle: FontStyle;

    if (run.font || run.mono) {
      family = run.font
        ? resolveThemeFont(this.context?.getTheme(), run.font) ?? run.font
        : 'mono';
      const overrideParsed = parseFaceId(family);
      if (overrideParsed) {
        // The override name carries its own style ('inter-bold') — it is the
        // more specific base that block typography and the run's axes
        // replace, so an explicit 400 un-bolds it like the block path (B20).
        family = overrideParsed.family;
        baseStyle = this.blockFaceStyle(overrideParsed.style);
      } else {
        // Inherit the block's fully-styled face (the base name's own style +
        // block typography) — the same decomposition non-override runs use.
        const blockFaceName = this.getFontName();
        const parsed = builtinPdfNameFace(blockFaceName) ?? parseFaceId(blockFaceName);
        baseStyle = parsed?.style ?? 'regular';
      }
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

    const face = faceId(family, resolveFaceStyle(baseStyle, run.fontWeight, run.fontStyle));
    const pdfFamily = resolveBuiltinPdfFont(face) ?? face;
    return { fontName: pdfFamily, canvasFont: canvasFontForFace(face, this.getSize()) };
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
        color: resolveColor(this.context?.getTheme(), run.color, undefined, this.getColor()),
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
    // Measure with the same face that draws (B17) — getFontName() is the
    // fully-styled face id (e.g. 'sans-bold', 'inter-bold').
    return canvasFontForFace(this.getFontName(), this.getSize());
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
    // Yoga stores computed sizes as float32 while the measurements that
    // produced them are float64 — a shrink-wrapped block's stored width can
    // sit a ~1e-6pt hair UNDER its own measured text width, and re-wrapping
    // at the stored width would phantom-wrap ('1.' → '1' / '.'). Tolerate
    // sub-0.01pt overflow: invisible at any zoom, and exactly the noise
    // floor of the float32 boundary. Zero stays the natural-width sentinel.
    const effectiveMaxWidth = maxWidth > 0 ? maxWidth + 0.01 : maxWidth;
    return this.getEngine().layoutText(effectiveMaxWidth, heightLineLimit, this.getCanvasFont());
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
    // The line box spans baseline ± (halfLeading + ascent) top / (lineHeight
    // - halfLeading - ascent) bottom — the same model TextPainter.position
    // uses. The previous rect dropped the half-leading and sat one notch
    // below the line box (B20).
    const halfLeading = (lineHeight - this.getFontHeight()) / 2;

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
            line.y - (lineHeight - halfLeading - ascent),
            fragment.x + fragment.width,
            line.y + halfLeading + ascent,
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

    // The engine captures ascent/lineHeight and measurement closures. If it
    // was built before fonts were embedded (a getPageCount dry run), drop it
    // so it rebuilds with the real metrics now that preloading has embedded
    // them (B9).
    this.engine = undefined;

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
