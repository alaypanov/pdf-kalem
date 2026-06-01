import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import type { Theme } from './Theme';
import { PageSize, PDFDocSize } from './types/doc-sizes';
import { PageWidget } from './Page';
import { PDFDocument } from 'pdf-lib';
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
  context: RenderContext;
  root: PdfDoc;
}

export interface PdfDocAfterSaveArgs {
  doc: PDFDocument;
  context: RenderContext;
  root: PdfDoc;
  bytes: Uint8Array;
}

export class PdfDoc extends Widget {
  private static globalBeforeCreate: Array<(args: PdfDocBeforeCreateArgs) => Awaitable<void>> = [];
  private static globalAfterSave: Array<(args: PdfDocAfterSaveArgs) => Awaitable<void>> = [];
  private static browserFontLoads: Map<string, Promise<void>> = new Map();

  private static async registerBrowserFont(fontName: string, fontData: Uint8Array): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }

    const fontSet = document.fonts as FontFaceSet & {
      add(font: FontFace): FontFaceSet;
      ready: Promise<FontFaceSet>;
    };

    const cachedLoad = PdfDoc.browserFontLoads.get(fontName);
    if (cachedLoad) {
      await cachedLoad;
      return;
    }

    const loadPromise = (async () => {
      try {
        const fontSource = fontData.slice().buffer;
        const fontFace = new FontFace(fontName, fontSource);
        const loadedFont = await fontFace.load();
        fontSet.add(loadedFont);
        await fontSet.ready;
      } catch (err) {
        console.warn(`PdfDoc.registerBrowserFont: failed to load '${fontName}' into browser fonts`, err);
      }
    })();

    PdfDoc.browserFontLoads.set(fontName, loadPromise);
    await loadPromise;
  }

  static async registerFontFromUrl(fontName: string, url: string): Promise<boolean> {
    const name = fontName?.trim();
    const fontUrl = url?.trim();

    if (!name || !fontUrl) {
      console.error('PdfDoc.registerFontFromUrl: fontName and url are required');
      return false;
    }

    try {
      const res = await fetch(fontUrl);
      if (!res.ok) {
        console.error(
          `PdfDoc.registerFontFromUrl: failed to fetch '${fontUrl}' (${res.status} ${res.statusText})`
        );
        return false;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      PdfDoc.registerFont(name, bytes);
      await PdfDoc.registerBrowserFont(name, bytes);
      return true;
    } catch (err) {
      console.error(`PdfDoc.registerFontFromUrl: failed to load '${name}' from '${fontUrl}'`, err);
      return false;
    }
  }

  static async registerFonts(fonts: Record<string, string>): Promise<void> {
    // Example:
    // await PdfDoc.registerFonts({ Inter: '/fonts/Inter-Regular.ttf' })
    const entries = Object.entries(fonts ?? {});
    for (const [fontName, url] of entries) {
      await PdfDoc.registerFontFromUrl(fontName, url);
    }
  }

  static registerFont(fontName: string, fontData: Uint8Array | ArrayBuffer): void {
    RenderContext.registerFont(fontName, fontData);
  }

  static registerFontkit(fontkit: any): void {
    RenderContext.registerFontkit(fontkit);
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

  // Using protected instead of private to indicate these might be used by subclasses
  protected size?: PageSize; // Can be undefined if customSize is used
  protected dimensions?: [number, number];
  protected layout: 'portrait' | 'landscape';
  protected theme?: Theme;
  protected meta?: PdfDocMeta;
  protected beforeCreate?: (args: PdfDocBeforeCreateArgs) => Awaitable<void>;
  protected afterSave?: (args: PdfDocAfterSaveArgs) => Awaitable<void>;
  // protected children: Widget[];

  constructor(options: PdfDocOptions = {}, context: RenderContext = new RenderContext({})) {
    super(options);
    super.setContext(context);

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

    // Make doc dimensions available to Pages that don't specify size/dimensions.
    context.setDefaultDimensions(this.getWidth(), this.getHeight());

    console.log('PdfDoc children:', this.children);

    // Enforce only PageWidget children
    for (const child of this.children) {
      if (!(child instanceof PageWidget)) {
        throw new Error('PdfDoc children must be instances of PageWidget');
      }
    }
  }

  getMeta(): PdfDocMeta | undefined {
    return this.meta;
  }

  getTheme(): Theme | undefined {
    return this.theme;
  }

  async render(context: RenderContext): Promise<void> {
    console.log('Drawing doc');
    await this.renderChildren(context);
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
    console.log('getWidth: ', width);
    return this.layout === 'portrait' ? width : height;
  }

  getHeight(): number {
    const [width, height] = this.getDimensions();
    console.log('getHeight: ', height);
    return this.layout === 'portrait' ? height : width;
  }

  async savePdf(): Promise<Uint8Array> {
    if (!this.context) {
      throw new Error('PdfDoc has no RenderContext set');
    }

    for (const hook of PdfDoc.globalBeforeCreate) {
      await hook({ context: this.context, root: this });
    }
    await this.beforeCreate?.({ context: this.context, root: this });

    const pdfDoc = await PDFDocument.create();
    applyMeta(pdfDoc, this.getMeta());
    this.context.setDocument(pdfDoc);

    await this.render(this.context);
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