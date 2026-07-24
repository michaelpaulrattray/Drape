import { VIEW_TO_PDF_KEY, type PdfImageKey } from "../../shared/exportViews";
import type { CanonicalViewAngle } from "../../shared/boardTypes";
import { validateProxyUrl } from "../security/urlValidator";

const MAX_PDF_IMAGE_BYTES = 20 * 1024 * 1024;

export class SnapshotPdfImageError extends Error {
  constructor() {
    super("The selected Cast images could not be prepared for export.");
    this.name = "SnapshotPdfImageError";
  }
}

type SnapshotPdfView = {
  angle: CanonicalViewAngle;
  asset: { storageUrl: string | null };
};

function supportedImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6
    && (
      bytes.subarray(0, 6).toString("ascii") === "GIF87a"
      || bytes.subarray(0, 6).toString("ascii") === "GIF89a"
    )
  ) {
    return "image/gif";
  }
  return null;
}

async function readBoundedImage(response: Response): Promise<Buffer> {
  if (!response.body) throw new SnapshotPdfImageError();
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PDF_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SnapshotPdfImageError();
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof SnapshotPdfImageError) throw error;
    throw new SnapshotPdfImageError();
  } finally {
    reader.releaseLock();
  }
  if (length === 0) throw new SnapshotPdfImageError();
  return Buffer.concat(chunks, length);
}

async function trustedImageDataUrl(url: string): Promise<string> {
  if (!validateProxyUrl(url).valid) throw new SnapshotPdfImageError();

  let response: Response;
  try {
    response = await fetch(url, { redirect: "error" });
  } catch {
    throw new SnapshotPdfImageError();
  }
  if (!response.ok) throw new SnapshotPdfImageError();

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType?.startsWith("image/")) throw new SnapshotPdfImageError();
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_IMAGE_BYTES) {
    throw new SnapshotPdfImageError();
  }

  const bytes = await readBoundedImage(response);
  const verifiedMime = supportedImageMime(bytes);
  if (!verifiedMime) throw new SnapshotPdfImageError();
  return `data:${verifiedMime};base64,${bytes.toString("base64")}`;
}

/**
 * Resolve the official PDF image manifest from snapshot-selected views only.
 * Client-submitted image fields never enter this function.
 */
export async function resolveSnapshotPdfImages(
  views: readonly SnapshotPdfView[],
): Promise<Partial<Record<PdfImageKey, string>>> {
  const entries = await Promise.all(views.map(async (view) => {
    if (!view.asset.storageUrl) throw new SnapshotPdfImageError();
    return [
      VIEW_TO_PDF_KEY[view.angle],
      await trustedImageDataUrl(view.asset.storageUrl),
    ] as const;
  }));
  return Object.fromEntries(entries);
}
