import assert from 'node:assert/strict';
import { PDFDocument, PDFDict, PDFName, decodePDFRawStream } from 'pdf-lib';
import { PdfDoc } from '../dist/index.js';
import { FixedContainer, Page, Row, Text } from '../dist/widgets.js';
import { Button, CheckBox, Dropdown, Radio, RadioGroup, TextField } from '../dist/forms.js';

function repeatedDoc(children, formData) {
  return new PdfDoc({ formData, children: [Page({
    dimensions: [300, 200], padding: 20,
    children: [
      FixedContainer({ top: 4, left: 20, children }),
      Text(Array.from({ length: 30 }, (_, i) => `Line ${i}`).join('\n'), { size: 12, lineHeight: 16 }),
    ],
  })] });
}

const doc = repeatedDoc([
  TextField('repeated', { value: 'initial', multiline: true, maxLength: 30, readOnly: true, fontSize: 9 }),
  CheckBox('checked', { readOnly: true }),
  CheckBox('off'),
  Dropdown('choice', { options: ['Basic', 'Pro'], readOnly: true }),
  RadioGroup('radio', { readOnly: true, children: [
    Row({ children: [Radio('basic')] }), Radio('pro'),
  ] }),
  Button('button', { label: 'Go', fontSize: 11, readOnly: true }),
], { repeated: 'bound', checked: true, choice: 'Pro', radio: 'pro' });

function checkSaved(pdf) {
  const count = pdf.getPageCount();
  assert.ok(count >= 3, 'the third placement exercises pdf-lib’s last matching export index');
  const form = pdf.getForm();
  assert.equal(form.getFields().length, 6);
  for (const field of form.getFields()) {
    const widgets = field.acroField.getWidgets();
    assert.equal(widgets.length, count * (field.getName() === 'radio' ? 2 : 1));
    assert.equal(field.isReadOnly(), field.getName() !== 'off');
    for (const widget of widgets) {
      const page = pdf.getPages().find((page) => page.ref === widget.P());
      assert.ok(page, 'annotation /P resolves to an output page');
      const annots = page.node.Annots().asArray();
      assert.ok(annots.some((ref) => pdf.context.lookup(ref) === widget.dict), 'page owns annotation');
      const rect = widget.getRectangle();
      assert.ok(rect.width > 0 && rect.height > 0);
      assert.deepEqual(rect, widgets[widgets.indexOf(widget) % (field.getName() === 'radio' ? 2 : 1)].getRectangle());
      assert.ok(widget.getAppearances()?.normal, 'saved appearance exists');
    }
  }
  for (const page of pdf.getPages()) assert.equal(page.node.Annots().size(), 7);
  const text = form.getTextField('repeated');
  assert.equal(text.getText(), 'bound');
  assert.equal(text.isMultiline(), true);
  assert.equal(text.getMaxLength(), 30);
  assert.deepEqual(form.getDropdown('choice').getOptions(), ['Basic', 'Pro']);
  assert.deepEqual(form.getDropdown('choice').getSelected(), ['Pro']);
  assert.equal(form.getDropdown('choice').isEditable(), false);
  for (const name of ['checked', 'off']) {
    const field = form.getCheckBox(name);
    assert.equal(field.isChecked(), name === 'checked');
    for (const widget of field.acroField.getWidgets()) {
      assert.equal(widget.getAppearanceState().toString(), name === 'checked' ? widget.getOnValue().toString() : '/Off');
    }
  }
  const radio = form.getRadioGroup('radio');
  assert.deepEqual(radio.getOptions(), Array.from({ length: count }, () => ['basic', 'pro']).flat());
  assert.equal(radio.isMutuallyExclusive(), false);
  function checkSelection(value, selectedIndex) {
    assert.equal(radio.getSelected(), value);
    const widgets = radio.acroField.getWidgets();
    for (const [i, widget] of widgets.entries()) {
      const on = widget.getOnValue();
      assert.equal(on, widgets[i % 2].getOnValue());
      assert.equal(widget.getAppearanceState().toString(), i % 2 === selectedIndex ? on.toString() : '/Off');
    }
  }
  checkSelection('pro', 1);
  radio.select('basic');
  checkSelection('basic', 0);
  for (const [field, size] of [[text, 9], [form.getButton('button'), 11]]) {
    for (const widget of field.acroField.getWidgets()) {
      const stream = pdf.context.lookup(widget.getAppearances().normal);
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString();
      assert.match(content, new RegExp(`/${'\\S+'} ${size} Tf`), 'font size preserved on every appearance');
      const fonts = stream.dict.lookup(PDFName.of('Resources'), PDFDict).lookup(PDFName.of('Font'), PDFDict);
      assert.ok(fonts.keys().length > 0);
      for (const key of fonts.keys()) assert.equal(fonts.lookup(key, PDFDict).get(PDFName.of('BaseFont')).toString(), '/Helvetica');
    }
  }
  for (const widget of form.getButton('button').acroField.getWidgets()) {
    assert.equal(widget.getAppearanceCharacteristics().getCaptions().normal, 'Go');
  }
}

const first = await PDFDocument.load(await doc.save());
checkSaved(first);
const second = await PDFDocument.load(await doc.save());
checkSaved(second);
first.getForm().getTextField('repeated').setText('changed');
assert.equal(second.getForm().getTextField('repeated').getText(), 'bound');
console.log('ok - repeated fixed fields preserve annotations, values, flags, appearances, and fresh saves');

// Distinct controls can share an export value. Keep their original on-states
// distinct, and preserve pdf-lib’s selection of the last matching option.
const duplicates = await PDFDocument.load(await repeatedDoc([
  RadioGroup('duplicates', { value: 'same', children: [Radio('same'), Radio('same')] }),
]).save());
const duplicateGroup = duplicates.getForm().getRadioGroup('duplicates');
assert.equal(duplicateGroup.getSelected(), 'same');
assert.deepEqual(duplicateGroup.getOptions(), Array(duplicates.getPageCount() * 2).fill('same'));
const duplicateOptions = duplicateGroup.acroField.getWidgets();
assert.notEqual(duplicateOptions[0].getOnValue(), duplicateOptions[1].getOnValue());
for (const [i, widget] of duplicateOptions.entries()) {
  assert.equal(widget.getOnValue(), duplicateOptions[i % 2].getOnValue());
  assert.equal(widget.getAppearanceState().toString(), i % 2 ? widget.getOnValue().toString() : '/Off');
}

const factories = [
  (name) => TextField(name), (name) => CheckBox(name),
  (name) => Dropdown(name, { options: ['one'] }),
  (name) => RadioGroup(name, { children: [Radio('one')] }), (name) => Button(name),
];
for (const create of factories) {
  await assert.rejects(repeatedDoc([create('duplicate'), create('duplicate')]).save(), /already exists/);
  await assert.rejects(new PdfDoc({ children: [Page({ children: [TextField('cross-type'), create('cross-type')] })] }).save(), /already exists/);
}
console.log('ok - distinct widgets still reject duplicate names, including cross-type collisions');
