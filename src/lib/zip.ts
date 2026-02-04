/**
 * ZIP file utilities for batch downloads
 */

import JSZip from "jszip";

export interface ZipFile {
  name: string;
  dataUrl: string;
}

/**
 * Convert a data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Create a ZIP file from multiple images
 */
export async function createZip(files: ZipFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    const blob = dataUrlToBlob(file.dataUrl);
    zip.file(file.name, blob);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Download a ZIP blob
 */
export function downloadZip(
  blob: Blob,
  filename: string = "processed_images.zip",
): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Create and download a ZIP file in one step
 */
export async function downloadAsZip(
  files: ZipFile[],
  filename?: string,
): Promise<void> {
  const blob = await createZip(files);
  downloadZip(blob, filename);
}
