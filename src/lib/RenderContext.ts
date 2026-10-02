// Shared render-context types (args, options, color/image aliases).
export * from './RenderContextTypes';

// Backend-neutral interface that widgets depend on.
export type { RenderContext } from './RenderContextInterface';

// PDF backend implementation.
export * from './PdfRenderContext';
