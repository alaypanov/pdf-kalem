# Widgets

Everything in a pdf-kalem document is a widget created through a factory function. Widgets depend on a backend-neutral `RenderContext` interface — they deal in layout boxes, not PDF math.

## Layout primitives

- `Page` — the root container. Owns padding, page size, and pagination behavior.
- `Container` — a box that sizes to its content unless given `width`/`height`. Supports `bgColor`, `padding`, and `border`. Accepts `child` (single) or `children`.
- `Row` / `Column` — flex containers with `mainAxisAlignment`, `crossAxisAlignment`, and `gap` (via `style`). Expose Flutter-ish statics: `Row.justifyBetween`, `Row.alignCenter`, `Column.alignEnd`, …
- `FlexContainer` — the general flex box with a full `style` object.
- `FixedContainer` — absolutely positioned against the page box (`top`/`bottom`/`left`/`right`). Used for page furniture like footers.
- `Stack` — overlays its children in the same box, painted in order (first child bottom-most). Non-positioned children align per `alignment` (`'topLeft'` … `'bottomRight'`); a `FixedContainer` child keeps its own insets. Sizes to its largest non-positioned child unless given `width`/`height`. Atomic under pagination — it moves whole to the next page.
- `Spacer` — invisible box that occupies space in flow: `Spacer({ size: 12 })` for a fixed gap, bare `Spacer()` (or `grow: 2`) to absorb free space and push siblings apart.
- `HLine` — a horizontal rule with `color` and `thickness`.
- `VLine` — the vertical sibling: `color`, `thickness`, and `height` (stretches to the row by default).

```ts
import { Page, Column, Row, Container, Stack, FixedContainer, Text, HLine } from 'pdf-kalem/widgets';

Page({
  padding: 36,
  children: [
    Row({
      width: '100%',
      mainAxisAlignment: Row.justifyBetween,
      crossAxisAlignment: Row.alignStart,
      children: [
        Text('Left side', { variant: 'h2' }),
        Text('Right side', { variant: 'caption' }),
      ],
    }),
    HLine({ color: 'line', thickness: 1, width: '100%' }),
    Spacer({ size: 24 }),
    // A photo with a badge overlaid on its top-right corner:
    Stack({
      alignment: 'topLeft',
      children: [
        Image.png('/photo.png'),          // sizes the stack
        FixedContainer({ top: 8, right: 8, width: 48, height: 16, bgColor: 'primary' }),
      ],
    }),
  ],
});
```

::: tip Shrink-wrap
Children of a `Container` shrink-wrap horizontally (`alignItems: 'flex-start'`). Give a `Row` or `Column` `width: '100%'` when you want it to fill the panel or let `justifyBetween` spread its children. Direct children of `Page` stretch by default.
:::

::: warning Stack needs something to size to
A `Stack` whose children are all positioned (`FixedContainer`) has nothing to size itself against — pass explicit `width` and `height`, or include at least one non-positioned child.
:::

## Text and rich runs

`Text` takes a string or an array of styled **runs**. Each run carries its own typography, which layers onto the text's base font (and the block's `fontWeight`/`fontStyle`):

```ts
import { Text, Link } from 'pdf-kalem/widgets';

Text(
  [
    { text: 'Revenue grew ' },
    { text: '12%', fontWeight: 700 },
    { text: ' quarter over quarter' },
    { text: ' (audited)', fontStyle: 'italic', color: '#666666' },
  ],
  { size: 12 },
);

// Runs can carry their own links — each line fragment of the run gets its
// own clickable annotation, so a run that wraps stays clickable everywhere.
Text([{ text: 'Read the ' }, { text: 'full report', href: 'https://example.com' }]);

// `mono` switches the run to the builtin monospace family; `font` overrides
// the family outright (theme token or family name).
Text([{ text: 'const x = 1', mono: true }]);
```

Run fields: `fontWeight`, `fontStyle`, `strike`, `href`, `mono`, `font`, `color`. Weight follows CSS matching — 100–500 renders regular, 600–900 renders bold — and each axis replaces the base style (an explicit `fontWeight: 400` un-bolds a bold base). Faces resolve through the run's family with the usual fallback chain. Words that span run boundaries never break internally; wrapping, `maxLines`, and `ellipsis` all work across runs.

Text options include `variant` (theme text variant), `size`, `color`, `align`, `fontWeight`, `fontStyle`, `lineHeight`, `maxLines`, and `overflow: 'ellipsis'`. Theme text variants accept the same `fontWeight`/`fontStyle`, so a variant can set its weight once: `heading: { fontWeight: 700 }`.

## Tables

For the common case of a table where every cell is plain text, use `Table.fromRows`:

```ts
import { Table } from 'pdf-kalem/widgets';

Table.fromRows(
  [
    ['KPI', 'Value', 'Change'],
    ['Quarterly revenue', '$42k', '+12%'],
    ['Customer retention', '93%', '+4%'],
  ],
  {
    width: '100%',
    columnWeights: [2, 1, 1],
    header: true,
  },
);
```

Cells accept either strings (auto-wrapped in `Text`) or arbitrary widgets for custom content. For full control over headers, cell padding, or mixed cell content, use the explicit constructors:

```ts
Table({
  width: '100%',
  columnWeights: [3.5, 1, 1, 1],
  head: TableHead({
    rows: [
      TableRow({
        children: ['Description', 'Qty', 'Rate', 'Amount'].map((value) =>
          TableCell({ child: Text(value, { variant: 'label', color: 'white' }) }),
        ),
      }),
    ],
  }),
  body: TableBody({
    rows: items.map((item) =>
      TableRow({
        minHeight: 30,
        children: [
          TableCell({ child: Text(item.description, { variant: 'body' }) }),
          TableCell({ child: Text(item.amount, { variant: 'body', align: 'right' }) }),
        ],
      }),
    ),
  }),
});
```

## Media: images, SVG paths, icons

- `Image.png(url)` / `Image.jpeg(url)` / `Image.fromBytes(bytes, format)` — embed raster images with `sizing: ImageSizing.Fit | Cover | None`. The drawn area is centered in the layout box.
- `SVGPath(d, { viewBoxWidth, viewBoxHeight, fill, stroke, strokeWidth })` — draw vector paths.
- `Icon({ path, size, color })` — Material-style icons from SVG path data, with a small built-in registry (`Icon.register`). Colors resolve theme tokens.

```ts
import { Image, ImageSizing, SVGPath, Icon } from 'pdf-kalem/widgets';

Image.png('/logo.png', { sizing: ImageSizing.Fit });

SVGPath('M 10 30 C 10 10 40 10 40 30 …', {
  viewBoxWidth: 64,
  viewBoxHeight: 64,
  fill: '#E11D48',
});

Icon({ path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', size: 24, color: 'primary' });
```

## Links

`Link(text, { href })` renders clickable text with a link annotation. With run arrays, each line fragment of a wrapping run gets its own annotation.

## Try it live

The [widget playground](/playground/widgets) has this whole guide editable — every snippet works there.
