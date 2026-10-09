# Markdown → PDF example

A small CLI converter built on the `pdf-kalem/markdown` subpath. With no
arguments it converts an embedded sample; pass a file to convert any
markdown document.

```bash
node src/main.ts                          # embedded sample -> markdown.pdf
node src/main.ts path/to/README.md        # any markdown file -> markdown.pdf
node src/main.ts notes.md out/report.pdf  # explicit output path
```

## Structure

```
src/
  theme.ts      # document theme (merged over the converter's defaults)
  styles.ts     # MarkdownStyles overrides (code font, spacing, …)
  sample.ts     # embedded sample document
  main.ts       # CLI: read markdown, convert, write the PDF
```

## What it demonstrates

- **`markdownToPdf`** — one call from markdown to a paginated, ready-to-save
  document.
- **Theme merging** — your theme's tokens win per key over the converter's
  markdown defaults; unset tokens keep the baseline.
- **`MarkdownStyles`** — converter-level overrides the theme's text variants
  don't cover (code font, blockquote rule, list indent, spacing).
- **Shipped fonts** — `useFonts({ body: 'inter' })`; code falls back to the
  builtin mono alias (Courier).

## Copy it

The folder is plain ESM TypeScript — copy it into any project that has
`pdf-kalem` installed and run `node src/main.ts`.
