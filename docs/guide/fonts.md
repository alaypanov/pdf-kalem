# Fonts

Built-in aliases work without registration: `sans`, `sans-bold`, `sans-italic`, `sans-bold-italic`, `serif` (+ variants), `mono` (+ variants). These are pdf-lib's standard fonts — WinAnsi-encoded, so they cannot draw characters outside that range (e.g. `✓`, `→`, emoji). For real typography, load a font set.

## Shipped families

One family ships with the package — `inter` (regular, bold, italic, bold-italic) — so common documents need no font files at all. The builtin `mono` alias (Courier) covers code out of the box:

```ts
import { PdfDoc, useFonts } from 'pdf-kalem';

const fonts = await useFonts({
  body: 'inter',
});

const doc = new PdfDoc({ fonts, children: [/* ... */] });
```

`useFonts` maps your document's **font tokens** to families: the keys (`body`, `code`, `heading`, …) are the same tokens text variants reference. Doc-level font tokens win over `theme.fonts`. No `registerFontkit` call is needed — fontkit loads lazily on the first custom-font embed.

## Faces and fallback

A family carries faces: `regular` plus optional `bold`, `italic`, and `boldItalic`. A face is referenced by suffixing the family name — `inter-bold`, `inter-italic`, `inter-bold-italic` — the same convention the builtin aliases use.

Missing faces fall back at embed time (bold-italic → bold → italic → regular) with a console warning, so a family can ship incrementally.

## Bring your own fonts

Per-face entries merge over the shipped faces of the same family:

```ts
const fonts = await useFonts(
  { body: 'inter' },
  {
    files: {
      inter: { bold: '/fonts/MyInter-Bold.ttf' }, // override one face
      'my-serif': {
        regular: '/fonts/MySerif.ttf',
        italic: '/fonts/MySerif-Italic.ttf',
      },
    },
  },
);
```

Legacy global registration (`PdfDoc.registerFont` / `registerFonts` / `registerFontFromUrl`) still works as a process-wide fallback; doc-scoped `FontSet`s always resolve first.

::: warning WinAnsi limitation
Task-list markers (`✓`/`□`), arrows, and emoji throw with the builtin aliases — including code blocks set in `mono` (Courier). Load your own mono family via `files` for symbol-heavy or non-Latin code.
:::
