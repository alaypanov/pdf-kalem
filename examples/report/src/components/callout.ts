import { Text } from 'pdf-kalem/widgets';
import { panel } from './panel.ts';

/** An accent callout box. Keep-together: callouts move whole, never split. */
export function callout(title: string, body: string) {
  return panel({
    bgColor: 'accentSoft',
    breakable: false,
    padding: 14,
    children: [
      Text(title, { variant: 'h3', color: 'brand' }),
      Text(body, { variant: 'body' }),
    ],
  });
}