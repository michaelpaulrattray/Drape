/**
 * Shared image actions for canvas surfaces (toolbar, context menu). All
 * fetches go through the same-origin image proxy — R2 bucket URLs are
 * cross-origin and CORS-less.
 */
import { toast } from "sonner";

/** Build a same-origin proxy URL to bypass CORS for stored images */
export function proxyUrl(originalUrl: string, download = false): string {
  const params = new URLSearchParams({ url: originalUrl });
  if (download) params.set("download", "1");
  return `/api/image-proxy?${params.toString()}`;
}

export async function downloadImage(url: string, filename: string) {
  try {
    // Use server proxy — sets Content-Disposition: attachment
    const a = document.createElement("a");
    a.href = proxyUrl(url, true);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, "_blank");
    toast.info("Opened image in new tab");
  }
}

export async function copyImageToClipboard(url: string) {
  try {
    // Fetch through our proxy (same-origin, no CORS issues)
    const res = await fetch(proxyUrl(url));
    if (!res.ok) throw new Error("Proxy fetch failed");
    const blob = await res.blob();
    // Convert to PNG for clipboard compatibility
    const pngBlob = blob.type === "image/png" ? blob : await convertToPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    toast.success("Image copied to clipboard");
  } catch {
    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image URL copied (image copy not supported in this browser)");
    } catch {
      toast.error("Failed to copy image");
    }
  }
}

function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("toBlob failed"));
      }, "image/png");
    };
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(blob);
  });
}
