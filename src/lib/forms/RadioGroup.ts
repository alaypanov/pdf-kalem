import type { RenderContext } from '../RenderContextInterface';
import type { Widget } from '../Widget';
import { FormWidget, type FormFieldOptions } from './FormWidget';

export interface RadioGroupOptions extends FormFieldOptions {
  /** Initially selected option value — must match a Radio child's value. */
  value?: string;
  /** Layout direction of the options. Default: column. */
  direction?: 'row' | 'column';
  /** Gap between options, in points. Default: 6. */
  gap?: number;
}

/**
 * One AcroForm radio group field spread over its children's boxes: the group
 * creates the field; each {@link Radio} descendant adds an option at its own
 * layout box. Radios may be nested in Rows/Columns (for labels) — they find
 * the group through the parent chain.
 *
 * The group is always atomic (`breakable: false`): options stranded on
 * another page from their field would be broken UX.
 */
export class RadioGroupWidget extends FormWidget {
  private value?: string;

  constructor(name: string, options: RadioGroupOptions = {}) {
    super(name, { ...options, breakable: false });
    this.value = options.value;

    this.setYogaStyle({
      flexDirection: options.direction === 'row' ? 'row' : 'column',
      gap: options.gap ?? 6,
    });
  }

  protected get kind(): string {
    return 'RadioGroup';
  }

  /**
   * @internal — PdfDoc's formData walk applies values here. The value is
   * validated at render (against the options the Radio children added), not
   * here — validating early would need the Radio class, and Radio.ts imports
   * this module.
   */
  bindValue(value: string | boolean): void {
    if (typeof value !== 'string') {
      throw new Error(`RadioGroup "${this.name}" expects a string formData value, got ${typeof value}.`);
    }
    this.value = value;
  }

  /**
   * The group places nothing at its own box. Children render first (adding
   * their options), then the initial selection is applied — pdf-lib's
   * `select` validates against the added options, so it must come after.
   */
  async render(context: RenderContext): Promise<void> {
    const { form } = this.requireSurface(context);
    const field = form.createRadioGroup(this.name);
    if (this.readOnly) field.enableReadOnly();
    await this.renderChildren(context);
    if (this.value !== undefined) {
      // pdf-lib's select validates too, but its error would read cryptic —
      // name the actual mistake: the value must match a Radio child.
      const options = field.getOptions();
      if (!options.includes(this.value)) {
        throw new Error(
          `RadioGroup "${this.name}": value "${this.value}" is not one of its Radio children's values (${options.join(', ')}).`,
        );
      }
      field.select(this.value);
    }
  }

  /**
   * Places one option at `radio`'s layout box. Called by Radio.render — the
   * field lookup goes through the group so nested Radios need no state.
   *
   * @internal — package-internal: Radio renders through its group.
   */
  placeOption(value: string, radio: Widget, context: RenderContext): void {
    const { form, page } = this.requireSurface(context);
    const field = form.getRadioGroup(this.name);
    const box = context.getLayoutBox(radio);
    field.addOptionToPage(value, page, { ...box, ...this.appearanceArgs(context) });
  }
}

export function RadioGroup(name: string, options: RadioGroupOptions = {}): RadioGroupWidget {
  return new RadioGroupWidget(name, options);
}
