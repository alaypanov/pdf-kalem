# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — while in `0.x`, breaking changes bump the minor version.

## [0.2.0] — 2026-10-10

### Changed

- **Breaking:** `Run.bold` and `Run.italic` are replaced by CSS-like `Run.fontWeight` (100–900, `'normal'`, `'bold'`) and `Run.fontStyle` (`'normal'`, `'italic'`). Weights snap to the family's two-face model (100–500 → regular, 600–900 → bold); an explicit value replaces its axis on the base style, so `fontWeight: 400` un-bolds a bold base. `TextOptions` and `ThemeTextStyle` gain matching block-level `fontWeight`/`fontStyle`, and `font`/`mono` run overrides now inherit the block's typography instead of resetting to regular. See `src/lib/Text.ts` and `src/lib/fonts/face.ts`.

### Fixed

- Homepage links under the GitHub Pages subpath (docs-site infra).

## [0.1.1] — 2026-10-09

Maintenance release; no user-facing package changes recorded.

## [0.1.0] — 2026-10-09

Initial public release: widget-tree PDF generation on pdf-lib + yoga-layout, text layout and pagination, custom font embedding, markdown subpath, `PdfDoc.print()`, and the `pdf-kalem/edit` subpath for loading existing PDFs as widget trees.
