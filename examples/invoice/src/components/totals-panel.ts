import { Column, Container, HLine, Row, Text } from 'pdf-kalem/widgets';
import type { InvoiceData } from '../data.ts';

/** Emphasized rows render label/body as label/h2. */
function summaryRow(label: string, value: string, emphasize = false) {
  return Row({
    width: '100%',
    mainAxisAlignment: Row.justifyBetween,
    children: [
      Text(label, { variant: emphasize ? 'label' : 'body' }),
      Text(value, { variant: emphasize ? 'h2' : 'body' }),
    ],
  });
}

/** The totals panel, right of the notes. */
export function totalsPanel(totals: InvoiceData['totals']) {
  return Container({
    width: '49%',
    padding: 12,
    bgColor: 'panel',
    child: Column({
      width: '100%',
      gap: 8,
      children: [
        summaryRow('Subtotal', totals.subtotal),
        summaryRow('Tax (8%)', totals.tax),
        HLine({ color: 'line', thickness: 1, width: '100%' }),
        summaryRow('Total', totals.total, true),
        summaryRow('Balance due', totals.balanceDue, true),
      ],
    }),
  });
}