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

    // Validate the characters too: `parseInt('ZZ', 16)` would otherwise
    // produce NaN colors (a cryptic late pdf-lib error) or silently wrong
    // ones (`parseInt('1G', 16)` = 1) (B20).
    if (
        !/^[0-9a-fA-F]+$/.test(cleanHex) ||
        (cleanHex.length !== 3 && cleanHex.length !== 4 && cleanHex.length !== 6 && cleanHex.length !== 8)
    ) {
        throw new Error(`Invalid hex color: ${hex}`);
    }

    if (cleanHex.length === 3 || cleanHex.length === 4) {
        return cleanHex
            .split('')
            .map((char) => `${char}${char}`)
            .join('');
    }

    return cleanHex;
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

let alphaUnsupportedWarned = false;

export function toPdfLibColor(color?: ColorValue): PdfLibColor | undefined {
    if (!color) {
        return undefined;
    }

    // pdf-lib's rgb() has no alpha channel; warn once instead of silently
    // rendering transparency as fully opaque (B20).
    if (color.alpha !== undefined && color.alpha < 255 && !alphaUnsupportedWarned) {
        alphaUnsupportedWarned = true;
        console.warn('pdf-kalem: ColorValue.alpha is not supported by the PDF backend — the color renders fully opaque.');
    }

    return rgb(color.red / 255, color.green / 255, color.blue / 255);
}

export function convertToPDFColor(color?: string | ColorValue): PdfLibColor {
    const resolvedColor = typeof color === 'string' ? fromHex(color) : color ?? fromRGB(255, 255, 255);
    return toPdfLibColor(resolvedColor) ?? rgb(1, 1, 1);
}
