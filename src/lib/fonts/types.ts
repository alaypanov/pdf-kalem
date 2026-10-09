/**
 * A resolved, immutable set of font families ready to hand to a document.
 *
 * Created by {@link useFonts}; consumed by `new PdfDoc({ fonts })`. The doc
 * applies `tokens` over the theme's font mapping (doc-level wins, the user's
 * theme object is never mutated) and resolves family bytes doc-scoped —
 * before the global `FontRegistry` — so two documents in one process can use
 * different fonts under the same family name.
 */

/** The faces a family can provide. */
export type FontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic';

/**
 * The byte content of one family: a required regular face plus optional
 * style faces. Missing faces fall back at embed time (bold → regular,
 * bold-italic → bold → italic → regular) with a warning, so a family can
 * ship incrementally.
 */
export interface FontVariants {
  readonly regular: Uint8Array;
  readonly bold?: Uint8Array;
  readonly italic?: Uint8Array;
  readonly boldItalic?: Uint8Array;
}

export interface FontSet {
  /** Theme font token → family name (e.g. `{ body: 'inter' }`). */
  readonly tokens: Readonly<Record<string, string>>;
  /** Family name → the faces available for that family. */
  readonly families: ReadonlyMap<string, FontVariants>;
}
