import { PageSize, PdfDoc } from 'pdf-kalem';
import { Column, Container, Page, Row, Text } from 'pdf-kalem/widgets';
import { fromHex } from 'pdf-kalem/utils/color-utils';

// The smallest useful pdf-kalem document: one file, no theme, no components —
// just widgets in, PDF out. Run from this folder: node main.ts

const doc = new PdfDoc({
  size: PageSize.LETTER,
  meta: { title: 'Hello pdf-kalem' },
  children: [
    Page({
      padding: 48,
      children: [
        Column({
          gap: 16,
          children: [
            Text('Hello, pdf-kalem', { size: 28, color: fromHex('#1c1917') }),
            Text(
              'A one-file document: describe content as a tree of widgets, lay it out with flexbox (rows, columns, gaps, padding), and write the PDF. No theme, no components — add those when a document grows.',
              { size: 11, lineHeight: 16, color: fromHex('#78716c') },
            ),
            Row({
              gap: 12,
              children: [
                Container({ width: 120, height: 64, bgColor: fromHex('#b45309') }),
                Container({ width: 120, height: 64, bgColor: fromHex('#134e4a') }),
                Container({ width: 120, height: 64, bgColor: fromHex('#0f766e') }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

await doc.writeToFile('basic.pdf');
console.log('Wrote basic.pdf');