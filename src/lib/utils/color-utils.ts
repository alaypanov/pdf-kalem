import { rgb, Color } from 'pdf-lib';

// Accept hex color and convert it to a pdf-lib Color.
export function convertToPDFColor(color?: string): Color {
    if (!color) return rgb(1, 1, 1); // Default color

    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}

export function fromHex(hex?: string): Color {
    if (!hex) return rgb(1, 1, 1); // Default color
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}

export function fromRGB(r: number, g: number, b: number): Color {
    return rgb(r / 255, g / 255, b / 255);
}
