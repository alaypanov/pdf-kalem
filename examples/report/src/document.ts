import { Column, Container, FixedContainer, HLine, Link, Page, Row, Text } from 'pdf-kalem/widgets';
import { PageSize } from 'pdf-kalem';
import { fromHex } from 'pdf-kalem/utils/color-utils';
import {
  executiveSummary,
  incidents,
  milestones,
  nextQuarter,
  platformNarrative,
  reliabilityNarrative,
  type Incident,
  type Milestone,
} from './data.ts';
import { callout } from './components/callout.ts';
import { dataTable, type DataTableColumn } from './components/data-table.ts';
import { labelValue } from './components/label-value.ts';
import { panel } from './components/panel.ts';
import { sectionHeading } from './components/section-heading.ts';
import { statCard } from './components/stat-card.ts';
import { theme } from './theme.ts';

const milestoneColumns: DataTableColumn<Milestone>[] = [
  { header: 'Milestone', weight: 4, cell: (item) => item.milestone },
  { header: 'Owner', weight: 1.4, cell: (item) => item.owner },
  { header: 'Status', weight: 1.4, cell: (item) => item.status },
  { header: 'Target', weight: 1.2, cell: (item) => item.target },
];

const incidentColumns: DataTableColumn<Incident>[] = [
  { header: 'Incident', weight: 1, cell: (item) => item.id },
  { header: 'Severity', weight: 1, cell: (item) => item.severity },
  { header: 'Duration', weight: 1, cell: (item) => item.duration },
  { header: 'Summary', weight: 5, cell: (item) => item.summary },
];

function tocRow(number: string, title: string) {
  return Row({
    width: '100%',
    mainAxisAlignment: Row.justifyBetween,
    children: [
      Row({
        style: { gap: 10 },
        crossAxisAlignment: Row.alignCenter,
        children: [
          Text(number, { variant: 'label', color: 'accent' }),
          Text(title, { variant: 'body' }),
        ],
      }),
      Text(`section ${number}`, { variant: 'caption' }),
    ],
  });
}

