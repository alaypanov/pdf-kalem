import { Column, Container, HLine, Page, Row, Text } from 'pdf-kalem/widgets';
import type { InvoiceData } from './data.ts';
import { labelValue } from './components/label-value.ts';
import { lineItemsTable } from './components/line-items-table.ts';
import { notesPanel } from './components/notes-panel.ts';
import { partyPanel } from './components/party-panel.ts';
import { summaryCard } from './components/summary-card.ts';
import { totalsPanel } from './components/totals-panel.ts';

/**
 * The invoice page: header, parties, project bar, line items, closing
 * panels, and footer bar — assembled from components, styled only through
 * theme tokens.
 */
export function invoicePages(data: InvoiceData) {
  return [
    Page({
      padding: 36,
      children: [
        Column({
          gap: 16,
          children: [
            // Header: brand chip + title on the left, summary card on the right.
            Row({
              width: '100%',
              mainAxisAlignment: Row.justifyBetween,
              crossAxisAlignment: Row.alignStart,
              children: [
                Column({
                  gap: 10,
                  children: [
                    Container({
                      padding: 12,
                      bgColor: 'brand',
                      child: Text(data.brand, { variant: 'label', color: 'white' }),
                    }),
                    Text(data.title, { variant: 'h1' }),
                    Text(data.subtitle, { variant: 'caption' }),
                  ],
                }),
                summaryCard(data.summary),
              ],
            }),

            HLine({ color: 'line', thickness: 1, width: '100%' }),

            // Parties: equal-height panels (alignStretch), addresses on one line.
            Row({
              width: '100%',
              mainAxisAlignment: Row.justifyBetween,
              crossAxisAlignment: Row.alignStretch,
              children: [
                partyPanel('From', data.from, '50%'),
                partyPanel('Bill to', data.billTo, '49%'),
              ],
            }),

            // Project bar: width 100% so justifyBetween spreads the three groups.
            Container({
              width: '100%',
              padding: 12,
              bgColor: 'accentSoft',
              child: Row({
                width: '100%',
                mainAxisAlignment: Row.justifyBetween,
                children: [
                  labelValue('Project', data.details.project),
                  labelValue('Terms', data.details.terms),
                  labelValue('Currency', data.details.currency),
                ],
              }),
            }),

            lineItemsTable(data.lineItems),

            // Notes + totals: equal-height panels.
            Row({
              width: '100%',
              mainAxisAlignment: Row.justifyBetween,
              crossAxisAlignment: Row.alignStretch,
              children: [
                notesPanel(data.notes),
                totalsPanel(data.totals),
              ],
            }),

            Container({
              width: '100%',
              padding: 12,
              bgColor: 'brand',
              child: Row({
                width: '100%',
                mainAxisAlignment: Row.justifyBetween,
                children: [
                  Text(data.footer.left, { variant: 'caption', color: 'white' }),
                  Text(data.footer.right, { variant: 'caption', color: 'white' }),
                ],
              }),
            }),
          ],
        }),
      ],
    }),
  ];
}