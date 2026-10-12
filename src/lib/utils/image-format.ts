/**
 * Image-format sniffing from magic bytes — the shared home (I13). Used by
 * the markdown renderer for fetched images and by `Image` for file/byte
 * sources whose declared format can't be trusted.
 */
export function sniffImageFormat(bytes: ArrayBuffer | Uint8Array): 'png' | 'jpeg' | undefined {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // PNG also requires the IHDR chunk tag at bytes 12–16: a bare signature
  // followed by garbage (a truncated download) must not pass as a png and
  // blow up later at embed time (B20).
  if (
    view.length >= 16 &&
    view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47 &&
    view[12] === 0x49 && view[13] === 0x48 && view[14] === 0x44 && view[15] === 0x52
  ) {
    return 'png';
  }
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'jpeg';
  }
  return undefined;
}
