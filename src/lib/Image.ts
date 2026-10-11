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
    this.scale = options.scale || 1;
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
    if (this.pdfImage) return;
    const bytes = this.bytes ?? (await this.fetchBytes());

    // The bytes are ground truth: when the signature disagrees with the
    // declared format (Image.jpeg on png data), the sniffed format wins —
    // embedImage reports unsupported signatures itself.
    const sniffed = sniffImageFormat(bytes);
    if (sniffed && sniffed !== this.format) {
      console.warn(`Image: declared format '${this.format}' does not match the bytes (sniffed '${sniffed}') — using the sniffed format.`);
    }
    this.pdfImage = await context.embedImage(bytes, sniffed ?? this.format);
    // Use natural image size initially
    this.imageWidth = this.pdfImage.width * this.scale;
    this.imageHeight = this.pdfImage.height * this.scale;

    // If consumer didn't explicitly size the image, set intrinsic size for Yoga.
    if (!this.explicitWidth) {
      this.node.setWidth(this.imageWidth);
    }
    if (!this.explicitHeight) {
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

  /**
   * I13: in Node, a bare path (`./logo.png`) or `file://` URL reads from
   * disk — the regular user's first attempt, which used to break on
   * `fetch`. Real URLs (http/https/data/blob) fetch as before, in every
   * runtime.
   */
  private async fetchBytes(): Promise<ArrayBuffer> {
    const url = this.url;
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url);
    const isFileUrl = url.startsWith('file://');

    if (isNode() && (!hasScheme || isFileUrl)) {
      const path = isFileUrl ? url.slice('file://'.length) : url;
      const bytes = await readNodeFile(path);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }

    return (await fetch(url)).arrayBuffer();
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