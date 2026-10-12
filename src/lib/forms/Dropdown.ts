import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';
import { PlacedFormWidget, type FormFieldOptions } from './FormWidget';

export interface DropdownOptions extends FormFieldOptions {
  /** Choices the reader offers. Must be a non-empty array of strings. */
  options: string[];
  /** Initially selected value — must be one of `options` (pdf-lib enforces). */
  value?: string;
}

export class DropdownWidget extends PlacedFormWidget {
  private readonly options: string[];
  private value?: string;

  constructor(name: string, options: DropdownOptions) {
    super(name, options);
    if (
      !Array.isArray(options.options) ||
      options.options.length === 0 ||
      !options.options.every((option) => typeof option === 'string')
    ) {
      throw new Error(`Dropdown "${name}" requires a non-empty \`options\` array of strings.`);
    }
    this.options = options.options;
    this.value = options.value;
    // pdf-lib's select() silently turns a dropdown into an editable combo
    // box for unknown values — validate instead (honest failures).
    if (this.value !== undefined && !this.options.includes(this.value)) {
      throw new Error(
        `Dropdown "${name}": value "${this.value}" is not one of the declared options (${this.options.join(', ')}).`,
      );
    }

    this.setYogaStyle({
      // Same floor as TextField: '100%' collapses to zero inside a
      // shrink-wrapping Column; explicit `width` is honored exactly.
      width: options.width ?? '100%',
      minWidth: options.width === undefined ? 120 : undefined,
      height: options.height ?? 24,
    });
  }

  protected get kind(): string {
    return 'Dropdown';
  }

  /** @internal — PdfDoc's formData walk applies values here. */
  bindValue(value: string | boolean): void {
    if (typeof value !== 'string') {
      throw new Error(`Dropdown "${this.name}" expects a string formData value, got ${typeof value}.`);
    }
    if (!this.options.includes(value)) {
      throw new Error(
        `Dropdown "${this.name}": formData value "${value}" is not one of the declared options (${this.options.join(', ')}).`,
      );
    }
    this.value = value;
  }

  protected placeField(
    form: PDFForm,
    page: PDFPage,
    box: { x: number; y: number; width: number; height: number },
    context: RenderContext,
  ): void {
    const field = form.createDropdown(this.name);
    field.addOptions(this.options);
    if (this.value !== undefined) field.select(this.value);
    if (this.readOnly) field.enableReadOnly();
    field.addToPage(page, { ...box, ...this.appearanceArgs(context) });
  }
}

export function Dropdown(name: string, options: DropdownOptions): DropdownWidget {
  return new DropdownWidget(name, options);
}
