/**
 * Image compression utility for client-side image processing
 * Used by Dashboard and ProfileSettingsModal for avatar/banner uploads
 */

export interface CompressedImage {
  base64: string;
  mimeType: string;
  size: number;
}

/**
 * Compress an image file to specified dimensions and quality
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - JPEG quality (0-1), defaults to 0.85
 * @returns Promise with base64 data, mime type, and size
 */
export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.85
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale down if needed while maintaining aspect ratio
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(",")[1];
      // Calculate approximate size from base64 length
      const size = Math.ceil((base64.length * 3) / 4);

      // Revoke the object URL to free memory
      URL.revokeObjectURL(img.src);

      resolve({ base64, mimeType, size });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Compression presets
export const AVATAR_COMPRESSION = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.85,
};

export const BANNER_COMPRESSION = {
  maxWidth: 1920,
  maxHeight: 600,
  quality: 0.85,
};
