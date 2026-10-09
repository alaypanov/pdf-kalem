/**
 * Browser sandbox for the docs playgrounds' live widget-code editing.
 *
 * The editor holds the *body* of a function: it must `return` an array of
 * Page widgets. Widget factories and helpers are injected as function
 * parameters (plain JavaScript — no imports, no types), so edited code is
 * evaluated with `new Function` on every render without a transpiler. This
 * keeps the playgrounds dependency-free and instant.
 */
import {
  Column,
  Container,
  FixedContainer,
  HLine,
  Icon,
  Image,
  ImageSizing,
  Link,
  Page,
  Row,
  SVGPath,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
} from '../../../src/widgets';
import { PageSize } from '../../../src';
import { fromHex } from '../../../src/lib/utils/color-utils';
import type { Widget } from '../../../src/lib/Widget';

/** Names in scope for editor code, in addition to the widget factories. */
export function widgetSandbox(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Page,
    Text,
    Column,
    Row,
    Container,
    FixedContainer,
    HLine,
    Link,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Image,
    ImageSizing,
    SVGPath,
    Icon,
    PageSize,
    fromHex,
    ...extra,
  };
}

/** Evaluate editor code (a function body) and return the Page widgets it built. */
export function evalPages(code: string, sandbox: Record<string, unknown>): Widget[] {
  const names = Object.keys(sandbox);
  const factory = new Function(...names, `"use strict";\n${code}`);
  const pages = factory(...names.map((name) => sandbox[name]));

  if (!Array.isArray(pages)) {
    throw new Error('Editor code must return an array of Page widgets');
  }
  return pages as Widget[];
}

/**
 * Evaluate editor code (a function body) that edits `pages` in place — the
 * edit playground's contract: overlay with `pages[i].add([...])`, restructure
 * by mutating the array. No return value; the (mutated) array is the result.
 */
export function applyEdits(code: string, sandbox: Record<string, unknown>, pages: Widget[]): void {
  const names = Object.keys(sandbox);
  const factory = new Function('pages', ...names, `"use strict";\n${code}`);
  factory(pages, ...names.map((name) => sandbox[name]));
}