import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';
import { PlacedFormWidget, type FormFieldOptions } from './FormWidget';

export interface CheckBoxOptions extends FormFieldOptions {
  /** Initial state (data binding sets the same state by field name). */
  checked?: boolean;
}

export class CheckBoxWidget extends PlacedFormWidget {
  private checked: boolean;

  constructor(name: string, options: CheckBoxOptions = {}) {
    super(name, options);
    this.checked = options.checked ?? false;

    this.setYogaStyle({
      width: options.width ?? 13,
      height: options.height ?? 13,
    });
  }

  protected get kind(): string {
    return 'CheckBox';
  }

  /** @internal — PdfDoc's formData walk applies values here. */
  bindValue(value: string | boolean): void {
    if (typeof value !== 'boolean') {
      throw new Error(`CheckBox "${this.name}" expects a boolean formData value, got ${typeof value}.`);
    }
    this.checked = value;
  }

  protected placeField(
    form: PDFForm,
    page: PDFPage,
    box: { x: number; y: number; width: number; height: number },
    context: RenderContext,
  ): void {
    const field = form.createCheckBox(this.name);
    if (this.checked) field.check();
    if (this.readOnly) field.enableReadOnly();
    field.addToPage(page, { ...box, ...this.appearanceArgs(context) });
  }
}

export function CheckBox(name: string, options: CheckBoxOptions = {}): CheckBoxWidget {
  return new CheckBoxWidget(name, options);
}
