import { Column, Text } from 'pdf-kalem/widgets';
import type { Link } from 'pdf-kalem/widgets';

/** Link's widget type — label values may embed a link instead of a string. */
type LinkWidget = ReturnType<typeof Link>;

/** An uppercase label over a value; the value may be a widget (e.g. a Link). */
export function labelValue(label: string, value: string | LinkWidget) {
  return Column({
    gap: 3,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      typeof value === 'string' ? Text(value, { variant: 'body' }) : value,
    ],
  });
}