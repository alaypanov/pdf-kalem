/**
 * Output-adapter tests: the byte → destination seam (ARCHITECTURE.md #7),
 * exercised directly — no document model needed for the mechanics.
 *
 * Node covers the Node paths (buffer, file) and the browser paths' guards;
 * the browser mechanics themselves (download anchor, print iframe) need a
 * DOM and stay covered by the playgrounds.
 *
 * Run: node tests/doc-output.test.mjs (after `pnpm build`).
 */
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { toBlob, toBuffer, writeBytesToFile, downloadBytes, printBytes } from '../dist/internals.js';
import { PdfDoc } from '../dist/index.js';

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]); // "%PDF" + payload

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('toBuffer copies the bytes into a Node Buffer', async () => {
  const buffer = toBuffer(bytes);
  assert.ok(Buffer.isBuffer(buffer), 'expected a real Buffer');
  assert.deepEqual(Uint8Array.from(buffer), bytes);
});

test('writeBytesToFile writes the bytes to disk', async () => {
  const path = join(tmpdir(), `pdf-kalem-doc-output-${Date.now()}.pdf`);
  try {
    await writeBytesToFile(bytes, path);
    const read = await readFile(path);
    assert.deepEqual(Uint8Array.from(read), bytes);
  } finally {
    await rm(path, { force: true });
  }
});

test('toBlob wraps the bytes in an application/pdf Blob', async () => {
  const blob = toBlob(bytes);
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  assert.equal(blob.size, bytes.length);
});

test('browser-only adapters throw a branded error outside the browser', () => {
  assert.throws(() => downloadBytes(bytes, 'x.pdf'), /PdfDoc\.download is only available in browser-like runtimes/);
  assert.throws(() => printBytes(bytes), /PdfDoc\.print is only available in browser-like runtimes/);
});

test('PdfDoc.writeToFile guards the path before doing any work', async () => {
  const doc = new PdfDoc({});
  await assert.rejects(doc.writeToFile('  '), /requires a file path/);
});

test('end to end: a saved document round-trips through writeBytesToFile', async () => {
  const { Page, Text } = await import('../dist/widgets.js');
  const doc = new PdfDoc({ children: [Page({ dimensions: [300, 200], children: [Text('round trip')] })] });
  const path = join(tmpdir(), `pdf-kalem-doc-output-e2e-${Date.now()}.pdf`);
  try {
    await writeBytesToFile(await doc.save(), path);
    const read = await readFile(path);
    assert.deepEqual([...read.slice(0, 4)], [0x25, 0x50, 0x44, 0x46], 'file starts with the PDF magic bytes');
  } finally {
    await rm(path, { force: true });
  }
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`ok - ${name}`);
}
console.log(`${tests.length} tests passed`);
