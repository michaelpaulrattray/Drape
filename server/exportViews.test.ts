/**
 * Export-map closure (Batch A-safe): the shared canonical-six export module
 * that useExportPack rides. The era-0 trio maps
 * (frontClose/frontFull/sideClose only) silently dropped three-quarter,
 * walk, and back views from export packs — these tests pin every map to
 * ALL SIX canonical view angles so a trio regression cannot come back.
 */
import { describe, it, expect } from "vitest";
import {
  EXPORT_VIEW_FILENAME_STEMS,
  exportViewFilename,
  imageFileTypeFromDataUrl,
  VIEW_TO_PDF_KEY,
  isCanonicalViewType,
  compCardViewOrder,
  COMP_CARD_VIEW_ORDER,
} from "../shared/exportViews";
import { CANONICAL_VIEW_ANGLES, PACKAGE_SLOTS, VIEW_ANGLE_LABELS } from "../shared/boardTypes";

describe("EXPORT_VIEW_FILENAMES — all six slots, unique, in card order", () => {
  it("covers exactly the canonical six", () => {
    expect(Object.keys(EXPORT_VIEW_FILENAME_STEMS).sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
  });

  it("filenames are unique and numbered 01–06 along COMP_CARD_VIEW_ORDER", () => {
    const names = Object.values(EXPORT_VIEW_FILENAME_STEMS);
    expect(new Set(names).size).toBe(6);
    // ZIP numbering follows the comp-card presentation order slot-by-slot
    COMP_CARD_VIEW_ORDER.forEach((angle, i) => {
      const name = EXPORT_VIEW_FILENAME_STEMS[angle];
      expect(name.startsWith(String(i + 1).padStart(2, "0") + "_")).toBe(true);
      expect(name.includes(".")).toBe(false);
    });
  });

  it("the era-0 trio's missing views are present (the V3 regression)", () => {
    expect(EXPORT_VIEW_FILENAME_STEMS.threeQuarter).toBe("02_Three_Quarter_Head");
    expect(EXPORT_VIEW_FILENAME_STEMS.sideFull).toBe("05_Full_Body_Walk");
    expect(EXPORT_VIEW_FILENAME_STEMS.backFull).toBe("06_Full_Body_Rear");
  });

  it("trusts encoded magic bytes over a lying MIME header", () => {
    const jpegBytesWithPngMime = "data:image/png;base64,/9j/4AAQSkZJRgABAQ";
    expect(imageFileTypeFromDataUrl(jpegBytesWithPngMime)).toEqual({ extension: "jpg", pdfFormat: "JPEG" });
    expect(exportViewFilename("frontClose", jpegBytesWithPngMime)).toBe("01_Headshot_Primary.jpg");
  });
});

describe("VIEW_TO_PDF_KEY — all six slots onto the generatePdf contract", () => {
  it("covers exactly the canonical six with unique PDF keys", () => {
    expect(Object.keys(VIEW_TO_PDF_KEY).sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
    expect(new Set(Object.values(VIEW_TO_PDF_KEY)).size).toBe(6);
  });

  it("matches the generatePdf zod input keys (castingExport.ts contract)", () => {
    // The server route accepts exactly these image keys — if this drifts,
    // proxied views silently vanish from the identity document
    expect(new Set(Object.values(VIEW_TO_PDF_KEY))).toEqual(
      new Set(["headshot", "threeQuarter", "fullBody", "profile", "walk", "back"]),
    );
  });
});

describe("COMP_CARD_VIEW_ORDER / isCanonicalViewType / compCardViewOrder", () => {
  /**
   * TAB 4 IS FILE 04, AND THIS IS THE ONLY PLACE THAT SAYS SO.
   *
   * `COMP_CARD_VIEW_ORDER` is what the export surfaces sort by and what the ZIP
   * filenames are numbered along; `PACKAGE_SLOTS` is what draws the customer's
   * tab strip. They are ONE order, and since 2026-08-24 they are one constant
   * (`shared/exportViews.ts` aliases the declaration in `shared/boardTypes.ts`,
   * ruled fable-1511 §1).
   *
   * Until then they were two literals with identical values, each pinned to its
   * OWN literal by its own test — so a deliberate reorder of the strip reddened
   * exactly one of them, got its literal updated, and shipped a download whose
   * numbering no longer matched the tabs, green all the way.
   *
   * So this asserts the IDENTITY and not a literal. The literal that spells the
   * six out lives once, in `server/boardTypes.test.ts`, on the declaration.
   */
  it("IS the package-slot order — one order, not two lists that happen to agree", () => {
    expect([...COMP_CARD_VIEW_ORDER]).toEqual([...PACKAGE_SLOTS]);
    // Same six slots as the canonical list — only the ordering differs
    expect([...COMP_CARD_VIEW_ORDER].sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
    expect([...COMP_CARD_VIEW_ORDER]).not.toEqual([...CANONICAL_VIEW_ANGLES]);
  });

  it("accepts the six, refuses junk AND the retired wire names (V21)", () => {
    for (const a of CANONICAL_VIEW_ANGLES) expect(isCanonicalViewType(a)).toBe(true);
    for (const junk of ["side", "walk", "back", "headshot", "", "front"]) {
      expect(isCanonicalViewType(junk)).toBe(false);
    }
  });

  it("sorts the full six into exact comp-card order; unknown types sort last", () => {
    const shuffled = ["backFull", "frontFull", "frontClose", "sideFull", "sideClose", "threeQuarter"];
    expect([...shuffled].sort((a, b) => compCardViewOrder(a) - compCardViewOrder(b))).toEqual([
      "frontClose",
      "threeQuarter",
      "sideClose",
      "frontFull",
      "sideFull",
      "backFull",
    ]);
    expect(compCardViewOrder("mystery")).toBe(COMP_CARD_VIEW_ORDER.length);
  });

  it("every canonical slot has a display label (export surfaces read these)", () => {
    for (const a of CANONICAL_VIEW_ANGLES) {
      expect(VIEW_ANGLE_LABELS[a]).toBeTruthy();
    }
  });
});
