import type { Widget } from '../Widget';
import { FormWidget } from './FormWidget';

/**
 * Applies `formData` to the tree's form widgets, by AcroForm field name —
 * the data-binding walk (PLAN.md, form widgets increment 3).
 *
 * Called once from the PdfDoc constructor: the widget tree is the state, so
 * binding mutates the widgets' values exactly as if the caller had passed
 * them in the widget options — `formData` just wins (it is the doc-level
 * data). Fields whose name is absent from `formData` keep their own value;
 * keys matching no field warn (stale/typoed data should be visible, not
 * silently dropped). Duplicate field names are pdf-lib's to catch at save
 * (FieldAlreadyExistsError) — the walk does not re-detect them.
 *
 * Package-internal: PdfDoc calls this; not part of the public surface.
 */
export function bindFormData(roots: Widget[], formData: Record<string, string | boolean>): void {
  const bound = new Set<string>();
  const visit = (widget: Widget): void => {
    for (const child of widget.getChildWidgets()) {
      visit(child);
    }
    if (widget instanceof FormWidget) {
      // Object.hasOwn, not property access — 'constructor' or 'toString'
      // must not read Object.prototype.
      if (Object.hasOwn(formData, widget.name)) {
        const value = formData[widget.name];
        if (value !== undefined) {
          widget.bindValue(value);
          bound.add(widget.name);
        }
      }
    }
  };
  for (const root of roots) visit(root);

  const unknown = Object.keys(formData).filter(
    (name) => formData[name] !== undefined && !bound.has(name),
  );
  if (unknown.length > 0) {
    console.warn(
      `PdfDoc formData: no form field matches ${unknown.map((name) => `"${name}"`).join(', ')} ` +
      '— check the field names (binding keys are AcroForm field names).',
    );
  }
}
