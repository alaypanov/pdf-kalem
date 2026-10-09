/**
 * Fonts shipped with the package, as base64 TS modules under `files/`.
 *
 * Base64-in-JS (instead of binary assets + URL resolution) so a shipped
 * family loads identically in Node, Vite, webpack, and CDN builds with zero
 * consumer configuration. Each face is imported lazily and dynamically, so
 * consumers who never request it never pay for it — `sideEffects: false`
 * keeps unused modules out of the bundle entirely.
 *
 * Add a family: generate the modules with
 * `node scripts/generate-font-module.mjs <ttf> <name>` and add entries here.
 * Family names are lowercase kebab: `inter`. A family
 * entry lists the faces it ships (`regular` required, others optional);
 * missing faces fall back at embed time with a warning.
 */
import type { FontVariants, FontStyle } from './types';

type FaceLoader = () => Promise<Uint8Array>;

interface ShippedFamily {
  regular: FaceLoader;
  bold?: FaceLoader;
  italic?: FaceLoader;
  boldItalic?: FaceLoader;
}

function base64ToBytes(base64: string): Uint8Array {
  const maybeBuffer = (globalThis as typeof globalThis & {
    Buffer?: { from(data: string, encoding: string): Uint8Array };
  }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(base64, 'base64');
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const shippedFontLoaders: Record<string, ShippedFamily> = {
  inter: {
    regular: async () => {
      const { FONT_TTF_BASE64 } = await import('./files/inter-regular');
      return base64ToBytes(FONT_TTF_BASE64);
    },
    bold: async () => {
      const { FONT_TTF_BASE64 } = await import('./files/inter-bold');
      return base64ToBytes(FONT_TTF_BASE64);
    },
    italic: async () => {
      const { FONT_TTF_BASE64 } = await import('./files/inter-italic');
      return base64ToBytes(FONT_TTF_BASE64);
    },
    boldItalic: async () => {
      const { FONT_TTF_BASE64 } = await import('./files/inter-bold-italic');
      return base64ToBytes(FONT_TTF_BASE64);
    },
  },
}

const FACE_KEYS: readonly FontStyle[] = ['regular', 'bold', 'italic', 'boldItalic'];

/** Family names available without any user-provided files. */
export function shippedFamilyNames(): string[] {
  return Object.keys(shippedFontLoaders);
}

export function isShippedFamily(family: string): boolean {
  return family in shippedFontLoaders;
}

/** The faces a shipped family provides (empty array for unknown families). */
export function shippedFamilyFaces(family: string): FontStyle[] {
  const entry = shippedFontLoaders[family];
  if (!entry) return [];
  return FACE_KEYS.filter((face) => Boolean(entry[face]));
}

export async function loadShippedFamily(family: string): Promise<FontVariants> {
  const entry = shippedFontLoaders[family];
  if (!entry) {
    throw new Error(
      `useFonts: family '${family}' is not shipped with pdf-kalem. ` +
        `Shipped families: ${shippedFamilyNames().join(', ') || '(none)'}. ` +
        `Provide your own file via useFonts(families, { files: { '${family}': bytes } }).`,
    );
  }

  const variants: { regular: Uint8Array; bold?: Uint8Array; italic?: Uint8Array; boldItalic?: Uint8Array } = {
    regular: await entry.regular(),
  };
  if (entry.bold) variants.bold = await entry.bold();
  if (entry.italic) variants.italic = await entry.italic();
  if (entry.boldItalic) variants.boldItalic = await entry.boldItalic();
  return variants;
}
