import { StandardFonts } from 'pdf-lib';
import { faceId } from '../fonts/face';
import type { FontStyle } from '../fonts/types';

export const BuiltinPdfFonts = {
	sans: { pdf: StandardFonts.Helvetica },
	'sans-bold': { pdf: StandardFonts.HelveticaBold },
	'sans-italic': { pdf: StandardFonts.HelveticaOblique },
	'sans-bold-italic': { pdf: StandardFonts.HelveticaBoldOblique },
	serif: { pdf: StandardFonts.TimesRoman },
	'serif-bold': { pdf: StandardFonts.TimesRomanBold },
	'serif-italic': { pdf: StandardFonts.TimesRomanItalic },
	'serif-bold-italic': { pdf: StandardFonts.TimesRomanBoldItalic },
	mono: { pdf: StandardFonts.Courier },
	'mono-bold': { pdf: StandardFonts.CourierBold },
	'mono-italic': { pdf: StandardFonts.CourierOblique },
	'mono-bold-italic': { pdf: StandardFonts.CourierBoldOblique },
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
