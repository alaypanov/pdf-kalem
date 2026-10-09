import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFString,
  PDFFont,
  StandardFonts,
} from 'pdf-lib';
import type { Widget } from './Widget';
import type { Theme } from './Theme';
import type { RenderContext } from './RenderContextInterface';
import type {
  RenderImage,
  RenderContextOptions,
  DrawRectangleArgs,
  DrawTextArgs,
  DrawLineArgs,
  DrawImageArgs,
  DrawSvgPathArgs,
  LinkAnnotationArgs,
} from './RenderContextTypes';
import { resolveBuiltinPdfFont } from './types/doc-fonts';
import { toPdfLibColor } from './utils/color-utils';
import { FontRegistry } from './FontRegistry';
import { parseFaceId, resolveFaceBytes } from './fonts/face';
import type { FontSet, FontVariants } from './fonts/types';
import { debugLog, setDebugEnabled } from './utils/debug';

/**
 * PDF backend for {@link RenderContext}. Drives a `pdf-lib` `PDFDocument`:
 * embeds fonts via fontkit, draws primitives on `PDFPage`, and applies the
 * PDF coordinate flip (y grows up from the bottom-left) in
 * {@link getLayoutBox}.
 *
 * This was previously named `RenderContext`. The rename makes the
 * backend-specific nature explicit and frees the `RenderContext` name for
 * the backend-neutral interface that widgets depend on.
 */
export class PdfRenderContext implements RenderContext {
  private options: RenderContextOptions;
  private theme?: Theme;
  private doc?: PDFDocument;
  private page: PDFPage | null;
  private dimensions?: [number, number];
  private fontCache: Map<string, PDFFont>;
  private textWidthCache: Map<string, number>;
  private fontkitRegisteredOnDoc = false;
  private fontkitInstance?: unknown;
  private fonts?: FontSet;

  constructor(options: RenderContextOptions) {
    this.options = options;
    this.page = null;
    this.dimensions = undefined;
    this.fontCache = new Map();
    this.textWidthCache = new Map();
  }

  // --- Theme / debug ---

  setDebug(enabled: boolean): void {
    this.options.debug = !!enabled;
    setDebugEnabled(this.options.debug);
  }

  setTheme(theme?: Theme): void {
    this.theme = theme;
  }

  getTheme(): Theme | undefined {
    return this.theme;
  }

  isDebugEnabled(): boolean {
    return !!this.options.debug;
  }

  getDebugStrokeWidth(): number {
    const w = this.options.debugStrokeWidth;
    return Number.isFinite(w) && (w as number) > 0 ? (w as number) : 0.5;
  }

  setDefaultDimensions(width: number, height: number): void {
    if (Number.isFinite(width) && width > 0) {
      this.options.width = width;
    }
    if (Number.isFinite(height) && height > 0) {
      this.options.height = height;
    }
  }

  getOptions(): RenderContextOptions {
    return this.options;
  }

  // --- Font registration (back-compat delegates to FontRegistry) ---

  /**
   * Doc-scoped font families (from `new PdfDoc({ fonts })`). Looked up
   * before the global {@link FontRegistry}, so two documents in one process
   * can use different bytes under the same family name.
   */
  setFonts(fonts?: FontSet): void {
    this.fonts = fonts;
  }

  getFonts(): FontSet | undefined {
    return this.fonts;
  }

  /**
   * @deprecated Font registration is now handled by {@link FontRegistry}.
   * Kept for back-comat; delegates to the shared registry.
   */
  static registerFont(fontName: string, fontData: Uint8Array | ArrayBuffer): void {
    FontRegistry.instance.registerFont(fontName, fontData);
  }

  /**
   * @deprecated Fontkit registration is now handled by {@link FontRegistry}.
   * Kept for back-comat; delegates to the shared registry.
   */
  static registerFontkit(fontkit: any): void {
    FontRegistry.instance.registerFontkit(fontkit);
  }

  // --- PDF document / page lifecycle ---

  setDocument(doc: PDFDocument): void {
    this.doc = doc;
  }

  getDocument(): PDFDocument {
    if (!this.doc) {
      throw new Error('No document set on RenderContext');
    }
    return this.doc;
  }

