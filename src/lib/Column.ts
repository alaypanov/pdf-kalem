import { FlexContainer, FlexContainerOptions } from './FlexContainer';

/**
 * Options for configuring a Column widget
 */
export interface ColumnOptions extends FlexContainerOptions {
  mainAxisAlignment?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  crossAxisAlignment?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
}

/**
 * Creates a Column widget that arranges its children vertically
 */
export function Column(options: ColumnOptions = {}): FlexContainer {
  // Map alignment properties to flex style
  const style = {
    ...options.style,
    flexDirection: 'column',
    justifyContent: options.mainAxisAlignment || 'flex-start',
    alignItems: options.crossAxisAlignment || 'flex-start',
  };

  return new FlexContainer({
    ...options,
    style,
  });
}
