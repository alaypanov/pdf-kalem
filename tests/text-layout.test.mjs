import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { TextLayoutEngine, Text, Page } from '../dist/widgets.js';
import { PdfDoc, useFonts } from '../dist/index.js';

const config = (text, overrides = {}) => ({
  text, size: 10, lineHeight: 10, ascent: 8, align: 'left',
  whiteSpace: 'normal', overflow: 'visible',
  measureTextWidth: (value) => Array.from(value).length * 6,
  ...overrides,
});
const engine = (text, overrides) => new TextLayoutEngine(config(text, overrides));
const plainLines = (result) => result.lines.map(({ text, width }) => ({ text, width }));
const texts = (result) => result.lines.map((line) => line.text);

// B22: pending text must count even before a piece has been committed.
for (const runs of [
  [{ text: 'abcdefghij', fontName: 'regular' }],
  [{ text: 'ab', fontName: 'regular' }, { text: 'cdefghij', fontName: 'bold' }],
]) {
  const measureRunWidth = (value, font) => value.length * (font === 'bold' ? 7 : 6);
  const result = engine('', { runs, measureRunWidth }).layoutText(20);
  assert.equal(result.lines.map((line) => line.text).join(''), 'abcdefghij');
  assert.ok(result.lines.every((line) => line.width <= 20));
  for (const line of result.lines) {
    assert.equal(line.width, line.fragments.reduce((sum, fragment) => sum + fragment.width, 0));
    for (const fragment of line.fragments) {
      assert.equal(fragment.width, measureRunWidth(fragment.text, runs[fragment.runIndex].fontName));
    }
  }
}
assert.deepEqual(texts(engine('abcdefghij').layoutText(18)), ['abc', 'def', 'ghi', 'j']);
assert.deepEqual(texts(engine('abcdefghij').layoutText(1)), Array.from('abcdefghij'));
assert.deepEqual(texts(engine('a👩‍💻b', { measureTextWidth: (s) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length * 6 }).layoutText(6)), ['a', '👩‍💻', 'b']);

// B31: preserve indentation, tabs (eight spaces), blank lines, and edge spaces.
const pre = '  a\t b  \r\n\t\n\n  c\n';
assert.deepEqual(texts(engine(pre, { whiteSpace: 'pre-wrap' }).layoutText(200)), [
  '  a         b  ', '        ', '', '  c', '',
]);
const indented = engine('    abc', { whiteSpace: 'pre-wrap' }).layoutText(18);
assert.equal(texts(indented).join(''), '    abc');
assert.ok(indented.lines.every((line) => line.width <= 18));

const splitWhitespace = engine('', {
  whiteSpace: 'pre-wrap',
  runs: [{ text: '  a ', fontName: 'regular' }, { text: '\t b\n  c  ', fontName: 'regular' }],
  measureRunWidth: config('').measureTextWidth,
}).layoutText(200);
assert.deepEqual(texts(splitWhitespace), ['  a          b', '  c  ']);
assert.deepEqual(texts(engine('aa bb cc', { overflow: 'clip' }).layoutText(18, 1)), ['aa']);
assert.deepEqual(texts(engine('aa bb cc', { overflow: 'visible' }).layoutText(18, 1)), ['aa', 'bb', 'cc']);

// Plain and single-run text share normalization, wrapping and truncation.
for (const text of ['', '  aa\tbb  ', 'abcdefghijk z', 'a\r\nb\rc\n', pre, '漢字かな한글']) {
  for (const whiteSpace of ['normal', 'pre-wrap']) {
    for (const width of [0, 5, 18, 60, Infinity]) {
      for (const overflow of ['visible', 'clip', 'ellipsis']) {
        const options = { whiteSpace, overflow, maxLines: 2 };
        const plain = engine(text, options);
        const rich = engine(text, {
          ...options, runs: [{ text, fontName: 'regular' }],
          measureRunWidth: config('').measureTextWidth,
        });
        assert.equal(plain.getNaturalWidth(), rich.getNaturalWidth());
        const result = plain.layoutText(width, 1);
        assert.deepEqual(result.lines, plainLines(rich.layoutText(width, 1)));
        assert.ok(result.lines.every((line) => !('fragments' in line)));
        assert.equal(result.maxLineWidth, Math.max(0, ...result.lines.map((line) => line.width)));
      }
    }
  }
}
assert.deepEqual(texts(engine('abc def ghi', { maxLines: 1, overflow: 'ellipsis' }).layoutText(24)), ['abc…']);
assert.deepEqual(engine('abc def', { maxLines: 0 }).layoutText(24).lines, []);
assert.equal(engine('a\nbbbb').getNaturalWidth(), 24);
assert.equal(engine('  a  ').getNaturalWidth(), 6);

// Width decisions and emitted fragments must measure the actual painted string,
// not a sum of separately measured words/spaces (non-additive font metrics).
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const measure = (value) => font.widthOfTextAtSize(value, 10);
for (const text of ['AV To AV To', 'a longwordwithoutspaces follows', '  AV  To\nshort']) {
  const plain = engine(text, { measureTextWidth: measure });
  const rich = engine(text, {
    runs: [{ text, fontName: 'Helvetica' }], measureRunWidth: measure,
  });
  const width = measure('AV To');
  assert.deepEqual(plain.layoutText(width).lines, plainLines(rich.layoutText(width)));
  for (const line of plain.layoutText(width).lines) {
    assert.equal(line.width, measure(line.text));
    assert.ok(line.width <= width);
  }
}

const nonAdditive = (value) => value.length * 6 - (value.includes('a b') ? 3 : 0) - (value.endsWith('a…') ? 2 : 0);
assert.deepEqual(engine('a b', { measureTextWidth: nonAdditive }).layoutText(15).lines, [{ text: 'a b', width: 15 }]);
assert.deepEqual(engine('aa bb', { measureTextWidth: nonAdditive, maxLines: 1, overflow: 'ellipsis' }).layoutText(10).lines, [{ text: 'a…', width: 10 }]);

// Browser-like globals must never select canvas metrics or await FontFace loading.
const inter = await readFile(new URL('../examples/fonts/Inter-Regular.ttf', import.meta.url));
const fonts = await useFonts({ body: 'inter' }, { files: { inter } });
const descriptors = new Map(['document', 'OffscreenCanvas', 'FontFace'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let browserFontLoads = 0;
try {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement() { throw new Error('canvas must not be used'); },
    fonts: { load() { throw new Error('browser fonts must not be required'); } },
  } });
  Object.defineProperty(globalThis, 'OffscreenCanvas', { configurable: true, value: class {
    constructor() { throw new Error('canvas must not be used'); }
  } });
  Object.defineProperty(globalThis, 'FontFace', { configurable: true, value: class {
    constructor() { browserFontLoads++; }
  } });
  assert.deepEqual(texts(engine('abcdef').layoutText(18)), ['abc', 'def']);
  await new PdfDoc({
    fonts,
    children: [Page({ children: [Text('PDF metrics', { font: 'body' }), Text([{ text: 'PDF metrics', font: 'body' }])] })],
  }).save();
  assert.equal(browserFontLoads, 0, 'embedding a custom font must not register a browser FontFace');
} finally {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
console.log('text layout regressions passed');
