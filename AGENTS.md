# TODO Tasks

- Fix build and typing baseline.
- Implement pagination and overflow rules.
- Harden text measurement and fonts.
- Upgrade tables.
- Build online design editor.
- Add reusable document helpers.
- Add tests and richer examples.
- Documentation
- Design Theme system
- Export MD and HTML
- Package into npm module

## Priority 1

Pagination and page-breaking. This is the biggest viability feature. You need predictable overflow handling, explicit page breaks, keep-together behavior, repeated headers/footers, and rules for splitting text, tables, and containers across pages.
Text engine quality. Fonts, measurement accuracy, line wrapping, alignment, line height, truncation, and inline emphasis need to become reliable. If text is unstable, the whole layout system feels untrustworthy.
Stable table/layout primitives. Tables are a core document feature. Add column sizing rules, row splitting, repeating table headers, borders/backgrounds, and cell padding/alignment.
Build correctness. Fix the current TypeScript blockers in Column.ts:27, Row.ts:44, and padding.ts:2. A library is not viable if the baseline build is broken.

## Priority 2

Template helpers and document DSL. This is where you can differentiate. Add higher-level helpers like Section, Header, Footer, Divider, KeyValue, Card, Stack, and invoice/report primitives.
Reusable styling system. Add a coherent styling layer instead of ad hoc widget options everywhere. You want shared spacing, font presets, colors, borders, and typography tokens.
Asset and font loading model. Make font and image loading explicit and predictable. Browser-only fetch is not enough long term; define a clean loader story.
Debugging and inspection tools. Keep the existing debug direction and expand it with layout boxes, overflow warnings, page-break traces, and maybe a layout tree dump.

## Priority 3

Schema and serialization. If you still want long-term live builder potential, define a serializable document schema now, even if authoring stays code-first for the moment.
Template data binding. Let users pass data into templates cleanly so this becomes useful for invoices, statements, reports, and letters.
Test coverage for rendering behavior. Add snapshot-style PDF assertions where practical and focused layout tests for text wrapping, page breaks, and table splitting.
Documentation and examples. Add 3 to 5 serious examples: invoice, report, letterhead, certificate, and multi-page table.