import { describe, expect, it } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import {
  ANCHOR_STANDIN_NOTE,
  FAILED_SLOT_CONFESSION,
  projectSignedCast,
} from "./castProjection";

/**
 * What the room may see, and what it must SAY.
 *
 * Two separate obligations live in this file. The first is the privacy
 * allowlist (§J, invariant 8): the identity documents are the complete recipe
 * for reproducing a customer's Cast, and they must be absent from the
 * projection by construction rather than by a caller remembering to omit them.
 *
 * The second is the founder's gate condition (D-92): a view that is never
 * coming confesses in place, with what happened to the money. That is asserted
 * here rather than left to the client, because a client is free to invent a
 * friendlier version of a refund and this sentence is a ruling.
 */

const SECRET_PROMPT = "SECRET-MASTER-PROMPT-DO-NOT-LEAK";

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: 7,
    userId: 1,
    agencyId: "KI-AAAA-BBBB-CCCC-DDDD",
    name: "Nine",
    masterPrompt: SECRET_PROMPT,
    technicalSchema: { subject: { sex: "female", secretAxis: "SECRET-SCHEMA" } },
    preferences: { briefText: "SECRET-PREFERENCE" },
    status: "active",
    cohortKey: "photoreal-human",
    styleKey: null,
    sourceCandidateId: 55,
    sourceRollId: 22,
    identityRevisionId: "rev-1",
    currentPackageSnapshotId: "pkg-1",
    stateVersion: 1,
    sealedIdentitySnapshotId: "id-1",
    sealedPackageSnapshotId: "pkg-1",
    mintedAt: new Date("2026-08-02T10:00:00Z"),
    deletedAt: null,
    createdAt: new Date("2026-08-02T10:00:00Z"),
    updatedAt: new Date("2026-08-02T10:00:00Z"),
    ...overrides,
  } as Model;
}

let nextAssetId = 1000;
function asset(overrides: Partial<ModelAsset> = {}): ModelAsset {
  nextAssetId -= 1;
  return {
    id: nextAssetId,
    modelId: 7,
    viewType: "frontFull",
    resolution: "2K",
    storageUrl: "https://cdn.example/view.png",
    storageKey: "casting-v2/casts/op/views/secret-key.png",
    pointsCost: 50,
    pinned: false,
    status: null,
    provenance: { provider: "fal", engine: "fal-ai/nano-banana-pro", providerRef: "SECRET-REF" },
    createdAt: new Date(),
    ...overrides,
  } as ModelAsset;
}

const lineage = {
  rollPublicId: "roll-public",
  rollIndex: 2,
  sessionPublicId: "session-public",
  candidatePublicId: "candidate-public",
  personaLine: "Dry and flat",
  castFromAt: new Date("2026-08-02T10:00:00Z"),
};

/** Newest-first, like the ledger's own order. */
function ledger(...assets: ModelAsset[]): ModelAsset[] {
  return [...assets].sort((a, b) => b.id - a.id);
}

const anchor = () =>
  asset({
    viewType: "frontClose",
    resolution: "1K",
    storageUrl: "https://cdn.example/anchor.png",
    pointsCost: 0,
  });

