import { Column, Container, Text } from 'pdf-kalem/widgets';
import type { InvoiceData } from '../data.ts';
import { labelValue } from './label-value.ts';

/** The "Invoice summary" card in the header's right column. */
export function summaryCard(summary: InvoiceData['summary']) {
  return Container({
    width: 210,
    padding: 14,
    bgColor: 'panel',
    child: Column({
      gap: 7,
      children: [
        Text('Invoice summary', { variant: 'h2' }),
        labelValue('Invoice number', summary.number),
        labelValue('Issue date', summary.issueDate),
        labelValue('Due date', summary.dueDate),
      ],
    }),
  });
}