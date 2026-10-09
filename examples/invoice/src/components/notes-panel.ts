import { Column, Container, Text } from 'pdf-kalem/widgets';
import type { InvoiceData } from '../data.ts';

/** The "Notes" panel, left of the totals. */
export function notesPanel(notes: InvoiceData['notes']) {
  return Container({
    width: '50%',
    padding: 12,
    bgColor: 'panel',
    child: Column({
      width: '100%',
      gap: 6,
      children: [
        Text('Notes', { variant: 'h2' }),
        Text(notes.message, { variant: 'body' }),
        Text(notes.terms, { variant: 'caption' }),
      ],
    }),
  });
}