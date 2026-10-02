import { Widget, WidgetOptions, type YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import { resolveThemeColor, type ThemeColorValue } from './Theme';
import { fromHex } from './utils/color-utils';
import { ImageSizing } from './Image';
import { MeasureMode } from 'yoga-layout';

/**
 * Material Icons use a 24×24 viewBox. Each entry is the raw SVG path data (`d`)
 * for that icon at the 24px grid.
 */
export interface IconDefinition {
  /** SVG path data. */
  d: string;
  /** ViewBox dimension. Defaults to 24 (Material Icons standard). */
  viewBox?: number;
}

/**
 * Registry of named icon definitions. The widget looks up `name` here at
 * construction time. Extend it via {@link Icon.register} / {@link Icon.registerAll}.
 */
export type IconRegistry = Map<string, IconDefinition>;

/**
 * Options for the {@link Icon} widget.
 */
export interface IconOptions extends WidgetOptions {
  /**
   * Name of a registered icon (looked up in the registry). Mutually exclusive
   * with `path`; if both are given, `path` wins.
   */
  name?: string;
  /**
   * Inline SVG path data. Use this to render an icon without registering it.
   */
  path?: string;
  /**
   * ViewBox dimension (the icon is drawn on a square `viewBox × viewBox` grid).
   * Defaults to 24 (Material Icons standard) or the registered icon's viewBox.
   */
  viewBox?: number;
  /** Edge length in PDF points. Defaults to 24. */
  size?: number;
  /** Yoga sizing overrides; defaults to `size × size`. */
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  /** Fill color. Resolves theme tokens; falls back to currentColor-ish black. */
  color?: ThemeColorValue;
  /** Stroke color (outline). Most Material icons are fill-only. */
  stroke?: ThemeColorValue;
  /** Stroke width in viewBox units. Scales with the icon. */
  strokeWidth?: number;
  /** How the icon scales into its layout box when both dims are constrained. */
  sizing?: ImageSizing;
  /** Additional multiplier on top of fit/cover scaling. Defaults to 1. */
  scale?: number;
}

/**
 * A widget that renders a single Material-style icon as an SVG path.
 *
 * The icon is resolved from the {@link materialIcons} registry by `name`, or
 * rendered directly from `path`. Drawing is delegated to the backend's
 * `drawSvgPath` (same path `SVGPathWidget` uses), so this works for any
 * `RenderContext` that supports SVG paths.
 *
 * @example
 *   Icon({ name: 'home', size: 24, color: 'primary' })
 *   Icon({ path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', size: 32 })
 */
export class IconWidget extends Widget {
  private readonly d: string;
  private readonly viewBoxWidth: number;
  private readonly viewBoxHeight: number;
  private readonly baseScale: number;
  private readonly sizing: ImageSizing;
  private readonly colorOverride?: ThemeColorValue;
  private readonly strokeOverride?: ThemeColorValue;
  private readonly strokeWidth?: number;

  private measureConfigured = false;

  constructor(options: IconOptions = {}) {
    super(options);

    const def =
      options.path !== undefined
        ? { d: options.path, viewBox: options.viewBox }
        : options.name !== undefined
          ? materialIcons.get(options.name) ??
            (() => {
              throw new Error(
                `Icon: no registered icon named '${options.name}'. Register it via Icon.register('${options.name}', { d, viewBox }) or pass \`path\` directly.`
              );
            })()
          : (() => {
              throw new Error('Icon: either `name` or `path` is required');
            })();

    const vb = options.viewBox ?? def.viewBox ?? 24;
    if (!Number.isFinite(vb) || vb <= 0) {
      throw new Error('Icon: viewBox must be a positive number');
    }

    this.d = def.d;
    this.viewBoxWidth = vb;
    this.viewBoxHeight = vb;
    this.baseScale = options.scale ?? 1;
    this.sizing = options.sizing ?? ImageSizing.Fit;
    this.colorOverride = options.color;
    this.strokeOverride = options.stroke;
    this.strokeWidth = options.strokeWidth;

    const size = options.size ?? 24;
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('Icon: size must be a positive number');
    }

    if (options.width !== undefined) {
      this.setProperty(this.context as any, 'width', options.width);
    } else {
      this.node.setWidth(size);
    }
    if (options.height !== undefined) {
      this.setProperty(this.context as any, 'height', options.height);
    } else {
      this.node.setHeight(size);
    }

    this.configureMeasureFunc();
  }

  private configureMeasureFunc(): void {
    if (this.measureConfigured) return;

    this.node.setMeasureFunc((width, widthMode, height, heightMode) => {
      const widthConstrained =
        widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost;
      const heightConstrained =
        heightMode === MeasureMode.Exactly || heightMode === MeasureMode.AtMost;

      const intrinsicW = this.viewBoxWidth * this.baseScale;
      const intrinsicH = this.viewBoxHeight * this.baseScale;

      if (this.sizing === ImageSizing.None || (!widthConstrained && !heightConstrained)) {
        return { width: intrinsicW, height: intrinsicH };
      }

      const aspect = this.viewBoxWidth / this.viewBoxHeight;
      let targetW = intrinsicW;
      let targetH = intrinsicH;

      if (widthConstrained && heightConstrained) {
        const scale =
          this.sizing === ImageSizing.Cover
            ? Math.max(width / intrinsicW, height / intrinsicH)
            : Math.min(width / intrinsicW, height / intrinsicH);
        targetW = intrinsicW * scale;
        targetH = intrinsicH * scale;
      } else if (widthConstrained) {
        targetW = width;
        targetH = width / aspect;
      } else if (heightConstrained) {
        targetH = height;
        targetW = height * aspect;
      }

      return { width: targetW, height: targetH };
    });

    this.measureConfigured = true;
  }

  getWidth(): number {
    return this.viewBoxWidth * this.baseScale;
  }

  getHeight(): number {
    return this.viewBoxHeight * this.baseScale;
  }

  private getColor(): RenderColor {
    return (
      resolveThemeColor(this.context?.getTheme(), this.colorOverride) ??
      fromHex('#000000')
    );
  }

  private getStroke(): RenderColor | undefined {
    return resolveThemeColor(this.context?.getTheme(), this.strokeOverride);
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width, height } = context.getLayoutBox(this)
    this.drawIconAt(context, x, y, width, height);
  }

  async renderAt(
    context: RenderContext,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> {
    this.drawIconAt(context, x, y, width, height);
  }

  private drawIconAt(
    context: RenderContext,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const boxW = width > 0 ? width : this.getWidth();
    const boxH = height > 0 ? height : this.getHeight();

    let scale = this.baseScale;
    if (this.sizing !== ImageSizing.None) {
      if (boxW > 0 && boxH > 0) {
        const fitScale =
          this.sizing === ImageSizing.Cover
            ? Math.max(boxW / (this.viewBoxWidth * this.baseScale), boxH / (this.viewBoxHeight * this.baseScale))
            : Math.min(boxW / (this.viewBoxWidth * this.baseScale), boxH / (this.viewBoxHeight * this.baseScale));
        scale = this.baseScale * fitScale;
      } else if (boxW > 0) {
        scale = this.baseScale * (boxW / (this.viewBoxWidth * this.baseScale));
      } else if (boxH > 0) {
        scale = this.baseScale * (boxH / (this.viewBoxHeight * this.baseScale));
      }
    }

    const drawnW = this.viewBoxWidth * scale;
    const drawnH = this.viewBoxHeight * scale;
    const offsetX = boxW > 0 ? (boxW - drawnW) / 2 : 0;
    // pdf-lib's drawSvgPath flips Y (scale(s, -s)), so the path's SVG (0,0)
    // (top-left) lands at the y origin and grows downward in SVG space =
    // upward in PDF space. To place the icon inside the layout box, we pass
    // the TOP of the drawn area as the y origin.
    const offsetY = boxH > 0 ? (boxH - drawnH) / 2 : 0;
    const originY = y + boxH - offsetY;

    const borderWidth =
      this.strokeWidth !== undefined && Number.isFinite(this.strokeWidth)
        ? this.strokeWidth * scale
        : undefined;

    context.drawSvgPath({
      d: this.d,
      x: x + offsetX,
      y: originY,
      scale,
      color: this.getColor(),
      borderColor: this.getStroke(),
      borderWidth,
    });
  }
}

