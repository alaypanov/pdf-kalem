// text.ts
import { Widget } from './widget';
import { PDFPage, PDFFont } from 'pdf-lib';

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

    // Set a measure function for Yoga to calculate text dimensions
    this.node.setMeasureFunc(this.measure.bind(this));
  }

  async build(page: PDFPage) {
    const { size = 12, font } = this.props;

    page.drawText(this.text, {
      x: this.node.getComputedLeft(),
      y: this.node.getComputedTop(),
      size,
      font,
    });
  }

  measure(width: number): { width: number; height: number } {
    // Implement a basic measure function; you might need a more accurate one
    const height = this.props.size || 12;
    return { width, height };
  }
}

export function Text(text: string, props?: TextProps): Widget {
  return new TextWidget(text, props);
}