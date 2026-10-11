/**
 * Image-format sniffing from magic bytes — the shared home (I13). Used by
 * the markdown renderer for fetched images and by `Image` for file/byte
 * sources whose declared format can't be trusted.
 */
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
