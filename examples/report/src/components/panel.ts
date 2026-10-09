import { Container } from 'pdf-kalem/widgets';

/** Container's option bag, reused so panel stays a thin wrapper. */
type ContainerOptions = Parameters<typeof Container>[0];

export interface PanelOptions {
  width?: ContainerOptions['width'];
  padding?: number;
  bgColor?: ContainerOptions['bgColor'];
  breakable?: ContainerOptions['breakable'];
  child?: ContainerOptions['child'];
  children?: ContainerOptions['children'];
}

/**
 * A variable-height panel: Container sizes to content unless given explicit
 * dimensions. The report's default surface — stat cards, callouts, and
 * side-by-side columns are all panels with different options.
 */
export function panel(options: PanelOptions) {
  return Container({
    width: options.width ?? '100%',
    padding: options.padding ?? 12,
    bgColor: options.bgColor ?? 'panel',
    breakable: options.breakable,
    child: options.child,
    children: options.children,
  });
}