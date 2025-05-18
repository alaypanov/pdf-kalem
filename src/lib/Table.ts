import { Widget, WidgetOptions } from './Widget';
import { RenderContext } from './RenderContext';
import { convertToPDFColor } from './utils/color-utils';

interface TableHead {
  titles: string[];
}

interface TableRow {
  values: string[];
}

interface TableBody {
  rows: TableRow[];
}

interface TableOptions extends WidgetOptions {
  head: TableHead;
  body: TableBody;
  width?: number;
  rowHeight?: number;
  headBgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textColor?: string;
  fontSize?: number;
}

export class TableWidget extends Widget {
  private head: TableHead;
  private body: TableBody;
  private width: number;
  private rowHeight: number;
  private headBgColor: string;
  private borderColor: string;
  private borderWidth: number;
  private textColor: string;
  private fontSize: number;

  constructor(options: TableOptions) {
    super(options);
    this.head = options.head;
    this.body = options.body;
    this.width = options.width || 400;
    this.rowHeight = options.rowHeight || 24;
    this.headBgColor = options.headBgColor || '#eeeeee';
    this.borderColor = options.borderColor || '#000000';
    this.borderWidth = options.borderWidth || 1;
    this.textColor = options.textColor || '#000000';
    this.fontSize = options.fontSize || 12;
    this.node.style.width = this.width;
    // Height is calculated dynamically
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    // Header + rows
    return this.rowHeight * (1 + this.body.rows.length);
  }

  async render(context: RenderContext): Promise<void> {
    const page = context.getCurrentPage();
    const x = this.node.computed.x;
    let y = this.node.computed.flippedY ?? 0;
    const colCount = this.head.titles.length;
    const colWidth = this.width / colCount;

    // Draw header background
    page.drawRectangle({
      x,
      y,
      width: this.width,
      height: this.rowHeight,
      color: convertToPDFColor(this.headBgColor),
      borderWidth: this.borderWidth,
      borderColor: convertToPDFColor(this.borderColor),
    });

    // Draw header text
    for (let i = 0; i < colCount; i++) {
      page.drawText(this.head.titles[i], {
        x: x + i * colWidth + 4,
        y: y + 6,
        size: this.fontSize,
        color: convertToPDFColor(this.textColor),
        maxWidth: colWidth - 8,
      });
    }

    // Draw rows
    for (let rowIdx = 0; rowIdx < this.body.rows.length; rowIdx++) {
      const row = this.body.rows[rowIdx];
      const rowY = y - (rowIdx + 1) * this.rowHeight;

      // Row background (optional: alternate row color)
      page.drawRectangle({
        x,
        y: rowY,
        width: this.width,
        height: this.rowHeight,
        color: undefined,
        borderWidth: this.borderWidth,
        borderColor: convertToPDFColor(this.borderColor),
      });

      // Row text
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        page.drawText(row.values[colIdx] ?? '', {
          x: x + colIdx * colWidth + 4,
          y: rowY + 6,
          size: this.fontSize,
          color: convertToPDFColor(this.textColor),
          maxWidth: colWidth - 8,
        });
      }
    }
  }
}

export function Table(options: TableOptions): TableWidget {
  return new TableWidget(options);
}
