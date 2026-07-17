/**
 * exportViews — the ONE canonical-six export mapping, shared by every export
 * surface (useCastingExport, useExportPack) so no hook can regress to an
 * era-0 trio map again (audit V3's last copy lived in useExportPack and
 * silently dropped three-quarter, walk, and back from the export-verb packs).
 *
 * Keys are CanonicalViewAngle; PDF keys are the generatePdf zod contract
 * (server/routes/generation/castingExport.ts) — a unit test asserts the two
 * never drift.
 */
import { CANONICAL_VIEW_ANGLES, type CanonicalViewAngle } from "./boardTypes";

/** The comp-card PRESENTATION order — face cluster (headshot, ¾, profile)
 *  then body (front, walk, back). This is the order ViewTabs renders
 *  (ViewTabs.tsx VIEWS) and the ZIP filenames are numbered in; it is NOT
 *  the CANONICAL_VIEW_ANGLES tuple order (that list puts frontFull before
 *  sideClose). Export surfaces sort by THIS. */
export const COMP_CARD_VIEW_ORDER = [
  "frontClose",
  "threeQuarter",
  "sideClose",
  "frontFull",
  "sideFull",
  "backFull",
] as const satisfies readonly CanonicalViewAngle[];

/** Extension-free filenames inside the export ZIP. The extension is derived
 *  from the image bytes at export time; R2/R6 assets have historically been
 *  served as JPEG bytes with PNG metadata, so MIME alone is not authority. */
export const EXPORT_VIEW_FILENAME_STEMS: Record<CanonicalViewAngle, string> = {
  frontClose: "01_Headshot_Primary",
  threeQuarter: "02_Three_Quarter_Head",
  sideClose: "03_Profile_Head",
  frontFull: "04_Full_Body_Standing",
  sideFull: "05_Full_Body_Walk",
  backFull: "06_Full_Body_Rear",
};

export type ExportImageFileType = {
  extension: "jpg" | "png" | "webp" | "gif" | "bin";
  pdfFormat: "JPEG" | "PNG" | "WEBP" | "GIF";
};

/** Determine the encoded format from base64 magic bytes first, falling back
 *  to the data-URL MIME only when the bytes are unknown. */
export function imageFileTypeFromDataUrl(dataUrl: string): ExportImageFileType {
  const payload = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  if (payload.startsWith("/9j/")) return { extension: "jpg", pdfFormat: "JPEG" };
  if (payload.startsWith("iVBORw0KGgo")) return { extension: "png", pdfFormat: "PNG" };
  if (payload.startsWith("UklGR")) return { extension: "webp", pdfFormat: "WEBP" };
  if (payload.startsWith("R0lGOD")) return { extension: "gif", pdfFormat: "GIF" };

  const mime = /^data:image\/([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase();
  if (mime === "jpeg" || mime === "jpg") return { extension: "jpg", pdfFormat: "JPEG" };
  if (mime === "png") return { extension: "png", pdfFormat: "PNG" };
  if (mime === "webp") return { extension: "webp", pdfFormat: "WEBP" };
  if (mime === "gif") return { extension: "gif", pdfFormat: "GIF" };
  return { extension: "bin", pdfFormat: "PNG" };
}

export function filenameWithActualImageExtension(stem: string, dataUrl: string): string {
  return `${stem}.${imageFileTypeFromDataUrl(dataUrl).extension}`;
}

export function exportViewFilename(angle: CanonicalViewAngle, dataUrl: string): string {
  return filenameWithActualImageExtension(EXPORT_VIEW_FILENAME_STEMS[angle], dataUrl);
}

/** generatePdf's `images` keys per canonical slot (the PDF layout contract). */
export const VIEW_TO_PDF_KEY: Record<CanonicalViewAngle, PdfImageKey> = {
  frontClose: "headshot",
  threeQuarter: "threeQuarter",
  frontFull: "fullBody",
  sideClose: "profile",
  sideFull: "walk",
  backFull: "back",
};

export type PdfImageKey = "headshot" | "threeQuarter" | "fullBody" | "profile" | "walk" | "back";

/** True for the six canonical slots — the export surfaces' asset filter. */
export function isCanonicalViewType(viewType: string): viewType is CanonicalViewAngle {
  return (CANONICAL_VIEW_ANGLES as readonly string[]).includes(viewType);
}

/** Sort key: the comp-card presentation order above (frontClose first …
 *  backFull last); unknown view types sort after the six. */
export function compCardViewOrder(viewType: string): number {
  const i = (COMP_CARD_VIEW_ORDER as readonly string[]).indexOf(viewType);
  return i === -1 ? COMP_CARD_VIEW_ORDER.length : i;
}
