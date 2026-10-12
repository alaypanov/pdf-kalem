# Forms example

A registration form whose fields are **real AcroForm fields** — the saved PDF
is fillable in any PDF reader.

```bash
node src/main.ts   # writes form-blank.pdf + form-filled.pdf next to this README
```

## What it demonstrates

- **`pdf-kalem/forms`** — `TextField`, `CheckBox`, `Dropdown`, `RadioGroup` +
  `Radio`, `Button`, and the visual-only `Signature` line, laid out by the
  same widget tree as everything else.
- **Labels** — plain `Text` widgets composed above or beside the fields; the
  form widgets are primitives, not labeled controls.
- **Template + data** — `applicationForm(data)` builds the tree and passes
  `formData` to `PdfDoc`: values land on the widgets by field name and win
  over per-widget options. The same builder writes the blank template and a
  filled variant.

Run `pnpm example forms` from the repo root (or this folder's command above).
