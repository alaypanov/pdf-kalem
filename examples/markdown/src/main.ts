import { readFile } from 'node:fs/promises';
import { useFonts } from 'pdf-kalem';
import { markdownToPdf } from 'pdf-kalem/markdown';
import { sample } from './sample.ts';
import { styles } from './styles.ts';
import { theme } from './theme.ts';

// Usage: node src/main.ts [input.md] [output.pdf]
// With no arguments, converts the embedded sample to markdown.pdf.
const [input, output = 'markdown.pdf'] = process.argv.slice(2);
const markdown = input ? await readFile(input, 'utf8') : sample;

// Inter loads from the repo's shared examples/fonts/ folder through `files`
// (all four faces — the sample uses bold/italic runs). Code falls back to the
// builtin mono alias (Courier).
const face = (name: string) => readFile(new URL(`../../fonts/${name}`, import.meta.url));
const fonts = await useFonts(
  { body: 'inter' },
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

const doc = await markdownToPdf(markdown, {
  theme,
  fonts,
  styles,
  meta: {
    title: input ?? 'pdf-kalem markdown demo',
    creator: 'pdf-kalem',
    producer: 'pdf-lib',
  },
});

await doc.writeToFile(output);
console.log(`Wrote ${output}${input ? ` from ${input}` : ' (embedded sample)'}`);