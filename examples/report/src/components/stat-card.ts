import { Text } from 'pdf-kalem/widgets';
import { panel } from './panel.ts';

/** A cover-page stat card: label, big value, delta caption. */
export function statCard(label: string, value: string, delta: string) {
  return panel({
    width: '32%',
    padding: 12,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      Text(value, { variant: 'h2', color: 'brand' }),
      Text(delta, { variant: 'caption', color: 'accent' }),
    ],
  });
}