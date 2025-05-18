import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import { convertToPDFColor } from './utils/color-utils';

interface TextOptions extends WidgetOptions {
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

class TextWidget extends Widget {
  private text: string;
  private size: number;
  private color?: string;
  private align: 'left' | 'center' | 'right';

  constructor(text: string, options: TextOptions) {
    super(options);
    this.text = text;
    this.size = options.size || 12;
    this.color = options.color;
    this.align = options.align || 'left';

    // Set width/height in node.style if not already set
    if (!this.node.style.width) {
      this.node.style.width = this.getWidth();
    }
    if (!this.node.style.height) {
      this.node.style.height = this.getHeight();
    }
  }

  // Estimate width of a string for the current font size
  private measureTextWidth(text: string): number {
    // Use a better estimate for monospace-like font
    return text.length * this.size * 0.6;
  }

  // Split text into lines that fit within maxWidth
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (this.measureTextWidth(testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  async render(context: RenderContext): Promise<void> {
    const page = context.getCurrentPage();
    const baseX = this.node.computed.x;
    const y = this.node.computed.flippedY;
    const maxWidth = this.node.parent?.computed.width || this.getWidth();

    const lines = this.wrapText(this.text, maxWidth);
    const lineHeight = this.size * 0.8;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let x = baseX;
      const lineWidth = this.measureTextWidth(line);

      if (this.align === 'center') {
        x = baseX + (maxWidth - lineWidth) / 2;
      } else if (this.align === 'right') {
        x = baseX + (maxWidth - lineWidth);
      }

      
      page.drawText(line, {
        x,
        y: y - (i * lineHeight),
        size: this.size,
        color: convertToPDFColor(this.color || '#000000'),
        maxWidth,
      });
    }
  }

  getWidth(): number {
    // Use computed width if set, otherwise estimate
    return typeof this.node.computed.width === 'number' && this.node.computed.width > 0
      ? this.node.computed.width
      : this.text.length * this.size * 0.6;
  }

  getHeight(): number {
    // Estimate height based on number of lines
    const maxWidth = typeof this.node.computed.width === 'number' && this.node.computed.width > 0
      ? this.node.computed.width
      : this.getWidth();
    const lines = this.wrapText(this.text, maxWidth);
    return lines.length * this.size * 0.8;
  }
}

export function Text(text: string, options: TextOptions = {}): TextWidget {
  return new TextWidget(text, options);
}