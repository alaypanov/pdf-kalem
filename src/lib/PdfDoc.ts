import { Widget, WidgetOptions } from './Widget';
import { PdfRenderContext } from './PdfRenderContext';
import type { Theme } from './Theme';
import { PageSize, PDFDocSize } from './types/doc-sizes';
import { PageWidget } from './Page';
import { PDFDocument } from 'pdf-lib';
import { FontRegistry } from './FontRegistry';
import { Paginator } from './pagination/Paginator';
import type { FontSet } from './fonts/types';
import { downloadBytes, printBytes, toBlob, toBuffer, writeBytesToFile, type NodeBufferLike } from './doc-output';
import { bindFormData } from './forms/bind';

type Awaitable<T> = T | Promise<T>;

function applyMeta(doc: PDFDocument, meta?: PdfDocMeta): void {
  if (!meta) return;
  const title = meta.title?.trim();
  const author = meta.author?.trim();
  const subject = meta.subject?.trim();
  const language = meta.language?.trim();
  const creator = meta.creator?.trim();
  const producer = meta.producer?.trim();

  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  if (meta.keywords && meta.keywords.length > 0) doc.setKeywords(meta.keywords);
  if (language) doc.setLanguage(language);
  if (creator) doc.setCreator(creator);
  if (producer) doc.setProducer(producer);
  if (meta.creationDate) doc.setCreationDate(meta.creationDate);
  if (meta.modificationDate) doc.setModificationDate(meta.modificationDate);
}

export interface PdfDocOptions extends WidgetOptions {
  size?: PageSize; // Use standard size names
  dimensions?: [number, number]; // Optional custom dimensions
  layout?: 'portrait' | 'landscape';
  theme?: Theme;
  /**
   * Font families for this document, from {@link useFonts}. Applied over the
   * theme's font mapping at construction (doc-level wins; the theme object
   * is never mutated) and resolved doc-scoped during rendering.
   */
  fonts?: FontSet;
  /**
   * Data binding: values applied to the tree's form widgets (`pdf-kalem/forms`)
   * by AcroForm field name — the widgets' `name`. Applied in the constructor;
   * wins over per-widget `value`/`checked` options. Type mismatches throw
   * (text wants a string, checkbox a boolean, dropdown/radio a declared
   * option); keys matching no field warn. The same tree-builder with
   * different `formData` produces filled variants of one template.
   */
  formData?: Record<string, string | boolean>;
  /** Enables drawing colored debug outlines around every widget. */
  debug?: boolean;
  meta?: PdfDocMeta;
  beforeCreate?: (args: PdfDocBeforeCreateArgs) => Awaitable<void>;
  afterSave?: (args: PdfDocAfterSaveArgs) => Awaitable<void>;
  children?: Widget[];
}

export interface PdfDocMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  language?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export interface PdfDocBeforeCreateArgs {
  context: PdfRenderContext;
  root: PdfDoc;
}

export interface PdfDocAfterSaveArgs {
  doc: PDFDocument;
  context: PdfRenderContext;
  root: PdfDoc;
  bytes: Uint8Array;
}

/**
 * PdfDoc is the document model: it owns the page tree, theme, metadata, and
 * lifecycle hooks. It is intentionally not a Widget — a document is not a
 * layout node. Rendering is the save-time walk over the page tree; output
 * mechanics (blob/download/buffer/file) delegate to the runtime adapters in
 * `doc-output.ts`.
 */
export class PdfDoc {
  /**
   * Registers a font from `url`, stores its bytes in {@link FontRegistry},
   * and loads it into the browser font set (for canvas-based measurement via
   * pretext). Delegates to the shared registry so any future backend
   * (ImageDoc, EmailDoc) sees the same registered fonts.
   */
  static async registerFontFromUrl(fontName: string, url: string): Promise<boolean> {
    return FontRegistry.instance.registerFontFromUrl(fontName, url);
  }

  /**
   * Bulk {@link registerFontFromUrl}. `fonts` maps font name → URL.
   */
  static async registerFonts(fonts: Record<string, string>): Promise<void> {
    await FontRegistry.instance.registerFonts(fonts);
  }

  /**
   * Registers raw font bytes under `fontName`. Delegates to the shared
   * {@link FontRegistry}.
   */
  static registerFont(fontName: string, fontData: Uint8Array | ArrayBuffer): void {
    FontRegistry.instance.registerFont(fontName, fontData);
  }

  static registerFontkit(fontkit: any): void {
    FontRegistry.instance.registerFontkit(fontkit);
  }

  protected size?: PageSize; // Can be undefined if customSize is used
  protected dimensions?: [number, number];
  protected layout: 'portrait' | 'landscape';
  protected theme?: Theme;
  protected fonts?: FontSet;
  protected meta?: PdfDocMeta;
  protected beforeCreate?: (args: PdfDocBeforeCreateArgs) => Awaitable<void>;
  protected afterSave?: (args: PdfDocAfterSaveArgs) => Awaitable<void>;
  protected readonly children: Widget[];
  protected readonly context: PdfRenderContext;
  private cachedPageCount?: number;

