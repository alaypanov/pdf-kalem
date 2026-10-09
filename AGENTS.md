# AGENTS.md

Guidance for AI coding agents working in this repo. Humans: start at [README.md](./README.md).

## What this is

pdf-kalem — a PDF-focused widget-tree UI library for document generation. TypeScript, ESM, built with tsup on top of pdf-lib + yoga-layout; examples are copyable plain-ESM folders under `examples/` (run with `node`, no per-example npm setup).

## Commands

- `pnpm typecheck` — `tsc --noEmit`; run after every change
- `pnpm build` — tsup build to `dist/`
- `pnpm test` — build + run `tests/pagination.test.mjs` + `tests/fonts.test.mjs` + `tests/layout.test.mjs` + `tests/runs.test.mjs` + `tests/markdown.test.mjs` + `tests/aspect-fit.test.mjs` (golden plan tests, e2e page-count invariant, custom-font embedding, container-containment invariants, rich-run wrapping/painting, markdown conversion, shared aspect-fit measure/placement math)
- `pnpm examples` — build + run every example (each writes its PDF next to its code)
- `pnpm docs:dev` — VitePress docs site (`docs/`; playground pages are open-layout placeholders for now)
- `pnpm docs:build` — build the docs site into `docs/.vitepress/dist`

## Doc map

- [CONTEXT.md](./CONTEXT.md) — domain glossary; read before touching source
- [ARCHITECTURE.md](./ARCHITECTURE.md) — module seams and deepening opportunities; defines vocabulary (module, seam, adapter, depth)
- [IDEAS.md](./IDEAS.md) — known bugs + ideas
- [PLAN.md](./PLAN.md) — roadmap

## Conventions

- Public API surface is what `package.json` `exports` declares — don't widen it without intent.
- `sideEffects: false` — keep tree-shaking safe; no top-level side effects in `src/`.
- Use the vocabulary from ARCHITECTURE.md when writing or reviewing design changes.
