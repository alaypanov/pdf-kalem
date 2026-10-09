/**
 * The embedded sample, used when no input file is passed on the command
 * line. It exercises every supported construct so the output doubles as a
 * converter showcase.
 */
export const sample = `# pdf-kalem Markdown

This document was converted to PDF with **pdf-kalem** — a widget-tree UI library
for document generation. Everything you see is laid out with *Yoga flexbox*
and painted with pdf-lib.

## Inline styles

Text can be **bold**, *italic*, ***both***, ~~struck through~~, or
\`inline code\`. Links stay clickable on every line fragment they wrap onto —
try [this one](https://github.com/alaypanov/pdf-kalem).

## Lists

1. Ordered lists number themselves
2. Nested lists indent under their parent
   - bullets at the first level
   - and another
3. Task lists track state
   - [x] pagination
   - [x] rich runs
   - [ ] your feature here

## Code

Fenced blocks render in the mono family on a soft background:

\`\`\`ts
const doc = await markdownToPdf(md, { fonts, theme });
await doc.save();
\`\`\`

## Quotes and rules

> Blockquotes get a left rule and italic text — good for asides and
> callouts that span more than one line.

---

## Tables

| Feature    | Status  | Notes                                    |
|:-----------|:-------:|-----------------------------------------:|
| Pagination | shipped | text splits by line, headers repeat      |
| Rich runs  | shipped | per-fragment links, strike, mono         |
| Markdown   | shipped | this very document                       |

Images work too (\`png\`/\`jpeg\`, format sniffed from the bytes) — this sample
skips them so it renders offline.
`;