
import { Color } from 'pdf-lib';
import { RenderContext } from './RenderContext';
import { fromHex } from './utils/color-utils';
import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';

interface TableOptions extends WidgetOptions {
  head?: TableHeadWidget;
  body?: TableBodyWidget;
  width?: YogaStyleValue;
  rowHeight?: number;
  cellPadding?: number;
  borderColor?: Color;
  borderWidth?: number;
  headBgColor?: Color;
  rowBgColor?: Color;
  alternateRowBgColor?: Color;
  columnWidths?: YogaStyleValue[];
  columnWeights?: number[];
}

interface TableSectionOptions extends WidgetOptions {
  rows?: TableRowWidget[];
}

interface TableRowOptions extends WidgetOptions {
  cells?: Widget[];
  bgColor?: Color;
  minHeight?: number;
}

interface TableCellOptions extends WidgetOptions {
  child?: Widget;
  width?: YogaStyleValue;
  weight?: number;
  padding?: number;
  bgColor?: Color;
  borderColor?: Color;
  borderWidth?: number;
}

abstract class TableSectionWidget extends Widget {
  protected readonly rows: TableRowWidget[];

  constructor(options: TableSectionOptions = {}) {
    const rows = options.rows ?? ((options.children as TableRowWidget[] | undefined) ?? []);
    super({ ...options, children: rows });
    this.rows = rows;

    this.setYogaStyle({
      width: '100%',
      flexDirection: 'column',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    });
  }

  getRowIndex(row: TableRowWidget): number {
    return this.rows.indexOf(row);
  }

  getTable(): TableWidget | undefined {
    return this.parent instanceof TableWidget ? this.parent : undefined;
  }

  getWidth(): number {
    return this.node.getComputedWidth();
  }

  getHeight(): number {
    const computedHeight = this.node.getComputedHeight();
    if (computedHeight > 0) {
      return computedHeight;
    }

    return this.rows.reduce((height, row) => height + row.getHeight(), 0);
  }

  async render(context: RenderContext): Promise<void> {
    await this.renderChildren(context);
  }
}

export class TableHeadWidget extends TableSectionWidget { }

export class TableBodyWidget extends TableSectionWidget { }

export class TableRowWidget extends Widget {
  private readonly cells: TableCellWidget[];
  private readonly bgColor?: Color;
  private readonly minHeight?: number;

  constructor(options: TableRowOptions = {}) {
    const rawCells = options.cells ?? options.children ?? [];
    const cells = rawCells.map((cell) =>
      cell instanceof TableCellWidget ? cell : new TableCellWidget({ child: cell })
    );

    super({ ...options, children: cells });
    this.cells = cells;
    this.bgColor = options.bgColor;
    this.minHeight = options.minHeight;

    this.setYogaStyle({
      width: '100%',
      flexDirection: 'row',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    });
  }

  getCellIndex(cell: TableCellWidget): number {
    return this.cells.indexOf(cell);
  }

  getResolvedBackgroundColor(): Color | undefined {
    if (this.bgColor) {
      return this.bgColor;
    }

    const table = this.getTable();
    const section = this.getSection();
    if (!table || !section) {
      return undefined;
    }

    if (section instanceof TableHeadWidget) {
      return table.getHeadBgColor();
    }

    const rowIndex = section.getRowIndex(this);
    if (rowIndex >= 0 && rowIndex % 2 === 1) {
      return table.getAlternateRowBgColor() ?? table.getRowBgColor();
    }

    return table.getRowBgColor();
  }

  getSection(): TableSectionWidget | undefined {
    return this.parent instanceof TableSectionWidget ? this.parent : undefined;
  }

  getTable(): TableWidget | undefined {
    const section = this.getSection();
    return section?.getTable();
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    const minHeight = this.minHeight ?? this.getTable()?.getRowHeight();
    if (typeof minHeight === 'number' && Number.isFinite(minHeight) && minHeight > 0) {
      this.node.setMinHeight(minHeight);
    }

    await super.prepareLayout(context);
  }

  getWidth(): number {
    return this.node.getComputedWidth();
  }

  getHeight(): number {
    const computedHeight = this.node.getComputedHeight();
    if (computedHeight > 0) {
      return computedHeight;
    }

    return this.minHeight ?? 0;
  }

  async render(context: RenderContext): Promise<void> {
    await this.renderChildren(context);
  }
}

export class TableCellWidget extends Widget {
  private readonly width?: YogaStyleValue;
  private readonly weight?: number;
  private readonly padding?: number;
  private readonly bgColor?: Color;
  private readonly borderColor?: Color;
  private readonly borderWidth?: number;

  constructor(options: TableCellOptions = {}) {
    const children = options.children ?? (options.child ? [options.child] : []);
    super({ ...options, children });
    this.width = options.width;
    this.weight = options.weight;
    this.padding = options.padding;
    this.bgColor = options.bgColor;
    this.borderColor = options.borderColor;
    this.borderWidth = options.borderWidth;

    this.setYogaStyle({
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    });
  }

  private getRow(): TableRowWidget | undefined {
    return this.parent instanceof TableRowWidget ? this.parent : undefined;
  }

  private getTable(): TableWidget | undefined {
    return this.getRow()?.getTable();
  }

