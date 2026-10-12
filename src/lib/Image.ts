import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderImage } from './RenderContextTypes';
import {
  ImageSizing,
  aspectFitMeasure,
  aspectFitPlacement,
  type FitSpec,
} from './aspect-fit';
import { sniffImageFormat } from './utils/image-format';

// Compat re-export: ImageSizing is the shared fit vocabulary (defined in
// aspect-fit.ts) but was first shipped from this module.
export { ImageSizing };

/** True when running under Node — the runtime that can read file paths. */
function isNode(): boolean {
  return typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === 'string';
}

/** Node fs via the same `new Function` escape hatch `doc-output.ts` uses. */
async function readNodeFile(path: string): Promise<Uint8Array> {
  const loadFs = new Function("return import('node:fs/promises')") as () => Promise<{
    readFile(path: string): Promise<Uint8Array>;
  }>;
  return loadFs().then((fs) => fs.readFile(path));
}

/**
 * Resolves an image source to bytes: in Node, bare paths and `file://` URLs
 * read from disk (I13); real URLs (http/https/data/blob) fetch in every
 * runtime. Shared with the markdown renderer so its images resolve the same
 * way (B20).
 */
export async function fetchImageBytes(url: string): Promise<ArrayBuffer> {
  // A single-letter "scheme" is a Windows drive letter (`C:\\img.png`), not
  // a URL scheme (B20).
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !/^[a-zA-Z]:/.test(url);
  const isFileUrl = url.startsWith('file://');

  if (isNode() && (!hasScheme || isFileUrl)) {
    const path = isFileUrl ? url.slice('file://'.length) : url;
    const bytes = await readNodeFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

interface ImageOptions extends WidgetOptions {
  url: string;
  /** Pre-fetched image bytes; when set, `loadImage` skips the fetch. */
  bytes?: ArrayBuffer;
  scale?: number;
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  sizing?: ImageSizing;
  format: 'png' | 'jpeg';
}

export class ImageWidget extends Widget {
  private url: string;
  private bytes?: ArrayBuffer;
  private scale: number;
  private format: 'png' | 'jpeg';
  private pdfImage?: RenderImage;
  private resolvedFormat?: 'png' | 'jpeg';
  private imageWidth: number = 0;
  private imageHeight: number = 0;
  private explicitWidth: boolean;
  private explicitHeight: boolean;
  private sizing: ImageSizing;
  private measureConfigured = false;

  constructor(options: ImageOptions) {
    super(options);
    this.url = options.url;
    this.bytes = options.bytes;
    this.scale = options.scale ?? 1;
    if (!Number.isFinite(this.scale) || this.scale <= 0) {
      // Same guard SVGPath has — scale 0 used to silently become 1 and a
      // negative scale silently drew nothing (B20).
      throw new Error('Image: scale must be a positive number');
    }
    this.format = options.format;

    this.explicitWidth = options.width !== undefined;
    this.explicitHeight = options.height !== undefined;
    this.sizing = options.sizing ?? ImageSizing.Fit;

    if (options.width !== undefined) {
      this.setYogaStyle({ width: options.width });
    }
    if (options.height !== undefined) {
      this.setYogaStyle({ height: options.height });
    }
  }

  /**
   * The fit spec is only known once the image bytes are embedded — before
   * that the measure function measures zero (aspect-fit module contract).
   */
  private spec(): FitSpec | null {
    if (this.imageWidth <= 0 || this.imageHeight <= 0) {
      return null;
    }
    return {
      // imageWidth/Height already include the scale multiplier.
      intrinsicWidth: this.imageWidth,
      intrinsicHeight: this.imageHeight,
      baseScale: 1,
      sizing: this.sizing,
    };
  }

  async loadImage(context: RenderContext): Promise<void> {
    if (!this.bytes) {
      this.bytes = await fetchImageBytes(this.url);
    }
    const bytes = this.bytes;

    // The bytes are ground truth: when the signature disagrees with the
    // declared format (Image.jpeg on png data), the sniffed format wins —
    // embedImage reports unsupported signatures itself. The decision is
    // memoized so re-loads within/across saves warn once, not per call.
    const sniffed = sniffImageFormat(bytes);
    const format = sniffed ?? this.format;
    if (sniffed && sniffed !== this.format && this.resolvedFormat !== format) {
      console.warn(`Image: declared format '${this.format}' does not match the bytes (sniffed '${sniffed}') — using the sniffed format.`);
    }
    this.resolvedFormat = format;
    // No widget-level embed cache: the backend dedupes per document, and a
    // cached PDFImage would point into a discarded document on a second
    // save (B8).
    this.pdfImage = await context.embedImage(bytes, format);
    // Use natural image size initially
    this.imageWidth = this.pdfImage.width * this.scale;
    this.imageHeight = this.pdfImage.height * this.scale;

    // Pin the intrinsic size only when neither dimension is explicit — with
    // one dimension user-set the other must stay auto so the aspect-fit
    // measure function derives it (B12).
    if (!this.explicitWidth && !this.explicitHeight) {
      this.node.setWidth(this.imageWidth);
      this.node.setHeight(this.imageHeight);
    }

    if (!this.measureConfigured) {
      this.node.setMeasureFunc(aspectFitMeasure(() => this.spec()));
      this.measureConfigured = true;
    }
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    await this.loadImage(context);
    await super.prepareLayout(context);
  }

  async render(context: RenderContext): Promise<void> {
    await this.loadImage(context);
    const spec = this.spec();
    if (!this.pdfImage || !spec) return;

    const box = context.getLayoutBox(this);
    const placement = aspectFitPlacement(spec, box);

    context.drawImage(this.pdfImage, {
      x: placement.left,
      y: placement.bottom,
      width: placement.drawnWidth,
      height: placement.drawnHeight,
    });
  }
}

export const Image = {
  png(url: string, options: Omit<ImageOptions, 'url' | 'format'> = {}): ImageWidget {
    return new ImageWidget({ ...options, url, format: 'png' });
  },
  jpeg(url: string, options: Omit<ImageOptions, 'url' | 'format'> = {}): ImageWidget {
    return new ImageWidget({ ...options, url, format: 'jpeg' });
  },
  /**
   * Builds an image from already-fetched bytes (no internal fetch). Copies
   * typed-array views into an exact ArrayBuffer first. `format` is optional
   * when the bytes carry a recognizable png/jpeg signature (sniffed; a
   * passed format that disagrees is overridden with a warning).
   */
  fromBytes(
    bytes: ArrayBuffer | Uint8Array,
    format?: 'png' | 'jpeg',
    options: Omit<ImageOptions, 'url' | 'format' | 'bytes'> = {},
  ): ImageWidget {
    const buffer = ArrayBuffer.isView(bytes)
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : (bytes as ArrayBuffer);
    const resolved = format ?? sniffImageFormat(buffer);
    if (!resolved) {
      throw new Error("Image.fromBytes: could not sniff the format from the bytes — pass 'png' or 'jpeg' explicitly.");
    }
    return new ImageWidget({ ...options, url: '', format: resolved, bytes: buffer });
  },
}