import { PDFDocument } from 'pdf-lib';
import { Widget } from './widget';
// Page Widget
export class PageWidget extends Widget {
  // private pdfPage: any;
  private margin: number;

  constructor(margin: number) {
    super();
    this.margin = margin;
  }

  // setPDFPage(page: any) {
  //   this.pdfPage = page;
  // }

  render(context: PDFDocument) {
    let currentY = this.margin;

    for (const child of this.children) {
      child.setPosition(this.margin, currentY);
      child.render(context);
      currentY += child.dimensions.height;
    }
  }
}

export function Page(margin: number): Widget {
  return new PageWidget(margin);
}