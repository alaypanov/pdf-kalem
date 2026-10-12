import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';
import { PlacedFormWidget, type FormFieldOptions } from './FormWidget';

export interface TextFieldOptions extends FormFieldOptions {
  /** Initial text (data binding sets the same state by field name). */
  value?: string;
  /** Multi-line input box; the default height grows to three lines. */
  multiline?: boolean;
  /** Maximum character count the reader enforces while typing. */
  maxLength?: number;
}

export class TextFieldWidget extends PlacedFormWidget {
  private value?: string;
  private readonly multiline: boolean;
  private readonly maxLength?: number;

  constructor(name: string, options: TextFieldOptions = {}) {
    super(name, options);
    this.value = options.value;
    this.multiline = options.multiline ?? false;
    this.maxLength = options.maxLength;

    this.setYogaStyle({
      // Fill the available width — with a floor: inside a shrink-wrapping
      // Column (alignItems: flex-start) a bare '100%' resolves against the
      // wrapped parent and collapses to zero (an invisible field). Explicit
      // `width` is honored exactly, no floor.
      width: options.width ?? '100%',
      minWidth: options.width === undefined ? 120 : undefined,
      height: options.height ?? (this.multiline ? 72 : 24),
    });
  }

  protected get kind(): string {
    return 'TextField';
  }

  /** @internal — PdfDoc's formData walk applies values here. */
  bindValue(value: string | boolean): void {
    if (typeof value !== 'string') {
      throw new Error(`TextField "${this.name}" expects a string formData value, got ${typeof value}.`);
    }
    this.value = value;
  }

  protected placeField(
    form: PDFForm,
    page: PDFPage,
    box: { x: number; y: number; width: number; height: number },
    context: RenderContext,
  ): void {
    const field = form.createTextField(this.name);
    if (this.multiline) field.enableMultiline();
    if (this.maxLength !== undefined) field.setMaxLength(this.maxLength);
    if (this.value !== undefined) field.setText(this.value);
    if (this.readOnly) field.enableReadOnly();
    // addToPage creates the /DA entry setFontSize requires — order matters.
    field.addToPage(page, { ...box, ...this.appearanceArgs(context) });
    if (this.appearance.fontSize !== undefined) field.setFontSize(this.appearance.fontSize);
  }
}

export function TextField(name: string, options: TextFieldOptions = {}): TextFieldWidget {
  return new TextFieldWidget(name, options);
}
