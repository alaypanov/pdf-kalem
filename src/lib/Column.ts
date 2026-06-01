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
 * Options for configuring a Column widget
 */
export interface ColumnOptions extends FlexContainerOptions {
  mainAxisAlignment?: JustifyValue;
  crossAxisAlignment?: Exclude<AlignValue, 'auto'>;
  gap?: number;
}

const columnStatics = {
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

export type ColumnComponent = ((options?: ColumnOptions) => FlexContainer) & typeof columnStatics;

/**
 * Creates a Column widget that arranges its children vertically
 */
function createColumn(options: ColumnOptions = {}): FlexContainer {
  // Map alignment properties to flex style
  const style: YogaStyle = {
    ...options.style,
    flexDirection: 'column',
    gap: options?.gap || 0,
    justifyContent: options.mainAxisAlignment || justifyStart,
    alignItems: options.crossAxisAlignment || alignStart,
  };

  return new FlexContainer({
    ...options,
    style,
  });
}

export const Column: ColumnComponent = Object.assign(createColumn, columnStatics);
