import type { PDFImage } from 'pdf-lib';
import type { StandardFonts } from 'pdf-lib';
import type { ColorValue } from './utils/color-utils';

export interface RenderContextOptions {
  height?: number; // Default page height if needed before page creation
  width?: number;  // Default page width if needed before page creation
  // Removed margin, handled by layout engine

  /**
   * When enabled, widgets can draw visual debug outlines.
   * This must not affect Yoga layout; it only impacts rendering.
   */
  debug?: boolean;

  /** Border stroke width for debug outlines (PDF points). */
  debugStrokeWidth?: number;
}

export type RenderColor = ColorValue;
export type RenderImage = PDFImage;

export interface DrawRectangleArgs {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: RenderColor;
  borderWidth?: number;
  borderColor?: RenderColor;
}

export interface DrawTextArgs {
  text: string;
  x: number;
  y: number;
  size: number;
  color?: RenderColor;
  fontName?: StandardFonts | string;
  maxWidth?: number;
}

export interface DrawLineArgs {
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  color?: RenderColor;
}

export interface DrawImageArgs {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawSvgPathArgs {
  d: string;
  x: number;
  y: number;
  scale: number;
  color?: RenderColor;
  borderColor?: RenderColor;
  borderWidth?: number;
}

export interface LinkAnnotationArgs {
  href: string;
  rect: [number, number, number, number];
}
