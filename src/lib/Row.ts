import { FlexContainer, FlexContainerOptions } from './FlexContainer';
import {
  alignCenter,
  alignEnd,
  alignStart,
  alignStretch,
  AlignValue,
  justifyAround,
  justifyBetween,
  justifyCenter,
  justifyEnd,
  justifyEvenly,
  justifyStart,
  JustifyValue,
} from './types/styles';
import { YogaStyle } from './Widget';

/**
 * Options for configuring a Row widget
 */
export interface RowOptions extends FlexContainerOptions {
  mainAxisAlignment?: JustifyValue;

  crossAxisAlignment?: Exclude<AlignValue, 'auto'>;
}

const rowStatics = {
  justifyStart,
  justifyCenter,
  justifyEnd,
  justifyBetween,
  justifyAround,
  justifyEvenly,
  alignStart,
  alignCenter,
  alignEnd,
  alignStretch,
} as const;

export type RowComponent = ((options?: RowOptions) => FlexContainer) &
  typeof rowStatics;

/**
 * Creates a Row widget that arranges its children horizontally
 */
function createRow(options: RowOptions = {}): FlexContainer {
  // console.log('Creating Row with options:', this);
  // Map alignment properties to flex style
  const style: YogaStyle = {
    ...options.style,
    flexDirection: 'row',
    justifyContent: options.mainAxisAlignment || justifyStart,
    alignItems: options.crossAxisAlignment || alignStart,
  };

  return new FlexContainer({
    ...options,
    style,
  });
}

export const Row: RowComponent = Object.assign(createRow, rowStatics);
