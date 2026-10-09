import { Table, TableBody, TableCell, TableHead, TableRow, Text } from 'pdf-kalem/widgets';
import type { LineItem } from '../data.ts';

/** Line items: numeric columns right-aligned, header on the brand color. */
export function lineItemsTable(items: LineItem[]) {
  return Table({
    width: '100%',
    columnWeights: [3.5, 0.8, 1, 1.2],
    head: TableHead({
      rows: [
        TableRow({
          children: [
            TableCell({ child: Text('Description', { variant: 'label', color: 'white' }) }),
            TableCell({ child: Text('Qty', { variant: 'label', color: 'white', align: 'right' }) }),
            TableCell({ child: Text('Rate', { variant: 'label', color: 'white', align: 'right' }) }),
            TableCell({ child: Text('Amount', { variant: 'label', color: 'white', align: 'right' }) }),
          ],
        }),
      ],
    }),
    body: TableBody({
      rows: items.map((item) =>
        TableRow({
          minHeight: 30,
          children: [
            TableCell({ child: Text(item.description, { variant: 'body' }) }),
            TableCell({ child: Text(item.quantity, { variant: 'body', align: 'right' }) }),
            TableCell({ child: Text(item.rate, { variant: 'body', align: 'right' }) }),
            TableCell({ child: Text(item.amount, { variant: 'body', align: 'right' }) }),
          ],
        }),
      ),
    }),
  });
}