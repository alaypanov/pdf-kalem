import { StandardFonts } from 'pdf-lib';

export const BuiltinPdfFonts = {
	sans: {
		pdf: StandardFonts.Helvetica,
		canvas: 'Helvetica, Arial, sans-serif',
	},
	'sans-bold': {
		pdf: StandardFonts.HelveticaBold,
		canvas: 'Helvetica, Arial, sans-serif',
	},
	'sans-italic': {
		pdf: StandardFonts.HelveticaOblique,
		canvas: 'Helvetica, Arial, sans-serif',
	},
	'sans-bold-italic': {
		pdf: StandardFonts.HelveticaBoldOblique,
		canvas: 'Helvetica, Arial, sans-serif',
	},
	serif: {
		pdf: StandardFonts.TimesRoman,
		canvas: 'Times New Roman, Times, serif',
	},
	'serif-bold': {
		pdf: StandardFonts.TimesRomanBold,
		canvas: 'Times New Roman, Times, serif',
	},
	'serif-italic': {
		pdf: StandardFonts.TimesRomanItalic,
		canvas: 'Times New Roman, Times, serif',
	},
	'serif-bold-italic': {
		pdf: StandardFonts.TimesRomanBoldItalic,
		canvas: 'Times New Roman, Times, serif',
	},
	mono: {
		pdf: StandardFonts.Courier,
		canvas: 'Courier New, Courier, monospace',
	},
	'mono-bold': {
		pdf: StandardFonts.CourierBold,
		canvas: 'Courier New, Courier, monospace',
	},
	'mono-italic': {
		pdf: StandardFonts.CourierOblique,
		canvas: 'Courier New, Courier, monospace',
	},
	'mono-bold-italic': {
		pdf: StandardFonts.CourierBoldOblique,
		canvas: 'Courier New, Courier, monospace',
	},
} as const;

export type BuiltinPdfFontName = keyof typeof BuiltinPdfFonts;

export function resolveBuiltinPdfFont(fontName?: string): string | undefined {
	if (!fontName) {
		return undefined;
	}

	return BuiltinPdfFonts[fontName as BuiltinPdfFontName]?.pdf ?? fontName;
}

export function resolveBuiltinCanvasFont(fontName?: string): string | undefined {
	if (!fontName) {
		return undefined;
	}

	return BuiltinPdfFonts[fontName as BuiltinPdfFontName]?.canvas ?? fontName;
}
