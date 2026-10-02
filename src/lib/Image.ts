import { Widget, WidgetOptions } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderImage } from './RenderContextTypes';
import { MeasureMode } from 'yoga-layout';

export enum ImageSizing {
  Fit = 'fit',
  Cover = 'cover',
  None = 'none',
}

interface ImageOptions extends WidgetOptions {
  url: string;
  scale?: number;
  width?: number | string;
  height?: number | string;
  sizing?: ImageSizing;
  format: 'png' | 'jpeg';
}

export class ImageWidget extends Widget {
  private url: string;
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
    this.scale = options.scale || 1;
    this.format = options.format;

    this.explicitWidth = options.width !== undefined;
    this.explicitHeight = options.height !== undefined;
    this.sizing = options.sizing ?? ImageSizing.Fit;

    if (options.width !== undefined) {
      this.setProperty(this.context as any, 'width', options.width);
    }
    if (options.height !== undefined) {
      this.setProperty(this.context as any, 'height', options.height);
    }
  }

  async loadImage(context: RenderContext): Promise<void> {
    if (this.pdfImage) return;
    const response = await fetch(this.url);
    const bytes = await response.arrayBuffer();
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
      this.node.setMeasureFunc((width, widthMode, height, heightMode) => {
        if (this.imageWidth <= 0 || this.imageHeight <= 0) {
          return { width: 0, height: 0 };
        }

        const aspect = this.imageWidth / this.imageHeight;
        console.log('Measure image', aspect )
        const widthConstrained =
          widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost;
        const heightConstrained =
          heightMode === MeasureMode.Exactly || heightMode === MeasureMode.AtMost;

        if (this.sizing === ImageSizing.None || (!widthConstrained && !heightConstrained)) {
          return { width: this.imageWidth, height: this.imageHeight };
        }

        let targetW = this.imageWidth;
        let targetH = this.imageHeight;

        if (widthConstrained && heightConstrained) {
          const scale = this.sizing === ImageSizing.Cover
            ? Math.max(width / this.imageWidth, height / this.imageHeight)
            : Math.min(width / this.imageWidth, height / this.imageHeight);
          targetW = this.imageWidth * scale;
          targetH = this.imageHeight * scale;
        } else if (widthConstrained) {
          targetW = width;
          targetH = width / aspect;
        } else if (heightConstrained) {
          targetH = height;
          targetW = height * aspect;
        }

        return { width: targetW, height: targetH };
      });
      this.measureConfigured = true;
    }
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    await this.loadImage(context);
    await super.prepareLayout(context);
  }

  getWidth(): number {
    return this.imageWidth || 0;
  }

  getHeight(): number {
    return this.imageHeight || 0;
  }

  async render(context: RenderContext): Promise<void> {
    await this.loadImage(context);
    if (!this.pdfImage) return;

    const { x, y, width, height } = context.getLayoutBox(this);

    const aspect = this.imageWidth > 0 ? this.imageWidth / this.imageHeight : 1;
    let drawWidth = width || this.imageWidth;
    let drawHeight = height || this.imageHeight;

    if (this.sizing !== ImageSizing.None && width > 0 && height > 0) {
      const scale = this.sizing === ImageSizing.Cover
        ? Math.max(width / this.imageWidth, height / this.imageHeight)
        : Math.min(width / this.imageWidth, height / this.imageHeight);
      drawWidth = this.imageWidth * scale;
      drawHeight = this.imageHeight * scale;
    } else if (width > 0 && !(height > 0)) {
      drawHeight = drawWidth / aspect;
    } else if (height > 0 && !(width > 0)) {
      drawWidth = drawHeight * aspect;
    }

    context.drawImage(this.pdfImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }
}

export const Image = {
  png(url: string, options: Omit<ImageOptions, 'url' | 'format'> = {}): ImageWidget {
    return new ImageWidget({ ...options, url, format: 'png' });
  },
  jpeg(url: string, options: Omit<ImageOptions, 'url' | 'format'> = {}): ImageWidget {
    return new ImageWidget({ ...options, url, format: 'jpeg' });
  }
}
