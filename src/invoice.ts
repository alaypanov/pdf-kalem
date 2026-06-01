import {
  Column,
  Container,
  HLine,
  Link,
  Page,
  Row,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
} from './lib/widgets';
import { PdfDoc, PageSize, createTheme } from './lib';
import { fromHex } from './lib/utils/color-utils';

const lineItems = [
  {
    description: 'Product design system audit',
    quantity: '1',
    rate: '$1,200.00',
    amount: '$1,200.00',
  },
  {
    description: 'Frontend implementation support',
    quantity: '12',
    rate: '$85.00',
    amount: '$1,020.00',
  },
  {
    description: 'QA review and launch checklist',
    quantity: '4',
    rate: '$60.00',
    amount: '$240.00',
  },
];

const totals = {
  subtotal: '$2,460.00',
  tax: '$196.80',
  total: '$2,656.80',
  balanceDue: '$2,656.80',
};

function labelValue(label: string, value: string) {
  return Column({
    gap: 4,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      Text(value, { variant: 'body' }),
    ],
  });
}

function summaryRow(label: string, value: string, emphasize = false) {
  return Row({
    mainAxisAlignment: Row.justifyBetween,
    children: [
      Text(label, { variant: emphasize ? 'label' : 'body' }),
      Text(value, { variant: emphasize ? 'h2' : 'body' }),
    ],
  });
}

