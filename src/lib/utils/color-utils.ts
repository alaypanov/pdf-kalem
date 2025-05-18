import { rgb, Color } from 'pdf-lib';

export function   // will accept hex color and convert it to PDF color
  convertToPDFColor(color?: string): Color {
    if (!color) return rgb(1, 1, 1); // Default color

    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }