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

/** Filenames inside the export ZIP, one per canonical slot, numbered in
 *  comp-card order. */
export const EXPORT_VIEW_FILENAMES: Record<CanonicalViewAngle, string> = {
  frontClose: "01_Headshot_Primary.png",
  threeQuarter: "02_Three_Quarter_Head.png",
  sideClose: "03_Profile_Head.png",
  frontFull: "04_Full_Body_Standing.png",
  sideFull: "05_Full_Body_Walk.png",
  backFull: "06_Full_Body_Rear.png",
};

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
