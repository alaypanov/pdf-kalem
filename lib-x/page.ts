// page.ts
import { Widget } from './widget';
import { PDFDocument } from 'pdf-lib';

interface PageProps {
  size?: [number, number];
  margin?: number;
  children: Widget[];
}

class PageWidget extends Widget {
  props: PageProps;
  pdfPage: any;

  constructor(props: PageProps) {
    super();
    this.props = props;

    this.children = props.children;
    // for (const child of this.children) {
    //   this.node.insertChild(child.node, this.node.getChildCount());
    // }
  }

  render(context: any) {
    let currentY = this.margin;

    for (const child of this.children) {
      child.setPosition(this.margin, currentY);
      child.render(this.pdfPage);
      currentY += child.dimensions.height;
    }
  }

  async build(pdfDoc: PDFDocument) {
    this.pdfPage = pdfDoc.addPage(this.props.size);
    const margin = this.props.margin || 0;

    
    // await this.layout(
    //   this.pdfPage.getWidth() - margin * 2,
    //   this.pdfPage.getHeight() - margin * 2
    // );

    for (const child of this.children) {
      await child.build(this.pdfPage);
    }
  }
}

export function Page(props: PageProps): PageWidget {
  return new PageWidget(props);
}