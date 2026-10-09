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

// Shipped family — no font files or network needed. Code falls back to the
// builtin mono alias (Courier).
const fonts = await useFonts({ body: 'inter' });

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