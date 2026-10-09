import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderImage } from './RenderContextTypes';
import {
  ImageSizing,
  aspectFitMeasure,
  aspectFitPlacement,
  type FitSpec,
} from './aspect-fit';

// Compat re-export: ImageSizing is the shared fit vocabulary (defined in
// aspect-fit.ts) but was first shipped from this module.
export { ImageSizing };

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
    const bytes = this.bytes ?? (await (await fetch(this.url)).arrayBuffer());
    this.pdfImage = await context.embedImage(bytes, this.format);
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
   * typed-array views into an exact ArrayBuffer first.
   */
  fromBytes(
    bytes: ArrayBuffer | Uint8Array,
    format: 'png' | 'jpeg',
    options: Omit<ImageOptions, 'url' | 'format' | 'bytes'> = {},
  ): ImageWidget {
    const buffer = ArrayBuffer.isView(bytes)
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : (bytes as ArrayBuffer);
    return new ImageWidget({ ...options, url: '', format, bytes: buffer });
  },
}