# Form widgets

The `pdf-kalem/forms` subpath adds **real AcroForm fields** to the widget tree — the saved PDF is fillable in any PDF reader. Fields are laid out by the same Yoga layout as every other widget; a field's box is the widget's box:

```ts
import { TextField, CheckBox, Dropdown } from 'pdf-kalem/forms';

Page({
  padding: 48,
  children: [
    TextField('email', { height: 28 }),          // stretches to the content width
    CheckBox('consent', { checked: false }),     // 13×13 square
    Dropdown('country', { options: ['Germany', 'Kazakhstan'] }),
  ],
});
```

Every field takes a unique **`name`** — the AcroForm field name, and (once you use data binding) the key its value is bound by. Keep names simple: AcroForm reads dots as field hierarchy.

## The field set

| Widget | Field | Notes |
|---|---|---|
| `TextField(name, opts)` | text | `value`, `multiline` (default height grows to three lines), `maxLength` |
| `CheckBox(name, opts)` | checkbox | `checked` |
| `Dropdown(name, opts)` | dropdown | `options` (required, non-empty), `value` — must be a declared option |
| `RadioGroup(name, opts)` + `Radio(value)` | radio group | one field spread over the children's boxes |
| `Button(name, opts)` | push button | `label` — **visual only**: pdf-lib has no action API, so it cannot submit/reset |
| `Signature(opts)` | — | a drawn signing line + caption, **not a field** — pdf-lib can read but not create signature fields |

Shared options: `readOnly`, appearance (`fontSize`, `textColor`, `backgroundColor`, `borderColor`, `borderWidth`), and box sizing (`width`/`height`). Text fields, dropdowns, and signature lines default to **filling the available width with a 120pt floor** — inside a shrink-wrapping `Column` (the default alignment) a bare `'100%'` would resolve against the wrapped parent and collapse to an invisible sliver, so the floor keeps the field usable; pass `width` for exact sizing (honored as-is, no floor). To make a field genuinely fill the page, give its label+field wrapper `Column` a `width: '100%'` — `Column`s shrink-wrap their children by default. Unset appearance options fall back to pdf-lib's defaults: black text on white with a black 1pt border — a visible box, which is the right default for a form.

## Labels are composition

The form widgets are primitives, not labeled controls — compose captions with `Text`:

```ts
import { Column, Row, Text } from 'pdf-kalem/widgets';
import { Radio, RadioGroup } from 'pdf-kalem/forms';

Column({
  gap: 4,
  children: [
    Text('PLAN', { size: 9, color: 'muted' }),
    RadioGroup('plan', {
      gap: 8,
      children: [
        Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('basic'), Text('Basic — free')] }),
        Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('pro'), Text('Pro — €120')] }),
      ],
    }),
  ],
});
```

`Radio` finds its group through the parent chain, so options can be nested in Rows (or anything else) — but a `Radio` outside any `RadioGroup` fails honestly at save.

## Data binding: template + data

`formData` on `PdfDoc` applies values to the tree's fields **by field name**, winning over per-widget `value`/`checked` options. The same tree-builder with different `formData` produces filled variants of one template:

```ts
function applicationForm(data: Record<string, string | boolean> = {}) {
  return new PdfDoc({ formData: data, children: [Page({ children: [/* fields */] })] });
}

await applicationForm().writeToFile('form-blank.pdf');
await applicationForm({ 'full-name': 'Ada Lovelace', consent: true, plan: 'pro' })
  .writeToFile('form-filled.pdf');
```

Validation is honest and early: type mismatches throw at construction (text wants a string, checkbox a boolean, dropdown/radio a declared option), keys matching no field warn, and duplicate field names fail at save (pdf-lib refuses them — two fields sharing a name would silently collide).

## Placement and pagination

Fields are placed at their layout box — the PDF coordinate flip is the backend's job, so nothing special is needed. Fields are **atomic**: on overflow they move whole to the next page (a field never splits), and they compose with `FixedContainer` for absolute placement.

::: warning Limitations
- **Field text is Helvetica** in the generated appearance (pdf-lib limitation) — embedded-font faces for field appearances can come later.
- **Buttons carry no actions** — pdf-lib exposes no way to attach submit/reset/JavaScript to a push button.
- **Signature is a placeholder** — it draws the line and caption; it is not an interactive signature field.
- **Flattening** (filled values baked into static content) is not exposed yet — it will be a root property (`flattenForms`) when it lands.
:::

## Try it live

The [forms playground](/playground/forms) re-renders a registration form as you type — download the proof and fill it in a reader. For a starting point you own, copy the [`examples/forms/`](https://github.com/alaypanov/pdf-kalem/tree/main/examples/forms) project (it also demonstrates the template + data pattern).
