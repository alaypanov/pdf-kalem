/**
 * Package-internal test surface. Shipped in dist/ but deliberately NOT
 * exported from package.json `exports` — consumers cannot import it via the
 * package name. In-repo tests use it to assert pagination plans without
 * pdf-lib (see tests/pagination.test.mjs) and the shared aspect-fit math
 * (see tests/aspect-fit.test.mjs).
 */
export { Paginator, type BreakRules } from './lib/pagination/Paginator';
export { PageScope } from './lib/pagination/PageScope';
export type {
  BreakUnit,
  Fragment,
  LayoutBox,
  PagePlan,
  Pagination,
} from './lib/pagination/types';
export {
  ImageSizing,
  aspectFitMeasure,
  aspectFitPlacement,
  type FitSpec,
  type FitBox,
  type FitPlacement,
} from './lib/aspect-fit';