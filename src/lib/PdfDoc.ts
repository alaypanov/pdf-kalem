import { PDFDocument } from 'pdf-lib';
import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import { FlexLayoutEngine, FlexNode } from './utils/FlexLayoutEngine';
import { StandardSize, PDFDocSize } from './utils/doc-sizes';
import { PageWidget } from './Page';
// Changed PDFDocSize to a constant object

interface PDFDocOptions extends WidgetOptions {
  size?: StandardSize; // Use standard size names
  dimensions?: [number, number]; // Optional custom dimensions
  pageNumber?: string;
  layout?: 'portrait' | 'landscape';
  children?: PageWidget[];
}

export class PDFDocWidget extends Widget {
  // Using protected instead of private to indicate these might be used by subclasses
  protected size?: StandardSize; // Can be undefined if customSize is used
  protected dimensions?: [number, number];
  protected pageNumber: string;
  protected layout: 'portrait' | 'landscape';
  protected children: PageWidget[];

  constructor(context?: RenderContext, options: PDFDocOptions = {}) {
    super(context, options);
    // Prioritize customSize if provided
    if (options.dimensions) {
      this.dimensions = options.dimensions;
      this.size = undefined; // Ensure size is not set if customSize is used
    } else {
      this.size = options.size; // Default to A4 if neither is provided
      this.dimensions = undefined;
    }
    this.pageNumber = options.pageNumber || 'none';
    this.layout = options.layout || 'portrait';
    this.children = options.children || [];
    // Enforce only PageWidget children
    for (const child of this.children) {
      if (!(child instanceof PageWidget)) {
        throw new Error('PDFDocWidget children must be instances of PageWidget');
      }
    }
  }

  async render(context: RenderContext): Promise<void> {
    console.log('Drawing pdfdoc');
    // context.initWidgetTree(this);


    // Set up layout engine for the content area (consider margins later if needed)
    // const rootNode = new FlexNode(this, { padding: 10 }); // Example padding
    // const layoutEngine = new FlexLayoutEngine();
    // layoutEngine.calculateLayout(rootNode, this.getWidth(), this.getHeight());
    // await layoutEngine.applyLayout(rootNode, context);

    // TODO: Build the actual flex tree from children
    // Example: this.children.forEach(child => rootNode.addChild(new FlexNode(child, child.style)));

    // Calculate layout based on page dimensions minus padding
    // layoutEngine.calculateLayout(rootNode, width - 20, height - 20); // Adjust for padding

    // Apply the layout and render children
    // await layoutEngine.applyLayout(rootNode, context); // This would render children based on layout
    
    // Temporary direct rendering until layout application is complete
    await this.renderChildren(context); 
  }

  private getDimensions(): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }

    // Use standard size, default to A4 if size is somehow undefined (shouldn't happen with constructor logic)
    return PDFDocSize[StandardSize.LETTER] 
  } 

  getWidth(): number {
    const [width, height] = this.getDimensions();
    return this.layout === 'portrait' ? width : height;
  }

  getHeight(): number {
    const [width, height] = this.getDimensions();
    return this.layout === 'portrait' ? height : width;
  }

  protected async drawWithOffset(context: RenderContext, _x: number, _y: number): Promise<void> {
    // The PDFDocWidget itself doesn't draw anything at an offset,
    // it sets up the page and coordinates the rendering of its children.
    // The render method handles page creation and layout.
    // This method might be redundant for PDFDocWidget or needs rethinking.
    // For now, delegate to renderChildren if needed, but it's likely handled by layout engine.
    // await this.renderChildren(context); // Probably remove this if layoutEngine.applyLayout is used
  }

  async save(): Promise<Uint8Array> {
    console.log('Saving PDF');
    const doc = await PDFDocument.create();
    // Pass page dimensions to RenderContext if needed globally, or handle per page
    const context = new RenderContext(doc, {})
    // context.setDimensions(this.getWidth(), this.getHeight());

    // Render method now creates the page and sets it in the context
    await this.render(context);

    const pdfBytes = await doc.save();
    return pdfBytes;
  }
}

export function PDFDoc(options: PDFDocOptions = {}): PDFDocWidget {
  return new PDFDocWidget(null, options);
}