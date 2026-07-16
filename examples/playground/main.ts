import {
  Column,
  Container,
  FixedContainer,
  HLine,
  Image,
  ImageSizing,
  Link,
  Page,
  Row,
  SVGPath,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
} from '../../src/widgets';
import { PdfDoc, PageSize, createTheme } from '../../src';
import { fromHex } from '../../src/lib/utils/color-utils';

async function generatePdf() {
  await PdfDoc.registerFonts({ Inter: '/fonts/Inter-Regular.ttf' });

  PdfDoc.beforeCreate(() => {
    console.log('Before create');
  });

  PdfDoc.afterSave(({ bytes, doc }) => {
    console.log('After save, pages:', doc.getPageCount(), 'bytes:', bytes.length);
  });

  const theme = createTheme({
    fonts: {
      body: 'Inter',
      heading: 'Inter',
    },
    colors: {
      text: fromHex('#0f172a'),
      muted: fromHex('#475569'),
      surface: fromHex('#ffffff'),
      surfaceAlt: fromHex('#f8fafc'),
      primary: fromHex('#1d4ed8'),
      border: fromHex('#cbd5e1'),
      link: fromHex('#0f766e'),
    },
    text: {
      body: { font: 'body', size: 12, lineHeight: 14.5, color: 'text' },
      h1: { font: 'heading', size: 20, lineHeight: 24, color: 'text' },
      h2: { font: 'heading', size: 18, lineHeight: 22, color: 'text' },
      caption: { font: 'body', size: 11, lineHeight: 13, color: 'muted' },
      link: { font: 'body', size: 13, lineHeight: 15, color: 'link', underline: true },
    },
    container: {
      bgColor: 'surface',
    },
    table: {
      borderColor: 'border',
      borderWidth: 1,
      cellPadding: 8,
      headBgColor: 'primary',
      rowBgColor: 'surface',
      alternateRowBgColor: 'surfaceAlt',
    },
  });

  const doc = new PdfDoc({
    size: PageSize.LETTER,
    debug: true,
    theme,
    meta: {
      title: 'Kalem playground demo',
      author: 'Kalem',
      subject: 'Widget-tree PDF rendering demo',
      language: 'en-US',
      keywords: ['demo', 'pdf-lib', 'layout'],
      creator: 'Kalem',
      producer: 'pdf-lib',
    },
    children: [
      Page({
        size: PageSize.A3,
        padding: 10,
        children: [
          Text('lorem ipsum iblis dolor', { variant: 'body', color: fromHex('#ff0000') }),
          Container({
            height: 100,
            width: '100%',
            padding: 10,
            bgColor: fromHex('#ffbb00'),
            child: Container({
              width: 100,
              height: 50,
              bgColor: fromHex('#00ff00'),
              child: Text('hello world', {}),
            }),
          }),
          Container({
            width: '100%',
            height: 'auto',
            bgColor: fromHex('#218d15ff'),
            child: Image.png('/image1.png', { sizing: ImageSizing.Fit }),
          }),
          Container({
            width: 120,
            height: 50,
            bgColor: fromHex('#111111'),
            child: SVGPath(
              'M 10 30 C 10 10 40 10 40 30 C 40 50 25 60 25 60 C 25 60 10 50 10 30 Z',
              {
                viewBoxWidth: 64,
                viewBoxHeight: 4,
                sizing: ImageSizing.Fit,
                fill: '#E11D48',
                stroke: '#111827',
                strokeWidth: 2,
              }
            ),
          }),
          Container({
            width: 160,
            height: 100,
            bgColor: fromHex('#de1912ff'),
            child: Text('hello green teste seore cdkeife sleiirk', {}),
          }),
          FixedContainer({
            right: 100,
            top: 100,
            width: 100,
            height: 100,
            bgColor: fromHex('#ae12deff'),
          }),

          Row({
            mainAxisAlignment: Row.justifyCenter,
            children: [
              Container({
                width: 100,
                height: 100,
                bgColor: fromHex('#ae12deff'),
                padding: 10,
                child: Link('hellow purple ', { href: 'https://google.com', variant: 'link' }),
              }),
              Container({
                width: 100,
                height: 100,
                padding: 10,
                bgColor: fromHex('#de1912ff'),
                child: Text('hello green', { variant: 'body' }),
              }),
            ],
          }),

          Table({
            width: '100%',
            columnWeights: [2, 1, 1],
            head: TableHead({
              rows: [
                TableRow({
                  children: ['KPI', 'Value', 'Change vs last quarter'].map((value) =>
                    TableCell({ child: Text(value, { size: 14, color: '#ffffff' }) })
                  ),
                }),
              ],
            }),
            body: TableBody({
              rows: [
                TableRow({
                  children: [
                    TableCell({ child: Text('Quarterly revenue summary') }),
                    TableCell({ child: Text('$42k') }),
                    TableCell({ child: Text('+12%') }),
                  ],
                }),
                TableRow({
                  children: [
                    TableCell({ child: Text('Customer retention', {}) }),
                    TableCell({ child: Text('93%', {}) }),
                    TableCell({ child: Text('+4%', {}) }),
                  ],
                }),
                TableRow({
                  children: [
                    TableCell({ child: Text('Support backlog', {}) }),
                    TableCell({ child: Text('18', {}) }),
                    TableCell({ child: Text('-7', {}) }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
      Page({
        padding: 10,
        children: [
          Text('Second page', { variant: 'h1' }),
          HLine({ color: fromHex('#0000ff'), thickness: 2, width: '100%' }),
          Container({
            width: '100%',
            padding: 12,
            bgColor: fromHex('#e0f2fe'),
            child: Column({
              gap: 8,
              children: [
                Text('Text overflow demos', { variant: 'h2' }),
                Row({
                  children: [
                    Container({
                      width: 220,
                      height: 70,
                      padding: 8,
                      bgColor: 'surface',
                      child: Text('This paragraph is intentionally long so the new text engine has to wrap it, respect max lines, and end with an ellipsis once it runs out of room.', {
                        variant: 'body',
                        size: 13,
                        maxLines: 2,
                        overflow: 'ellipsis',
                      }),
                    }),
                    Container({
                      width: 220,
                      height: 70,
                      padding: 8,
                      bgColor: 'surface',
                      child: Link('https://example.com/docs/very/long/link/path/that/needs/wrapping/and/truncation/to-stay-readable-in-tight-cards', {
                        href: 'https://example.com/docs/very/long/link/path/that/needs/wrapping/and/truncation/to-stay-readable-in-tight-cards',
                        variant: 'link',
                        size: 13,
                        maxLines: 2,
                        overflow: 'ellipsis',
                      }),
                    }),
                  ],
                }),
              ],
            }),
          }),
          FixedContainer({
            right: 10,
            top: 10,
            width: 100,
            height: 100,
            bgColor: fromHex('#aabbff'),
          }),
          Column({
            gap: 10,
            children: [
              Text('start', { variant: 'h1' }),
              Text('hello world', { variant: 'caption' }),
              Container({
                width: 200,
                height: 100,
                bgColor: fromHex('#00ff00'),
                child: Text('hello world', {}),
              }),
              Container({
                width: 100,
                height: 200,
                bgColor: fromHex('#2f00ff'),
                child: Text('hello world', {}),
              }),
              Container({
                width: 100,
                height: 50,
                bgColor: fromHex('#ff0000'),
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return doc.save();
}

window.addEventListener('load', async () => {
  const bytes = await generatePdf();
  const pdfElement = document.getElementById('pdf') as HTMLIFrameElement | HTMLObjectElement | null;

  if (!pdfElement) {
    throw new Error("Missing PDF element with id='pdf'");
  }

  const pdfBytes = new Uint8Array(bytes);
  const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));

  if (pdfElement instanceof HTMLObjectElement) {
    pdfElement.data = url;
  } else {
    pdfElement.src = url;
  }
});
