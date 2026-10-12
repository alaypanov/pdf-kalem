<script setup lang="ts">
import { PageSize, PdfDoc, type FontSet } from '../../../src/index'
import { evalPages, widgetSandbox } from './sandbox'
import { loadPlaygroundFonts, playgroundTheme } from './workbench'
import CodePdfWorkbench from './CodePdfWorkbench.vue'
import { mdiAbacus } from '@mdi/js'

/**
 * Live widget-tree workbench for the docs playground.
 *
 * The editor holds the body of a plain-JS function returning an array of
 * Page widgets — widget factories, `theme`, `fromHex`, `PageSize`, and
 * `mdiAbacus` are injected as parameters (same sandbox contract as the
 * standalone examples), evaluated with `new Function` on every debounced
 * render. The starter tree is the invoice example. The shell (editor,
 * preview, debounce, status) lives in {@link CodePdfWorkbench}.
 * Mount inside <ClientOnly> — rendering touches browser APIs.
 */

const SAMPLE_CODE = `// Widget playground — edit the code; the PDF re-renders as you type.
//
// This is the body of a function: \`return\` an array of Page widgets.
// Widget factories (Page, Text, Row, Column, Container, Table, …) plus
// \`theme\`, \`fromHex\`, \`PageSize\`, and \`mdiAbacus\` are already in scope —
// plain JavaScript, no imports or types needed. Fonts, theme, and document
// setup are handled by the scaffolding around this editor.
//
// Tip: children of a Container shrink-wrap (alignItems: flex-start) — give
// Rows and Columns \`width: '100%'\` when you want them to fill the panel
// or let \`justifyBetween\` spread their children.

const lineItems = [
  { description: 'Frontend implementation support', quantity: '12', rate: '$85.00', amount: '$1,020.00' },
  { description: 'Design system audit', quantity: '4', rate: '$120.00', amount: '$480.00' },
  { description: 'Performance optimization', quantity: '8', rate: '$120.00', amount: '$960.00' },
];

const totals = {
  subtotal: '$2,460.00',
  tax: '$196.80',
  total: '$2,656.80',
  balanceDue: '$2,656.80',
};

function labelValue(label, value) {
  return Column({
    gap: 3,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      Text(value, { variant: 'body' }),
    ],
  });
}

function summaryRow(label, value, emphasize = false) {
  return Row({
    width: '100%',
    mainAxisAlignment: Row.justifyBetween,
    children: [
      Text(label, { variant: emphasize ? 'label' : 'body' }),
      Text(value, { variant: emphasize ? 'h2' : 'body' }),
    ],
  });
}

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
                    child: Text('ACME STUDIO', { variant: 'label', color: 'white' }),
                  }),
                  Text('INVOICE', { variant: 'h1' }),
                  Text('Project delivery and implementation support.', {
                    variant: 'caption',
                  }),
                ],
              }),
              Container({
                width: 210,
                padding: 14,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 7,
                  children: [
                    Text('Invoice summary', { variant: 'h2' }),
                    labelValue('Invoice number', 'INV-2026-014'),
                    labelValue('Issue date', 'May 31, 2026'),
                    labelValue('Due date', 'June 14, 2026'),
                  ],
                }),
              }),
            ],
          }),

          HLine({ color: 'line', thickness: 1, width: '100%' }),

          // Parties: equal-height panels (alignStretch), addresses on one line.
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStretch,
            children: [
              Container({
                width: '50%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('From', { variant: 'h2' }),
                    Text('Acme Studio LLC', { variant: 'body' }),
                    Text('201 Market Street, San Francisco, CA 94105', { variant: 'caption' }),
                    Link('billing@acmestudio.dev', {
                      href: 'mailto:billing@acmestudio.dev',
                      variant: 'link',
                    }),
                  ],
                }),
              }),
              Container({
                width: '49%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('Bill to', { variant: 'h2' }),
                    Text('Northwind Labs — Attn: Finance Team', { variant: 'body' }),
                    Text('88 King Street, Toronto, ON M5V 1L7', { variant: 'caption' }),
                    Link('accounts@northwindlabs.com', {
                      href: 'mailto:accounts@northwindlabs.com',
                      variant: 'link',
                    }),
                  ],
                }),
              }),
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
                labelValue('Project', 'Website refresh and launch'),
                labelValue('Terms', 'Net 14'),
                labelValue('Currency', 'USD'),
              ],
            }),
          }),

          // Line items: numeric columns right-aligned.
          Table({
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
              rows: lineItems.map((item) =>
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
          }),

          // Notes + totals: equal-height panels.
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStretch,
            children: [
              Container({
                width: '50%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('Notes', { variant: 'h2' }),
                    Text(
                      'Thank you for your business. Please include the invoice number with your payment reference.',
                      { variant: 'body' },
                    ),
                    Text('Bank transfer preferred. Payment is due within 14 days of receipt.', {
                      variant: 'caption',
                    }),
                  ],
                }),
              }),
              Container({
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
              }),
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
                Text('Paid via bank transfer to ACME STUDIO LLC', {
                  variant: 'caption',
                  color: 'white',
                }),
                Text('Thank you', { variant: 'caption', color: 'white' }),
              ],
            }),
          }),
        ],
      }),
    ],
  }),
];
`

async function renderCode(code: string, fonts: FontSet | undefined) {
  const pages = evalPages(code, widgetSandbox({ theme: playgroundTheme, mdiAbacus }))

  const doc = new PdfDoc({
    size: PageSize.LETTER,
    theme: playgroundTheme,
    fonts,
    meta: {
      title: 'pdf-kalem widget playground',
      creator: 'pdf-kalem',
      producer: 'pdf-lib',
    },
    children: pages,
  })

  const blob = await doc.getBlob()
  const pageCount = await doc.getPageCount()
  return { blob, pageCount }
}
</script>

<template>
  <CodePdfWorkbench
    :sample-code="SAMPLE_CODE"
    breadcrumbs="widgets"
    source-label="Source"
    download-name="widgets.pdf"
    :load-fonts="() => loadPlaygroundFonts({ body: 'inter', heading: 'inter', mono: 'inter' }, 'widget playground')"
    :render-code="renderCode"
  />
</template>
