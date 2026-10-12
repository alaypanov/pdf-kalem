/**
 * Form-widget tests (`pdf-kalem/forms`): widgets create real AcroForm fields.
 *
 * Round-trip strategy: build a doc → save → reload the bytes with pdf-lib →
 * assert field names, types, values, flags, and placement. Run:
 * node tests/forms.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';

import { PDFDocument } from 'pdf-lib';

import { PdfDoc } from '../dist/index.js';
import { Column, Page, Row, Text } from '../dist/widgets.js';
import { Button, CheckBox, Dropdown, Radio, RadioGroup, Signature, TextField } from '../dist/forms.js';

let passed = 0;
async function test(label, fn) {
  await fn();
  passed++;
  console.log(`ok - ${label}`);
}

/** Save → reload → the reloaded document's PDFForm. */
async function formOf(doc) {
  const bytes = await doc.save();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getForm();
}

// --- field round-trip -----------------------------------------------------------

await test('text/check/dropdown fields round-trip through save/load with values', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      padding: 48,
      children: [
        TextField('full-name', { value: 'Ada Lovelace' }),
        CheckBox('consent', { checked: true }),
        Dropdown('plan', { options: ['Basic', 'Pro'], value: 'Pro' }),
      ],
    })],
  }));

  assert.deepEqual(
    form.getFields().map((field) => field.getName()).sort(),
    ['consent', 'full-name', 'plan'],
  );
  assert.equal(form.getTextField('full-name').getText(), 'Ada Lovelace');
  assert.equal(form.getCheckBox('consent').isChecked(), true);
  const dropdown = form.getDropdown('plan');
  assert.deepEqual(dropdown.getOptions(), ['Basic', 'Pro']);
  assert.deepEqual(dropdown.getSelected(), ['Pro']);
});

await test('unfilled fields exist with empty state', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({ children: [TextField('empty'), CheckBox('off')] })],
  }));
  const text = form.getTextField('empty').getText();
  assert.ok(text === undefined || text === '', 'unset text field reads empty');
  assert.equal(form.getCheckBox('off').isChecked(), false);
});

await test('multiline, maxLength, and readOnly reach the AcroForm field', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      children: [TextField('notes', { multiline: true, maxLength: 10, readOnly: true, value: 'hello' })],
    })],
  }));
  const field = form.getTextField('notes');
  assert.equal(field.isMultiline(), true);
  assert.equal(field.getMaxLength(), 10);
  assert.equal(field.isReadOnly(), true);
  assert.equal(field.getText(), 'hello');
});

await test('appearance options are accepted (colors/border ride into the widget)', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      children: [
        TextField('styled', {
          fontSize: 12,
          textColor: '#1F2937',
          backgroundColor: '#F9FAFB',
          borderColor: '#9CA3AF',
          borderWidth: 1,
        }),
      ],
    })],
  }));
  const widget = form.getTextField('styled').acroField.getWidgets()[0];
  const characteristics = widget.getAppearanceCharacteristics();
  // pdf-lib stores background (BG) and border (BC) colors on the widget's MK dict.
  assert.ok(characteristics, 'appearance characteristics (MK) present');
  assert.ok(characteristics.getBackgroundColor(), 'background color stored');
  assert.ok(characteristics.getBorderColor(), 'border color stored');
});

// --- placement ------------------------------------------------------------------

await test('fields are placed at their layout box in PDF coordinates', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      dimensions: [300, 400],
      padding: 48,
      children: [TextField('field', { height: 24 })],
    })],
  }));
  const rect = form.getTextField('field').acroField.getWidgets()[0].getRectangle();
  // Yoga box: x=48, top=48, height=24, width=300-96 (stretch). PDF Y-flip:
  // y = 400 - 48 - 24 = 328 (bottom-left origin). pdf-lib's widget rect
  // straddles the box edge by borderWidth/2 (default 1pt border): ±0.5.
  const round = (n) => Math.round(n * 100) / 100;
  assert.deepEqual(
    [rect.x, rect.y, rect.width, rect.height].map(round),
    [47.5, 327.5, 205, 25],
  );
});

