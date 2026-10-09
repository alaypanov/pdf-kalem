/**
 * Image format sniffing from magic bytes. pdf-lib can embed png/jpeg only;
 * other formats are reported as unsupported.
 */

/** Returns the embeddable format of `bytes`, or undefined when unsupported. */
export function sniffImageFormat(bytes: ArrayBuffer | Uint8Array): 'png' | 'jpeg' | undefined {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length >= 8 && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
    return 'png';
  }
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'jpeg';
  }
  return undefined;
}
