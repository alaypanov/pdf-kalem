import type { RenderContext } from '../RenderContextInterface';
import { Widget, type WidgetOptions, type YogaStyleValue } from '../Widget';
import { RadioGroupWidget } from './RadioGroup';

export interface RadioOptions extends WidgetOptions {
  /** Box size overrides (default 13×13, like CheckBox). */
  width?: YogaStyleValue;
  height?: YogaStyleValue;
}

/**
 * One option of a {@link RadioGroup} — a single radio circle. `value` is the
 * option value stored in the group's field (and matched by data binding).
 * The circle carries no label of its own: compose one with `Text` in a Row.
 */
export class RadioWidget extends Widget {
  private readonly value: string;

  constructor(value: string, options: RadioOptions = {}) {
    super(options);
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('Radio requires a non-empty `value` — it is the option value stored in the RadioGroup field.');
    }
    this.value = value;

    this.setYogaStyle({
      width: options.width ?? 13,
      height: options.height ?? 13,
    });
  }

  getValue(): string {
    return this.value;
  }

  async render(context: RenderContext): Promise<void> {
    const group = this.findGroup();
    if (!group) {
      throw new Error(
        'Radio must be placed inside a RadioGroup (nesting in Rows/Columns is fine) — it has no field of its own.',
      );
    }
    group.placeOption(this.value, this, context);
  }

  /** Nearest RadioGroup ancestor, or undefined. */
  private findGroup(): RadioGroupWidget | undefined {
    let ancestor: Widget | undefined = this.getParent();
    while (ancestor && !(ancestor instanceof RadioGroupWidget)) {
      ancestor = ancestor.getParent();
    }
    return ancestor ?? undefined;
  }
}

export function Radio(value: string, options: RadioOptions = {}): RadioWidget {
  return new RadioWidget(value, options);
}
