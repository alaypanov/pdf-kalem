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
  // Prop-derived values first, `style` last (the escape hatch wins per key,
  // same contract as Container — B14). The direction stays pinned: it is the
  // widget's identity, not a default.
  const style: YogaStyle = {
    justifyContent: options.mainAxisAlignment || justifyStart,
    alignItems: options.crossAxisAlignment || alignStart,
    ...options.style,
    flexDirection: 'row',
  };

  return new FlexContainer({
    ...options,
    style,
  });
}

export const Row: RowComponent = Object.assign(createRow, rowStatics);
