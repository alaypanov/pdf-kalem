import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const root = fileURLToPath(new URL('../', import.meta.url));
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const section = readme.split('## Your first PDF\n')[1]?.split('\n## ')[0];
const source = section?.match(/```js\n([\s\S]*?)\n```/)?.[1];
assert.ok(source, 'README must contain an executable first-PDF example');

const directory = await mkdtemp(join(tmpdir(), 'pdf-kalem-readme-'));
try {
  // Evaluate inside the package scope so the documented public imports resolve.
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `process.chdir(process.env.README_OUTPUT_DIR);\n${source}`], {
    cwd: root,
    env: { ...process.env, README_OUTPUT_DIR: directory },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const bytes = await readFile(join(directory, 'hello.pdf'));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  console.log('README quick start writes a readable one-page PDF');
} finally {

  await rm(directory, { recursive: true, force: true });
}
