// pdfDoc.ts
import { PDFDocument } from 'pdf-lib';
import { PageWidget } from '../lib-1';

interface PDFDocProps {
  children: Widget[];
}

export class PDFDoc {
  pdfDoc: PDFDocument;
  props: PDFDocProps;

  constructor(props: PDFDocProps) {
    this.props = props;
    this.pdfDoc = PDFDocument.create();
  }

  async save(): Promise<Uint8Array> {
    for (const child of this.props.children) {
      if (child instanceof PageWidget) {
        await child.build(this.pdfDoc);
      }
    }
    return await this.pdfDoc.save();
  }
}