# ADR 0001 — PDF-only focus

Date: 2026-10-09 · Status: accepted

## Context

pdf-kalem's architecture kept a backend-neutral `RenderContext` interface between the widget
tree and the PDF backend, justified by a planned v2 of image (`ImageDoc`) and HTML/email
(`EmailDoc`) backends sharing the widget tree, theme, and `FontRegistry`. No second backend has
shipped. Every feature since the seam landed has been PDF-specific: pagination (an output page
*is* a PDF page), font embedding/subsetting, markdown → PDF, and editing (`adoptPage`,
`copyPages`, rotation, encryption).

The neutrality tax is visible in the code: `RenderImage` is pdf-lib-typed (acknowledged debt),
PDF-only seams get smoothed through `unknown`-typed interface methods and immediately re-cast,
and the interface grows with each PDF feature. A backend-neutral interface with one backend is
a hypothetical seam by this repo's own vocabulary.

## Decision

PDF is the only output format, deliberately.

- No image/HTML backends will be built; the v2 `ImageDoc`/`EmailDoc` plan is dropped.
- The `RenderContext` seam is **retained** — not as a backend hook, but because it is
  load-bearing: pagination's per-page `PageScope` is a second implementation that composes
  through it, and the PDF Y-flip lives in one place (`mapContentBox`).
- PDF-specific features get PDF-typed modules and escape hatches — the `pdf-kalem/edit`
  pattern: real `PDFDocument` types, a `PDFDocument` getter, no pretense of neutrality —
  never interface widening.
- Format-neutral modules that cost nothing extra (widget tree, pagination, theme, markdown,
  `TextLayoutEngine`) stay as they are.

## Alternatives considered

- **Active de-generalization** — collapse `RenderContext` into `PdfRenderContext` and let
  widgets use pdf-lib types directly. Rejected: a large rewrite with no user value that
  destabilizes pagination, the library's most valuable machinery. Complexity would be
  relocated, not removed.
- **Keep the multi-backend posture** — continue generalizing per feature. Rejected:
  speculative generality with a real, growing tax; no user has asked for a second backend.

## Consequences

- README, CONTEXT.md, and ARCHITECTURE.md no longer promise future backends.
- PDF-native features (form filling, annotations, outlines, text extraction, compression) are
  first-class roadmap candidates (PLAN.md) rather than things to apologize for.
- If a second backend is ever genuinely needed, expect a refactor then — the seam makes it
  possible, not free.
