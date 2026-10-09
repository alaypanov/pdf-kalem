import { createTheme } from 'pdf-kalem';
import { fromHex } from 'pdf-kalem/utils/color-utils';

/**
 * The converted document's look. `markdownToPdf` merges these values over
 * its own markdown theme defaults — user values win per key, so only the
 * tokens you set change the output.
 */
export const theme = createTheme({
  fonts: {
    body: 'inter',
    code: 'mono',
  },
  colors: {
    ink: fromHex('#1f2937'),
    muted: fromHex('#6b7280'),
    link: fromHex('#1d4ed8'),
  },
  text: {
    body: { font: 'body', size: 11, color: 'ink' },
    h1: { font: 'body', size: 26, color: 'ink' },
    h2: { font: 'body', size: 19, color: 'ink' },
    h3: { font: 'body', size: 15, color: 'ink' },
  },
});