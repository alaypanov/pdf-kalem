/**
 * Layout invariant tests: containers contain their content.
 *
 * Regression guard for the Container fixed-height default (a panel given no
 * height used to be 100pt tall regardless of content, spilling text past its
 * background). Run: node tests/layout.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { Page, Container, Column, Text } from '../dist/widgets.js';
import { PdfDoc, createTheme } from '../dist/index.js';

const theme = createTheme({
  text: {
    h2: { size: 16, lineHeight: 20 },
    label: { size: 9.5, lineHeight: 11 },
    body: { size: 11.5, lineHeight: 12 },
  },
});

const labelValue = (label, value) =>
  Column({
    gap: 4,
    children: [Text(label.toUpperCase(), { variant: 'label' }), Text(value, { variant: 'body' })],
  });

/** The invoice's summary panel — the structure that used to overflow. */
function summaryPanel() {
  return Container({
    width: 210,
    padding: 16,
    bgColor: 'panel',
    child: Column({
      gap: 8,
      children: [
        Text('Invoice summary', { variant: 'h2' }),
        labelValue('Invoice number', 'INV-2026-014'),
        labelValue('Issue date', 'May 31, 2026'),
        labelValue('Due date', 'June 14, 2026'),
      ],
    }),
  });
}

async function layout(widget) {
  const doc = new PdfDoc({ theme, children: [Page({ dimensions: [612, 792], padding: 36, children: [widget] })] });
  await doc.save();
  return widget;
}

/** Vertical overflow of `widget`'s direct children beyond its border box. */
function verticalOverflow(widget) {
  const box = widget.getAbsoluteLayoutBox();
  return Math.max(
    0,
    ...widget.getChildWidgets().map((child) => {
      const childBox = child.getAbsoluteLayoutBox();
      return childBox.y + childBox.height - (box.y + box.height);
    }),
  );
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('Container sizes to content when no height is given', async () => {
  const panel = await layout(summaryPanel());
  const box = panel.getAbsoluteLayoutBox();

  // Content column (125) + vertical padding (32) — not the old fixed 100.
  const content = panel.getChildWidgets()[0].getAbsoluteLayoutBox();
  assert.ok(
    Math.abs(box.height - (content.height + 32)) < 1,
    `expected content-sized panel (~${(content.height + 32).toFixed(0)}pt), got ${box.height}pt`,
  );
  assert.equal(verticalOverflow(panel), 0);
});

test('Container content never overflows its box vertically (invoice panels)', async () => {
  const panel = await layout(summaryPanel());
  assert.equal(verticalOverflow(panel), 0, 'summary panel content spills past its background');

  const from = await layout(
    Container({
      width: '50%',
      padding: 16,
      bgColor: 'panel',
      child: Column({
        gap: 8,
        children: [
          Text('From', { variant: 'h2' }),
          Text('Acme Studio LLC', { variant: 'body' }),
          Text('201 Market Street', { variant: 'caption' }),
          Text('San Francisco, CA 94105', { variant: 'caption' }),
        ],
      }),
    }),
  );
  assert.equal(verticalOverflow(from), 0, 'from panel content spills past its background');
});

test('explicit Container dimensions are still respected', async () => {
  const chip = await layout(Container({ width: 90, height: 30, padding: 12, child: Text('ACME', { variant: 'label' }) }));
  const box = chip.getAbsoluteLayoutBox();
  assert.equal(box.width, 90);
  assert.equal(box.height, 30);
});

// --- Runner ---

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log(`\n${tests.length} tests passed`);