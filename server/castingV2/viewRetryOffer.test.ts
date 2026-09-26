import { describe, expect, it, vi } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import { VIEW_RETRY_WORDS } from "../../client/src/features/castingV2/viewRetryRow";
import {
  castSlotRetryOffer,
  projectSignedCast,
} from "./castProjection";
import { CAST_PACKAGE_VIEW_PRICE } from "./castViewPackage";

/*
  `storagePublicUrl` reads the R2 config from an import-time ENV snapshot and
  throws when it is absent — primed hoisted, exactly as `castProjection.test.ts`
  does, and for the same reason.
*/
vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

/**
 * WHAT A TILE OFFERS, AND WHAT IT COSTS — his rule, verbatim (2026-09-25):
 * *"you pay 50 for each view you keep."*
 *
 * These arms exist because the offer is a MONEY reading that a customer sees
 * as a price on a button. The service authorizes with this same function, so a
 * rule that drifted here would drift at the till in the same direction and
 * nothing would disagree with itself. Everything is driven through
 * `projectSignedCast` rather than against hand-built slot literals: the input
 * to the rule is what the room is really shown, and a fixture of that is a
 * second opinion about the thing under test.
 */

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: 7,
    userId: 1,
    agencyId: "KI-AAAA-BBBB-CCCC-DDDD",
    name: "Nine",
    masterPrompt: "SECRET",
    technicalSchema: { subject: { sex: "female" } },
    preferences: {},
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
    mintedAt: new Date("2026-09-01T10:00:00Z"),
    deletedAt: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
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
    storageKey: "casting-v2/casts/op/views/key.png",
    pointsCost: 50,
    pinned: false,
    status: null,
    provenance: {
      provider: "fal",
      engine: "fal-ai/nano-banana-pro",
      conformanceMethod: "model",
    },
    createdAt: new Date(),
    ...overrides,
  } as ModelAsset;
}

const lineage = {
  rollPublicId: "roll-public",
  rollIndex: 2,
  sessionPublicId: "session-public",
  candidatePublicId: "candidate-public",
  castFromAt: new Date("2026-09-01T10:00:00Z"),
};

/** The 1K signed face, which every Cast has. */
const anchor = () =>
  asset({
    id: 900,
    viewType: "frontClose",
    resolution: "1K",
    pointsCost: 0,
    provenance: { identityRole: "anchor", identityRevisionId: "rev-1", identityText: "t" },
  });

/** A written-off view: the marker the room confesses from. */
const failed = (viewType: string, refunded = CAST_PACKAGE_VIEW_PRICE) =>
  asset({
    id: 500 + viewType.length,
    viewType: viewType as ModelAsset["viewType"],
    storageUrl: "",
    status: { state: "failed", reason: "didn't arrive", refunded },
  });

/** A view that arrived with nobody able to check it (D-246). */
const unjudged = (viewType: string) =>
  asset({
    viewType: viewType as ModelAsset["viewType"],
    provenance: {
      provider: "fal",
      engine: "fal-ai/nano-banana-pro",
      conformanceMethod: "unavailable",
    },
  });

function slotsOf(
  assets: ModelAsset[],
  overrides: Partial<Model> = {},
  promisedAngles: Parameters<typeof projectSignedCast>[0]["promisedAngles"] =
    ["frontFull", "threeQuarter", "sideFull", "backFull", "closeUp"],
) {
  const projection = projectSignedCast({
    model: model(overrides),
    assets: [...assets].sort((a, b) => b.id - a.id),
    lineage,
    promisedAngles,
  });
  return new Map(projection.slots.map((slot) => [slot.angle, slot]));
}

