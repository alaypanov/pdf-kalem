import { Table, TableBody, TableCell, TableHead, TableRow, Text } from 'pdf-kalem/widgets';

/**
 * A column-driven data table: describe the columns once (header, weight,
 * cell mapper) and map any row array onto them. Rows stay whole across page
 * breaks and the header repeats on every continuation page.
 */
export interface DataTableColumn<T> {
  header: string;
  /** Relative width, mirroring Table's `columnWeights`. */
  weight: number;
  align?: 'left' | 'right';
  cell: (item: T) => string;
}

export function dataTable<T>(
  items: T[],
  columns: DataTableColumn<T>[],
  options: { minHeight?: number } = {},
) {
  return Table({
    width: '100%',
    columnWeights: columns.map((column) => column.weight),
    head: TableHead({
      rows: [
        TableRow({
          children: columns.map((column) =>
            TableCell({
              child: Text(column.header, { variant: 'label', color: 'white', align: column.align }),
            }),
          ),
        }),
      ],
    }),
    body: TableBody({
      rows: items.map((item) =>
        TableRow({
          minHeight: options.minHeight ?? 26,
          children: columns.map((column) =>
            TableCell({
              child: Text(column.cell(item), { variant: 'body', align: column.align }),
            }),
          ),
        }),
      ),
    }),
  });
}