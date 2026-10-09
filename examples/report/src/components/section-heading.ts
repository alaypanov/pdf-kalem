import { Column, Container, HLine, Row, Text } from 'pdf-kalem/widgets';

/**
 * A numbered section heading. Keep-together: a heading must never straddle
 * a page boundary, so the whole block is `breakable: false`.
 */
export function sectionHeading(number: string, title: string) {
  return Container({
    width: '100%',
    breakable: false,
    child: Column({
      width: '100%',
      gap: 6,
      children: [
        Row({
          style: { gap: 8 },
          crossAxisAlignment: Row.alignCenter,
          children: [
            Text(number, { variant: 'label', color: 'accent' }),
            Text(title, { variant: 'h2' }),
          ],
        }),
        HLine({ color: 'line', thickness: 1, width: '100%' }),
      ],
    }),
  });
}