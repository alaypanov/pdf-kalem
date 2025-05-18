import { PDFDocument, PDFPage, rgb, PDFFont } from 'pdf-lib';
// Import the stretch layout Node (adjust the import path/API as needed)
// import { Node as StretchNode } from 'stretch-layout';

/**
 * Base widget class.
 * Each widget holds a stretch layout node (for computing its position and dimensions),
 * a list of children widgets, and a position/dimensions that we update after layout.
 */
abstract class Widget {
  // The stretch layout node used for computing flex layouts.
  node: LayoutNode;
  // Child widgets (if any)
  children: Widget[] = [];
  // Computed position (after layout)
  position: { x: number; y: number } = { x: 0, y: 0 };
  // Computed dimensions (after layout)
  dimensions: { width: number; height: number } = { width: 0, height: 0 };

  constructor(style: LayoutStyle = {}) {
    this.node = new LayoutNode(style);
  }

  addChild(child: Widget) {
    this.children.push(child);
    // Connect the child’s layout node to this node.
    this.node.addChild(child.node);
  }

  /**
   * After stretch-layout computes the layout, update this widget’s position/dimensions.
   * This recursively updates the entire widget subtree.
   */
  // updateLayout() {
  //   // Assumes that computeLayout() has been called on the root node.
  //   this.position.x = this.node.layout.left;
  //   this.position.y = this.node.layout.top;
  //   this.dimensions.width = this.node.layout.width;
  //   this.dimensions.height = this.node.layout.height;
  //   for (const child of this.children) {
  //     child.updateLayout();
  //   }
  // }

  /**
   * Render the widget to a PDF page.
   * Each subclass should implement its own render() method.
   */
  abstract render(context: PDFPage): void;
}

/**
 * PDFDoc wraps a pdf-lib PDFDocument and holds a tree of widgets.
 */
interface PDFDocProps {
  size?: string; // e.g. 'US Letter'
  pageNumber?: string; // e.g. 'numeric'
  children: Widget[];
}

export class PDFDoc {
  props: PDFDocProps;
  pdfDoc!: PDFDocument; // will be created in save()

  constructor(props: PDFDocProps) {
    this.props = props;
  }

  /**
   * Create the PDF document, compute layouts on each Page widget,
   * render the pages, and return the final bytes.
   */
  async save(): Promise<Uint8Array> {
    this.pdfDoc = await PDFDocument.create();
    // For simplicity, we assume US Letter page dimensions (612 x 792 points)
    const pageWidth = 612;
    const pageHeight = 792;

    // Iterate over top-level children (expected to be Page widgets)
    for (const child of this.props.children) {
      if (child instanceof PageWidget) {
        // Create a new PDF page.
        const page = this.pdfDoc.addPage([pageWidth, pageHeight]);
        child.setPDFPage(page);
        // Compute the layout for this page’s widget tree.
        // (Assuming computeLayout() is provided by stretch-layout.)
        child.node.computeLayout();
        // Propagate computed layout into our widget objects.
        child.updateLayout();
        // Render the page’s content.
        child.render(page);
      }
    }
    return await this.pdfDoc.save();
  }
}

/**
 * Page widget.
 * Acts as a root container for a PDF page.
 */
interface PageProps {
  margin?: string; // e.g. '10px'
  children: Widget[];
}

class PageWidget extends Widget {
  margin: number;
  pdfPage!: PDFPage;

  constructor(props: PageProps) {
    super();
    // Convert the margin string (e.g. '10px') to a number (assume pixels map directly to points)
    this.margin = parseInt(props.margin || '0');
    // Configure this page’s stretch node.
    // Here we use padding to simulate a margin.
    this.node.style = {
      padding: this.margin,
      flexDirection: 'column',
    } as any; // cast as needed if your style types differ

    // Add each child widget.
    for (const child of props.children) {
      this.addChild(child);
    }
  }

  setPDFPage(page: PDFPage) {
    this.pdfPage = page;
  }

  render(context: PDFPage): void {
    // Render each child widget.
    for (const child of this.children) {
      child.render(context);
    }
  }
}

export function Page(props: PageProps): PageWidget {
  return new PageWidget(props);
}

/**
 * Text widget.
 * Renders a piece of text.
 */
interface TextProps {
  size?: number;
  font?: PDFFont;
}

