import { describe, expect, it, vi } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import {
  ANCHOR_STANDIN_NOTE,
  FAILED_SLOT_CONFESSION,
  projectSignedCast,
  TOTAL_LOSS_CONFESSION,
} from "./castProjection";

/*
  `storagePublicUrl` reads the R2 config from an import-time ENV snapshot and
  throws when it is absent, so on an envless checkout (CI) the kept-siblings
  case died in storage config before its assertion ran. The projection
  contract does not depend on WHICH bucket is configured — prime any absent
  R2 variable with an obvious test value (hoisted, so it lands before the ENV
  snapshot is taken) and leave a configured machine's real values untouched.
*/
vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

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
  castFromAt: new Date("2026-08-02T10:00:00Z"),
};

/** Newest-first, like the ledger's own order. */
function ledger(...assets: ModelAsset[]): ModelAsset[] {
  return [...assets].sort((a, b) => b.id - a.id);
}

/** A written-off view: the marker the room confesses from. */
const failed = (viewType: string) =>
  asset({
    id: 500 + viewType.length,
    viewType: viewType as ModelAsset["viewType"],
    storageUrl: "",
    status: { state: "failed", reason: "didn't arrive", refunded: 50 },
  });

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

  it("renders the view a v3 Cast actually bought", () => {
    /*
      THE REGRESSION, found by the first paid package-v3 Sign and worth the
      money it cost. `closeUp` is stored in the same column as the comp-card six
      but is deliberately not one of them, and the strip was drawn by iterating
      the six — so the slot was planned, generated, charged, judged, refunded
      and then dropped on the floor between the database and the screen. Every
      record was correct; the customer simply never saw it.

      The lesson generalises past this slot: a V2 surface iterates
      CAST_VIEW_ANGLES, and the comp-card six is a legacy list that happens to
      overlap.
    */
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(
        anchor(),
        asset({ id: 91, viewType: "closeUp" }),
        asset({ id: 92, viewType: "frontClose" }),
      ),
      lineage,
      promisedAngles: ["closeUp", "frontClose", "frontFull", "sideClose", "backFull"],
    });
    expect(projection.slots.map((entry) => entry.angle)).toEqual([
      "closeUp",
      "frontClose",
      "frontFull",
      "sideClose",
      "backFull",
    ]);
    // And it leads the strip, carrying its own label rather than the portrait's.
    expect(projection.slots[0].label).toBe("Close-up");
    expect(projection.slots[0].state).toBe("ready");
    expect(projection.slots[1].label).toBe("Portrait");
  });

  it("says the package never arrived, once, at the top of the room", () => {
    /*
      Founder ruling (2026-08-02): a total loss is a different event from five
      unlucky views and it gets its own sentence. Three facts the customer is
      owed — nothing arrived, ALL of it came back including the base, and the
      Cast is still theirs and still repairable. Said once at the room level,
      because five identical confessions in a strip is noise, and the base is
      the one number that behaves differently here.
    */
    const projection = projectSignedCast({
      model: model({ status: "active" }),
      assets: ledger(anchor(), failed("frontFull"), failed("closeUp")),
      lineage,
      promisedAngles: ["closeUp", "frontClose", "frontFull"],
    });
    expect(projection.notice).toBe(TOTAL_LOSS_CONFESSION);
    expect(projection.notice).toContain("including the Sign itself");
  });

  it("stays quiet when even one view landed", () => {
    // A partial package keeps its base, so the room must not claim otherwise.
    const projection = projectSignedCast({
      model: model({ status: "active" }),
      assets: ledger(anchor(), asset({ id: 93, viewType: "frontFull" }), failed("closeUp")),
      lineage,
      promisedAngles: ["closeUp", "frontClose", "frontFull"],
    });
    expect(projection.notice).toBeNull();
  });

  it("never lets the stand-in pose as a delivered view", () => {
    /*
      Founder ruling: the MASTER is always the chest-up image she was signed in,
      and the close-up is a supporting image. A companion cell that fell back to
      the anchor would show her twice and label one of them a close-up. The flag
      is what makes that rule mechanical rather than remembered.
    */
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
      promisedAngles: ["frontClose", "threeQuarter"],
    });
    const headshot = projection.slots.find((entry) => entry.angle === "frontClose");
    expect(headshot?.standIn).toBe(true);
    // A genuinely landed view carries no such flag.
    const other = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), asset({ viewType: "threeQuarter" })),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter"],
    }).slots.find((entry) => entry.angle === "threeQuarter");
    expect(other?.standIn).toBeUndefined();
  });

  it("labels a slot the way the CAST bought it, not the way today sells it", () => {
    // Her waist-up headshot is not retroactively a close-up because the profile
    // changed after she was signed.
    const legacy = projectSignedCast({
      model: model(),
      assets: ledger(anchor()),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "sideFull", "backFull"],
    });
    expect(legacy.slots.find((entry) => entry.angle === "frontClose")?.label).toBe("Headshot");

    const current = projectSignedCast({
      model: model(),
      assets: ledger(anchor()),
      lineage,
      promisedAngles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "backFull"],
    });
    expect(current.slots.find((entry) => entry.angle === "frontClose")?.label).toBe("Close-up");
  });

  it("carries her real kept siblings, and an honest absence when there are none", () => {
    const withSiblings = projectSignedCast({
      model: model(),
      assets: ledger(anchor()),
      lineage,
      siblings: [
        { publicId: "sib-1", imageKey: "k/1.png", thumbKey: null, position: 3 },
      ],
    });
    expect(withSiblings.siblings).toHaveLength(1);
    expect(withSiblings.siblings[0]).toMatchObject({ candidateId: "sib-1", indexLabel: "04" });
    expect(withSiblings.siblings[0].imageUrl).toContain("k/1.png");

    const alone = projectSignedCast({ model: model(), assets: ledger(anchor()), lineage });
    expect(alone.siblings).toEqual([]);
  });

  it("names where it came from, in public ids only", () => {
    const projection = projectSignedCast({ model: model(), assets: ledger(anchor()), lineage });
    expect(projection.provenance).toBe("Cast from a sheet on 2 August");
    expect(projection.lineage.fromCandidatePublicId).toBe("candidate-public");
    expect(projection.lineage.fromRollPublicId).toBe("roll-public");
  });
});