  constructor(options: PdfDocOptions = {}, context: PdfRenderContext = new PdfRenderContext({})) {
    this.context = context;

    if (options.debug !== undefined) {
      context.setDebug(!!options.debug);
    }

    this.theme = this.deriveTheme(options.theme, options.fonts);
    this.fonts = options.fonts;
    context.setTheme(this.theme);
    if (options.fonts) {
      context.setFonts(options.fonts);
    }

    // Prioritize customSize if provided
    if (options.dimensions) {
      this.dimensions = options.dimensions;
      this.size = undefined; // Ensure size is not set if customSize is used
    } else {
      this.size = options.size; // Default to LETTER if neither is provided
      this.dimensions = PDFDocSize[options.size || PageSize.LETTER] as [number, number];
    }
    this.layout = options.layout || 'portrait';
    this.meta = options.meta;
    this.beforeCreate = options.beforeCreate;
    this.afterSave = options.afterSave;
    this.children = options.children || [];

    // Wire the widget tree to the render context (propagates theme, context
    // to every widget without PdfDoc itself being part of the yoga tree).
    for (const child of this.children) {
      child.setContext(context);
    }

    // Make doc dimensions available to Pages that don't specify size/dimensions.
    context.setDefaultDimensions(this.getWidth(), this.getHeight());

    // Enforce only PageWidget children
    for (const child of this.children) {
      if (!(child instanceof PageWidget)) {
        throw new Error('PdfDoc children must be instances of PageWidget');
      }
    }

    // A pageless document would save as a degenerate PDF that loads back as
    // one phantom page — fail fast instead (B20).
    if (this.children.length === 0) {
      throw new Error(
        'PdfDoc requires at least one Page child — pass Page({ ... }) widgets in children.'
      );
    }

    // Data binding runs once, at construction: the widget tree is the state,
    // so bound values land on the widgets exactly like option values would.
    if (options.formData) {
      bindFormData(this.children, options.formData);
    }
  }

  getContext(): PdfRenderContext {
    return this.context;
  }

  /**
   * Total number of output pages, computed by running the pagination plan
   * for every Page widget (a dry run: no drawing, no pages added).
   * Memoized — plans are pure, so the count is stable for an unchanged tree.
   *
   * Text metrics are exact once fonts have been embedded by {@link save};
   * before that, un-embedded fonts fall back to estimated widths. Trees
   * containing images need a created document (call after save, e.g. in an
   * `afterSave` hook) because image embedding requires one.
   */
  async getPageCount(): Promise<number> {
    if (this.cachedPageCount !== undefined) return this.cachedPageCount;

    const paginator = new Paginator();
    let count = 0;
    for (const child of this.children) {
      const pagination = await paginator.paginate(child as PageWidget, this.context);
      count += pagination.pageCount;
    }

    this.cachedPageCount = count;
    return count;
  }

  getChildren(): Widget[] {
    return this.children;
  }

  getMeta(): PdfDocMeta | undefined {
    return this.meta;
  }

  getTheme(): Theme | undefined {
    return this.theme;
  }

  getFonts(): FontSet | undefined {
    return this.fonts;
  }

  /**
   * The doc's effective theme: the user's theme with the FontSet's font
   * tokens applied over it (doc-level wins). Returns a NEW object — the
   * user's theme value is never mutated, so theme objects can be shared
   * across documents safely.
   */
  private deriveTheme(theme: Theme | undefined, fonts: FontSet | undefined): Theme | undefined {
    if (!fonts) return theme;
    const tokens = fonts.tokens;
    if (Object.keys(tokens).length === 0) return theme;
    return { ...theme, fonts: { ...theme?.fonts, ...tokens } };
  }

  private getDimensions(): number[] {
    if (this.dimensions) {
      return this.dimensions;
    }

    // Use standard size, default to LETTER if size is somehow undefined (shouldn't happen with constructor logic)
    return PDFDocSize[PageSize.LETTER]
  }

  getWidth(): number {
    const [width, height] = this.getDimensions();
    return this.layout === 'portrait' ? width : height;
  }

  getHeight(): number {
    const [width, height] = this.getDimensions();
    return this.layout === 'portrait' ? height : width;
  }

  async savePdf(): Promise<Uint8Array> {
    await this.beforeCreate?.({ context: this.context, root: this });

    const pdfDoc = await PDFDocument.create();
    applyMeta(pdfDoc, this.getMeta());
    this.context.setDocument(pdfDoc);

    // Any dry run before this save measured with un-embedded fonts; the real
    // count — and any later dry run — must recompute with embedded metrics (B9).
    this.cachedPageCount = undefined;

    // The render walk is the save-time strategy itself — the constructor
    // enforces that every child is a PageWidget, so there is nothing here
    // worth a separate module (I5: the former PdfRenderer was a pass-through).
    for (const page of this.children) {
      await page.render(this.context);
    }

    const bytes = await pdfDoc.save();

    await this.afterSave?.({ doc: pdfDoc, context: this.context, root: this, bytes });

    return bytes;
  }

  async getBlob(): Promise<Blob> {
    return toBlob(await this.savePdf());
  }

  async download(fileName = 'document.pdf'): Promise<void> {
    downloadBytes(await this.savePdf(), fileName);
  }

  /**
   * Opens the browser's print dialog with the generated PDF. Browser-only.
   * See `printBytes` in `doc-output.ts` for the mechanics and the Safari
   * caveat.
   */
  async print(): Promise<void> {
    printBytes(await this.savePdf());
  }

  async getBuffer(): Promise<NodeBufferLike> {
    return toBuffer(await this.savePdf());
  }

  async writeToFile(filePath: string): Promise<void> {
    if (!filePath.trim()) {
      throw new Error('PdfDoc.writeToFile requires a file path');
    }

    await writeBytesToFile(await this.savePdf(), filePath);
  }

  async save(): Promise<Uint8Array> {
    return this.savePdf();
  }
}

export { PdfDoc as PdfDocWidget };
