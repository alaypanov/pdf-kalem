import { Widget, WidgetOptions } from './Widget';
// import { RenderContext } from '../context/RenderContext';
import type { RenderContext } from './RenderContextInterface';
import { PageSize, PDFDocSize } from './types/doc-sizes';
import { Align, Direction, Edge, FlexDirection, Justify } from 'yoga-layout';



interface PageOptions extends WidgetOptions {
  padding?: number;
  size?: PageSize;
  dimensions?: [number, number];
  children?: Widget[];
}

export class PageWidget extends Widget {
  private dimensions?: [number, number];
  private size?: PageSize;

  constructor(options: PageOptions = {}) {
    super(options);
    this.dimensions = options.dimensions;
    this.size = options.size;

    // Root page node defaults
    this.node.setFlexDirection(FlexDirection.Column);
    this.node.setJustifyContent(Justify.FlexStart);
    this.node.setAlignItems(Align.Stretch);
    this.node.setPadding(Edge.All, options.padding ?? 0);
  }

  getWidth(): number {
    if (this.dimensions) return this.dimensions[0];
    if (this.size) {
      const size = PDFDocSize[this.size as keyof typeof PDFDocSize];
      if (size) return size[0];
    }
    return 0;
  }

  getHeight(): number {
    if (this.dimensions) return this.dimensions[1];
    if (this.size) {
      const size = PDFDocSize[this.size as keyof typeof PDFDocSize];
      if (size) return size[1];
    }
    return 0;
  }
  // getWidth(): number {
  //   const [width, height] = this.getDimensions();
  //   return this.layout === 'portrait' ? width : height;
  // }

  // getHeight(): number {
  //   const [width, height] = this.getDimensions();
  //   return this.layout === 'portrait' ? height : width;
  // }

  getDimensions(context: RenderContext): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    if (this.size) {
      const size = PDFDocSize[this.size as keyof typeof PDFDocSize];
      if (size) {
        return size as [number, number];
      }
    }

    const docDimensions = context.getDimensions();
    return docDimensions;
  }

  async render(context: RenderContext): Promise<void> {
    console.log('Drawing Page');
    const dimensions = this.getDimensions(context);
    console.log(`Page dimensions: ${dimensions[0]} x ${dimensions[1]}`);
    context.addPage(dimensions);

    // Preload intrinsic sizes (images, etc) before layout
    await this.prepareLayout(context);

    // Run Yoga layout once for the whole page
    this.node.setWidth(dimensions[0]);
    this.node.setHeight(dimensions[1]);
    this.calculateLayout(dimensions[0], dimensions[1], Direction.LTR);

    await this.renderChildren(context);
  }
}

export function Page(options: PageOptions = {}): PageWidget {
  return new PageWidget(options);
}