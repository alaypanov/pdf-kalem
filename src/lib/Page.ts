import { Widget, WidgetOptions } from './Widget';
// import { RenderContext } from '../context/RenderContext';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { RenderContext } from './RenderContext';
import { FlexLayoutEngine, FlexNode } from './utils/FlexLayoutEngine';
import { StandardSize, PDFDocSize } from './utils/doc-sizes';
import { Allocator } from 'stretch-layout';



interface PageOptions extends WidgetOptions {
  padding?: number;
  size?: StandardSize;
  dimensions?: [number, number];
  children?: Widget[];
}

export class PageWidget extends Widget {
  private padding: number;
  private dimensions?: [number, number];
  private size?: StandardSize;
  private layout: 'portrait' | 'landscape';

  constructor(options: PageOptions = {}) {
    super(options);
    this.node.style.padding = options.padding || 0;
    this.node.style.flexDirection = 'column';
    this.node.style.width = options.size ? options.size[0] + 'px' : '100%';
    this.node.style.height = options.size ? options.size[1] + 'px' : '100%';
    this.padding = options.padding || 0;
  }
  // getWidth(): number {
  //   const [width, height] = this.getDimensions();
  //   return this.layout === 'portrait' ? width : height;
  // }

  // getHeight(): number {
  //   const [width, height] = this.getDimensions();
  //   return this.layout === 'portrait' ? height : width;
  // }

  protected drawWithOffset(context: RenderContext, x: number, y: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getDimensions(context:RenderContext): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    if (this.size) {
      const size = PDFDocSize[this.size as keyof typeof PDFDocSize];
      if (size) {
        return size;
      }
    }

    const docDimensions = context.getDimensions();
    return docDimensions;
  }

  async buildLayout(context): Promise<void> {
     // --- Layout calculation step ---
    //  const layoutEngine = new FlexLayoutEngine(dimensions[0], dimensions[1]);
    //  layoutEngine.calculateLayout(this.node);
 
    //  console.log('Layout calculated:', layoutEngine);

    const allocator = new Allocator();
    const dimensions = this.getDimensions(context);
    context.setAllocator(allocator);
    this.stretchNode?.setStyle({
      width: dimensions[0],
      height: dimensions[1],
    });
    this.stretchNode?.computeLayout(allocator);
  }


  async render(context: RenderContext): Promise<void> {
    console.log('Drawing Page 34');
    const doc = context.getDocument();

    // Prefer explicit dimensions, then context, then fallback
    const dimensions = this.getDimensions(context);
    const page = doc.addPage(dimensions);
    context.setCurrentPage(page);

    await this.buildLayout(context);
    // Optionally: await layoutEngine.applyLayout(this.node, context);

    await this.renderChildren(context);
  }
}

export function Page(options: PageOptions = {}): PageWidget {
  return new PageWidget(options);
}