import { PDFFont } from 'pdf-lib';
import { Widget } from './Widget';

// Text Widget
interface TextProps {
  size?: number;
  font?: PDFFont;
}

class TextWidget extends Widget {
  private text: string;
  dimensions: any = {};
  props: TextProps;
 
  constructor(text: string, props: TextProps = {size: 12}) {
    super();
    this.text = text;
    this.props = props;
    const size = props.size || 12;
    this.dimensions.height = size * 1.2; // Estimate text height
    this.dimensions.width = this.text.length * size * 0.6; // Estimate text width
  }
  
  render(context: any) {
    context.drawText(this.text, {
      x: this.position.x,
      y: context.getHeight() - this.position.y - this.props.size!,
      size: this.props.size,
    });
  }
}

export function Text(text: string, props?: TextProps): Widget {
  console.log(text)
  return new TextWidget(text, props);
}