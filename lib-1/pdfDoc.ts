// pdfDoc.ts
import { PDFDocument } from 'pdf-lib';

import { Widget } from './widget';
import { PageWidget } from './page';

interface PDFDocProps {
  children: Widget[];
}

export class PDFDoc {
  pdfDoc: PDFDocument;
  props: PDFDocProps;

  constructor(props: PDFDocProps) {
    this.props = props;
    this.create();
  }

  async create(): Promise<void> {
    this.pdfDoc = await PDFDocument.create();
  }

  async save(): Promise<Uint8Array> {
    for (const child of this.props.children) {
      if (child instanceof PageWidget) {
        await child.render(this.pdfDoc);
      }
    }
    return await this.pdfDoc.save();
  }
}