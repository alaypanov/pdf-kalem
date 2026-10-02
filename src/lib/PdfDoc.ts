import { Widget, WidgetOptions } from './Widget';
import { PdfRenderContext } from './PdfRenderContext';
import type { Theme } from './Theme';
import { PageSize, PDFDocSize } from './types/doc-sizes';
import { PageWidget } from './Page';
import { PDFDocument } from 'pdf-lib';
import { PdfRenderer } from './PdfRenderer';
import { FontRegistry } from './FontRegistry';
// Changed PDFDocSize to a constant object

type Awaitable<T> = T | Promise<T>;
type NodeBufferLike = Uint8Array;
type NodeFsLike = {
  writeFile(path: string, data: NodeBufferLike): Promise<void>;
};

function getNodeBufferFactory(): { from(data: Uint8Array): NodeBufferLike } | undefined {
  const maybeBuffer = (globalThis as typeof globalThis & {
    Buffer?: { from(data: Uint8Array): NodeBufferLike };
  }).Buffer;

  if (!maybeBuffer || typeof maybeBuffer.from !== 'function') {
    return undefined;
  }

  return maybeBuffer;
}

async function getNodeFs(): Promise<NodeFsLike> {
  try {
    const loadFs = new Function("return import('node:fs/promises')") as () => Promise<NodeFsLike>;
    return await loadFs();
  } catch (err) {
    throw new Error('node:fs/promises is not available in this runtime', { cause: err });
  }
}

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
 * layout node. Rendering is delegated to {@link PdfRenderer}, and runtime
 * helpers (blob/download/buffer/file) live on PdfDoc as convenience methods.
 */
export class PdfDoc {
  private static globalBeforeCreate: Array<(args: PdfDocBeforeCreateArgs) => Awaitable<void>> = [];
  private static globalAfterSave: Array<(args: PdfDocAfterSaveArgs) => Awaitable<void>> = [];

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

  static beforeCreate(hook: (args: PdfDocBeforeCreateArgs) => Awaitable<void>): void {
    PdfDoc.globalBeforeCreate.push(hook);
  }

  static afterSave(hook: (args: PdfDocAfterSaveArgs) => Awaitable<void>): void {
    PdfDoc.globalAfterSave.push(hook);
  }

  static clearHooks(): void {
    PdfDoc.globalBeforeCreate = [];
    PdfDoc.globalAfterSave = [];
  }

  protected size?: PageSize; // Can be undefined if customSize is used
  protected dimensions?: [number, number];
  protected layout: 'portrait' | 'landscape';
  protected theme?: Theme;
  protected meta?: PdfDocMeta;
  protected beforeCreate?: (args: PdfDocBeforeCreateArgs) => Awaitable<void>;
  protected afterSave?: (args: PdfDocAfterSaveArgs) => Awaitable<void>;
  protected readonly children: Widget[];
  protected readonly context: PdfRenderContext;

  constructor(options: PdfDocOptions = {}, context: PdfRenderContext = new PdfRenderContext({})) {
    this.context = context;

    if (options.debug !== undefined) {
      context.setDebug(!!options.debug);
    }

    this.theme = options.theme;
    context.setTheme(this.theme);

    // Prioritize customSize if provided
    if (options.dimensions) {
      this.dimensions = options.dimensions;
      this.size = undefined; // Ensure size is not set if customSize is used
    } else {
      this.size = options.size; // Default to A4 if neither is provided
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
  }

  getContext(): PdfRenderContext {
    return this.context;
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

  private getDimensions(): number[] {
    if (this.dimensions) {
      return this.dimensions;
    }

    // Use standard size, default to A4 if size is somehow undefined (shouldn't happen with constructor logic)
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
    for (const hook of PdfDoc.globalBeforeCreate) {
      await hook({ context: this.context, root: this });
    }
    await this.beforeCreate?.({ context: this.context, root: this });

    const pdfDoc = await PDFDocument.create();
    applyMeta(pdfDoc, this.getMeta());
    this.context.setDocument(pdfDoc);

    const renderer = new PdfRenderer(this);
    await renderer.render();

    const bytes = await pdfDoc.save();

    await this.afterSave?.({ doc: pdfDoc, context: this.context, root: this, bytes });
    for (const hook of PdfDoc.globalAfterSave) {
      await hook({ doc: pdfDoc, context: this.context, root: this, bytes });
    }

    return bytes;
  }

  async getBlob(): Promise<Blob> {
    if (typeof Blob === 'undefined') {
      throw new Error('Blob is not available in this runtime');
    }

    const bytes = await this.savePdf();
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }

  async download(fileName = 'document.pdf'): Promise<void> {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('PdfDoc.download is only available in browser-like runtimes');
    }

    const blob = await this.getBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async getBuffer(): Promise<NodeBufferLike> {
    const bufferFactory = getNodeBufferFactory();
    if (!bufferFactory) {
      throw new Error('Node Buffer is not available in this runtime');
    }

    const bytes = await this.savePdf();
    return bufferFactory.from(bytes);
  }

  async writeToFile(filePath: string): Promise<void> {
    if (!filePath.trim()) {
      throw new Error('PdfDoc.writeToFile requires a file path');
    }

    const fsModule = await getNodeFs();
    const buffer = await this.getBuffer();
    await fsModule.writeFile(filePath, buffer);
  }

  async save(): Promise<Uint8Array> {
    return this.savePdf();
  }
}

// export function PdfDocWidgetFactory(options: PdfDocOptions = {}): PdfDoc {
//   return new PdfDoc(options);
// }

// Back-compat exports (older names)
// export type PdfDocOptions = PdfDocOptions;
export { PdfDoc as PdfDocWidget };
