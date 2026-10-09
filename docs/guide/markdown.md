# Markdown

The `pdf-kalem/markdown` subpath converts markdown (GFM, powered by [marked](https://github.com/markedjs/marked)) into widgets or a ready-to-save document:

```ts
import { markdownToPdf, markdownToWidgets } from 'pdf-kalem/markdown';

// Sugar: one paginated Page, markdown theme defaults merged under your theme.
const doc = await markdownToPdf('# Report\n\nBody text with **emphasis**.', {
  theme: myTheme,      // optional — user values win over the defaults
  fonts,               // optional FontSet (see Fonts)
  page: { padding: 48 },
});
await doc.save();

// Deep seam: bare blocks you embed in your own Page (wrap in a Column with a
// gap for spacing).
const blocks = await markdownToWidgets(md, { styles: { spacing: 8 } });
```

## Supported

- **Headings** — `h1`..`h6` theme variants, bold.
- **Emphasis** — `**bold**`, `*italic*`, `***both***`, `~~strikethrough~~`, `` `code` `` — rendered as rich runs.
- **Links** — clickable per line fragment, underlined, `link` color token.
- **Lists** — ordered, unordered, nested, and task lists (tasks render as `✓`/`□`).
- **Code blocks** — fenced, monospace, `pre-wrap`, padded background.
- **Blockquotes** — left rule + italic text.
- **Tables** — GFM tables with per-column alignment, padded cells, header row.
- **Horizontal rules** — full-width lines.
- **Images** — png/jpeg; the format is sniffed from the fetched bytes, other formats are skipped with a warning.

## Styling

Styling is theme-driven: headings resolve the `h1`..`h6` text variants, links resolve the `link` color token, and `MarkdownStyles` overrides the rest:

```ts
import { markdownToPdf } from 'pdf-kalem/markdown';

const doc = await markdownToPdf(md, {
  theme,
  fonts,
  styles: {
    code: { font: 'code' },   // font token for code blocks/inline code
    spacing: 10,              // vertical rhythm between blocks
    imageWidth: '80%',        // optional image width
  },
});
```

`markdownThemeDefaults` is exported so custom tooling can merge the same baseline (heading sizes, `link` color, `table.cellPadding`) under a user theme — user values win per key.

::: warning WinAnsi
Task-list markers (`✓`/`□`) need a real font — the builtin aliases throw on them. Load a font family via `files` for documents with task lists (the [markdown example](https://github.com/alaypanov/pdf-kalem/tree/main/examples/markdown) loads Inter from `examples/fonts/`).
:::

## Try it live

The [markdown playground](/playground/markdown) converts as you type. For a starting point you own, copy the [`examples/markdown/`](https://github.com/alaypanov/pdf-kalem/tree/main/examples/markdown) project — a small CLI that converts any markdown file into a paginated PDF.
