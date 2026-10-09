# Pagination

When a page's content is taller than the page, pdf-kalem splits it across additional pages. It does this with a three-pass approach (layout → paginate → render), similar to react-pdf:

1. **Layout** — the whole page tree is laid out once on a single tall canvas.
2. **Paginate** — the laid-out tree is walked and split into per-page *fragment* trees. Each fragment is a lightweight view onto a widget for one output page (it reuses the same Yoga node, so there's no re-layout).
3. **Render** — each output page adds a PDF page and renders its fragments, shifting coordinates by `-pageIndex × pageHeight` so each slice lands correctly.

## Splitting rules by widget

- **Text** splits line-by-line (`breakable: true` by default). Use `{ breakable: false }` to keep a block together.
- **Table rows** stay whole (never split mid-row), and the **header repeats** on each page that shows body rows.
- **Containers/columns** pass the boundary to their children.
- **Unbreakable blocks** (`breakable: false`) move whole to the next page; a block taller than a full page is clipped.
- **Fixed widgets** (`FixedContainer` anchored to the page box) are re-emitted on every output page the `Page` produces — each `Page` owns its furniture.

```ts
Page({
  padding: 24,
  children: [
    Text(longReport, { variant: 'body' }),   // flows across pages by line
    Table.fromRows(rows, { header: true }),  // rows stay whole, header repeats
    FixedContainer({                          // footer on every output page
      bottom: 0, left: 0, right: 0, height: 30,
      bgColor: 'brand',
      children: [/* ... */],
    }),
  ],
});
```

## Keep-together

Two tools keep related content together:

- `breakable: false` on any widget — the block moves whole instead of straddling a boundary.
- The table head is marked `keepWithNext` internally — a header is never orphaned at a page bottom; it moves to the next page with the first row.

## Opting out

To disable pagination for a page (legacy single-page behavior; overflow is clipped by the viewer):

```ts
Page({ overflow: false, children: [...] });
```

## Page count

`doc.getPageCount()` returns the number of output pages (Σ per-Page plan pages, memoized) — the number the paginator will actually produce, not the number of `Page` widgets you declared.

## See it live

The copyable [`examples/report/`](https://github.com/alaypanov/pdf-kalem/tree/main/examples/report) project exercises the whole engine: splitting text, repeating table headers, keep-together panels, and per-page furniture. Run it with `pnpm examples` in the repo, or copy the folder and `node src/main.ts`.
