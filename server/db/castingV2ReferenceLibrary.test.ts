/**
 * The library's door — the row shapes it refuses, driven directly.
 *
 * MySQL cannot be asked to enforce "a surface never holds a crop", so the write
 * helper is where those rules live, and this file drives each one at a row it
 * should reject. Working law 3: a backstop proved only by a path that usually
 * behaves is not proved at all — and every one of these refusals would sit
 * green and unreachable if it were only ever handed legal rows.
 *
 * So each rule gets both arms: the row it must refuse, and the closest legal
 * row to it, which must pass.
 */
import { describe, expect, it } from "vitest";

import {
  assertReferenceRowShape,
  ReferenceLibraryShapeError,
  type ReferenceRowToRecord,
} from "./castingV2ReferenceLibrary";

const geometry = {
  bbox: { x: 10, y: 20, width: 120, height: 80 },
  frame: { width: 1024, height: 1536 },
};
const guard = { kind: "hair", coverage: 9460, spill: 120, threshold: 9460 };

function crop(overrides: Partial<ReferenceRowToRecord> = {}): ReferenceRowToRecord {
  return {
    role: "carry",
    slot: "hair",
    tier: "anatomy",
    noun: "hair",
    words: ["a blunt shoulder-length bob"],
    image: { storageKey: "casting-v2/library/abc.png", digest: "a".repeat(64), geometry, guard },
    ...overrides,
  };
}

function reasonOf(row: ReferenceRowToRecord): string {
  try {
    assertReferenceRowShape(row);
  } catch (error) {
    if (error instanceof ReferenceLibraryShapeError) return error.reason;
    return `unexpected: ${String(error)}`;
  }
  return "accepted";
}

describe("the keys the library will hold", () => {
  /*
    THE WHOLE DIFFERENCE BETWEEN THIS TABLE AND THE UNDO LEDGER is that the
    ledger's key does not parse here. `makeup@face skin` is a real production
    key from the other store; letting one in would make the library a second
    copy of the ledger under a cleaner name.
  */
  it("refuses a ledger key", () => {
    expect(reasonOf(crop({ slot: "makeup@face skin" }))).toBe("slotNotAFeatureSlot");
  });

  it("takes a panel slot, plain or per instance", () => {
    expect(reasonOf(crop({ slot: "hair" }))).toBe("accepted");
    expect(reasonOf(crop({ slot: "eye@left" }))).toBe("accepted");
  });
});

describe("what a row of each role may hold", () => {
  it("refuses an anchor with no image — a frozen reference is a picture", () => {
    expect(reasonOf(crop({ role: "anchor", tier: "item", image: undefined })))
      .toBe("anchorWithoutImage");
  });

  it("refuses an anchor carrying a bbox it was never cut from", () => {
    expect(reasonOf(crop({
      role: "anchor",
      tier: "item",
      image: { storageKey: "flash-sheet.png", digest: "b".repeat(64), geometry },
    }))).toBe("anchorWithGeometry");
  });

  it("takes an uploaded anchor: an image, no geometry, no guard reading", () => {
    expect(reasonOf(crop({
      role: "anchor",
      tier: "item",
      image: { storageKey: "flash-sheet.png", digest: "b".repeat(64) },
    }))).toBe("accepted");
  });

  /*
    §3.0a: a surface is carried by words, always. fable-195's carve-out is the
    OTHER role — an uploaded makeup reference is a legal anchor — so both arms
    are asserted here rather than one, because a refusal that swallowed the
    carve-out would make an uploaded look impossible to store.
  */
  it("refuses a minted crop for a surface, and allows an uploaded anchor for one", () => {
    expect(reasonOf(crop({ slot: "skin", tier: "surface", noun: "skin" })))
      .toBe("surfaceCarriesCrop");
    expect(reasonOf(crop({
      slot: "skin",
      tier: "surface",
      noun: "skin",
      role: "anchor",
      image: { storageKey: "the-look.png", digest: "c".repeat(64) },
    }))).toBe("accepted");
  });

  it("takes a words-only row for a surface", () => {
    expect(reasonOf(crop({
      slot: "skin",
      tier: "surface",
      noun: "skin",
      words: ["a warm even tan"],
      image: undefined,
    }))).toBe("accepted");
  });

  it("takes a words-only row for anatomy nothing has delivered yet", () => {
    expect(reasonOf(crop({ image: undefined }))).toBe("accepted");
  });
});

describe("what a stored crop must be able to say about itself", () => {
  it("refuses a crop with no completeness reading", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", digest: "d".repeat(64), geometry },
    }))).toBe("cropWithoutGuard");
  });

  it("refuses a crop with no frame", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", digest: "d".repeat(64), guard },
    }))).toBe("cropWithoutGeometry");
  });

  it("refuses an image with no digest — the byte-identity refusal reads it", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", digest: "  ", geometry, guard },
    }))).toBe("imageWithoutDigest");
  });

  /* The mislabelled-frame class: a box that leaves its own frame was measured
     against a different picture, and every later reader inherits the mistake. */
  it("refuses a bbox that falls outside its own frame", () => {
    expect(() => assertReferenceRowShape(crop({
      image: {
        storageKey: "crop.png",
        digest: "e".repeat(64),
        geometry: {
          bbox: { x: 900, y: 20, width: 300, height: 80 },
          frame: { width: 1024, height: 1536 },
        },
        guard,
      },
    }))).toThrow(/outside its own frame/);
  });
});
