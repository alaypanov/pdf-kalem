
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import { resolveThemeColor, type ThemeColorValue } from './Theme';
import { fromHex } from './utils/color-utils';
import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import type { BreakUnit } from './pagination/types';
import { Text } from './Text';

export interface TableOptions extends WidgetOptions {
  head?: TableHeadWidget;
  body?: TableBodyWidget;
  width?: YogaStyleValue;
  rowHeight?: number;
  cellPadding?: number;
  borderColor?: ThemeColorValue;
  borderWidth?: number;
  headBgColor?: ThemeColorValue;
  rowBgColor?: ThemeColorValue;
  alternateRowBgColor?: ThemeColorValue;
  columnWidths?: YogaStyleValue[];
  columnWeights?: number[];
}

interface TableSectionOptions extends WidgetOptions {
  rows?: TableRowWidget[];
}

interface TableRowOptions extends WidgetOptions {
  cells?: Widget[];
  bgColor?: ThemeColorValue;
  minHeight?: number;
}

interface TableCellOptions extends WidgetOptions {
  child?: Widget;
  width?: YogaStyleValue;
  weight?: number;
  padding?: number;
  bgColor?: ThemeColorValue;
  borderColor?: ThemeColorValue;
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

  /** Rows in this section (head or body). */
  getRows(): TableRowWidget[] {
    return this.rows;
  }

  getTable(): TableWidget | undefined {
    return this.parent instanceof TableWidget ? this.parent : undefined;
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
  private readonly bgColor?: ThemeColorValue;
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

  getResolvedBackgroundColor(): RenderColor | undefined {
    const theme = this.context?.getTheme();
    if (this.bgColor) {
      return resolveThemeColor(theme, this.bgColor);
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
  private readonly bgColor?: ThemeColorValue;
  private readonly borderColor?: ThemeColorValue;
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

  private getResolvedBorderColor(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.borderColor) ?? this.getTable()?.getBorderColor();
  }

  private getResolvedBorderWidth(): number {
    return this.borderWidth ?? this.getTable()?.getBorderWidth() ?? 0;
  }

  private getResolvedPadding(): number {
    return this.padding ?? this.getTable()?.getCellPadding() ?? 0;
  }

  private getResolvedBackgroundColor(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.bgColor) ?? this.getRow()?.getResolvedBackgroundColor();
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

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this);
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
  private readonly cellPadding?: number;
  private readonly borderColor?: ThemeColorValue;
  private readonly borderWidth?: number;
  private readonly headBgColor?: ThemeColorValue;
  private readonly rowBgColor?: ThemeColorValue;
  private readonly alternateRowBgColor?: ThemeColorValue;
  private readonly columnWidths?: YogaStyleValue[];
  private readonly columnWeights?: number[];

  constructor(options: TableOptions) {
    const children = [options.head, options.body].filter(Boolean) as Widget[];
    super({ ...options, children });
    this.head = options.head;
    this.body = options.body;
    this.width = options.width;
    this.rowHeight = options.rowHeight;
    this.cellPadding = options.cellPadding;
    this.borderColor = options.borderColor;
    this.borderWidth = options.borderWidth;
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
    return this.rowHeight ?? this.context?.getTheme()?.table?.rowHeight;
  }

  getCellPadding(): number {
    return this.cellPadding ?? this.context?.getTheme()?.table?.cellPadding ?? 0;
  }

  getBorderColor(): RenderColor {
    return resolveThemeColor(this.context?.getTheme(), this.borderColor ?? this.context?.getTheme()?.table?.borderColor) ?? fromHex('#000000');
  }

  getBorderWidth(): number {
    return this.borderWidth ?? this.context?.getTheme()?.table?.borderWidth ?? 1;
  }

  getHeadBgColor(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.headBgColor ?? this.context?.getTheme()?.table?.headBgColor);
  }

  getRowBgColor(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.rowBgColor ?? this.context?.getTheme()?.table?.rowBgColor);
  }

  getAlternateRowBgColor(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.alternateRowBgColor ?? this.context?.getTheme()?.table?.alternateRowBgColor);
  }

  getColumnWidth(index: number): YogaStyleValue | undefined {
    return this.columnWidths?.[index];
  }

  getColumnWeight(index: number): number | undefined {
    return this.columnWeights?.[index];
  }

  /**
   * Row units: the head is marked `repeat` (re-emitted atop every
   * continuation page) and `keepWithNext` (never orphaned at a page bottom);
   * rows are atomic because a TableRow is row-direction, so the base-class
   * default returns null for them and the paginator moves rows whole. The
   * render side needs no pagination awareness — rows are real widgets the
   * plan places like any other.
   */
  override getBreakUnits(): BreakUnit[] | null {
    if (this.breakableOption === false) return null;

    const units: BreakUnit[] = [];
    const tableTop = this.getAbsoluteLayoutBox().y;

    if (this.head) {
      const headHeight = this.head.getHeight();
      if (headHeight > 0) {
        units.push({
          offset: this.head.getAbsoluteLayoutBox().y - tableTop,
          height: headHeight,
          widget: this.head,
          repeat: true,
          keepWithNext: true,
        });
      }
    }

    if (this.body) {
      for (const row of this.body.getRows()) {
        const rowHeight = row.getHeight();
        if (rowHeight <= 0) continue;
        units.push({
          offset: row.getAbsoluteLayoutBox().y - tableTop,
          height: rowHeight,
          widget: row,
        });
      }
    }

    return units.length > 0 ? units : null;
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

function createTable(options: TableOptions): TableWidget {
  return new TableWidget(options);
}

/**
 * Options for {@link Table.fromRows}.
 */
export interface TableFromRowsOptions extends Omit<TableOptions, 'head' | 'body'> {
  /**
   * When true, the first row is rendered as a table head using the head
   * background color from the table options or theme.
   */
  header?: boolean;
}

/**
 * Convenience constructor for the common case: a list of rows where every
 * cell is plain text. The first row can be promoted to a header via
 * `{ header: true }`. This collapses the verbose
 * `TableHead({ rows: [TableRow({ children: [...].map(v => TableCell({ child: Text(v) })) })] })`
 * ceremony into a single call.
 *
 * @example
 *   Table.fromRows([['KPI', 'Value', 'Change'], ['$42k', '+12%']], {
 *     header: true,
 *     columnWeights: [2, 1, 1],
 *   })
 */
export function fromRows(
  rows: Array<Array<string | Widget>>,
  options: TableFromRowsOptions = {}
): TableWidget {
  const { header = false, ...tableOptions } = options;
  const toCell = (value: string | Widget) =>
    TableCell({ child: typeof value === 'string' ? Text(value, {}) : value });
  const toRow = (cells: Array<string | Widget>) =>
    TableRow({ children: cells.map(toCell) });

  const bodyRows = rows.map(toRow);
  const head = header ? TableHead({ rows: [bodyRows.shift()!] }) : undefined;
  const body = TableBody({ rows: bodyRows });

  return createTable({ ...tableOptions, head, body });
}

export type TableComponent = ((options: TableOptions) => TableWidget) & {
  fromRows: typeof fromRows;
};

export const Table: TableComponent = Object.assign(createTable, { fromRows });
