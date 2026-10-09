import { readFile } from 'node:fs/promises';
import { PageSize, PdfDoc, useFonts } from 'pdf-kalem';
import { invoice } from './data.ts';
import { invoicePages } from './document.ts';
import { theme } from './theme.ts';

// Inter loads from the repo's shared examples/fonts/ folder through `files`
// (Node: fs bytes; in the browser you'd fetch the same files). One call binds
// the family to the theme's font tokens at doc construction (doc-level wins
// over theme.fonts).
const face = (name: string) => readFile(new URL(`../../fonts/${name}`, import.meta.url));
const fonts = await useFonts(
  { body: 'inter', heading: 'inter', mono: 'inter' },
  {
    files: {
      inter: {
        regular: await face('Inter-Regular.ttf'),
        bold: await face('Inter-Bold.ttf'),
        italic: await face('Inter-Italic.ttf'),
        boldItalic: await face('Inter-BoldItalic.ttf'),
      },
    },
  },
);

const doc = new PdfDoc({
  size: PageSize.LETTER,
  theme,
  fonts,
  meta: {
    title: 'Generic invoice',
    author: 'pdf-kalem',
    subject: 'Invoice example',
    language: 'en-US',
    keywords: ['invoice', 'example', 'pdf'],
    creator: 'pdf-kalem',
    producer: 'pdf-lib',
  },
  children: invoicePages(invoice),
});

await doc.writeToFile('invoice.pdf');
console.log('Wrote invoice.pdf');