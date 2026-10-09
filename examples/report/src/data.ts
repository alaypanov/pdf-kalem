/**
 * The report's content as plain data. The narrative sections are strings;
 * the tables are typed rows consumed by the generic data-table component.
 */

export interface Milestone {
  milestone: string;
  owner: string;
  status: string;
  target: string;
}

export interface Incident {
  id: string;
  severity: string;
  duration: string;
  summary: string;
}

export const milestones: Milestone[] = [
  { milestone: 'Design tokens extracted into the shared theme package', owner: 'Platform', status: 'Shipped', target: 'Jan 17' },
  { milestone: 'Render pipeline moved behind the backend-neutral context', owner: 'Platform', status: 'Shipped', target: 'Jan 24' },
  { milestone: 'Invoice template migrated to the widget DSL', owner: 'Apps', status: 'Shipped', target: 'Jan 31' },
  { milestone: 'Font registry consolidated behind a single loader', owner: 'Platform', status: 'Shipped', target: 'Feb 07' },
  { milestone: 'Table primitives: column weights and row minimums', owner: 'Apps', status: 'Shipped', target: 'Feb 14' },
  { milestone: 'Text engine grapheme-aware wrapping enabled by default', owner: 'Platform', status: 'Shipped', target: 'Feb 21' },
  { milestone: 'Pagination engine: flow tree to page-plan transformation', owner: 'Platform', status: 'Shipped', target: 'Feb 28' },
  { milestone: 'Statement batch export (nightly, 12k documents)', owner: 'Apps', status: 'In review', target: 'Mar 13' },
  { milestone: 'Layout debugging overlay: overflow and break traces', owner: 'Tooling', status: 'In review', target: 'Mar 20' },
  { milestone: 'Table header repetition across page breaks', owner: 'Platform', status: 'Shipped', target: 'Mar 21' },
  { milestone: 'Keep-together semantics for callouts and panels', owner: 'Platform', status: 'Shipped', target: 'Mar 27' },
  { milestone: 'Email rendering backend spike', owner: 'Platform', status: 'Planned', target: 'Apr 10' },
  { milestone: 'Template data binding RFC', owner: 'Apps', status: 'Planned', target: 'Apr 17' },
  { milestone: 'Golden-plan test harness for layout regressions', owner: 'Tooling', status: 'Planned', target: 'Apr 24' },
];

export const incidents: Incident[] = [
  { id: 'INC-1038', severity: 'SEV-2', duration: '42 min', summary: 'Font fallback loop on documents mixing custom and standard fonts.' },
  { id: 'INC-1041', severity: 'SEV-3', duration: '18 min', summary: 'Statement batch stalled behind a slow image fetch; retries exhausted.' },
  { id: 'INC-1044', severity: 'SEV-3', duration: '25 min', summary: 'Rounding drift in table column weights produced 1pt overflow on A4.' },
  { id: 'INC-1049', severity: 'SEV-2', duration: '61 min', summary: 'Memory growth in the measure cache during very long text runs.' },
  { id: 'INC-1052', severity: 'SEV-4', duration: '9 min', summary: 'Preview service returned stale bundles after a dependency bump.' },
];

export const executiveSummary: string[] = [
  'The first quarter closed with the rendering platform in its strongest shape to date. The widget DSL that started the year as an invoice-only experiment now drives every document surface we operate, and the layout engine underneath it graduated from a single-page renderer into a true pagination system: content flows across output pages with predictable break rules, repeating table headers, and keep-together semantics that respect the intent of the composition.',
  'Delivery velocity held at eighteen percent above the trailing two quarters while the incident budget stayed flat. The reliability work detailed in section four is the main reason: the measure cache rewrite removed the last known unbounded growth path, and the fallback loop that plagued mixed-font documents was fixed at the registry level rather than patched per surface.',
  'The quarter also produced the first version of the page-plan architecture. Layout now runs once against an unbounded flow canvas, a pure transformation windows that flow into output pages, and rendering walks the resulting plans through the same widget render path as before. That separation is what makes the behaviors in this report — repeating headers, keep-together callouts, page-level furniture — composable instead of special-cased.',
];

export const platformNarrative: string[] = [
  'The platform investment this quarter concentrated on making the document model honest. The render context seam landed in January, which means widgets no longer know they are drawing onto a PDF; the same tree renders through the PDF backend today and is one adapter away from image and email output. The font registry followed: one loader, one cache, one set of fallback rules shared by every surface.',
  'The pagination engine is the second half of the story. It treats a Page as a unit of flow rather than a visual rectangle, computes what fits at render time, and spawns continuation pages with the size and furniture of the Page that owns them. Break decisions live in one reviewable module, and the plan it produces is plain data — which is why the test suite can assert page counts and break positions without rendering a single pixel.',
];

export const reliabilityNarrative =
  'Five incidents were opened in Q1, two of them customer-visible. Both SEV-2 incidents trace to growth paths that existed before the platform consolidation; both are covered by regressions in the new golden-plan suite. The median time to restore fell from 51 minutes in Q4 to 31 minutes this quarter, and no incident required a manual data repair.';

export const nextQuarter: string[] = [
  'Ship the email rendering backend on the shared widget tree, with the image backend behind it.',
  'Turn on template data binding for the statement surface and retire the last string-templated documents.',
  'Extend the golden-plan suite to cover table row splitting and multi-column flows.',
  'Publish the page-plan architecture notes as the reference for backend authors.',
];