import { Column, Text } from 'pdf-kalem/widgets';

/** The invoice's most-used primitive: an uppercase label over a value. */
export function labelValue(label: string, value: string) {
  return Column({
    gap: 3,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      Text(value, { variant: 'body' }),
    ],
  });
}