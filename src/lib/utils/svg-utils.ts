/**
 * Utility to build SVG path strings for common shapes.
 */
export function buildSvg(shape: 'rectangle' | 'circle', options: any): string {
  switch (shape) {
    case 'rectangle': {
      const { x = 0, y = 0, width, height, radius = 0 } = options;
      if (radius > 0) {
        // Rounded rectangle path
        return `
          M${x + radius},${y}
          h${width - 2 * radius}
          a${radius},${radius} 0 0 1 ${radius},${radius}
          v${height - 2 * radius}
          a${radius},${radius} 0 0 1 -${radius},${radius}
          h-${width - 2 * radius}
          a${radius},${radius} 0 0 1 -${radius},-${radius}
          v-${height - 2 * radius}
          a${radius},${radius} 0 0 1 ${radius},-${radius}
          z
        `.replace(/\s+/g, ' ').trim();
      } else {
        // Simple rectangle
        return `M${x},${y} h${width} v${height} h-${width} Z`;
      }
    }
    case 'circle': {
      const { cx, cy, r } = options;
      return `
        M ${cx - r}, ${cy}
        a ${r},${r} 0 1,0 ${2 * r},0
        a ${r},${r} 0 1,0 -${2 * r},0
      `.replace(/\s+/g, ' ').trim();
    }
    default:
      throw new Error(`Unknown shape: ${shape}`);
  }
}
