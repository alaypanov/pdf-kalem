# Quarterly report example

A multi-page engineering report that exercises the pagination engine end to
end: a cover that fits, a flowing report that does not, and the break rules
that keep the output correct.

```bash
node src/main.ts   # writes report.pdf next to this README
```

## Structure

```
src/
  theme.ts                  # editorial theme on builtin font aliases
  data.ts                   # milestones, incidents, narrative sections
  document.ts               # cover page + flowing report page
  components/
    panel.ts                # the default surface (stat cards, callouts, columns)
    section-heading.ts      # numbered heading, keep-together
    callout.ts              # accent callout, keep-together
    stat-card.ts            # cover stat card
    label-value.ts          # metadata rows
    data-table.ts           # generic column-driven table
  main.ts                   # PdfDoc, metadata, output
```

## What it demonstrates

- **Pagination** — long text sections split by line across output pages.
- **Repeating table headers** — the milestones table spans pages; its header
  row repeats on every continuation page.
- **Keep-together** — `breakable: false` headings and callouts move whole
  instead of straddling a boundary.
- **Per-page furniture** — a bottom-anchored `FixedContainer` footer is
  re-emitted on every output page the report Page produces (and absent from
  the cover — each Page owns its furniture).
- **Builtin font aliases** — the theme maps onto `sans`/`mono`, so the
  example runs with zero font setup (contrast with the invoice example,
  which loads Inter from files).
- **Generic components** — one `dataTable<T>` renders both tables from
  column descriptions.

## Copy it

The folder is plain ESM TypeScript — copy it into any project that has
`pdf-kalem` installed and run `node src/main.ts`.
