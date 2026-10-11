/**
 * Output adapters: PDF bytes → runtime destination (ARCHITECTURE.md #7).
 *
 * Extracted from `PdfDoc` so the document model stays free of runtime
 * sniffing — these functions are the explicit seam where browser and Node
 * differ. `PdfDoc`'s convenience methods delegate here; the public interface
 * is unchanged.
 *
 * Browser-only paths (`toBlob`, `downloadBytes`, `printBytes`) guard on the
 * globals they need and throw a branded error elsewhere. Node paths load
 * `node:fs/promises` lazily via `new Function` so bundlers don't pull it
 * into browser builds.
 */

export type NodeBufferLike = Uint8Array;
type NodeFsLike = {
  writeFile(path: string, data: NodeBufferLike): Promise<void>;
};

function getNodeBufferFactory(): { from(data: Uint8Array): NodeBufferLike } | undefined {
  const maybeBuffer = (globalThis as typeof globalThis & {
    Buffer?: { from(data: Uint8Array): NodeBufferLike };
  }).Buffer;

  if (!maybeBuffer || typeof maybeBuffer.from !== 'function') {
    return undefined;
  }

  return maybeBuffer;
}

async function getNodeFs(): Promise<NodeFsLike> {
  try {
    const loadFs = new Function("return import('node:fs/promises')") as () => Promise<NodeFsLike>;
    return await loadFs();
  } catch (err) {
    throw new Error('node:fs/promises is not available in this runtime', { cause: err });
  }
}

/** Wraps the bytes in a `Blob` (`application/pdf`). Browser-like runtimes. */
export function toBlob(bytes: Uint8Array): Blob {
  if (typeof Blob === 'undefined') {
    throw new Error('Blob is not available in this runtime');
  }

  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/** Triggers a browser download of the bytes. Browser-like runtimes only. */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('PdfDoc.download is only available in browser-like runtimes');
  }

  const blob = toBlob(bytes);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Opens the browser's print dialog with the PDF: the bytes are loaded into a
 * hidden iframe and the iframe's print is triggered once it finishes loading.
 * Browser-like runtimes only.
 *
 * Known limitation: Safari's PDF viewer doesn't support programmatic
 * printing — the dialog may print blank there. Downloading and printing
 * manually is the reliable fallback.
 */
export function printBytes(bytes: Uint8Array): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('PdfDoc.print is only available in browser-like runtimes');
  }

  const blob = toBlob(bytes);
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  // afterprint fires when the dialog closes (Chrome/Firefox). Browsers
  // that never fire it fall back to the timeout below.
  iframe.addEventListener('load', () => {
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    // A deferred call — some engines aren't ready to print inside the
    // load event itself.
    setTimeout(() => iframe.contentWindow?.print(), 0);
    // Fallback cleanup if afterprint never fires.
    setTimeout(cleanup, 60_000);
  });

  iframe.src = url;
  document.body.appendChild(iframe);
}

/** Copies the bytes into a Node `Buffer`. Node runtimes only. */
export function toBuffer(bytes: Uint8Array): NodeBufferLike {
  const bufferFactory = getNodeBufferFactory();
  if (!bufferFactory) {
    throw new Error('Node Buffer is not available in this runtime');
  }

  return bufferFactory.from(bytes);
}

/** Writes the bytes to `filePath` via `node:fs/promises`. Node runtimes only. */
export async function writeBytesToFile(bytes: Uint8Array, filePath: string): Promise<void> {
  const fsModule = await getNodeFs();
  const buffer = toBuffer(bytes);
  await fsModule.writeFile(filePath, buffer);
}
