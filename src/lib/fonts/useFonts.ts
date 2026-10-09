import type { FontSet, FontVariants, FontStyle } from './types';

/** One font file: fetched when a string, used directly otherwise. */
export type FontSource = string | Uint8Array | ArrayBuffer;

/** Explicit per-face sources for one family. */
export interface FamilyFiles {
  regular?: FontSource;
  bold?: FontSource;
  italic?: FontSource;
  boldItalic?: FontSource;
}

export interface UseFontsOptions {
  /**
   * Explicit font sources per family. A family entry is either a single
   * source (its regular face) or an object of per-face sources. A string is
   * fetched (browser/http URL — pass bytes for Node filesystem loading).
   */
  files?: Record<string, FontSource | FamilyFiles>;
}

const FACE_KEYS: readonly FontStyle[] = ['regular', 'bold', 'italic', 'boldItalic'];

type MutableVariants = {
  regular: Uint8Array;
  bold?: Uint8Array;
  italic?: Uint8Array;
  boldItalic?: Uint8Array;
};

function isFamilyFiles(value: FontSource | FamilyFiles): value is FamilyFiles {
  return (
    typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)
  );
}

async function resolveSource(family: string, face: FontStyle, source: FontSource): Promise<Uint8Array> {
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `useFonts: failed to fetch the ${face} face of '${family}' from '${source}' ` +
          `(${response.status} ${response.statusText})`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (bytes.byteLength === 0) {
    throw new Error(`useFonts: the ${face} face of '${family}' is empty`);
  }
  return bytes;
}

async function loadFamily(family: string, files: UseFontsOptions['files']): Promise<FontVariants> {
  const provided = files?.[family];
  const providedFaces: Partial<Record<FontStyle, FontSource>> = provided
    ? isFamilyFiles(provided)
      ? provided
      : { regular: provided }
    : {};

  if (!providedFaces.regular) {
    if (provided === undefined) {
      throw new Error(
        `useFonts: family '${family}' has no font files. Provide at least a regular face via ` +
          `useFonts(families, { files: { '${family}': bytes } }) — the builtin aliases ` +
          `('sans', 'serif', 'mono', …) need no files.`,
      );
    }
    throw new Error(
      `useFonts: family '${family}' has no regular face (provided: ${Object.keys(providedFaces).join(', ')}). ` +
        `A family needs at least a regular file.`,
    );
  }

  const variants: Partial<MutableVariants> = {};
  for (const face of FACE_KEYS) {
    const source = providedFaces[face];
    if (source !== undefined) {
      variants[face] = await resolveSource(family, face, source);
    }
  }

  // Validation above guarantees a regular face: a family requires a
  // `regular` files entry.
  return Object.freeze(variants as MutableVariants);
}

/**
 * Loads font families once and returns a reusable {@link FontSet} value.
 *
 * ```ts
 * const fonts = await useFonts(
 *   { body: 'inter' },
 *   { files: { inter: { regular: interBytes, bold: interBoldBytes } } },
 * );
 * const doc = new PdfDoc({ fonts, theme, children: [...] });
 * ```
 *
 * Configuration is synchronous and happens at doc construction: the doc
 * applies the FontSet's tokens over the theme's font mapping (doc-level
 * wins; the theme object is never mutated) and resolves family bytes
 * doc-scoped, so several documents can share one FontSet or use different
 * ones. Call before creating the doc — never after.
 *
 * A family carries a regular face plus optional bold/italic/bold-italic
 * faces from `files`. Missing faces fall back at embed time with a warning,
 * so a family can ship incrementally. Only families referenced by tokens
 * are loaded; extra `files` entries are ignored. The builtin aliases
 * (`sans`, `serif`, `mono`, … — pdf-lib's standard fonts) need no files at
 * all.
 */
export async function useFonts(
  families: Record<string, string>,
  options: UseFontsOptions = {},
): Promise<FontSet> {
  const tokens: Record<string, string> = {};
  for (const [token, family] of Object.entries(families ?? {})) {
    if (!token?.trim()) {
      throw new Error('useFonts: font token names must be non-empty');
    }
    if (!family?.trim()) {
      throw new Error(`useFonts: family for token '${token}' must be a non-empty name`);
    }
    tokens[token] = family;
  }

  const resolved = new Map<string, FontVariants>();

  await Promise.all([...new Set(Object.values(tokens))].map((family) => loadFamily(family, options.files).then((variants) => resolved.set(family, variants))));

  return Object.freeze({
    tokens: Object.freeze(tokens),
    families: resolved,
  } satisfies FontSet);
}

export type { FontSet, FontVariants, FontStyle } from './types';