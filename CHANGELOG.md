# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — while in `0.x`, breaking changes bump the minor version.

## [0.3.0] — 2026-10-11

### Added

- `Stack` — overlay composition: children painted in order in one box, non-positioned children aligned per `alignment`, `FixedContainer` children keeping their own insets. Sizes to its largest non-positioned child unless `width`/`height` are given; atomic under pagination.
- `Spacer` — invisible flow space: `size` for a fixed gap, `grow` (default 1) to absorb free main-axis space.
- `VLine` — vertical rule, the sibling of `HLine` (`color`, `thickness`, `height`; stretches to the row by default).

### Changed

- **Breaking:** removed the process-global `PdfDoc.beforeCreate`/`afterSave`/`clearHooks` statics — two documents in one process shared hook state, and the constructor's `beforeCreate`/`afterSave` options are the supported channel. No in-repo callers; the statics were undocumented.
- Runtime output mechanics (blob/download/print/buffer/file) moved from `PdfDoc` to `src/lib/doc-output.ts`; the `PdfDoc` methods remain as delegates — the public interface is otherwise unchanged.
- I14 resolved: `PageBreak` rejected by design (pagination stays automatic and opaque); `SizedBox` rejected as sugar for `Container({ height })`.
- Playground sandboxes expose the new widgets.

## [0.2.0] — 2026-10-10

### Changed

- **Breaking:** `Run.bold` and `Run.italic` are replaced by CSS-like `Run.fontWeight` (100–900, `'normal'`, `'bold'`) and `Run.fontStyle` (`'normal'`, `'italic'`). Weights snap to the family's two-face model (100–500 → regular, 600–900 → bold); an explicit value replaces its axis on the base style, so `fontWeight: 400` un-bolds a bold base. `TextOptions` and `ThemeTextStyle` gain matching block-level `fontWeight`/`fontStyle`, and `font`/`mono` run overrides now inherit the block's typography instead of resetting to regular. See `src/lib/Text.ts` and `src/lib/fonts/face.ts`.

### Fixed

- Homepage links under the GitHub Pages subpath (docs-site infra).

## [0.1.1] — 2026-10-09

Maintenance release; no user-facing package changes recorded.

## [0.1.0] — 2026-10-09

Initial public release: widget-tree PDF generation on pdf-lib + yoga-layout, text layout and pagination, custom font embedding, markdown subpath, `PdfDoc.print()`, and the `pdf-kalem/edit` subpath for loading existing PDFs as widget trees.
