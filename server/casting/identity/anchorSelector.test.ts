/**
 * Batch C — anchor authority, identity revisions, restore compatibility
 * (§7, M21's pure layer) and the pinned-included stale selection (§14).
 */
import { describe, it, expect } from "vitest";
import {
  GENESIS_REVISION,
  assetIdentityRole,
  assetRevisionMembership,
  currentRevisionId,
  identityStampFor,
  isRestoreCompatible,
  selectDisplayedHeadshot,
  selectIdentityAnchor,
  selectStaleSiblingHeads,
} from "./anchorSelector";

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

describe("§7.2 role + selector", () => {
  it("a row with NO recorded role counts as anchor (pre-Batch-C legacy)", () => {
    expect(assetIdentityRole(row())).toBe("anchor");
    expect(assetIdentityRole(row({ provenance: {} }))).toBe("anchor");
    expect(assetIdentityRole(row({ provenance: { identityRole: "display" } }))).toBe("display");
  });

  it("displayed v2 (display) with v1 anchoring: displayed and anchor legally diverge (M21)", () => {
    const assets = [
      row({ id: 2, storageUrl: "https://r2/v2.png", provenance: { identityRole: "display" } }), // newest
      row({ id: 1, storageUrl: "https://r2/v1.png", provenance: { identityRole: "anchor" } }),
    ];
    expect(selectDisplayedHeadshot(assets)?.id).toBe(2);
    expect(selectIdentityAnchor(assets)?.id).toBe(1); // refresh/add-views/mint consume THIS
  });

  it("an authorized edit's v3 anchor supersedes v1; unfilled and non-frontClose rows never anchor", () => {
    const assets = [
      row({ id: 3, storageUrl: "https://r2/v3.png", provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
      row({ id: 2, storageUrl: "https://r2/v2.png", provenance: { identityRole: "display" } }),
      row({ id: 1, storageUrl: "https://r2/v1.png", provenance: { identityRole: "anchor" } }),
    ];
    expect(selectIdentityAnchor(assets)?.id).toBe(3);
    expect(selectIdentityAnchor([row({ storageUrl: "" })])).toBeNull();
    expect(selectIdentityAnchor([row({ viewType: "sideClose" })])).toBeNull();
  });

  it("a display row can never self-promote: only the server stamp decides the role", () => {
    // A raw caller has no channel to set provenance (M21's router guard);
    // here we prove the SELECTOR side: a display stamp is never anchor.
    const display = row({ provenance: identityStampFor({ role: "display", revisionId: "rev-1" }) });
    expect(assetIdentityRole(display)).toBe("display");
    expect(selectIdentityAnchor([display])).toBeNull();
  });
});

describe("§7.4 revision membership", () => {
  const model = { identityRevisionId: "rev-2" };
  const genesisModel = { identityRevisionId: null };
  const CANON = "IDENTITY CONTEXT:\ncanon";

  it("recorded revision matches ⇒ current; differs ⇒ mismatch", () => {
    expect(assetRevisionMembership(row({ provenance: { identityRevisionId: "rev-2" } }), model, CANON)).toBe("current");
    expect(assetRevisionMembership(row({ provenance: { identityRevisionId: "rev-1" } }), model, CANON)).toBe("mismatch");
  });

  it("legacy fingerprint: identityText match ⇒ legacy-match; mismatch ⇒ mismatch; absent ⇒ unknown", () => {
    expect(assetRevisionMembership(row({ provenance: { identityText: CANON } }), model, CANON)).toBe("legacy-match");
    expect(assetRevisionMembership(row({ provenance: { identityText: "other" } }), model, CANON)).toBe("mismatch");
    expect(assetRevisionMembership(row(), model, CANON)).toBe("unknown");
  });

  it("restore compatibility: current/legacy-match only — uncertain refuses rather than guessing", () => {
    expect(isRestoreCompatible("current")).toBe(true);
    expect(isRestoreCompatible("legacy-match")).toBe(true);
    expect(isRestoreCompatible("mismatch")).toBe(false);
    expect(isRestoreCompatible("unknown")).toBe(false);
  });

  it("genesis: models.identityRevisionId NULL reads as the genesis revision", () => {
    expect(currentRevisionId(genesisModel)).toBe(GENESIS_REVISION);
    expect(currentRevisionId(model)).toBe("rev-2");
    const stamped = row({ provenance: { identityRevisionId: GENESIS_REVISION } });
    expect(assetRevisionMembership(stamped, genesisModel, CANON)).toBe("current");
  });
});

describe("§14 stale selection — PINNED INCLUDED (D-21 exemption superseded)", () => {
  const assets = [
    { id: 1, viewType: "frontClose", storageUrl: "u", pinned: false },
    { id: 2, viewType: "sideClose", storageUrl: "u", pinned: true }, // pinned!
    { id: 3, viewType: "frontFull", storageUrl: "u", pinned: false },
    { id: 4, viewType: "backFull", storageUrl: "", pinned: false }, // unfilled marker
    { id: 5, viewType: "sideClose", storageUrl: "u", pinned: false }, // older row, not the head
  ];

  it("stales every OTHER view's newest filled row — pinned included, unfilled skipped", () => {
    const ids = selectStaleSiblingHeads(assets, "frontClose");
    expect(ids.sort()).toEqual([2, 3]);
  });

  it("the edited view itself is never staled; an empty package stales nothing", () => {
    expect(selectStaleSiblingHeads(assets, "sideClose")).toEqual([1, 3]);
    expect(selectStaleSiblingHeads([], "frontClose")).toEqual([]);
  });
});