await test('fields keep a usable width inside shrink-wrapping Columns', async () => {
  // Column defaults to alignItems: flex-start — a bare percent-width field
  // resolves against the shrink-wrapped parent and collapses to zero (the
  // invisible-field bug). The default style carries a 120pt floor; the
  // documented fix is a `width: '100%'` wrapper (or a stretching parent).
  const form = await formOf(new PdfDoc({
    children: [Page({
      dimensions: [300, 400],
      padding: 48,
      children: [
        Column({
          gap: 16,
          children: [
            // Bare wrapper inside a shrink-wrapping Column: the wrapper wraps
            // to the label; the floor keeps the field at 120 (rect straddles
            // by the 1pt default border → 121).
            Column({ gap: 4, children: [Text('EMAIL', { size: 9 }), TextField('nested')] }),
            // The documented convention: a width-'100%' wrapper fills the
            // stretching outer Column, and the field fills the wrapper.
            Column({ gap: 4, width: '100%', children: [TextField('wrapped')] }),
          ],
        }),
        // Direct child of Page (alignItems: stretch): fills the content box.
        TextField('direct'),
      ],
    })],
  }));
  const rectOf = (name) => form.getTextField(name).acroField.getWidgets()[0].getRectangle();
  const round = (n) => Math.round(n * 100) / 100;
  assert.equal(round(rectOf('nested').width), 121);
  assert.equal(round(rectOf('wrapped').width), 205);
  assert.equal(round(rectOf('direct').width), 205);
});

// --- failure modes ---------------------------------------------------------------

await test('duplicate field names fail at save (pdf-lib honest error)', async () => {
  await assert.rejects(
    new PdfDoc({ children: [Page({ children: [TextField('dup'), TextField('dup')] })] }).save(),
    /already exists/,
  );
});

await test('form widgets require a non-empty name', () => {
  assert.throws(() => TextField('   '), /non-empty `name`/);
});

await test('dropdown requires a non-empty options array', () => {
  assert.throws(() => Dropdown('pick', { options: [] }), /non-empty `options`/);
});

await test('form widgets refuse a non-PDF render context', async () => {
  const widget = TextField('x');
  const stub = { getTheme: () => undefined };
  widget.setContext(stub);
  await assert.rejects(widget.render(stub), /requires the PDF render context/);
});

// --- save lifecycle ---------------------------------------------------------------

await test('a second save recreates the fields in the fresh document', async () => {
  const doc = new PdfDoc({
    children: [Page({ children: [TextField('again', { value: 'v1' })] })],
  });
  const first = await PDFDocument.load(await doc.save());
  const second = await PDFDocument.load(await doc.save());
  assert.equal(first.getForm().getTextField('again').getText(), 'v1');
  assert.equal(second.getForm().getTextField('again').getText(), 'v1');
});

// --- composite fields ------------------------------------------------------------

await test('radio group: children add options at their own boxes, value selects', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      padding: 48,
      children: [
        RadioGroup('plan', {
          value: 'pro',
          children: [Radio('basic'), Radio('pro')],
        }),
      ],
    })],
  }));
  const group = form.getRadioGroup('plan');
  assert.deepEqual(group.getOptions(), ['basic', 'pro']);
  assert.equal(group.getSelected(), 'pro');
  // One widget annotation per option.
  assert.equal(group.acroField.getWidgets().length, 2);
});

await test('radios nested in Rows still reach their group (parent-chain walk)', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({
      padding: 48,
      children: [
        RadioGroup('choice', {
          children: [
            Row({ children: [Radio('yes'), Text('Yes')] }),
            Row({ children: [Radio('no'), Text('No')] }),
          ],
        }),
      ],
    })],
  }));
  assert.deepEqual(form.getRadioGroup('choice').getOptions(), ['yes', 'no']);
});

await test('a Radio outside any RadioGroup fails honestly at save', async () => {
  await assert.rejects(
    new PdfDoc({ children: [Page({ children: [Radio('orphan')] })] }).save(),
    /Radio must be placed inside a RadioGroup/,
  );
});

await test('button: field exists with its caption on the face', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({ children: [Button('submit', { label: 'Submit' })] })],
  }));
  const widget = form.getButton('submit').acroField.getWidgets()[0];
  assert.equal(widget.getAppearanceCharacteristics()?.getCaptions()?.normal, 'Submit');
});

await test('signature is visual only: it draws but creates no form field', async () => {
  const form = await formOf(new PdfDoc({
    children: [Page({ children: [Signature({ label: 'Signed by' })] })],
  }));
  assert.equal(form.getFields().length, 0);
});

// --- pagination ------------------------------------------------------------------

