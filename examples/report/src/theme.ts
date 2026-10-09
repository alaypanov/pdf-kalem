import { createTheme } from 'pdf-kalem';
import { fromHex } from 'pdf-kalem/utils/color-utils';

/**
 * Editorial theme: warm ink on paper, deep teal brand, amber accents. Uses
 * the builtin font aliases ('sans'/'mono') so the example runs without
 * registering or loading any font files.
 */
export const theme = createTheme({
  fonts: {
    body: 'sans',
    heading: 'sans',
    mono: 'mono',
  },
  colors: {
    ink: fromHex('#1c1917'),
    muted: fromHex('#78716c'),
    line: fromHex('#e7e5e4'),
    panel: fromHex('#fafaf9'),
    accent: fromHex('#b45309'),
    accentSoft: fromHex('#fef3c7'),
    brand: fromHex('#134e4a'),
    brandSoft: fromHex('#ccfbf1'),
    white: fromHex('#ffffff'),
  },
  text: {
    body: { font: 'body', size: 10.5, lineHeight: 14, color: 'ink' },
    h1: { font: 'heading', size: 27, lineHeight: 31, color: 'brand' },
    h2: { font: 'heading', size: 15, lineHeight: 19, color: 'ink' },
    h3: { font: 'heading', size: 12, lineHeight: 16, color: 'ink' },
    label: { font: 'body', size: 9, lineHeight: 11, color: 'muted' },
    caption: { font: 'body', size: 9.5, lineHeight: 12, color: 'muted' },
    link: {
      font: 'body',
      size: 10.5,
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