async function generateInvoiceBlob() {
  await PdfDoc.registerFonts({ Inter: '/fonts/Inter-Regular.ttf' });

  const theme = createTheme({
    fonts: {
      body: 'Inter',
      heading: 'Inter',
      mono: 'Inter',
    },
    colors: {
      ink: fromHex('#0f172a'),
      muted: fromHex('#64748b'),
      line: fromHex('#dbe3ef'),
      panel: fromHex('#f8fafc'),
      accent: fromHex('#0f766e'),
      accentSoft: fromHex('#e6fffb'),
      brand: fromHex('#0b3b66'),
      white: fromHex('#ffffff'),
    },
    text: {
      body: { font: 'body', size: 11.5, lineHeight: 12, color: 'ink' },
      h1: { font: 'heading', size: 28, lineHeight: 32, color: 'brand' },
      h2: { font: 'heading', size: 16, lineHeight: 20, color: 'ink' },
      label: { font: 'body', size: 9.5, lineHeight: 11, color: 'muted' },
      caption: { font: 'body', size: 10, lineHeight: 12, color: 'muted' },
      link: { font: 'body', size: 11.5, lineHeight: 14, color: 'accent', underline: true },
    },
    container: {
      bgColor: 'white',
    },
    table: {
      borderColor: 'line',
      borderWidth: 1,
      cellPadding: 10,
      headBgColor: 'brand',
      rowBgColor: 'white',
      alternateRowBgColor: 'panel',
    },
  });

  const doc = new PdfDoc({
    size: PageSize.LETTER,
    theme,
    meta: {
      title: 'Generic invoice',
      author: 'Kalem',
      subject: 'Invoice example',
      language: 'en-US',
      keywords: ['invoice', 'example', 'pdf'],
      creator: 'Kalem',
      producer: 'pdf-lib',
    },
    children: [
      Page({
        padding: 36,
        children: [
          Column({
            gap: 20,
            children: [
              Row({
                mainAxisAlignment: Row.justifyBetween,
                crossAxisAlignment: Row.alignStart,
                children: [
                  Column({
                    gap: 8,
                    children: [
                      Container({
                        width: 92,
                        padding: 12,
                        bgColor: 'accentSoft',
                        child: Text('ACME STUDIO', { variant: 'label', color: 'brand' }),
                      }),
                      Text('INVOICE', { variant: 'h1' }),
                      Text('Creative services invoice for project delivery and implementation support.', {
                        variant: 'caption',
                        maxLines: 2,
                        overflow: 'ellipsis',
                      }),
                    ],
                  }),
                  Container({
                    width: 210,
                    padding: 16,
                    bgColor: 'panel',
                    child: Column({
                      gap: 8,
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

              Row({
                mainAxisAlignment: Row.justifyBetween,
                crossAxisAlignment: Row.alignStart,
                children: [
                  Container({
                    width: 248,
                    padding: 16,
                    bgColor: 'panel',
                    child: Column({
                      gap: 8,
                      children: [
                        Text('From', { variant: 'h2' }),
                        Text('Acme Studio LLC', { variant: 'body' }),
                        Text('201 Market Street', { variant: 'caption' }),
                        Text('San Francisco, CA 94105', { variant: 'caption' }),
                        Link('billing@acmestudio.dev', {
                          href: 'mailto:billing@acmestudio.dev',
                          variant: 'link',
                        }),
                      ],
                    }),
                  }),
                  Container({
                    width: 248,
                    padding: 16,
                    bgColor: 'panel',
                    child: Column({
                      gap: 8,
                      children: [
                        Text('Bill to', { variant: 'h2' }),
                        Text('Northwind Labs', { variant: 'body' }),
                        Text('Attn: Finance Team', { variant: 'caption' }),
                        Text('88 King Street', { variant: 'caption' }),
                        Text('Toronto, ON M5V 1L7', { variant: 'caption' }),
                        Link('accounts@northwindlabs.com', {
                          href: 'mailto:accounts@northwindlabs.com',
                          variant: 'link',
                        }),
                      ],
                    }),
                  }),
                ],
              }),

              Container({
                width: '100%',
                padding: 16,
                bgColor: 'accentSoft',
                child: Row({
                  mainAxisAlignment: Row.justifyBetween,
                  children: [
                    labelValue('Project', 'Website refresh and launch support'),
                    labelValue('Terms', 'Net 14'),
                    labelValue('Currency', 'USD'),
                  ],
                }),
              }),

              Table({
                width: '100%',
                columnWeights: [3.5, 1, 1, 1],
                head: TableHead({
                  rows: [
                    TableRow({
                      children: ['Description', 'Qty', 'Rate', 'Amount'].map((value) =>
                        TableCell({
                          child: Text(value, { variant: 'label', color: 'white' }),
                        })
                      ),
                    }),
                  ],
                }),
                body: TableBody({
                  rows: lineItems.map((item) =>
                    TableRow({
                      minHeight: 42,
                      children: [
                        TableCell({ child: Text(item.description, { variant: 'body' }) }),
                        TableCell({ child: Text(item.quantity, { variant: 'body' }) }),
                        TableCell({ child: Text(item.rate, { variant: 'body' }) }),
                        TableCell({ child: Text(item.amount, { variant: 'body' }) }),
                      ],
                    })
                  ),
                }),
              }),

              Row({
                mainAxisAlignment: Row.justifyBetween,
                crossAxisAlignment: Row.alignStart,
                children: [
                  Container({
                    width: 280,
                    padding: 16,
                    bgColor: 'panel',
                    child: Column({
                      gap: 8,
                      children: [
                        Text('Notes', { variant: 'h2' }),
                        Text('Thank you for your business. Please include the invoice number with your payment reference.', {
                          variant: 'body',
                        }),
                        Text('Bank transfer preferred. Payment is due within 14 days of receipt.', {
                          variant: 'caption',
                        }),
                      ],
                    }),
                  }),
                  Container({
                    width: 220,
                    padding: 16,
                    bgColor: 'panel',
                    child: Column({
                      gap: 10,
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
                padding: 14,
                bgColor: 'brand',
                child: Row({
                  mainAxisAlignment: Row.justifyBetween,
                  children: [
                    Text('Paid via bank transfer to ACME STUDIO LLC', { variant: 'caption', color: 'white' }),
                    Text('Thank you', { variant: 'caption', color: 'white' }),
                  ],
                }),
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return doc.getBlob();
}

window.addEventListener('load', async () => {
  const blob = await generateInvoiceBlob();
  const pdfElement = document.getElementById('pdf') as HTMLIFrameElement | HTMLObjectElement | null;

  if (!pdfElement) {
    throw new Error("Missing PDF element with id='pdf'");
  }

  const url = URL.createObjectURL(blob);

  if (pdfElement instanceof HTMLObjectElement) {
    pdfElement.data = url;
  } else {
    pdfElement.src = url;
  }
});

