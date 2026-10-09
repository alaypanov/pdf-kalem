# PDF editing example

Load an existing PDF, overlay widgets on its pages, restructure, save — the
`pdf-kalem/edit` subpath. With no arguments it edits the repo's sample PDF
(`public/pdf-sample.pdf` at the repo root).

```bash
node src/main.ts                            # sample PDF -> edited.pdf + merged.pdf
node src/main.ts path/to/input.pdf          # any PDF -> edited.pdf + merged.pdf
node src/main.ts in.pdf out/edited.pdf      # explicit output path
```

## Structure

```
src/
  main.ts       # load -> overlay -> save; then restructure/merge into merged.pdf
```

## What it demonstrates

- **`loadPdf`** — an existing PDF becomes a `LoadedPdf` whose `pages` are real
  `Page` widgets, sized from the file. Original content (streams, annotations,
  links, form fields) is preserved: pages are adopted into the output document,
  not re-drawn.
- **`page.add([...])`** — overlay widgets on top of the original content.
  Flow placement (the stamp block) and absolute placement (`FixedContainer`
  pinned to the bottom-right corner).
- **Pages as an array** — remove/reorder are native array ops; blank or
  generated pages are `push`ed; merging is composing two `pages` arrays in one
  `PdfDoc`.
- **Two save paths** — `pdf.save()` sugar, and composing loaded pages into a
  plain `PdfDoc` alongside generated ones.

## Copy it

The folder is plain ESM TypeScript — copy it into any project that has
`pdf-kalem` installed and run `node src/main.ts`. It reads the sample from
`public/pdf-sample.pdf` relative to the repo root — take a sample PDF along
(or pass any PDF as the first argument).
