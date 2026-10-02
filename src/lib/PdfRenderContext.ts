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
import { setDebugEnabled } from './utils/debug';

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

  // --- Font registration (back-comat delegates to FontRegistry) ---

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
   * Returns the widget's layout box in PDF coordinates (bottom-left origin,
   * y grows up). Yoga uses top-left origin with y growing down, so we flip.
   *
   * This is used only for non-paginated rendering (e.g. `overflow: false`
   * legacy path, or widgets rendered outside pagination). During pagination
   * the page computes each widget's per-page PDF coords explicitly and calls
   * `renderAt`.
   */
  getLayoutBox(widget: Widget): { x: number; y: number; width: number; height: number } {
    const { x, y, width, height } = widget.getAbsoluteLayoutBox();
    const pageHeight = this.getPageHeight();
    return {
      x,
      y: pageHeight - y - height,
      width,
      height,
    };
  }

  // --- Font embedding / measurement ---

  async getFont(fontName: StandardFonts | string = StandardFonts.Helvetica): Promise<PDFFont> {
    const requestedName = resolveBuiltinPdfFont(fontName) ?? StandardFonts.Helvetica;
    const cached = this.fontCache.get(requestedName);
    if (cached) return cached;

    const doc = this.getDocument();
    const registry = FontRegistry.instance;
    const registered = registry.getFontData(requestedName);
    const fontkit = registry.getFontkit();

    if (registered && !fontkit) {
      console.error(
        `RenderContext.getFont: custom font '${requestedName}' is registered, but fontkit is not. ` +
        `Falling back to '${StandardFonts.Helvetica}'. Install '@pdf-lib/fontkit' and call PdfDoc.registerFontkit(fontkit) to enable custom fonts.`
      );
      return this.getFont(StandardFonts.Helvetica);
    }
    if (registered && fontkit && !this.fontkitRegisteredOnDoc) {
      (doc as any).registerFontkit?.(fontkit);
      this.fontkitRegisteredOnDoc = true;
    }

    if (!registered && typeof requestedName === 'string' && !FontRegistry.isStandardFontName(requestedName)) {
      console.warn(
        `RenderContext.getFont: font '${requestedName}' is not registered and is not a StandardFonts value. ` +
        `Falling back to '${StandardFonts.Helvetica}'.`
      );
      return this.getFont(StandardFonts.Helvetica);
    }

    const font = registered
      ? await doc.embedFont(registered as any)
      : await doc.embedFont(requestedName as any);
    this.fontCache.set(requestedName, font);
    return font;
  }

  async preloadFont(fontName: StandardFonts | string = StandardFonts.Helvetica): Promise<void> {
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

  measureFontHeight(
    size: number,
    fontName: StandardFonts | string = StandardFonts.Helvetica,
    options?: { descender?: boolean },
  ): number {
    const font = this.fontCache.get(fontName);
    if (font) {
      return font.heightAtSize(size, options);
    }

    return size;
  }

  measureDefaultLineHeight(size: number, fontName: StandardFonts | string = StandardFonts.Helvetica): number {
    const fontHeight = this.measureFontHeight(size, fontName);
    return fontHeight + fontHeight * 0.2;
  }

  measureFontAscent(size: number, fontName: StandardFonts | string = StandardFonts.Helvetica): number {
    return this.measureFontHeight(size, fontName, { descender: false });
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
