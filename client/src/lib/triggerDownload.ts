/**
 * triggerDownload — Converts a base64 data URL to a Blob and triggers
 * a native browser download with the given filename.
 *
 * Use with the server-side proxyImage mutation to bypass CORS on S3 URLs.
 *
 * Usage:
 *   const proxy = await proxyImageMutation.mutateAsync({ imageUrl });
 *   triggerDownload(proxy.base64, "photo.png");
 */
export function triggerDownload(dataUrl: string, filename: string): void {
  // Split data URL into mime and base64 parts
  const [header, b64] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] || "application/octet-stream";

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
