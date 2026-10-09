# Theming

Documents carry a theme: color tokens, font tokens, text variants, and table/container defaults. Widget props override theme defaults, so the theme can stay focused on typography and visual tokens while layout remains explicit in the document tree.

## Defining a theme

```ts
import { PdfDoc, PageSize, createTheme } from 'pdf-kalem';
import { Page, Text, Table } from 'pdf-kalem/widgets';
import { fromHex } from 'pdf-kalem/utils/color-utils';

const theme = createTheme({
  fonts: {
    body: 'Inter',
    heading: 'Inter',
  },
  colors: {
    text: fromHex('#0f172a'),
    primary: fromHex('#1d4ed8'),
    border: fromHex('#cbd5e1'),
  },
  text: {
    body: { font: 'body', size: 12, color: 'text' },
    h1: { font: 'heading', size: 20, color: 'text' },
    link: { font: 'body', size: 12, color: 'primary', underline: true },
  },
  table: {
    borderColor: 'border',
    headBgColor: 'primary',
    cellPadding: 8,
  },
});

const doc = new PdfDoc({
  size: PageSize.LETTER,
  theme,
  children: [
    Page({
      children: [
        Text('Quarterly report', { variant: 'h1' }),
        Text('Prepared with shared theme defaults', { variant: 'body' }),
        Table({ width: '100%' }),
      ],
    }),
  ],
});
```

## What themes carry

- **`colors`** — named tokens. Widgets reference them by string (`bgColor: 'panel'`, `color: 'brand'`); hex values via `fromHex('#…')` also work anywhere a color is accepted.
- **`fonts`** — font tokens. Text variants reference fonts by token (`font: 'body'`), so swapping a family is a one-line change.
- **`text`** — text variants (`body`, `h1`..`h6`, `label`, `caption`, `link`, …). A variant sets font, size, line height, color, and underline; widgets pick one with `Text(..., { variant: 'h2' })`.
- **`table`** — table defaults: `borderColor`, `borderWidth`, `cellPadding`, `headBgColor`, `rowBgColor`, `alternateRowBgColor`.
- **`container`** — container defaults: `bgColor`, `padding`, border fields.

## Precedence

Widget props win over theme defaults, per property. A `Text({ variant: 'body', color: 'accent' })` uses the variant's font and size but the overridden color. Unresolved theme tokens fall back per widget (e.g. container backgrounds to white, icons to black).

## Markdown theme defaults

The markdown converter merges its own defaults (heading sizes, link color, table cell padding) under your theme — user values win per key. See the [markdown guide](/guide/markdown).
