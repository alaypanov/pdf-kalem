#!/usr/bin/env node
/**
 * Generates a base64 font module from a TTF/OTF file.
 *
 * Shipped fonts live as base64 TS modules (src/lib/fonts/files/) so they
 * resolve identically in Node and every bundler with zero loader config,
 * and tree-shake out when never requested (the manifest imports them
 * lazily). Regenerate or add fonts with:
 *
 *   node scripts/generate-font-module.mjs <input.ttf|otf> <output-name>
 *
 *   node scripts/generate-font-module.mjs public/fonts/Inter-Regular.ttf inter-regular
 *
 * The output module exports `FONT_TTF_BASE64`. Register the family in
 * `src/lib/fonts/shipped.ts` afterwards. Keep the font's license file
 * alongside the source TTF (public/fonts/).
 */
import fs from 'node:fs';
import path from 'node:path';

const [input, outputName] = process.argv.slice(2);

if (!input || !outputName) {
  console.error('usage: node scripts/generate-font-module.mjs <input.ttf|otf> <output-name>');
  process.exit(1);
}

const bytes = fs.readFileSync(input);
if (bytes.byteLength < 1000) {
  console.error(`generate-font-module: ${input} is suspiciously small (${bytes.byteLength} bytes)`);
  process.exit(1);
}

const magic = bytes.readUInt32BE(0);
if (![0x00010000, 0x4f54544f, 0x74727565].includes(magic)) {
  console.error(`generate-font-module: ${input} does not look like a TTF/OTF (magic 0x${magic.toString(16)})`);
  process.exit(1);
}

const base64 = Buffer.from(bytes).toString('base64');
const outPath = path.resolve('src/lib/fonts/files', `${outputName}.ts`);

const content = `// GENERATED FILE — do not edit by hand. Regenerate with:
//   node scripts/generate-font-module.mjs <input.ttf|otf> ${outputName}
export const FONT_TTF_BASE64 = ${JSON.stringify(base64)};
`;

fs.writeFileSync(outPath, content);
console.log(`written: ${outPath} (${content.length} bytes, font ${bytes.byteLength} bytes)`);
