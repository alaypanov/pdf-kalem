import { rgb, type Color as PdfLibColor } from 'pdf-lib';

export interface ColorValue {
    kind: 'rgb';
    red: number;
    green: number;
    blue: number;
    alpha?: number;
}

function clampByte(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string): string {
    const cleanHex = hex.trim().replace(/^#/, '');

    if (cleanHex.length === 3 || cleanHex.length === 4) {
        return cleanHex
            .split('')
            .map((char) => `${char}${char}`)
            .join('');
    }

    if (cleanHex.length === 6 || cleanHex.length === 8) {
        return cleanHex;
    }

    throw new Error(`Invalid hex color: ${hex}`);
}

export function fromHex(hex?: string): ColorValue {
    if (!hex) {
        return fromRGB(255, 255, 255);
    }

    const normalizedHex = normalizeHex(hex);
    return {
        kind: 'rgb',
        red: parseInt(normalizedHex.slice(0, 2), 16),
        green: parseInt(normalizedHex.slice(2, 4), 16),
        blue: parseInt(normalizedHex.slice(4, 6), 16),
        alpha: normalizedHex.length === 8 ? parseInt(normalizedHex.slice(6, 8), 16) : undefined,
    };
}

export function fromRGB(red: number, green: number, blue: number, alpha?: number): ColorValue {
    return {
        kind: 'rgb',
        red: clampByte(red),
        green: clampByte(green),
        blue: clampByte(blue),
        alpha: alpha === undefined ? undefined : clampByte(alpha),
    };
}

export function toPdfLibColor(color?: ColorValue): PdfLibColor | undefined {
    if (!color) {
        return undefined;
    }

    return rgb(color.red / 255, color.green / 255, color.blue / 255);
}

export function convertToPDFColor(color?: string | ColorValue): PdfLibColor {
    const resolvedColor = typeof color === 'string' ? fromHex(color) : color ?? fromRGB(255, 255, 255);
    return toPdfLibColor(resolvedColor) ?? rgb(1, 1, 1);
}
