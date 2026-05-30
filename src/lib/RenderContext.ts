import {
  PDFArray,
  PDFDocument,
  PDFImage,
  PDFName,
  PDFPage,
  PDFString,
  PDFFont,
  StandardFonts,
  type Color,
} from 'pdf-lib';

export interface RenderContextOptions {
  height?: number; // Default page height if needed before page creation
  width?: number;  // Default page width if needed before page creation
  // Removed margin, handled by layout engine

  /**
   * When enabled, widgets can draw visual debug outlines.
   * This must not affect Yoga layout; it only impacts rendering.
   */
  debug?: boolean;

  /** Border stroke width for debug outlines (PDF points). */
  debugStrokeWidth?: number;
}

export type RenderColor = Color;
export type RenderImage = PDFImage;

export interface DrawRectangleArgs {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: RenderColor;
  borderWidth?: number;
  borderColor?: RenderColor;
}

export interface DrawTextArgs {
  text: string;
  x: number;
  y: number;
  size: number;
  color?: RenderColor;
  fontName?: StandardFonts | string;
  maxWidth?: number;
}

export interface DrawLineArgs {
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  color?: RenderColor;
}

export interface DrawImageArgs {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawSvgPathArgs {
  d: string;
  x: number;
  y: number;
  scale: number;
  color?: RenderColor;
  borderColor?: RenderColor;
  borderWidth?: number;
}

export interface LinkAnnotationArgs {
  href: string;
  rect: [number, number, number, number];
}


export class RenderContext {
  private static registeredFonts: Map<string, Uint8Array> = new Map();
  private static fontkit: any | undefined;

  private options: RenderContextOptions;
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

  setDebug(enabled: boolean): void {
    this.options.debug = !!enabled;
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


  setDocument(doc: PDFDocument): void {
    this.doc = doc;
  }

  addPage(dimensions: [number, number]): PDFPage {
    const page = this.getDocument().addPage(dimensions);
    this.setCurrentPage(page);
    return page;
  }

  static registerFont(fontName: string, fontData: Uint8Array | ArrayBuffer): void {
    const name = fontName?.trim();
    if (!name) throw new Error('registerFont: fontName is required');
    const bytes = fontData instanceof Uint8Array ? fontData : new Uint8Array(fontData);
    if (bytes.byteLength === 0) throw new Error('registerFont: fontData is empty');
    RenderContext.registeredFonts.set(name, bytes);
  }

  static registerFontkit(fontkit: any): void {
    RenderContext.fontkit = fontkit;
  }

  private static isStandardFontName(fontName: string): boolean {
    return (Object.values(StandardFonts) as string[]).includes(fontName);
  }

  async getFont(fontName: StandardFonts | string = StandardFonts.Helvetica): Promise<PDFFont> {
    const requestedName = fontName;
    const cached = this.fontCache.get(requestedName);
    if (cached) return cached;

    const doc = this.getDocument();

    const registered = RenderContext.registeredFonts.get(requestedName);
    if (registered && !RenderContext.fontkit) {
      console.error(
        `RenderContext.getFont: custom font '${requestedName}' is registered, but fontkit is not. ` +
        `Falling back to '${StandardFonts.Helvetica}'. Install '@pdf-lib/fontkit' and call PdfDoc.registerFontkit(fontkit) to enable custom fonts.`
      );
      return this.getFont(StandardFonts.Helvetica);
    }
    if (registered && RenderContext.fontkit && !this.fontkitRegisteredOnDoc) {
      (doc as any).registerFontkit?.(RenderContext.fontkit);
      this.fontkitRegisteredOnDoc = true;
    }

    if (!registered && typeof requestedName === 'string' && !RenderContext.isStandardFontName(requestedName)) {
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

  async embedImage(bytes: ArrayBuffer, format: 'png' | 'jpeg'): Promise<RenderImage> {
    const doc = this.getDocument();
    if (format === 'png') {
      return doc.embedPng(bytes);
    }

    return doc.embedJpg(bytes);
  }

  getDocument(): PDFDocument {
    if (!this.doc) {
      throw new Error('No document set on RenderContext');
    }
    return this.doc;
  }

  private requireCurrentPage(): PDFPage {
    if (!this.page) {
      throw new Error('No current page in RenderContext');
    }

    return this.page;
  }

  getCurrentPage(): PDFPage | null {
    return this.page;
  }

  drawRectangle(args: DrawRectangleArgs): void {
    this.requireCurrentPage().drawRectangle(args);
  }

  async drawText({ text, x, y, size, color, fontName, maxWidth }: DrawTextArgs): Promise<void> {
    const font = await this.getFont(fontName);
    this.requireCurrentPage().drawText(text, {
      x,
      y,
      size,
      font,
      color,
      maxWidth,
    });
  }

  drawLine(args: DrawLineArgs): void {
    this.requireCurrentPage().drawLine(args);
  }

  drawImage(image: RenderImage, args: DrawImageArgs): void {
    this.requireCurrentPage().drawImage(image, args);
  }

  drawSvgPath({ d, ...options }: DrawSvgPathArgs): void {
    this.requireCurrentPage().drawSvgPath(d, options);
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

  setCurrentPage(currentPage: PDFPage): void {
    this.page = currentPage;
    this.dimensions = [currentPage.getWidth(), currentPage.getHeight()];
  }

  getOptions(): RenderContextOptions {
    return this.options;
  }

}