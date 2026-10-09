# Fonts

Built-in aliases work without any font files: `sans`, `sans-bold`, `sans-italic`, `sans-bold-italic`, `serif` (+ variants), `mono` (+ variants). These are pdf-lib's standard fonts — WinAnsi-encoded, so they cannot draw characters outside that range (e.g. `✓`, `→`, emoji). For real typography, load a font family.

## Loading a font family

`useFonts` maps your document's **font tokens** to families: the keys (`body`, `code`, `heading`, …) are the same tokens text variants reference. Doc-level font tokens win over `theme.fonts`. No `registerFontkit` call is needed — fontkit loads lazily on the first custom-font embed.

A family entry is either a single source (its regular face) or an object of per-face sources. A string is fetched (browser/http URL); pass bytes for Node filesystem loading:

```ts
import { PdfDoc, useFonts } from 'pdf-kalem';

// Browser: fetch the TTFs; Node: read them with fs.
const face = (name: string) => fetch(`/fonts/${name}`).then((r) => r.arrayBuffer());

const fonts = await useFonts(
  { body: 'inter', heading: 'inter', mono: 'inter' },
  {
    files: {
      inter: {
        regular: await face('Inter-Regular.ttf'),
        bold: await face('Inter-Bold.ttf'),
        italic: await face('Inter-Italic.ttf'),
        boldItalic: await face('Inter-BoldItalic.ttf'),
      },
    },
  },
);

const doc = new PdfDoc({ fonts, children: [/* ... */] });
```

The repo's examples load Inter exactly this way — the OFL-licensed TTFs live in [`examples/fonts/`](https://github.com/alaypanov/pdf-kalem/tree/main/examples/fonts).

## Faces and fallback

A family carries faces: `regular` plus optional `bold`, `italic`, and `boldItalic`. A face is referenced by suffixing the family name — `inter-bold`, `inter-italic`, `inter-bold-italic` — the same convention the builtin aliases use.

Missing faces fall back at embed time (bold-italic → bold → italic → regular) with a console warning, so a family can ship incrementally.

## Legacy global registration

`PdfDoc.registerFont` / `registerFonts` / `registerFontFromUrl` still work as a process-wide fallback; doc-scoped `FontSet`s always resolve first.

::: warning WinAnsi limitation
Task-list markers (`✓`/`□`), arrows, and emoji throw with the builtin aliases — including code blocks set in `mono` (Courier). Load your own mono family via `files` for symbol-heavy or non-Latin code.
:::
