/**
 * Image format sniffing from magic bytes. pdf-lib can embed png/jpeg only;
 * other formats are reported as unsupported. The implementation lives in
 * `utils/image-format.ts` (shared with `Image`); this re-export keeps the
 * markdown subpath's surface stable.
 */
export { sniffImageFormat } from '../utils/image-format';
