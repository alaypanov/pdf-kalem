import { PageSize, PdfDoc, useFonts } from 'pdf-kalem';
import { invoice } from './data.ts';
import { invoicePages } from './document.ts';
import { theme } from './theme.ts';

// One call: loads the shipped Inter family and binds it to the theme's font
// tokens at doc construction (doc-level wins over theme.fonts).
const fonts = await useFonts({ body: 'inter', heading: 'inter', mono: 'inter' });

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