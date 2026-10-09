# Invoice example

A single-page business invoice, structured the way a real document codebase
grows: theme tokens for the visual identity, small components for repeated
pieces, data separated from layout, and one entry point that writes the PDF.

```bash
node src/main.ts   # writes invoice.pdf next to this README
```

## Structure

```
src/
  theme.ts                  # color tokens, text variants, table defaults
  data.ts                   # the invoice as plain data (swap this, keep the layout)
  document.ts               # assembles the Page from components
  components/
    label-value.ts          # the most-used primitive
    summary-card.ts         # "Invoice summary" card
    party-panel.ts          # From / Bill to panels
    line-items-table.ts     # line items table
    notes-panel.ts          # notes panel
    totals-panel.ts         # totals panel
  main.ts                   # fonts, PdfDoc, metadata, output
```

## What it demonstrates

- **Theme tokens** — widgets reference `'brand'`, `'panel'`, `'label'`… so
  re-skinning never touches layout code (`src/theme.ts`).
- **Component composition** — repeated pieces (label/value, panels, tables)
  are functions returning widgets, composed in `document.ts`.
- **Data/layout separation** — content lives in `src/data.ts`; the same
  codebase renders any invoice.
- **Custom fonts** — Inter loads from the repo's shared `examples/fonts/`
  folder through `useFonts(…, { files })` (Node `fs` bytes); the library
  itself bundles no font files.

## Copy it

The folder is plain ESM TypeScript — copy it into any project that has
`pdf-kalem` installed and run `node src/main.ts`. It reads the Inter TTFs
from `examples/fonts/` — take that folder along (or swap in any TTFs you
like and point the `files` entries at them).