describe("the signed Cast projection", () => {
  it("carries none of the identity documents, keys or provider details", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), asset()),
      lineage,
    });
    const serialized = JSON.stringify(projection);

    // The single most sensitive field group in the product.
    expect(serialized).not.toContain(SECRET_PROMPT);
    expect(serialized).not.toContain("SECRET-SCHEMA");
    expect(serialized).not.toContain("SECRET-PREFERENCE");
    // Provider identity and internal storage keys (§J).
    expect(serialized).not.toContain("SECRET-REF");
    expect(serialized).not.toContain("nano-banana-pro");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("casting-v2/casts");
    // And nothing numeric that identifies a row.
    expect(serialized).not.toContain('"modelId"');
  });

  it("shows a landed view as ready, with nothing to apologise for", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), asset({ viewType: "frontFull" })),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "frontFull");
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBe("https://cdn.example/view.png");
    expect(slot?.note).toBeNull();
  });

  /**
   * THE GATE CONDITION (founder ruling, 2026-08-02). A permanently failed slot
   * confesses in place — never a shimmer, never a blank.
   */
  it("confesses a failed view in place, with what happened to the money", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(
        anchor(),
        asset({
          viewType: "backFull",
          storageUrl: "",
          storageKey: null,
          status: { state: "failed", reason: "This view didn't arrive", refunded: 50 },
        }),
      ),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "backFull");
    expect(slot?.state).toBe("failed-refunded");
    expect(slot?.url).toBeNull();
    expect(slot?.note).toBe(FAILED_SLOT_CONFESSION);
    expect(slot?.refundedCredits).toBe(50);
    // It is not still "building" — that is the shimmer the ruling forbids.
    expect(slot?.state).not.toBe("building");
  });

  it("never claims money moved that did not", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(
        anchor(),
        asset({
          viewType: "backFull",
          storageUrl: "",
          storageKey: null,
          // The refund itself failed to record. The room must say 0, not 50.
          status: { state: "failed", reason: "This view didn't arrive", refunded: 0 },
        }),
      ),
      lineage,
    });
    expect(projection.slots.find((entry) => entry.angle === "backFull")?.refundedCredits).toBe(0);
  });

  it("confesses a terminal Cast's empty slot rather than shimmering forever", () => {
    // No picture and no marker on a Cast that is done: the marker write is what
    // failed. A permanently empty tile reads as "still loading" for ever — and
    // the PROMISE is what proves the slot was bought at all.
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor()),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "backFull"],
    });
    const slot = projection.slots.find((entry) => entry.angle === "sideClose");
    expect(slot?.state).toBe("failed-refunded");
    expect(slot?.note).toBe(FAILED_SLOT_CONFESSION);
  });

  it("stands the signed face in for a headshot re-render that never came", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(
        anchor(),
        asset({
          viewType: "frontClose",
          storageUrl: "",
          storageKey: null,
          status: { state: "failed", reason: "This view didn't arrive", refunded: 50 },
        }),
      ),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "frontClose");
    // The customer is looking at the exact face they signed, so the confession
    // is about the refund rather than about an absence.
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBe("https://cdn.example/anchor.png");
    expect(slot?.note).toBe(ANCHOR_STANDIN_NOTE);
    expect(slot?.refundedCredits).toBe(50);
  });

  it("opens the room on the signed master while the package is still building", () => {
    const projection = projectSignedCast({
      model: model({ status: "provisioning", mintedAt: null, currentPackageSnapshotId: null }),
      assets: ledger(anchor()),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "backFull"],
    });
    expect(projection.status).toBe("building");
    expect(projection.anchorUrl).toBe("https://cdn.example/anchor.png");
    // The headshot already shows the signed face; the rest are honestly pending.
    expect(projection.slots.find((entry) => entry.angle === "frontClose")?.url)
      .toBe("https://cdn.example/anchor.png");
    expect(projection.slots.filter((entry) => entry.state === "building").length).toBe(5);
    // Nothing confesses while there is still a reason to wait.
    expect(projection.slots.some((entry) => entry.state === "failed-refunded")).toBe(false);
  });

  it("tells the truth about what this Cast can do today", () => {
    // §I's honest-capability law: what is not built reads `unsupported` rather
    // than being advertised as a greyed-out control.
    const projection = projectSignedCast({ model: model(), assets: ledger(anchor()), lineage });
    // Only what this milestone built and validated is claimed. Wardrobe and
    // canvas will list a V2 Cast — it is an ordinary `active` model — but
    // nothing has been driven through them against V2's identity documents,
    // and an unverified claim is the honest-capability law inverted.
    expect(projection.capabilities.multiview).toBe("full");
    expect(projection.capabilities.wardrobeVto).toBe("unsupported");
    expect(projection.capabilities.canvas).toBe("unsupported");
    expect(projection.capabilities.takes).toBe("unsupported");
    expect(projection.capabilities.voice).toBe("unsupported");
    expect(projection.identityLocked).toBe(true);
  });

  it("keeps a Cast's own package after the composition changes", () => {
    /*
      Package v2 retired the walk. The two Casts that bought one must keep it:
      an asset exists, the customer paid for it, and a deploy they had nothing
      to do with must not delete it from their room.
    */
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), asset({ viewType: "sideFull" })),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "sideFull", "backFull"],
    });
    const walk = projection.slots.find((entry) => entry.angle === "sideFull");
    expect(walk?.state).toBe("ready");
    expect(walk?.label).toBe("Walk");
    expect(projection.slots).toHaveLength(6);
  });

  it("labels this profile's frontClose a close-up, not a headshot", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor()),
      lineage,
      promisedAngles: ["frontClose"],
    });
    expect(projection.slots[0].label).toBe("Close-up");
  });

  it("names where it came from, in public ids only", () => {
    const projection = projectSignedCast({ model: model(), assets: ledger(anchor()), lineage });
    expect(projection.provenance).toBe("Cast from a sheet on 2 August");
    expect(projection.lineage.fromCandidatePublicId).toBe("candidate-public");
    expect(projection.lineage.fromRollPublicId).toBe("roll-public");
  });
});
