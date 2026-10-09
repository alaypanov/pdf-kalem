# Examples

Plain pdf-kalem codebases — no build step, no per-example npm setup. Each one
is a small, well-structured document codebase (theme tokens, reusable
components, data separated from layout) meant to be **copied and adapted**,
not browsed as a demo.

| Folder | Demonstrates |
|---|---|
| [`basic/`](./basic/) | One file, no setup: widgets in, PDF out — the starting point |
| [`invoice/`](./invoice/) | Single-page business document: theme tokens, component composition, data/layout separation, custom fonts via `files` |
| [`report/`](./report/) | Multi-page pagination: flowing text, repeating table headers, keep-together panels, per-page furniture, builtin font aliases |
| [`markdown/`](./markdown/) | Markdown → PDF converter with a small CLI |
| [`edit/`](./edit/) | Editing an existing PDF: load, overlay widgets, restructure/merge pages |

## Run (inside this repo)

Examples import the library by its package name; inside this repo that
resolves to the local build (Node package self-reference), so build first:

```bash
pnpm build      # examples import dist/
pnpm examples   # run every example; each writes its PDF next to its code
```

Or one at a time, from the example's folder:

```bash
cd examples/invoice
node src/main.ts
```

Running the TypeScript entry files directly needs Node ≥ 23.6 (native type
stripping). On older Node, run them with `tsx` (`npx tsx src/main.ts`) or
compile first.

## Copy an example out

The folders are plain ESM TypeScript — no package.json, no lockfile. Copy an
example into any project that has `pdf-kalem` installed (imports like
`import { PdfDoc } from 'pdf-kalem'` keep working as-is), or drop the folder
standalone and run `npm install pdf-kalem` next to it.

Each example folder carries its own `README.md` with a structure map and
pointers on what to modify first.
