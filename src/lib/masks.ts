// Embedded PNG masks from GeminiRef - exact byte-for-byte copy of the calibrated masks
// These are decoded and converted to alpha maps at runtime

// 48x48 mask PNG (1677 bytes) - for images where width OR height <= 1024
export const MASK_48_PNG_BASE64 =
  "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";

// 96x96 mask PNG (8165 bytes) - for images where BOTH width AND height > 1024
export const MASK_96_PNG_BASE64 =
  "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";

// Constants for the algorithm (matching GeminiRef exactly)
export const LOGO_VALUE = 255.0; // White watermark
export const ALPHA_THRESHOLD = 0.002; // Skip near-zero alpha
export const MAX_ALPHA = 0.99; // Avoid division by zero

/**
 * Decode a base64 PNG and calculate the alpha map from it.
 * This matches the C++ calculate_alpha_map function:
 *   alpha = max(R, G, B) / 255
 */
export async function loadAlphaMapFromPNG(
  base64: string,
): Promise<{ alphaMap: Float32Array; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      // Calculate alpha map: alpha = max(R, G, B) / 255
      const alphaMap = new Float32Array(img.width * img.height);
      for (let i = 0; i < alphaMap.length; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Use max of RGB channels for brightness
        const maxVal = Math.max(r, g, b);
        alphaMap[i] = maxVal / 255.0;
      }

      resolve({ alphaMap, size: img.width });
    };
    img.onerror = () => reject(new Error("Failed to load PNG"));
    img.src = "data:image/png;base64," + base64;
  });
}

// Cached alpha maps (loaded on first use)
let cachedAlphaMap48: Float32Array | null = null;
let cachedAlphaMap96: Float32Array | null = null;

export async function getAlphaMap48(): Promise<Float32Array> {
  if (!cachedAlphaMap48) {
    const result = await loadAlphaMapFromPNG(MASK_48_PNG_BASE64);
    cachedAlphaMap48 = result.alphaMap;
  }
  return cachedAlphaMap48;
}

export async function getAlphaMap96(): Promise<Float32Array> {
  if (!cachedAlphaMap96) {
    const result = await loadAlphaMapFromPNG(MASK_96_PNG_BASE64);
    cachedAlphaMap96 = result.alphaMap;
  }
  return cachedAlphaMap96;
}
