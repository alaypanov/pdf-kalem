import { RenderContext } from './RenderContext';
import { Widget, WidgetOptions } from './Widget';

enum ColumnAlignItems {
  Top = 'top',
  Center = 'center',
  Bottom = 'bottom',
}

interface ColumnOptions extends WidgetOptions {
  alignItems?: ColumnAlignItems;
}

class ColumnWidget extends Widget {
  private alignItems: ColumnAlignItems;

  constructor(options: ColumnOptions = {}) {
    super(options);
    this.alignItems = options.alignItems || ColumnAlignItems.Top;
  }

  async render(context: RenderContext): Promise<void> {
    // Implement alignment logic as needed
    console.log(`Aligning items: ${this.alignItems}`);
    await this.renderChildren(context);
  }
}

export function Column(options: ColumnOptions = {}): ColumnWidget {
  return new ColumnWidget(options);
}