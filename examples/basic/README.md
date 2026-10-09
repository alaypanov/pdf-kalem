# Basic example

The smallest useful pdf-kalem document — one file, no theme, no components.
Widgets in, PDF out.

```bash
node main.ts   # writes basic.pdf next to this README
```

## What it demonstrates

- **`PdfDoc` + `Page`** — the document shell and its single page.
- **Direct styling** — `size`/`color` straight on `Text`, hex colors via
  `fromHex`; no theme needed for a small document.
- **Flexbox layout** — a `Column` with `gap`, a `Row` of colored
  `Container`s.

When the document grows, reach for the patterns in the other examples:
theme tokens (`invoice/`), reusable components (`invoice/`, `report/`),
data separated from layout (`invoice/`, `report/`), and pagination
(`report/`).
