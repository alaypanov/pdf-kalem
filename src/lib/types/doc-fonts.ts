import { StandardFonts } from 'pdf-lib';
import { faceId } from '../fonts/face';
import type { FontStyle } from '../fonts/types';

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

/**
 * Reverse lookup: builtin pdf font name → the family/style face it renders.
 * Built lazily from {@link BuiltinPdfFonts} so the two tables can't drift.
 * Used to decompose a base font name (e.g. `Helvetica-Bold`) before applying
 * run-level style flags; checked BEFORE suffix parsing, since builtin pdf
 * names like `Helvetica-Bold` would otherwise mis-parse as a custom family.
 */
const BuiltinPdfNameFaces = new Map<string, { family: string; style: FontStyle }>(
  (['sans', 'serif', 'mono'] as const).flatMap((family) =>
    (['regular', 'bold', 'italic', 'boldItalic'] as const).map((style) => {
      const pdfName = BuiltinPdfFonts[faceId(family, style) as BuiltinPdfFontName].pdf;
      return [pdfName, { family, style }] as const;
    })
  )
);

export function builtinPdfNameFace(pdfName: string): { family: string; style: FontStyle } | undefined {
  return BuiltinPdfNameFaces.get(pdfName);
}

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
