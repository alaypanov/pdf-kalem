import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import { PDFPage, PDFImage } from 'pdf-lib';

interface ImageOptions extends WidgetOptions {
  url: string;
  scale?: number;
  width?: number | string;
  format: 'png' | 'jpeg';
}

export class ImageWidget extends Widget {
  private url: string;
  private scale: number;
  private format: 'png' | 'jpeg';
  private pdfImage?: PDFImage;
  private imageWidth: number = 0;
  private imageHeight: number = 0;

  constructor(options: ImageOptions) {
    super(options);
    this.url = options.url;
    this.scale = options.scale || 1;
    this.format = options.format;
  }

  async loadImage(context: RenderContext): Promise<void> {
    if (this.pdfImage) return;
    const response = await fetch(this.url);
    const bytes = await response.arrayBuffer();
    const doc = context.getDocument();
    if (this.format === 'png') {
      this.pdfImage = await doc.embedPng(bytes);
    } else {
      this.pdfImage = await doc.embedJpg(bytes);
    }
    // Use natural image size initially
    this.imageWidth = this.pdfImage.width * this.scale;
    this.imageHeight = this.pdfImage.height * this.scale;
    // Set node style for layout (will be adjusted in render)
    this.node.style.width = this.imageWidth;
    this.node.style.height = this.imageHeight;
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
    const page = context.getCurrentPage();

    // Get parent size if available
    const parentWidth = this.node.parent?.computed.width;
    const parentHeight = this.node.parent?.computed.height;

    let drawWidth = this.imageWidth;
    let drawHeight = this.imageHeight;

    // Scale down proportionally if image is bigger than parent
    if (parentWidth && parentHeight && (drawWidth > parentWidth || drawHeight > parentHeight)) {
      const widthRatio = parentWidth / drawWidth;
      const heightRatio = parentHeight / drawHeight;
      const scale = Math.min(widthRatio, heightRatio, 1);
      drawWidth = drawWidth * scale;
      drawHeight = drawHeight * scale;
    }

    // Update node style and computed for layout (optional, for downstream widgets)
    this.node.style.width = drawWidth;
    this.node.style.height = drawHeight;
    // this.node.computed.width = drawWidth;
    // this.node.computed.height = drawHeight;
    console.log(this.node)
    const x = this.node.computed.x;
    const y = this.node.computed.flippedY;

    page.drawImage(this.pdfImage, {
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
