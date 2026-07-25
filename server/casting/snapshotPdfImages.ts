import { VIEW_TO_PDF_KEY, type PdfImageKey } from "../../shared/exportViews";
import type { CanonicalViewAngle } from "../../shared/boardTypes";
import { fetchTrustedImage } from "../security/trustedImageFetch";

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

async function trustedImageDataUrl(url: string): Promise<string> {
  try {
    const image = await fetchTrustedImage(url, {
      maxBytes: MAX_PDF_IMAGE_BYTES,
    });
    return `data:${image.mime};base64,${image.bytes.toString("base64")}`;
  } catch {
    throw new SnapshotPdfImageError();
  }
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