/**
 * A VIEW BEING ASKED FOR AGAIN IS A VIEW BEING MADE (#1235).
 *
 * The projection is where a tile in flight becomes server truth per slot, and
 * these arms are about the two things that follow from it and nothing else: the
 * tile says it is working, and it offers NOTHING while it is. The second half is the money
 * half — the offer this projection withholds is the same function the entrance
 * authorizes the spend with, so a slot that still offered would be a second
 * paid render on one view, which is what his third report bought twice.
 */
describe("a view being asked for again (#1235)", () => {
  const backFull = (projection: ReturnType<typeof projectSignedCast>) =>
    projection.slots.find((slot) => slot.angle === "backFull")!;

  it("marks the slot building, says why, and offers nothing", () => {
    const assets = ledger(anchor(), failed("backFull"));

    const atRest = backFull(projectSignedCast({ model: model(), assets, lineage }));
    // The control: without a running retry this is a confession WITH an offer.
    expect(atRest.state).toBe("failed-refunded");
    expect(atRest.retry).toEqual({ priceCredits: 50 });
    expect(atRest.retrying).toBeUndefined();

    const asking = backFull(projectSignedCast({
      model: model(),
      assets,
      lineage,
      retryingAngles: ["backFull"],
    }));
    expect(asking.state).toBe("building");
    expect(asking.retrying).toBe(true);
    expect(asking.retry).toBeUndefined();
    // The caption belongs to a slot at rest; this one is being worked on.
    expect(asking.note).toBeNull();
  });

  it("keeps the picture she already has while the new one renders", () => {
    /*
      An UNJUDGED view: delivered, charged, kept, and nobody looked at it. Its
      Try again is free, and its picture is hers until a new one lands — the
      retry never writes a failure marker over it (#1233), so the url stays and
      the room draws the working state over the top of it.
    */
    const unjudged = asset({
      viewType: "backFull",
      provenance: { conformanceMethod: "unavailable" },
    });
    const assets = ledger(anchor(), unjudged);

    const atRest = backFull(projectSignedCast({ model: model(), assets, lineage }));
    expect(atRest.retry).toEqual({ priceCredits: 0 });
    expect(atRest.unjudged).toBe(true);

    const asking = backFull(projectSignedCast({
      model: model(),
      assets,
      lineage,
      retryingAngles: ["backFull"],
    }));
    expect(asking.state).toBe("building");
    expect(asking.url).toBe(unjudged.storageUrl);
    expect(asking.retry).toBeUndefined();
  });

  it("touches only the angle that is being asked for", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), failed("backFull"), failed("threeQuarter")),
      lineage,
      retryingAngles: ["backFull"],
    });
    const other = projection.slots.find((slot) => slot.angle === "threeQuarter")!;

    /*
      HIS SECOND REPORT, ASSERTED HERE RATHER THAN IN THE PAGE: asking for one
      view must leave the others exactly as they were, offer included. The old
      room held one angle in one string and disabled every button from it.
    */
    expect(other.state).toBe("failed-refunded");
    expect(other.retry).toEqual({ priceCredits: 50 });
    expect(other.retrying).toBeUndefined();
  });

  it("is absent when nobody is asking", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), failed("backFull")),
      lineage,
      retryingAngles: [],
    });
    expect(projection.slots.every((slot) => slot.retrying === undefined)).toBe(true);
  });
});

/*
  ⚠ AT THE SENTENCE, NOT AT THE SYMBOL (#1208).

  Every other arm in this file asserts `note).toBe(FAILED_SLOT_CONFESSION)` —
  the constant compared to itself — so the copy could say anything at all and
  this suite would stay green. That is how *"repairs come with revisions"*
  survived thirteen months of a green file after the feature it named stopped
  being planned.

  His ruling is about WORDS, so these arms read words. They are deliberately
  narrow: they pin the one property he ruled on — a failure sentence never
  promises a repair path the product does not have — and say nothing about
  phrasing, which is his to change.
*/
describe("the failure copy promises nothing that does not exist (#1208)", () => {
  const UNBUILT_PROMISES = [
    "revision",
    "repairs ship",
    "when repairs",
    "coming soon",
    "in a future",
  ];

  for (const [name, sentence] of Object.entries({
    FAILED_SLOT_CONFESSION,
    TOTAL_LOSS_CONFESSION,
    ANCHOR_STANDIN_NOTE,
  })) {
    it(`${name} names no unbuilt repair path`, () => {
      for (const promise of UNBUILT_PROMISES) {
        expect(sentence.toLowerCase()).not.toContain(promise);
      }
      // A positive control: these are real sentences, not empty strings that
      // would pass every arm above by containing nothing at all.
      expect(sentence.length).toBeGreaterThan(20);
      expect(sentence).toContain("didn't arrive");
    });
  }

  /*
    The negative control for the guard itself (working law 2): the reader must
    FAIL on the sentence this card removed, or it proves nothing about the one
    that replaced it.
  */
  it("would reject the sentence this card removed", () => {
    const removed = "This view didn't arrive — refunded; repairs come with revisions";
    const caught = UNBUILT_PROMISES.some((promise) => removed.toLowerCase().includes(promise));
    expect(caught).toBe(true);
  });
});
