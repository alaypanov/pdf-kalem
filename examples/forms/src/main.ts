import { PageSize, PdfDoc } from 'pdf-kalem';
import { Column, Page, Row, Text, type Widget } from 'pdf-kalem/widgets';
import { Button, CheckBox, Dropdown, Radio, RadioGroup, Signature, TextField } from 'pdf-kalem/forms';
import { fromHex } from 'pdf-kalem/utils/color-utils';

// A registration form as a widget tree: fields are real AcroForm fields, so
// the saved PDF is fillable in any reader. The tree-builder + `formData` is
// the template+data pattern — one function, any number of filled variants.
// Run from this folder: node src/main.ts

const ink = fromHex('#1c1917');
const muted = fromHex('#78716c');
const label = fromHex('#44403c');

/** A labeled field: caption above, form widget below. width: '100%' —
 * Columns shrink-wrap their children by default, so the field's own '100%'
 * would resolve against the wrapped width and collapse. */
function labeledField(labelText: string, widget: Widget) {
  return Column({
    width: '100%',
    gap: 4,
    children: [
      Text(labelText, { size: 9, color: label }),
      widget,
    ],
  });
}

function applicationForm(data: Record<string, string | boolean> = {}): PdfDoc {
  return new PdfDoc({
    size: PageSize.LETTER,
    // Data binding: values land on the widgets by field name and win over
    // per-widget `value`/`checked` options.
    formData: data,
    meta: { title: 'Workshop registration' },
    children: [
      Page({
        padding: 48,
        children: [
          Column({
            gap: 16,
            children: [
              Text('Workshop registration', { size: 24, fontWeight: 700, color: ink }),
              Text(
                'The boxes are real AcroForm fields — open in any PDF reader, fill, and save.',
                { size: 10, color: muted },
              ),

              labeledField('FULL NAME', TextField('full-name', { height: 28 })),
              labeledField('EMAIL', TextField('email', { height: 28 })),
              labeledField(
                'COUNTRY',
                Dropdown('country', {
                  options: ['Germany', 'Kazakhstan', 'United Kingdom', 'United States'],
                  height: 28,
                }),
              ),

              Column({
                gap: 8,
                children: [
                  Text('PLAN', { size: 9, color: label }),
                  RadioGroup('plan', {
                    gap: 8,
                    children: [
                      Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('basic'), Text('Basic — free', { size: 10, color: ink })] }),
                      Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('pro'), Text('Pro — €120', { size: 10, color: ink })] }),
                    ],
                  }),
                ],
              }),

              Row({
                gap: 8,
                crossAxisAlignment: 'center',
                children: [
                  CheckBox('consent'),
                  Text('I agree to the code of conduct', { size: 10, color: ink }),
                ],
              }),

              Row({
                gap: 12,
                children: [
                  Button('submit', { label: 'Register', width: 140, height: 36, backgroundColor: fromHex('#b45309'), textColor: fromHex('#ffffff') }),
                  // Visual only — pdf-lib cannot create signature fields; this
                  // draws the signing line for a hand-signed printout.
                  Signature({ label: 'Signature', height: 40 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Blank template + one filled variant — same tree, different data.
await applicationForm().writeToFile('form-blank.pdf');
await applicationForm({
  'full-name': 'Ada Lovelace',
  email: 'ada@example.com',
  country: 'United Kingdom',
  plan: 'pro',
  consent: true,
}).writeToFile('form-filled.pdf');
console.log('Wrote form-blank.pdf and form-filled.pdf');
