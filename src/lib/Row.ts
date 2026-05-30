import { FlexContainer, FlexContainerOptions } from './FlexContainer';


export const Justify = {
  FlexStart: 'flex-start',
  Center: 'center',
  FlexEnd: 'flex-end',
  SpaceBetween: 'space-between',
  SpaceAround: 'space-around',
  SpaceEvenly: 'space-evenly',
} as const;

export const Align = {
  FlexStart: 'flex-start',
  Center: 'center',
  FlexEnd: 'flex-end',
  Stretch: 'stretch',
} as const;

/**
 * Options for configuring a Row widget
 */
export interface RowOptions extends FlexContainerOptions {
  mainAxisAlignment?: typeof Justify[keyof typeof Justify];
  crossAxisAlignment?: typeof Align[keyof typeof Align];
}

/**
 * Creates a Row widget that arranges its children horizontally
 */
export function Row(options: RowOptions = {}): FlexContainer {

  // console.log('Creating Row with options:', this);
  // Map alignment properties to flex style
  const style = {
    ...options.style,
    flexDirection: 'row',
    justifyContent: options.mainAxisAlignment || Justify.FlexStart,
    alignItems: options.crossAxisAlignment || Align.FlexStart,
  };

  return new FlexContainer({
    ...options,
    style,
  });
}
