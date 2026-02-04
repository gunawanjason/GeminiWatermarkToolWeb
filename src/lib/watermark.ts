import {
  getAlphaMap48,
  getAlphaMap96,
  LOGO_VALUE,
  ALPHA_THRESHOLD,
  MAX_ALPHA,
} from "./masks";

export type WatermarkSize = "small" | "large";

export interface WatermarkConfig {
  size: number;
  margin: number;
}

/**
 * Determine watermark size based on image dimensions
 * Large (96x96) only when BOTH dimensions > 1024
 */
export function getWatermarkSize(width: number, height: number): WatermarkSize {
  if (width > 1024 && height > 1024) {
    return "large";
  }
  return "small";
}

/**
 * Get watermark configuration for a given size
 */
export function getWatermarkConfig(size: WatermarkSize): WatermarkConfig {
  if (size === "large") {
    return { size: 96, margin: 64 };
  }
  return { size: 48, margin: 32 };
}

/**
 * Get alpha map for a given size
 */
export async function getAlphaMap(size: WatermarkSize): Promise<Float32Array> {
  if (size === "large") {
    return getAlphaMap96();
  }
  return getAlphaMap48();
}

/**
 * Calculate watermark position (bottom-right corner)
 */
export function getWatermarkPosition(
  imageWidth: number,
  imageHeight: number,
  config: WatermarkConfig,
): { x: number; y: number } {
  return {
    x: imageWidth - config.margin - config.size,
    y: imageHeight - config.margin - config.size,
  };
}

/**
 * Remove watermark from image using reverse alpha blending
 *
 * The algorithm reverses Gemini's blending formula:
 *   watermarked = alpha * logo + (1 - alpha) * original
 *
 * To recover the original:
 *   original = (watermarked - alpha * logo) / (1 - alpha)
 *
 * This is a direct port of the C++ remove_watermark_alpha_blend function
 */
export function removeWatermark(
  imageData: ImageData,
  alphaMap: Float32Array,
  mapSize: number,
  x: number,
  y: number,
): void {
  const { width, data } = imageData;

  // Clamp region to image bounds
  const x1 = Math.max(0, x);
  const y1 = Math.max(0, y);
  const x2 = Math.min(imageData.width, x + mapSize);
  const y2 = Math.min(imageData.height, y + mapSize);

  if (x1 >= x2 || y1 >= y2) return;

  for (let row = y1; row < y2; row++) {
    for (let col = x1; col < x2; col++) {
      // Get alpha value from map
      const mapRow = row - y;
      const mapCol = col - x;
      const alpha = alphaMap[mapRow * mapSize + mapCol];

      // Skip pixels with negligible watermark effect
      if (alpha < ALPHA_THRESHOLD) continue;

      // Clamp alpha to avoid division issues
      const clampedAlpha = Math.min(alpha, MAX_ALPHA);
      const oneMinusAlpha = 1.0 - clampedAlpha;

      // Calculate pixel index in ImageData (RGBA format)
      const idx = (row * width + col) * 4;

      // Apply reverse blending for RGB channels
      for (let c = 0; c < 3; c++) {
        const watermarked = data[idx + c];
        const original =
          (watermarked - clampedAlpha * LOGO_VALUE) / oneMinusAlpha;
        data[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }
      // Alpha channel (idx + 3) remains unchanged
    }
  }
}

/**
 * Process an image to remove the Gemini watermark
 */
export async function processImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  forceSize?: WatermarkSize,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Set canvas size to match image
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  // Draw image to canvas
  ctx.drawImage(image, 0, 0);

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Determine watermark configuration
  const size = forceSize ?? getWatermarkSize(canvas.width, canvas.height);
  const config = getWatermarkConfig(size);
  const pos = getWatermarkPosition(canvas.width, canvas.height, config);

  // Get alpha map
  const alphaMap = await getAlphaMap(size);

  // Remove watermark
  removeWatermark(imageData, alphaMap, config.size, pos.x, pos.y);

  // Put processed image back
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Convert canvas to downloadable blob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/png",
  quality: number = 1.0,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      type,
      quality,
    );
  });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