await test('form fields are atomic: they move whole to the next page', async () => {
  const filler = Array.from({ length: 45 }, (_, i) => Text(`Filler line ${i}`, { size: 14 }));
  const doc = new PdfDoc({
    children: [Page({
      padding: 48,
      children: [
        ...filler,
        TextField('late-field'),
        RadioGroup('late-plan', { children: [Radio('a'), Radio('b')] }),
      ],
    })],
  });
  const bytes = await doc.save();
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);

  const pageTwo = pdf.getPage(1).ref.objectNumber;
  const onPage = (field) =>
    field.acroField.getWidgets().every((widget) => widget.P().objectNumber === pageTwo);
  assert.ok(onPage(pdf.getForm().getTextField('late-field')), 'text field landed on page 2');
  assert.ok(onPage(pdf.getForm().getRadioGroup('late-plan')), 'every radio option landed on page 2');
});

// --- data binding ----------------------------------------------------------------

await test('formData binds by field name and wins over widget values', async () => {
  const form = await formOf(new PdfDoc({
    formData: { 'full-name': 'Grace Hopper', consent: false, plan: 'Basic' },
    children: [Page({
      padding: 48,
      children: [
        TextField('full-name', { value: 'Ada Lovelace' }),
        CheckBox('consent', { checked: true }),
        Dropdown('plan', { options: ['Basic', 'Pro'] }),
        RadioGroup('tier', { value: 'a', children: [Radio('a'), Radio('b')] }),
      ],
    })],
  }));
  assert.equal(form.getTextField('full-name').getText(), 'Grace Hopper');
  assert.equal(form.getCheckBox('consent').isChecked(), false);
  assert.deepEqual(form.getDropdown('plan').getSelected(), ['Basic']);
  // 'tier' is absent from formData — the widget's own value survives.
  assert.equal(form.getRadioGroup('tier').getSelected(), 'a');
});

await test('type mismatches throw at construction', () => {
  assert.throws(
    () => new PdfDoc({
      formData: { 'full-name': true },
      children: [Page({ children: [TextField('full-name')] })],
    }),
    /expects a string formData value/,
  );
  assert.throws(
    () => new PdfDoc({
      formData: { consent: 'yes' },
      children: [Page({ children: [CheckBox('consent')] })],
    }),
    /expects a boolean formData value/,
  );
});

await test('binding a value to a Button throws (buttons carry no value)', () => {
  assert.throws(
    () => new PdfDoc({
      formData: { submit: 'go' },
      children: [Page({ children: [Button('submit')] })],
    }),
    /no value to bind/,
  );
});

await test('dropdown binding validates against the declared options', () => {
  assert.throws(
    () => new PdfDoc({
      formData: { plan: 'Enterprise' },
      children: [Page({ children: [Dropdown('plan', { options: ['Basic', 'Pro'] })] })],
    }),
    /not one of the declared options/,
  );
});

await test('dropdown constructor value must be a declared option (no silent combo box)', () => {
  assert.throws(
    () => Dropdown('plan', { options: ['Basic'], value: 'Nope' }),
    /not one of the declared options/,
  );
});

await test('radio group bound value must match a Radio child (fails at save)', async () => {
  await assert.rejects(
    new PdfDoc({
      formData: { tier: 'gold' },
      children: [Page({ children: [RadioGroup('tier', { children: [Radio('a')] })] })],
    }).save(),
    /not one of its Radio children/,
  );
});

await test('unknown formData keys warn with the offending names', () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    new PdfDoc({
      formData: { nobody: 'x' },
      children: [Page({ children: [TextField('known')] })],
    });
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no form field matches "nobody"/);
});

await test('one tree-builder, two datasets: binding produces filled variants', async () => {
  const buildForm = (data) => new PdfDoc({
    formData: data,
    children: [Page({
      padding: 48,
      children: [
        TextField('applicant'),
        CheckBox('approved', { checked: false }),
      ],
    })],
  });
  const first = await PDFDocument.load(await buildForm({ applicant: 'Ada', approved: true }).save());
  const second = await PDFDocument.load(await buildForm({ applicant: 'Grace', approved: false }).save());
  assert.equal(first.getForm().getTextField('applicant').getText(), 'Ada');
  assert.equal(first.getForm().getCheckBox('approved').isChecked(), true);
  assert.equal(second.getForm().getTextField('applicant').getText(), 'Grace');
  assert.equal(second.getForm().getCheckBox('approved').isChecked(), false);
});

console.log(`\nforms.test.mjs: ${passed} passed`);