/** The cover: brand chip, stat cards, table of contents, metadata panel. */
function coverPage() {
  return Page({
    size: PageSize.LETTER,
    padding: 48,
    children: [
      Column({
        gap: 24,
        children: [
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStart,
            children: [
              Column({
                gap: 10,
                children: [
                  Container({
                    width: 132,
                    padding: 8,
                    bgColor: 'brand',
                    child: Text('NORTHWIND LABS', { variant: 'label', color: 'white' }),
                  }),
                  Text('Engineering Quarterly', { variant: 'h1' }),
                  Text('Q1 2026 — platform, reliability, and delivery', { variant: 'caption' }),
                ],
              }),
              panel({
                width: 190,
                padding: 14,
                children: [
                  Text('Report metadata', { variant: 'h3' }),
                  labelValue('Prepared by', 'Platform group'),
                  labelValue('Period', 'Jan 01 — Mar 31, 2026'),
                  labelValue('Distribution', 'Engineering · Product'),
                  labelValue('Contact', Link('eng@northwindlabs.com', {
                    href: 'mailto:eng@northwindlabs.com',
                    variant: 'link',
                  })),
                ],
              }),
            ],
          }),

          HLine({ color: 'line', thickness: 1, width: '100%' }),

          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStretch,
            children: [
              statCard('Deploys', '142', '+18% vs Q4'),
              statCard('Uptime', '99.98%', '+0.07pt vs Q4'),
              statCard('Median MTTR', '31 min', '-20 min vs Q4'),
            ],
          }),

          panel({
            padding: 16,
            children: [
              Text('In this report', { variant: 'h3' }),
              tocRow('01', 'Executive summary'),
              tocRow('02', 'Delivery milestones'),
              tocRow('03', 'Platform investments'),
              tocRow('04', 'Reliability'),
              tocRow('05', 'Next quarter'),
            ],
          }),

          Column({
            width: '100%',
            gap: 10,
            children: [
              Text('About this document', { variant: 'h3' }),
              Text(
                'This report was generated from the same widget tree that renders our customer-facing documents: every section below is a composition of layout primitives — flowing text, splitting tables, keep-together panels, and page-level furniture — paginated by the engine into the pages you are reading. Nothing in this file was laid out by hand.',
                { variant: 'body' },
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The flowing report: sections, splitting tables, keep-together callouts. */
function reportPage() {
  return Page({
    size: PageSize.LETTER,
    padding: 48,
    children: [
      // Page furniture: re-emitted on every output page this Page produces,
      // and absent from the cover — each Page owns its furniture.
      // FixedContainer takes a concrete color (no theme-token resolution),
      // hence the explicit brand hex.
      FixedContainer({
        bottom: 0,
        left: 0,
        right: 0,
        height: 30,
        bgColor: theme.colors?.brand ?? fromHex('#134e4a'),
        children: [
          Row({
            width: '100%',
            style: { padding: 9, gap: 12 },
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignCenter,
            children: [
              Text('Northwind Labs — Q1 2026 Engineering Report', {
                variant: 'caption',
                color: 'white',
              }),
              Text('Confidential', { variant: 'caption', color: 'white' }),
            ],
          }),
        ],
      }),

      Column({
        width: '100%',
        gap: 18,
        children: [
          sectionHeading('01', 'Executive summary'),
          ...executiveSummary.map((text) => Text(text, { variant: 'body' })),
          callout(
            'Key finding',
            'Documents composed against the pagination engine required no per-surface break hints: the flow structure alone was enough to produce correct output for every template we migrated in February.',
          ),

          sectionHeading('02', 'Delivery milestones'),
          Text(
            'Fourteen milestones were tracked this quarter. Eleven shipped on or before their target date, two are in review, and one slipped into April by explicit scope trade — the email backend spike absorbed the slack. The table below spans multiple pages; the header row repeats on every continuation page.',
            { variant: 'body' },
          ),
          dataTable(milestones, milestoneColumns),

          sectionHeading('03', 'Platform investments'),
          ...platformNarrative.map((text) => Text(text, { variant: 'body' })),
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStart,
            children: [
              panel({
                width: '49%',
                children: [
                  Text('Design system', { variant: 'h3', color: 'brand' }),
                  Text(
                    'Tokens, text variants, and table defaults now live in one theme object. Surfaces that consumed ad hoc style options were migrated in three pull requests, and the theme resolves through pure functions that the test suite exercises directly.',
                    { variant: 'body' },
                  ),
                ],
              }),
              panel({
                width: '49%',
                children: [
                  Text('Render pipeline', { variant: 'h3', color: 'brand' }),
                  Text(
                    'The backend-neutral context turned the PDF renderer into one adapter among several. Coordinate handling, font embedding, and page lifecycle stay inside the adapter; widgets deal in layout boxes only.',
                    { variant: 'body' },
                  ),
                ],
              }),
            ],
          }),

          sectionHeading('04', 'Reliability'),
          Text(reliabilityNarrative, { variant: 'body' }),
          dataTable(incidents, incidentColumns),

          sectionHeading('05', 'Next quarter'),
          ...nextQuarter.map((text) =>
            Row({
              width: '100%',
              style: { gap: 8 },
              crossAxisAlignment: Row.alignStart,
              children: [
                Text('·', { variant: 'body', color: 'accent' }),
                Text(text, { variant: 'body' }),
              ],
            }),
          ),
          HLine({ color: 'line', thickness: 1, width: '100%' }),
          Text(
            'Generated by pdf-kalem — the document you are reading is the engine’s own demo.',
            { variant: 'caption' },
          ),
        ],
      }),
    ],
  });
}
export function reportPages() {
  return [coverPage(), reportPage()];
}

export const pages = [coverPage(), reportPage()];