/**
 * Batch C — §14's three separate mint-validity checks (ratified R8; M7's
 * pure matrix, cross-checked with M21's case-1/case-2 pair).
 */
import { describe, it, expect } from "vitest";
import { computeMintIntegrity } from "./mintIntegrity";
import { REFUSAL_COPY } from "./refusalCopy";

const CANON = "IDENTITY CONTEXT:\ncanon";
const TIER = ["frontClose", "threeQuarter", "frontFull"] as const;

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  viewType: "frontClose",
  storageUrl: "https://r2/a.png",
  pinned: false,
  status: null,
  provenance: null,
  createdAt: new Date(),
  ...over,
});

const revModel = { identityRevisionId: "rev-2" };
const genesisModel = { identityRevisionId: null };

describe("check 1 — identity-anchor validity", () => {
  it("no anchor ⇒ refuses with the anchor copy", () => {
    const integrity = computeMintIntegrity(revModel, [], TIER, CANON);
    expect(integrity.anchor).toEqual({ ok: false, message: REFUSAL_COPY.mintAnchorInvalid });
    expect(integrity.ok).toBe(false);
  });

  it("a STALE anchor refuses", () => {
    const assets = [row({ provenance: { identityRole: "anchor", identityRevisionId: "rev-2" }, status: { state: "stale" } })];
    expect(computeMintIntegrity(revModel, assets, TIER, CANON).anchor.ok).toBe(false);
  });

  it("a cross-revision anchor refuses; a current one passes", () => {
    const old = [row({ provenance: { identityRole: "anchor", identityRevisionId: "rev-1" } })];
    expect(computeMintIntegrity(revModel, old, TIER, CANON).anchor.ok).toBe(false);
    const current = [row({ provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } })];
    expect(computeMintIntegrity(revModel, current, TIER, CANON).anchor.ok).toBe(true);
  });

  it("the accepted legacy genesis case: a no-provenance anchor on a genesis model passes", () => {
    const assets = [row()];
    expect(computeMintIntegrity(genesisModel, assets, TIER, CANON).anchor.ok).toBe(true);
    // …but the same unknown anchor on a REVISED model refuses
    expect(computeMintIntegrity(revModel, assets, TIER, CANON).anchor.ok).toBe(false);
  });

  it("the legacy FINGERPRINT pair: identityText match passes, mismatch refuses (M7 case 7)", () => {
    const match = [row({ provenance: { identityText: CANON } })];
    expect(computeMintIntegrity(revModel, match, TIER, CANON).anchor.ok).toBe(true);
    const mismatch = [row({ provenance: { identityText: "other canon" } })];
    expect(computeMintIntegrity(revModel, mismatch, TIER, CANON).anchor.ok).toBe(false);
  });
});

describe("check 2 — display-headshot validity", () => {
  it("M7 case 1 / M21 pair: a SAME-REVISION display headshot over an older anchor PASSES", () => {
    const assets = [
      row({ id: 2, provenance: { identityRole: "display", identityRevisionId: "rev-2" } }), // newest, display
      row({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
    ];
    const integrity = computeMintIntegrity(revModel, assets, TIER, CANON);
    expect(integrity.displayHeadshot.ok).toBe(true);
    expect(integrity.anchor.ok).toBe(true);
  });

  it("a displayed headshot from an EARLIER or UNKNOWN revision refuses with its own copy", () => {
    const earlier = [
      row({ id: 2, provenance: { identityRole: "display", identityRevisionId: "rev-1" } }),
      row({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
    ];
    const integrity = computeMintIntegrity(revModel, earlier, TIER, CANON);
    expect(integrity.displayHeadshot).toEqual({ ok: false, message: REFUSAL_COPY.mintDisplayHeadshotInvalid });

    const unknown = [
      row({ id: 2, provenance: { identityRole: "display" } }),
      row({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
    ];
    expect(computeMintIntegrity(revModel, unknown, TIER, CANON).displayHeadshot.ok).toBe(false);
  });

  it("when the displayed row IS the anchor, check 2 trivially passes (check 1 territory)", () => {
    const assets = [row({ provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } })];
    expect(computeMintIntegrity(revModel, assets, TIER, CANON).displayHeadshot.ok).toBe(true);
  });
});

describe("check 3 — tier-view validity", () => {
  const anchor = row({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } });
  const goodView = (viewType: string, over: Record<string, unknown> = {}) =>
    row({ id: 10, viewType, provenance: { identityRole: "display", identityRevisionId: "rev-2" }, ...over });

  it("current-revision tier views pass (M7 case 5)", () => {
    const integrity = computeMintIntegrity(revModel, [anchor, goodView("threeQuarter"), goodView("frontFull", { id: 11 })], TIER, CANON);
    expect(integrity.ok).toBe(true);
  });

  it("STALE tier views refuse — pinned AND unpinned, each with its own copy", () => {
    const unpinned = computeMintIntegrity(revModel, [anchor, goodView("threeQuarter", { status: { state: "stale" } })], TIER, CANON);
    const failure = unpinned.tierViews.find((v) => v.angle === "threeQuarter")!;
    expect(failure).toMatchObject({ ok: false, reason: "stale" });

    const pinned = computeMintIntegrity(
      revModel,
      [anchor, goodView("threeQuarter", { status: { state: "stale" }, pinned: true })],
      TIER, CANON,
    );
    const pinnedFailure = pinned.tierViews.find((v) => v.angle === "threeQuarter")!;
    expect(pinnedFailure).toMatchObject({ ok: false, reason: "pinned_stale" });
    expect(pinnedFailure.message).toContain("unpin"); // the unpin-and-refresh route
  });

  it("CROSS-REVISION tier views refuse (M7 case 6)", () => {
    const integrity = computeMintIntegrity(
      revModel,
      [anchor, goodView("threeQuarter", { provenance: { identityRevisionId: "rev-1" } })],
      TIER, CANON,
    );
    expect(integrity.tierViews.find((v) => v.angle === "threeQuarter")).toMatchObject({ ok: false, reason: "cross_revision" });
  });

  it("UNKNOWN-authority tier views refuse — uncertain provenance never guesses", () => {
    const integrity = computeMintIntegrity(revModel, [anchor, goodView("threeQuarter", { provenance: null })], TIER, CANON);
    expect(integrity.tierViews.find((v) => v.angle === "threeQuarter")).toMatchObject({ ok: false, reason: "unknown_authority" });
  });

  it("a FAILED-marker slot refuses; a missing slot passes (the mint generates it)", () => {
    const failedMarker = row({ id: 20, viewType: "threeQuarter", storageUrl: "", status: { state: "failed", reason: "gate" } });
    const integrity = computeMintIntegrity(revModel, [anchor, failedMarker], TIER, CANON);
    expect(integrity.tierViews.find((v) => v.angle === "threeQuarter")).toMatchObject({ ok: false, reason: "failed" });
    // frontFull simply missing ⇒ generated by the mint, not a pre-refusal
    expect(integrity.tierViews.find((v) => v.angle === "frontFull")).toMatchObject({ present: false, ok: true });
  });

  it("legacy fingerprint-matched tier views pass on legacy models", () => {
    const legacyAnchor = row({ id: 1 });
    const legacyView = row({ id: 10, viewType: "threeQuarter", provenance: { identityText: CANON } });
    const integrity = computeMintIntegrity(genesisModel, [legacyAnchor, legacyView], TIER, CANON);
    expect(integrity.ok).toBe(true);
  });
});