  private getResolvedBorderColor(): Color | undefined {
    return this.borderColor ?? this.getTable()?.getBorderColor();
  }

  private getResolvedBorderWidth(): number {
    return this.borderWidth ?? this.getTable()?.getBorderWidth() ?? 0;
  }

  private getResolvedPadding(): number {
    return this.padding ?? this.getTable()?.getCellPadding() ?? 0;
  }

  private getResolvedBackgroundColor(): Color | undefined {
    return this.bgColor ?? this.getRow()?.getResolvedBackgroundColor();
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    const table = this.getTable();
    const row = this.getRow();
    const columnIndex = row?.getCellIndex(this) ?? -1;

    this.node.setPadding(0, this.getResolvedPadding());
    this.node.setPadding(1, this.getResolvedPadding());
    this.node.setPadding(2, this.getResolvedPadding());
    this.node.setPadding(3, this.getResolvedPadding());

    const width = this.width ?? (columnIndex >= 0 ? table?.getColumnWidth(columnIndex) : undefined);
    if (width !== undefined) {
      this.setYogaStyle({
        width,
        flexGrow: 0,
        flexShrink: 0,
      });
    } else {
      const weight = this.weight ?? (columnIndex >= 0 ? table?.getColumnWeight(columnIndex) : undefined) ?? 1;
      this.setYogaStyle({
        flexBasis: 0,
        flexGrow: weight,
        flexShrink: 1,
      });
    }

    await super.prepareLayout(context);
  }

  getWidth(): number {
    return this.node.getComputedWidth();
  }

  getHeight(): number {
    return this.node.getComputedHeight();
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = this.getLayoutBoxInPdfCoords(context);
    const bgColor = this.getResolvedBackgroundColor();
    const borderColor = this.getResolvedBorderColor();
    const borderWidth = this.getResolvedBorderWidth();

    context.drawRectangle({
      x,
      y,
      width,
      height,
      color: bgColor,
      borderColor,
      borderWidth,
    });

    await this.renderChildren(context);
  }
}

export class TableWidget extends Widget {
  private readonly head?: TableHeadWidget;
  private readonly body?: TableBodyWidget;
  private readonly width?: YogaStyleValue;
  private readonly rowHeight?: number;
  private readonly cellPadding: number;
  private readonly borderColor: Color;
  private readonly borderWidth: number;
  private readonly headBgColor?: Color;
  private readonly rowBgColor?: Color;
  private readonly alternateRowBgColor?: Color;
  private readonly columnWidths?: YogaStyleValue[];
  private readonly columnWeights?: number[];

  constructor(options: TableOptions) {
    const children = [options.head, options.body].filter(Boolean) as Widget[];
    super({ ...options, children });
    this.head = options.head;
    this.body = options.body;
    this.width = options.width;
    this.rowHeight = options.rowHeight;
    this.cellPadding = options.cellPadding ?? 0;
    this.borderColor = options.borderColor ?? fromHex('#000000');
    this.borderWidth = options.borderWidth ?? 1;
    this.headBgColor = options.headBgColor;
    this.rowBgColor = options.rowBgColor;
    this.alternateRowBgColor = options.alternateRowBgColor;
    this.columnWidths = options.columnWidths;
    this.columnWeights = options.columnWeights;

    this.setYogaStyle({
      width: this.width ?? '100%',
      flexDirection: 'column',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    });
  }

  getRowHeight(): number | undefined {
    return this.rowHeight;
  }

  getCellPadding(): number {
    return this.cellPadding;
  }

  getBorderColor(): Color {
    return this.borderColor;
  }

  getBorderWidth(): number {
    return this.borderWidth;
  }

  getHeadBgColor(): Color | undefined {
    return this.headBgColor;
  }

  getRowBgColor(): Color | undefined {
    return this.rowBgColor;
  }

  getAlternateRowBgColor(): Color | undefined {
    return this.alternateRowBgColor;
  }

  getColumnWidth(index: number): YogaStyleValue | undefined {
    return this.columnWidths?.[index];
  }

  getColumnWeight(index: number): number | undefined {
    return this.columnWeights?.[index];
  }

  getWidth(): number {
    const computedWidth = this.node.getComputedWidth();
    if (computedWidth > 0) {
      return computedWidth;
    }

    return typeof this.width === 'number' ? this.width : 0;
  }

  getHeight(): number {
    const computedHeight = this.node.getComputedHeight();
    if (computedHeight > 0) {
      return computedHeight;
    }

    return (this.head?.getHeight() ?? 0) + (this.body?.getHeight() ?? 0);
  }

  async render(context: RenderContext): Promise<void> {
    await this.renderChildren(context);
  }
}

export function TableHead(options: TableSectionOptions = {}): TableHeadWidget {
  return new TableHeadWidget(options);
}

export function TableBody(options: TableSectionOptions = {}): TableBodyWidget {
  return new TableBodyWidget(options);
}

export function TableRow(options: TableRowOptions = {}): TableRowWidget {
  return new TableRowWidget(options);
}

export function TableCell(options: TableCellOptions = {}): TableCellWidget {
  return new TableCellWidget(options);
}

export function Table(options: TableOptions): TableWidget {
  return new TableWidget(options);
}
