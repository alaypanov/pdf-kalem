import { Column, Container, Link, Text } from 'pdf-kalem/widgets';
import type { InvoiceParty } from '../data.ts';

/**
 * A "From" / "Bill to" panel. Widths differ by one percent so the pair
 * reads as two separate cards rather than one split surface.
 */
export function partyPanel(title: string, party: InvoiceParty, width: string) {
  return Container({
    width,
    padding: 12,
    bgColor: 'panel',
    child: Column({
      width: '100%',
      gap: 6,
      children: [
        Text(title, { variant: 'h2' }),
        Text(party.name, { variant: 'body' }),
        Text(party.address, { variant: 'caption' }),
        Link(party.email, {
          href: `mailto:${party.email}`,
          variant: 'link',
        }),
      ],
    }),
  });
}