/**
 * Export-map closure (Batch A-safe): the shared canonical-six export module
 * that useExportPack and useCastingExport both ride. The era-0 trio maps
 * (frontClose/frontFull/sideClose only) silently dropped three-quarter,
 * walk, and back views from export packs — these tests pin every map to
 * ALL SIX canonical view angles so a trio regression cannot come back.
 */
import { describe, it, expect } from "vitest";
import {
  EXPORT_VIEW_FILENAMES,
  VIEW_TO_PDF_KEY,
  isCanonicalViewType,
  compCardViewOrder,
  COMP_CARD_VIEW_ORDER,
} from "../shared/exportViews";
import { CANONICAL_VIEW_ANGLES, VIEW_ANGLE_LABELS } from "../shared/boardTypes";

describe("EXPORT_VIEW_FILENAMES — all six slots, unique, in card order", () => {
  it("covers exactly the canonical six", () => {
    expect(Object.keys(EXPORT_VIEW_FILENAMES).sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
  });

  it("filenames are unique and numbered 01–06 along COMP_CARD_VIEW_ORDER", () => {
    const names = Object.values(EXPORT_VIEW_FILENAMES);
    expect(new Set(names).size).toBe(6);
    // ZIP numbering follows the comp-card presentation order slot-by-slot
    COMP_CARD_VIEW_ORDER.forEach((angle, i) => {
      const name = EXPORT_VIEW_FILENAMES[angle];
      expect(name.startsWith(String(i + 1).padStart(2, "0") + "_")).toBe(true);
      expect(name.endsWith(".png")).toBe(true);
    });
  });

  it("the era-0 trio's missing views are present (the V3 regression)", () => {
    expect(EXPORT_VIEW_FILENAMES.threeQuarter).toBe("02_Three_Quarter_Head.png");
    expect(EXPORT_VIEW_FILENAMES.sideFull).toBe("05_Full_Body_Walk.png");
    expect(EXPORT_VIEW_FILENAMES.backFull).toBe("06_Full_Body_Rear.png");
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
  it("the comp-card order is EXACTLY the ViewTabs/export sequence — all six, in full", () => {
    // Face cluster then body — sideClose BEFORE frontFull. This is the
    // ViewTabs.tsx VIEWS order and the ZIP numbering order, and it is
    // deliberately NOT the CANONICAL_VIEW_ANGLES tuple order.
    expect([...COMP_CARD_VIEW_ORDER]).toEqual([
      "frontClose",
      "threeQuarter",
      "sideClose",
      "frontFull",
      "sideFull",
      "backFull",
    ]);
    // Same six slots as the canonical list — only the ordering differs
    expect([...COMP_CARD_VIEW_ORDER].sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
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