describe("what a tile offers, and what it costs", () => {
  it("a view that failed was refunded, so asking again is a PAID view", () => {
    const slots = slotsOf([anchor(), asset(), failed("backFull")]);
    expect(slots.get("backFull")?.state).toBe("failed-refunded");
    expect(slots.get("backFull")?.retry).toEqual({
      priceCredits: CAST_PACKAGE_VIEW_PRICE,
      reason: "refunded",
    });
  });

  it("a view nobody checked was charged and kept, so asking again is FREE — and it says why", () => {
    const slots = slotsOf([anchor(), unjudged("closeUp")]);
    const slot = slots.get("closeUp");
    expect(slot?.state).toBe("ready");
    expect(slot?.unjudged).toBe(true);
    expect(slot?.retry).toEqual({ priceCredits: 0, reason: "unchecked" });
    /*
      The word is not decoration: a free link under one tile and not the others,
      with nothing said, is a control nobody has a basis for pressing. It used to
      be a SENTENCE here (`UNJUDGED_SLOT_NOTE`, *"We didn't get to check this
      one"*) and it is one word on the row since his ruling of 2026-09-26 — so
      the note is null and the reason carries the fact.
    */
    expect(slot?.note).toBeNull();
  });

  it("a view that arrived and WAS checked offers nothing at all", () => {
    const slots = slotsOf([anchor(), asset()]);
    const slot = slots.get("frontFull");
    expect(slot?.state).toBe("ready");
    expect(slot?.unjudged).toBeUndefined();
    expect(slot?.retry).toBeUndefined();
    expect(slot?.note).toBeNull();
  });

  it("the headshot standing in for a refunded close-up is the PAID case wearing a picture", () => {
    const slots = slotsOf(
      [anchor(), failed("frontClose")],
      {},
    );
    const slot = slots.get("frontClose");
    expect(slot?.standIn).toBe(true);
    expect(slot?.refundedCredits).toBe(CAST_PACKAGE_VIEW_PRICE);
    expect(slot?.retry).toEqual({
      priceCredits: CAST_PACKAGE_VIEW_PRICE,
      reason: "refunded",
    });
    /*
      ⚠ AND ITS SENTENCE IS GONE WITH THE OTHER ONE (#1347). This slot said
      *"The face you signed, standing in — the close-up didn't arrive; refunded"*
      until 2026-09-26; under his *"one muted line, nothing else"* it says
      `Refunded` like the empty tile, and the fact that the picture is her Master
      rather than her Portrait is no longer stated. Asserted rather than left
      implicit, because it is the one thing this change actually costs.
    */
    expect(slot?.note).toBeNull();
  });

  it("a stand-in with NOTHING refunded is a Cast that never bought that view — no offer", () => {
    /*
      The negative control for the arm above, and the reason the rule keys on
      the refund rather than on the stand-in flag: a headshot that is simply
      the signed face has no failed view behind it and nothing to ask for.
    */
    const slots = slotsOf(
      [anchor(), asset()],
      {},
      /* An era that BOUGHT a headshot, so the slot is rendered at all. */
      ["frontClose", "frontFull", "threeQuarter", "sideFull", "backFull", "closeUp"],
    );
    expect(slots.get("frontClose")?.standIn).toBe(true);
    expect(slots.get("frontClose")?.retry).toBeUndefined();
  });

  it("NOTHING is offered while the package is still building — the Sign still owns every slot", () => {
    const building = slotsOf([anchor(), unjudged("closeUp")], { status: "provisioning" });
    expect([...building.values()].every((slot) => slot.retry === undefined)).toBe(true);
    /*
      The positive control that keeps the arm above from passing for the wrong
      reason: the SAME rows, terminal, do offer.
    */
    const terminal = slotsOf([anchor(), unjudged("closeUp")]);
    expect(terminal.get("closeUp")?.retry).toEqual({ priceCredits: 0, reason: "unchecked" });
  });

  it("the rule is a pure reading of the slot, and it refuses every other state", () => {
    const price = CAST_PACKAGE_VIEW_PRICE;
    expect(castSlotRetryOffer(
      { state: "building", refundedCredits: null },
      price,
    )).toBeNull();
    expect(castSlotRetryOffer(
      { state: "pending", refundedCredits: null },
      price,
    )).toBeNull();
    expect(castSlotRetryOffer(
      { state: "failed-refunded", refundedCredits: null },
      price,
    )).toEqual({ priceCredits: price, reason: "refunded" });
    expect(castSlotRetryOffer(
      { state: "ready", unjudged: true, refundedCredits: null },
      price,
    )).toEqual({ priceCredits: 0, reason: "unchecked" });
  });

  /*
    THE PAIR HIS ROW RESTS ON (#1347), and it is asserted rather than assumed.

    His line is a word and a link that appear together or not at all. The offer
    carries both, so the shapes that would break it are structurally impossible
    — but "structurally impossible" is a claim about a type, and a branch added
    later can still return a price with a reason that has no word behind it.
    These two arms hold the population from BOTH ends over every slot shape the
    projection can produce, so a third road cannot ship half-drawn.
  */
  it("every offer carries a reason, and every reason is one the row has a word for", () => {
    const shapes: Array<[string, ReturnType<typeof slotsOf>]> = [
      ["failed", slotsOf([anchor(), asset(), failed("backFull")])],
      ["unjudged", slotsOf([anchor(), unjudged("closeUp")])],
      ["stand-in refunded", slotsOf([anchor(), failed("frontClose")])],
      ["all good", slotsOf([anchor(), asset()])],
      ["building", slotsOf([anchor(), unjudged("closeUp")], { status: "provisioning" })],
    ];
    let offers = 0;
    for (const [name, slots] of shapes) {
      for (const slot of slots.values()) {
        if (!slot.retry) continue;
        offers += 1;
        expect(
          VIEW_RETRY_WORDS[slot.retry.reason],
          `${name}/${slot.angle}: reason "${slot.retry.reason}" has no word on the row`,
        ).toBeTruthy();
      }
    }
    /* The floor, so a reader that found no offer at all cannot pass silently. */
    expect(offers).toBeGreaterThanOrEqual(3);
  });

  it("the row has no word the server cannot ask for — the map is not wider than the union", () => {
    /*
      The other direction, and the one working law 4 is about: a word sitting in
      the client's map with no reason producing it is a sentence nobody can ever
      read, and it would make the arm above pass forever.
    */
    expect(Object.keys(VIEW_RETRY_WORDS).sort()).toEqual(["refunded", "unchecked"]);
  });
});
