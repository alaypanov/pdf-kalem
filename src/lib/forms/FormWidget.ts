import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';
import type { ThemeColorValue } from '../Theme';
import { resolveColor } from '../theme-resolve';
import type { Color as PdfLibColor } from 'pdf-lib';
import { toPdfLibColor } from '../utils/color-utils';
import { Widget, type WidgetOptions, type YogaStyleValue } from '../Widget';
import { isPdfFormSurface } from './surface';

/**
 * Appearance options pdf-lib's field appearance generation supports. The
 * default appearance font is Helvetica (a pdf-lib limitation — embedded-font
 * faces can come later); unset options leave pdf-lib's own defaults in place.
 */
export interface FormFieldAppearance {
  fontSize?: number;
  textColor?: ThemeColorValue;
  backgroundColor?: ThemeColorValue;
  borderColor?: ThemeColorValue;
  borderWidth?: number;
}

/**
 * Options every form field shares. `width`/`height` size the field's box —
 * the box IS the widget, so every field ships a usable default instead of
 * shrink-wrapping to zero.
 */
export interface FormFieldOptions extends WidgetOptions, FormFieldAppearance {
  /** Field cannot be edited in the PDF reader. */
  readOnly?: boolean;
  /** Box size overrides (defaults per field type). */
  width?: YogaStyleValue;
  height?: YogaStyleValue;
}

/**
 * Appearance args handed to pdf-lib's `addToPage` — the subset of its
 * (unexported) `FieldAppearanceOptions` form widgets set.
 */
interface FieldAppearanceArgs {
  textColor?: PdfLibColor;
  backgroundColor?: PdfLibColor;
  borderColor?: PdfLibColor;
  borderWidth?: number;
}

/**
 * Base class for widgets that create AcroForm fields.
 *
 * Form widgets are PDF-typed (ADR 0001): at render time they narrow the
 * backend-neutral context to {@link PdfFormSurface} and place their field at
 * the widget's layout box — which `getLayoutBox` already returns in PDF
 * coordinates (bottom-left origin; the Y-flip lives in the backend), exactly
 * what pdf-lib's `addToPage` wants. Because `PageScope` answers
 * `getLayoutBox` from the pagination plan, fields compose with pagination and
 * absolute positioning for free.
 *
 * Fields are created fresh on every render walk: a second save builds a fresh
 * `PDFDocument`, so nothing pdf-lib-owned is cached on the widget.
 */
export abstract class FormWidget extends Widget {
  /** The AcroForm field name — unique per document (pdf-lib enforces it). */
  readonly name: string;
  protected readonly readOnly: boolean;
  protected readonly appearance: FormFieldAppearance;

  constructor(name: string, options: FormFieldOptions = {}) {
    super(options);
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(
        'Form widgets require a non-empty `name` — it is the AcroForm field name (and the data-binding key).',
      );
    }
    this.name = name;
    this.readOnly = options.readOnly ?? false;
    this.appearance = {
      fontSize: options.fontSize,
      textColor: options.textColor,
      backgroundColor: options.backgroundColor,
      borderColor: options.borderColor,
      borderWidth: options.borderWidth,
    };
  }

  /** Readable widget name for error messages. */
  protected abstract get kind(): string;

  /**
   * Applies a formData value by field name (PdfDoc's binding walk). The base
   * refuses: only value-carrying fields (text, check, dropdown, radio group)
   * accept bindings — a Button, for instance, carries no value.
   *
   * @internal — package-internal: PdfDoc's formData walk applies values here.
   */
  bindValue(value: string | boolean): void {
    throw new Error(
      `${this.kind} has no value to bind (got ${typeof value}) — only text, check, dropdown, and radio fields accept formData values.`,
    );
  }

  /**
   * Narrows the backend-neutral context to the PDF form surface at render
   * time — the `LoadedPage` narrowing pattern (ADR 0001: PDF-typed modules,
   * never interface widening).
   */
  protected requireSurface(context: RenderContext): { form: PDFForm; page: PDFPage } {
    if (!isPdfFormSurface(context)) {
      throw new Error(
        `${this.kind} requires the PDF render context (pdf-kalem/forms renders through pdf-lib).`,
      );
    }
    const page = context.getCurrentPage();
    if (!page) {
      throw new Error(
        `${this.kind} rendered with no open page — form fields are placed on the page being painted.`,
      );
    }
    return { form: context.getForm(), page };
  }

  /**
   * Resolves appearance overrides against the theme (no theme tokens yet).
   * Unset options are OMITTED, not passed as undefined — pdf-lib's
   * `addToPage` only applies its own defaults (black text, white background,
   * black 1pt border) for keys that are absent, and a visible box is the
   * right default for a form field.
   *
   * @internal — package-internal: Radio reads its group's resolved appearance.
   */
  appearanceArgs(context: RenderContext): FieldAppearanceArgs {
    const theme = context.getTheme();
    const appearance = this.appearance;
    const args: FieldAppearanceArgs = {};
    const textColor = toPdfLibColor(resolveColor(theme, appearance.textColor));
    const backgroundColor = toPdfLibColor(resolveColor(theme, appearance.backgroundColor));
    const borderColor = toPdfLibColor(resolveColor(theme, appearance.borderColor));
    if (textColor) args.textColor = textColor;
    if (backgroundColor) args.backgroundColor = backgroundColor;
    if (borderColor) args.borderColor = borderColor;
    if (appearance.borderWidth !== undefined) args.borderWidth = appearance.borderWidth;
    return args;
  }
}

/**
 * A form field placed at its own layout box — the leaf fields. Field-owning
 * containers ({@link RadioGroup}) extend {@link FormWidget} directly and
 * override `render` instead: their box holds children, not a field.
 */
export abstract class PlacedFormWidget extends FormWidget {
  async render(context: RenderContext): Promise<void> {
    const { form, page } = this.requireSurface(context);
    const box = context.getLayoutBox(this);
    this.placeField(form, page, box, context);
  }

  /**
   * Create the pdf-lib field and place it at `box` (PDF coordinates:
   * bottom-left origin). Configure field state (value, flags) before
   * `addToPage` so the generated appearance reflects it; `setFontSize` must
   * come AFTER `addToPage` (it needs the /DA entry `addToPage` creates).
   */
  protected abstract placeField(
    form: PDFForm,
    page: PDFPage,
    box: { x: number; y: number; width: number; height: number },
    context: RenderContext,
  ): void;
}
