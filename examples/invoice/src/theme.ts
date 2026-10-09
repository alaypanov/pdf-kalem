import { createTheme } from 'pdf-kalem';
import { fromHex } from 'pdf-kalem/utils/color-utils';

/**
 * The invoice's visual identity: color tokens, text variants, and table
 * defaults. Widgets reference tokens by name ('brand', 'panel', 'label'),
 * so re-skinning the document never touches layout code.
 */
export const theme = createTheme({
  fonts: {
    body: 'inter',
    heading: 'inter',
    mono: 'inter',
  },
  colors: {
    primary: fromHex('#0f172a'),
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
    link: {
      font: 'body',
      size: 11.5,
      lineHeight: 14,
      color: 'accent',
      underline: true,
    },
  },
  container: {
    bgColor: 'white',
  },
  table: {
    borderColor: 'line',
    borderWidth: 1,
    cellPadding: 8,
    headBgColor: 'brand',
    rowBgColor: 'white',
    alternateRowBgColor: 'panel',
  },
});