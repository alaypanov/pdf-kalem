import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';
import { PlacedFormWidget, type FormFieldOptions } from './FormWidget';

export interface ButtonOptions extends FormFieldOptions {
  /** Caption drawn on the button face (pdf-lib renders it). */
  label?: string;
}

/**
 * A push button. Visual only by pdf-lib's limitation: the AcroForm field and
 * its face (caption, colors) are real, but pdf-lib exposes no action API, so
 * the button cannot submit/reset/run JavaScript — say so in docs, don't
 * pretend. The caption is pdf-lib's own (`addToPage(text, page, options)`),
 * not painted by the widget.
 */
export class ButtonWidget extends PlacedFormWidget {
  private readonly label?: string;

  constructor(name: string, options: ButtonOptions = {}) {
    super(name, options);
    this.label = options.label;

    this.setYogaStyle({
      width: options.width ?? 120,
      height: options.height ?? 32,
    });
  }

  protected get kind(): string {
    return 'Button';
  }

  protected placeField(
    form: PDFForm,
    page: PDFPage,
    box: { x: number; y: number; width: number; height: number },
    context: RenderContext,
  ): void {
    const field = form.createButton(this.name);
    // addToPage creates the /DA entry setFontSize requires — order matters.
    field.addToPage(this.label ?? '', page, { ...box, ...this.appearanceArgs(context) });
    if (this.appearance.fontSize !== undefined) field.setFontSize(this.appearance.fontSize);
    if (this.readOnly) field.enableReadOnly();
  }
}

export function Button(name: string, options: ButtonOptions = {}): ButtonWidget {
  return new ButtonWidget(name, options);
}