  addPage(dimensions: [number, number]): PDFPage {
    const page = this.getDocument().addPage(dimensions);
    this.setCurrentPage(page);
    return page;
  }

  getCurrentPage(): PDFPage | null {
    return this.page;
  }

  setCurrentPage(currentPage: PDFPage): void {
    this.page = currentPage;
    this.dimensions = [currentPage.getWidth(), currentPage.getHeight()];
  }

  /**
   * Adopts a page from a foreign `PDFDocument` (e.g. one loaded by the edit
   * module): the page object is copied into this document — content streams,
   * annotations, links, and form fields come along — and becomes the current
   * page, so subsequent drawing lands on top of the original content.
   */
  async adoptPage(source: unknown, pageIndex: number): Promise<void> {
    const doc = this.getDocument();
    const [copied] = await doc.copyPages(source as PDFDocument, [pageIndex]);
    this.setCurrentPage(doc.addPage(copied));
  }

  getPageHeight(): number {
    return this.getCurrentPage()?.getSize().height || this.options.height || 0;
  }

  getPageWidth(): number {
    return this.getCurrentPage()?.getSize().width || this.options.width || 0;
  }

  getDimensions(): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    const page = this.getCurrentPage();
    if (page) {
      return [page.getWidth(), page.getHeight()];
    }
    return [this.options.width || 0, this.options.height || 0];
  }

  // --- Layout box (PDF coordinate flip) ---

  /**
   * Maps a top-left-origin, page-relative box into PDF coordinates
   * (bottom-left origin, y grows up). This is the single place the PDF
   * Y-flip lives; {@link getLayoutBox} and the pagination scope both route
   * through it.
   */
  mapContentBox(box: { x: number; y: number; width: number; height: number }): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const pageHeight = this.getPageHeight();
    return {
      x: box.x,
      y: pageHeight - box.y - box.height,
      width: box.width,
      height: box.height,
    };
  }

  /**
   * Returns the widget's layout box in PDF coordinates (bottom-left origin,
   * y grows up). During pagination the per-page `PageScope` answers with
   * plan-driven boxes routed through {@link mapContentBox}; this direct path
   * serves non-paginated rendering (`overflow: false`, fitting documents).
   */
  getLayoutBox(widget: Widget): { x: number; y: number; width: number; height: number } {
    return this.mapContentBox(widget.getAbsoluteLayoutBox());
  }

  /** Pagination is not active on the raw backend; the per-page scope answers. */
  getFlowOffset(_widget: Widget): number {
    return 0;
  }

  // --- Font embedding / measurement ---

  async getFont(fontName: StandardFonts | string = StandardFonts.Helvetica): Promise<PDFFont> {
    const requestedName = resolveBuiltinPdfFont(fontName) ?? StandardFonts.Helvetica;
    const cached = this.fontCache.get(requestedName);
    if (cached) return cached;

    const doc = this.getDocument();
    const registry = FontRegistry.instance;

    // Doc-scoped resolution first (new PdfDoc({ fonts })), then the global
    // registry. In both, exact family names win: a family literally named
    // 'inter-bold' embeds as itself, never as the bold face of 'inter'.
    // Suffixed ids resolve through the family's faces, falling back (with
    // a warning) when a face is missing — bold-italic → bold → italic →
    // regular.
    let registered = this.fonts?.families.get(requestedName)?.regular;
    let faceNote: string | undefined;

    if (!registered) {
      const face = parseFaceId(requestedName);
      const variants: FontVariants | undefined = face
        ? this.fonts?.families.get(face.family)
        : undefined;
      if (face && variants) {
        const resolved = resolveFaceBytes(variants, face.style);
        registered = resolved.bytes;
        if (resolved.fellBack) {
          faceNote = `face '${requestedName}' is not available for family '${face.family}'; using its ${resolved.style} face`;
        }
      }
    }

    if (!registered) {
      registered = registry.getFontData(requestedName);
    }
    if (!registered) {
      const face = parseFaceId(requestedName);
      const familyBytes = face ? registry.getFontData(face.family) : undefined;
      if (face && familyBytes) {
        registered = familyBytes;
        faceNote = `family '${face.family}' is registered with a single face; using it for '${requestedName}'`;
      }
    }

    if (registered) {
      const fontkit = await this.ensureFontkit();
      if (!fontkit) {
        console.error(
          `RenderContext.getFont: custom font '${requestedName}' is registered, but fontkit could not be loaded. ` +
          `Falling back to '${StandardFonts.Helvetica}'. Ensure '@pdf-lib/fontkit' is installed.`
        );
        return this.getFont(StandardFonts.Helvetica);
      }
      if (!this.fontkitRegisteredOnDoc) {
        (doc as any).registerFontkit?.(fontkit);
        this.fontkitRegisteredOnDoc = true;
      }
      const font = await doc.embedFont(registered as any);
      this.fontCache.set(requestedName, font);
      if (faceNote) {
        console.warn(`RenderContext.getFont: ${faceNote}.`);
      }
      // Canvas-based measurement (pretext) needs the face registered under
      // the same name in the browser font set; no-op outside the browser.
      await registry.loadBrowserFont(requestedName, registered);
      return font;
    }

    if (typeof requestedName === 'string' && !FontRegistry.isStandardFontName(requestedName)) {
      console.warn(
        `RenderContext.getFont: font '${requestedName}' is not registered and is not a StandardFonts value. ` +
        `Falling back to '${StandardFonts.Helvetica}'.`
      );
      return this.getFont(StandardFonts.Helvetica);
    }

    const font = await doc.embedFont(requestedName as any);
    this.fontCache.set(requestedName, font);
    return font;
  }

  /**
   * The fontkit instance used to embed custom fonts: an explicitly
   * registered one (via {@link FontRegistry}) first, then a lazy dynamic
   * import of `@pdf-lib/fontkit` — so documents with custom fonts need no
   * `registerFontkit` call.
   */
  private async ensureFontkit(): Promise<unknown | undefined> {
    if (this.fontkitInstance) return this.fontkitInstance;

    const fromRegistry = FontRegistry.instance.getFontkit();
    if (fromRegistry) {
      this.fontkitInstance = fromRegistry;
      return fromRegistry;
    }

    try {
      const mod = await import('@pdf-lib/fontkit');
      const instance = (mod as { default?: unknown }).default ?? mod;
      this.fontkitInstance = instance;
      return instance;
    } catch (err) {
      debugLog('ensureFontkit: dynamic import of @pdf-lib/fontkit failed', err);
      return undefined;
    }
  }

  async preloadFont(fontName: StandardFonts | string = StandardFonts.Helvetica): Promise<void> {
    if (!this.doc) {
      // Measurement-only passes (e.g. PdfDoc.getPageCount() before save())
      // have no document to embed into; text measurement falls back to the
      // width estimate until save() embeds the font.
      debugLog('preloadFont: no document set; skipping font embedding');
      return;
    }
    await this.getFont(fontName);
  }

  measureTextWidth(text: string, size: number, fontName: StandardFonts | string = StandardFonts.Helvetica): number {
    const cacheKey = `${fontName}\u0000${size}\u0000${text}`;
    const cachedWidth = this.textWidthCache.get(cacheKey);
    if (cachedWidth !== undefined) {
      return cachedWidth;
    }

    let measuredWidth: number;
    const font = this.fontCache.get(fontName);
    if (font) {
      measuredWidth = font.widthOfTextAtSize(text, size);
    } else {
      measuredWidth = text.length * size * 0.6;
    }

    this.textWidthCache.set(cacheKey, measuredWidth);
    return measuredWidth;
  }

  /**
   * Typographic (hhea) metrics for embedded custom fonts, via pdf-lib's
   * fontkit embedder. pdf-lib's `heightAtSize` is bbox-based — its
   * `descender: false` variant returns the bbox yMax, which sits far below
   * the real ascender for fonts like Inter and made line boxes bottom-heavy.
   * Standard fonts have no fontkit font; their AFM metrics are already
   * typographic, so the bbox path is correct for them.
   */
  private customFontMetrics(fontName: StandardFonts | string): {
    ascent: number;
    descent: number;
    unitsPerEm: number;
  } | undefined {
    const font = this.fontCache.get(fontName);
    const fkFont = (
      font as unknown as {
        embedder?: { font?: { hhea?: { ascent?: number; descent?: number }; unitsPerEm?: number } };
      }
    )?.embedder?.font;
    const hhea = fkFont?.hhea;
    const unitsPerEm = fkFont?.unitsPerEm;
    if (
      !hhea ||
      typeof hhea.ascent !== 'number' ||
      typeof hhea.descent !== 'number' ||
      typeof unitsPerEm !== 'number' ||
      unitsPerEm <= 0
    ) {
      return undefined;
    }
    return { ascent: hhea.ascent, descent: hhea.descent, unitsPerEm };
  }

  measureFontHeight(
    size: number,
    fontName: StandardFonts | string = StandardFonts.Helvetica,
    options?: { descender?: boolean },
  ): number {
    const font = this.fontCache.get(fontName);
    if (!font) {
      return size;
    }

    if (options?.descender === false) {
      return this.measureFontAscent(size, fontName);
    }

    const metrics = this.customFontMetrics(fontName);
    if (metrics) {
      return ((metrics.ascent - metrics.descent) / metrics.unitsPerEm) * size;
    }

    return font.heightAtSize(size);
  }

  measureDefaultLineHeight(size: number, fontName: StandardFonts | string = StandardFonts.Helvetica): number {
    const fontHeight = this.measureFontHeight(size, fontName);
    return fontHeight + fontHeight * 0.2;
  }

  measureFontAscent(size: number, fontName: StandardFonts | string = StandardFonts.Helvetica): number {
    const font = this.fontCache.get(fontName);
    if (!font) {
      return size;
    }

    const metrics = this.customFontMetrics(fontName);
    if (metrics) {
      return (metrics.ascent / metrics.unitsPerEm) * size;
    }

    return font.heightAtSize(size, { descender: false });
  }

  // --- Image embedding ---

  async embedImage(bytes: ArrayBuffer, format: 'png' | 'jpeg'): Promise<RenderImage> {
    const doc = this.getDocument();
    if (format === 'png') {
      return doc.embedPng(bytes);
    }

    return doc.embedJpg(bytes);
  }

  // --- Drawing primitives ---

  private requireCurrentPage(): PDFPage {
    if (!this.page) {
      throw new Error('No current page in RenderContext');
    }

    return this.page;
  }

  drawRectangle(args: DrawRectangleArgs): void {
    this.requireCurrentPage().drawRectangle({
      ...args,
      color: toPdfLibColor(args.color),
      borderColor: toPdfLibColor(args.borderColor),
    });
  }

  async drawText({ text, x, y, size, color, fontName, maxWidth }: DrawTextArgs): Promise<void> {
    const font = await this.getFont(fontName);
    this.requireCurrentPage().drawText(text, {
      x,
      y,
      size,
      font,
      color: toPdfLibColor(color),
      maxWidth,
    });
  }

  drawLine(args: DrawLineArgs): void {
    this.requireCurrentPage().drawLine({
      ...args,
      color: toPdfLibColor(args.color),
    });
  }

  drawImage(image: RenderImage, args: DrawImageArgs): void {
    this.requireCurrentPage().drawImage(image, args);
  }

  drawSvgPath({ d, ...options }: DrawSvgPathArgs): void {
    this.requireCurrentPage().drawSvgPath(d, {
      ...options,
      color: toPdfLibColor(options.color),
      borderColor: toPdfLibColor(options.borderColor),
    });
  }

  addLinkAnnotation({ href, rect }: LinkAnnotationArgs): void {
    const page = this.requireCurrentPage();
    const doc: any = this.getDocument() as any;
    const pdfContext: any = doc.context;

    const linkAnnot = pdfContext.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: rect,
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(href),
      },
    });

    const linkRef = pdfContext.register(linkAnnot);
    const pageNode: any = (page as any).node;
    const annotsKey = PDFName.of('Annots');

    let annots = pageNode.get(annotsKey);
    if (!annots) {
      annots = pdfContext.obj([]);
      pageNode.set(annotsKey, annots);
    }

    const annotsArray: any = pdfContext.lookup(annots, PDFArray);
    annotsArray.push(linkRef);
  }
}
