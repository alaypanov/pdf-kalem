/**
 * Aspect-fit tests: the shared measure/placement math behind Image, SVGPath,
 * and Icon (ARCHITECTURE.md #4).
 *
 * Pure math — no widgets, no Yoga, no pdf-lib. Pins bug B1 (SVGPath drew
 * below its layout box because it passed the box bottom, not the drawn area's
 * top, to pdf-lib's y-flipping drawSvgPath). Run: node tests/aspect-fit.test.mjs
 * (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { MeasureMode } from 'yoga-layout';

import {
  ImageSizing,
  aspectFitMeasure,
  aspectFitPlacement,
} from '../dist/internals.js';

// Yoga's measure modes, straight from the library (Undefined = 0, Exactly = 1,
// AtMost = 2) — the widgets compare against this same enum.
const { Exactly, AtMost, Undefined } = MeasureMode;

const SPEC = {
  intrinsicWidth: 100,
  intrinsicHeight: 50,
  baseScale: 1,
  sizing: ImageSizing.Fit,
};

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  passed++;
}

// --- measure: unconstrained → intrinsic -------------------------------------

check(
  'unconstrained measures intrinsic',
  aspectFitMeasure(() => SPEC)(0, Undefined, 0, Undefined),
  { width: 100, height: 50 },
);

// --- measure: Fit takes the smaller scale ------------------------------------

check(
  'fit into a box with matching aspect scales exactly',
  aspectFitMeasure(() => SPEC)(200, Exactly, 100, Exactly),
  { width: 200, height: 100 },
);

check(
  'fit into a taller box limits by width',
  aspectFitMeasure(() => SPEC)(100, Exactly, 100, Exactly),
  { width: 100, height: 50 },
);

// --- measure: Cover takes the larger scale -----------------------------------

{
  // Distinguishes Fit from Cover: square box around 2:1 content —
  // Fit limits by width (100×50), Cover fills the height (200×100).
  const coverSpec = { ...SPEC, sizing: ImageSizing.Cover };
  check(
    'cover fills the box where fit would letterbox',
    aspectFitMeasure(() => coverSpec)(100, Exactly, 100, Exactly),
    { width: 200, height: 100 },
  );
}

// --- measure: single constrained dimension derives the other -----------------

check(
  'width-only constraint derives height from aspect',
  aspectFitMeasure(() => SPEC)(80, Exactly, 0, Undefined),
  { width: 80, height: 40 },
);

check(
  'height-only constraint derives width from aspect',
  aspectFitMeasure(() => SPEC)(0, Undefined, 20, Exactly),
  { width: 40, height: 20 },
);

// --- measure: None ignores the box -------------------------------------------

check(
  'None measures intrinsic regardless of constraints',
  aspectFitMeasure(() => ({ ...SPEC, sizing: ImageSizing.None }))(500, Exactly, 500, Exactly),
  { width: 100, height: 50 },
);

// --- measure: baseScale multiplies the intrinsic box -------------------------

check(
  'baseScale scales the intrinsic measure',
  aspectFitMeasure(() => ({ ...SPEC, baseScale: 2 }))(0, Undefined, 0, Undefined),
  { width: 200, height: 100 },
);

// --- measure: unknown intrinsic (image not loaded yet) measures zero ---------

check(
  'null spec (image not embedded yet) measures zero',
  aspectFitMeasure(() => null)(100, Exactly, 100, Exactly),
  { width: 0, height: 0 },
);

// --- placement: Fit centers the drawn area in the box -------------------------

{
  // 2:1 content in a 1:1 box: fit limits by width, leaving vertical slack.
  const p = aspectFitPlacement(SPEC, { x: 10, y: 100, width: 200, height: 200 });
  check('placement fit scale limited by width', p.scale, 2);
  check('placement drawn width', p.drawnWidth, 200);
  check('placement drawn height', p.drawnHeight, 100);
  check('placement fills width exactly (no horizontal offset)', p.left, 10);
  check('placement centers vertically (bottom edge)', p.bottom, 150);
  check('placement top edge = bottom + drawnHeight', p.top, 250);
  check('top/bottom span the drawn height', p.top - p.bottom, p.drawnHeight);
}

// --- placement: B1 — the drawSvgPath origin is the drawn area's TOP -----------

{
  // An exactly-fitting box: the old SVGPath code passed y + offsetY (the box
  // bottom in PDF coords), drawing the path entirely below its box.
  const p = aspectFitPlacement(SPEC, { x: 0, y: 300, width: 100, height: 50 });
  check('B1: top is the box top for an exactly-fitting box', p.top, 350);
  check('B1: bottom is the box bottom', p.bottom, 300);
  check('B1: content extends downward from top (pdf-lib y-flip)', p.top > p.bottom, true);
}

// --- placement: zero box dimensions fall back to intrinsic --------------------

{
  const p = aspectFitPlacement(SPEC, { x: 5, y: 5, width: 0, height: 0 });
  check('zero box keeps base scale', p.scale, 1);
  check('zero box draws at intrinsic width', p.drawnWidth, 100);
  check('zero box draws at intrinsic height', p.drawnHeight, 50);
  check('zero box has no centering offset (left)', p.left, 5);
  check('zero box top = y + intrinsic height', p.top, 55);
}

// --- placement: Cover fills the box (overflow allowed) ------------------------

{
  const p = aspectFitPlacement({ ...SPEC, sizing: ImageSizing.Cover }, { x: 0, y: 0, width: 200, height: 100 });
  check('placement cover takes the larger scale', p.scale, 2);
  check('placement cover fills box width', p.drawnWidth, 200);
  check('placement cover fills box height', p.drawnHeight, 100);
}

// --- placement: None draws at intrinsic size, centered ------------------------

{
  const p = aspectFitPlacement({ ...SPEC, sizing: ImageSizing.None }, { x: 0, y: 0, width: 500, height: 500 });
  check('placement None never scales', p.scale, 1);
  check('placement None centers horizontally', p.left, 200);
  check('placement None centers vertically (bottom edge)', p.bottom, 225);
}

console.log(`ok - ${passed} aspect-fit assertions passed (measure + placement, pins B1)`);