// --- Built-in Material Icons registry ---------------------------------------

/**
 * The bundled Material Icons registry. A small curated subset is shipped with
 * the library; the full set is intentionally not bundled to keep package size
 * small. Register more icons via {@link Icon.register} /
 * {@link Icon.registerAll}, or fetch them from Google's Material Icons font.
 *
 * All bundled paths target a 24×24 viewBox (Material Icons standard grid).
 */
export const materialIcons: IconRegistry = new Map<string, IconDefinition>([
  ['home', { d: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' }],
  ['search', { d: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' }],
  ['settings', { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' }],
  ['person', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' }],
  ['check', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' }],
  ['close', { d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' }],
  ['arrow-back', { d: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z' }],
  ['arrow-forward', { d: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z' }],
  ['add', { d: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' }],
  ['remove', { d: 'M19 13H5v-2h14v2z' }],
  ['menu', { d: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z' }],
  ['more-vert', { d: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z' }],
  ['info', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' }],
  ['warning', { d: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' }],
  ['error', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' }],
  ['mail', { d: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' }],
  ['phone', { d: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z' }],
  ['calendar', { d: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z' }],
  ['clock', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z' }],
  ['star', { d: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' }],
  ['favorite', { d: 'M12 21.35l-1.45-1.32C5.4 16.36 2 13.28 2 9.5 2 6.42 4.42 4 7.5 4c1.74 0 3.41.81 4.5 2.09C13.09 4.81 14.76 4 16.5 4 19.58 4 22 6.42 22 9.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' }],
  ['share', { d: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z' }],
  ['download', { d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' }],
  ['upload', { d: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z' }],
  ['edit', { d: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' }],
  ['delete', { d: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' }],
  ['refresh', { d: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' }],
  ['lock', { d: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z' }],
  ['visibility', { d: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' }],
  ['print', { d: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z' }],
  ['description', { d: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' }],
]);

// --- Factory + registry API -------------------------------------------------

/**
 * Creates an {@link IconWidget}.
 *
 * Either `name` (looked up in the registry) or `path` (inline SVG path data)
 * must be provided.
 *
 * @example
 *   Icon({ name: 'home', size: 24, color: 'primary' })
 *   Icon({ path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', size: 32, color: '#000' })
 */
export function Icon(options: IconOptions): IconWidget {
  return new IconWidget(options);
}

/**
 * Registers a single icon in the global {@link materialIcons} registry.
 * Subsequent `Icon({ name })` calls will resolve to this definition.
 *
 * @example
 *   Icon.register('my-logo', { d: 'M2 2h20v20H2z', viewBox: 24 })
 */
Icon.register = function register(name: string, def: IconDefinition): void {
  if (!name?.trim()) throw new Error('Icon.register: name is required');
  if (!def?.d) throw new Error('Icon.register: def.d is required');
  materialIcons.set(name, def);
};

/**
 * Bulk-{@link Icon.register}. `defs` maps name → definition.
 *
 * @example
 *   Icon.registerAll({
 *     'my-logo': { d: '...' },
 *     'my-mark': { d: '...', viewBox: 48 },
 *   })
 */
Icon.registerAll = function registerAll(defs: Record<string, IconDefinition>): void {
  for (const [name, def] of Object.entries(defs ?? {})) {
    Icon.register(name, def);
  }
};

/** Returns whether `name` is registered in the global registry. */
Icon.has = function has(name: string): boolean {
  return materialIcons.has(name);
};
