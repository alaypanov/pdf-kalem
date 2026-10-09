import { PageSize, PdfDoc } from 'pdf-kalem';
import { reportPages } from './document.ts';
import { theme } from './theme.ts';

// No useFonts here: the theme maps body/heading/mono onto the builtin
// 'sans'/'mono' aliases, which work without registering any font files.
const doc = new PdfDoc({
  size: PageSize.LETTER,
  theme,
  meta: {
    title: 'Q1 Report',
    author: 'Northwind Labs',
    subject: 'Platform, reliability, and delivery',
    language: 'en-US',
    keywords: ['report', 'q1'],
    creator: 'pdf-kalem',
    producer: 'pdf-lib',
  },
  children: reportPages(),
});

await doc.writeToFile('report.pdf');
console.log(`Wrote report.pdf (${await doc.getPageCount()} pages)`);