class TextWidget extends Widget {
  text: string;
  props: TextProps;

  constructor(text: string, props: TextProps = {}) {
    super();
    this.text = text;
    this.props = props;
    const size = props.size || 12;
    // Estimate dimensions (you might use a more sophisticated text measurement in a real implementation)
    this.dimensions.height = size * 1.2;
    this.dimensions.width = this.text.length * size * 0.6;
    // Set the fixed dimensions on the stretch node.
    this.node.style = {
      width: this.dimensions.width,
      height: this.dimensions.height,
    } as any;
  }

  render(context: PDFPage): void {
    const size = this.props.size || 12;
    // Draw the text using pdf-lib. Note that we adjust the y coordinate because
    // PDF-lib’s coordinate system starts at the bottom left.
    context.drawText(this.text, {
      x: this.position.x,
      y: context.getHeight() - this.position.y - size,
      size,
    });
  }
}

export function Text(text: string, props?: TextProps): TextWidget {
  return new TextWidget(text, props);
}

/**
 * Container widget.
 * Renders a rectangle (with an optional background color) and can contain children.
 */
interface ContainerProps {
  width: number;
  height: number;
  bgColor?: string;
  children?: Widget[];
}

class ContainerWidget extends Widget {
  bgColor?: string;

  constructor(props: ContainerProps) {
    super();
    this.bgColor = props.bgColor;
    // Set fixed dimensions on the stretch node.
    this.node.style = {
      width: props.width,
      height: props.height,
    } as any;
    if (props.children) {
      for (const child of props.children) {
        this.addChild(child);
      }
    }
  }

  // I want to build a wrapper around PDF-lib js using typescript, so I can create pdf document using declarative approach. I want structure to be similar to Flutter widget tree. There is a base abstract class Widget with some options, children and render function. other widgets are extended from it. here are some widgets that I need initially: PdfDoc(), Page(), Text(), Column(), Row(), Container(). I will also need some basic layout engine so widget will properly align on the page

  render(context: PDFPage): void {
    // If a background color is specified, draw a rectangle.
    if (this.bgColor) {
      // Convert a hex color (e.g. "#00ff00") to rgb components.
      const r = parseInt(this.bgColor.substring(1, 3), 16) / 255;
      const g = parseInt(this.bgColor.substring(3, 5), 16) / 255;
      const b = parseInt(this.bgColor.substring(5, 7), 16) / 255;
      context.drawRectangle({
        x: this.position.x,
        y: context.getHeight() - this.position.y - this.dimensions.height,
        width: this.dimensions.width,
        height: this.dimensions.height,
        color: rgb(r, g, b),
      });
    }
    // Render any children inside the container.
    for (const child of this.children) {
      child.render(context);
    }
  }
}

export function Container(props: ContainerProps): ContainerWidget {
  return new ContainerWidget(props);
}

/**
 * Column widget.
 * Lays out its children vertically.
 */
interface ColumnProps {
  alignItems?: string; // e.g. 'top' or 'start'
  children: Widget[];
}

class ColumnWidget extends Widget {
  constructor(props: ColumnProps) {
    super();
    // Configure the stretch node for a vertical (column) flex layout.
    // Here we translate an alignment like 'top' to the appropriate flex alignment.
    this.node.style = {
      flexDirection: 'column',
      alignItems: props.alignItems === 'top' ? 'flex-start' : props.alignItems || 'flex-start',
    } as any;
    for (const child of props.children) {
      this.addChild(child);
    }
  }

  render(context: PDFPage): void {
    for (const child of this.children) {
      child.render(context);
    }
  }
}

export function Column(props: ColumnProps): ColumnWidget {
  return new ColumnWidget(props);
}

/**
 * Row widget.
 * Lays out its children horizontally.
 */
interface RowProps {
  alignItems?: string;
  children: Widget[];
}

class RowWidget extends Widget {
  constructor(props: RowProps) {
    super();
    this.node.style = {
      flexDirection: 'row',
      alignItems: props.alignItems || 'center',
    } as any;
    for (const child of props.children) {
      this.addChild(child);
    }
  }

  render(context: PDFPage): void {
    for (const child of this.children) {
      child.render(context);
    }
  }
}

export function Row(props: RowProps): RowWidget {
  return new RowWidget(props);
}



// For example, you could call generatePdf() and write the bytes to a file or send them in a response.