import { FlexContainer, FlexContainerOptions } from './FlexContainer';

/**
 * Options for configuring a Row widget
 */
export interface RowOptions extends FlexContainerOptions {
  mainAxisAlignment?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  crossAxisAlignment?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
}

/**
 * Creates a Row widget that arranges its children horizontally
 */
export function Row(options: RowOptions = {}): FlexContainer {
  // Map alignment properties to flex style
  const style = {
    ...options.style,
    flexDirection: 'row',
    justifyContent: options.mainAxisAlignment || 'flex-start',
    alignItems: options.crossAxisAlignment || 'flex-start',
  };

  return new FlexContainer({
    ...options,
    style,
  });
}
