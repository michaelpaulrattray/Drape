/**
 * exportViews — the ONE canonical-six export mapping, shared by every export
 * surface (useExportPack) so the library export cannot regress to an
 * era-0 trio map again (audit V3's last copy lived in useExportPack and
 * silently dropped three-quarter, walk, and back from the export-verb packs).
 *
 * Keys are CanonicalViewAngle; PDF keys are the generatePdf zod contract
 * (server/routes/generation/castingExport.ts) — a unit test asserts the two
 * never drift.
 */
import { CANONICAL_VIEW_ANGLES, PACKAGE_SLOTS, type CanonicalViewAngle } from "./boardTypes";

/**
 * The comp-card PRESENTATION order — face cluster (headshot, ¾, profile) then
 * body (front, walk, back). Export surfaces sort by THIS, and the ZIP
 * filenames are numbered along it. It is NOT the `CANONICAL_VIEW_ANGLES` tuple
 * order — that list puts `frontFull` before `sideClose`.
 *
 * ⚠ THIS IS AN ALIAS, NOT A DECLARATION (2026-08-24, ruled fable-1511 §1).
 *
 * The order is declared ONCE, in `shared/boardTypes.ts`'s `PACKAGE_SLOTS`,
 * which is also the list that draws the customer's tab strip. Until this
 * commit these were two literal copies of the same six, in the same order,
 * under two names, each with a docblock claiming to be the presentation order
 * — and nothing tied them. Worse, each was pinned to its own LITERAL by its
 * own test, which is the worst available arrangement: move the strip order
 * deliberately, update the one literal that reddens, ship, and the tabs now
 * number differently from the customer's download with a green suite.
 *
 * The name is kept rather than retired because every export consumer reads it
 * and because it says what this file uses the order FOR. The direction of the
 * fold is forced by the import graph: `boardTypes.ts` imports nothing at all,
 * so the declaration cannot live here.
 *
 * `server/exportViews.test.ts` asserts the identity, and that assertion is the
 * promise *tab 4 is file 04* — which no test could see before.
 *
 * This copy was found by `scripts/sweep-handwritten-vocabularies.mts`, asking
 * law 7 of the commit that had just repaired the strip's own hand-written copy
 * (triage §29d/§30): that repair pinned an order without asking whether the
 * order already had a home, and it did.
 */
export const COMP_CARD_VIEW_ORDER = PACKAGE_SLOTS;

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
