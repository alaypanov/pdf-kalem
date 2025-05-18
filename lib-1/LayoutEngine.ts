import { RenderContext } from '../context/RenderContext';

export interface LayoutOptions {
  direction?: 'row' | 'column';
  alignItems?: 'start' | 'center' | 'end';
  justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  padding?: number;
  margin?: number;
}

export class LayoutEngine {
  private options: LayoutOptions;

  constructor(options: LayoutOptions = {}) {
    this.options = options;
  }

  async layout(context: RenderContext, widgets: Widget[]): Promise<void> {
    const page = context.getCurrentPage();
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    let x = this.options.margin || 0;
    let y = pageHeight - (this.options.margin || 0);

    for (const widget of widgets) {
      const width = widget.getWidth();
      const height = widget.getHeight();

      if (this.options.direction === 'row') {
        await widget.drawAt(context, x, y - height);
        x += width + (this.options.padding || 0);
      } else {
        await widget.drawAt(context, x, y - height);
        y -= height + (this.options.padding || 0);
      }
    }
  }
}