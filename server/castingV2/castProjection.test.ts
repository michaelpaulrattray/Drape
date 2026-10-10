import { describe, expect, it, vi } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";

/**
 * What a view's slice was refunded under the rule #1968 retired — a LEDGER and
 * ROW fact, not a product constant.
 *
 * ⚠ **It was `CAST_PACKAGE_VIEW_PRICE` and that constant is gone.** His word of
 * 2026-10-08 makes a Sign one flat charge with no per-view refund, so nothing
 * in the tree can produce this number any more — but Casts signed before it
 * carry slot markers that say exactly this, and the room still reads them. A
 * literal on purpose: deriving it from a live constant would be a fiction that
 * moves with his next price word.
 */
const LEGACY_VIEW_SLICE = 1000;

/**
 * WHAT A VIEW COST AND WHAT ASKING AGAIN COSTS — two numbers since 2026-10-01
 * (#1601 item 1), and this suite pinned both as the same literal `50`.
 *
 * ⚠ **THAT IS WHY THEY ARE SEPARATE NAMES HERE.** A refund is the VIEW's slice
 * — what was charged for it — and a paid Try again is its own price, dearer
 * because it is one render plus its own check rather than an amortised fifth of
 * a package. While both were 50 no arm in this file could tell which one the
 * projection was reading.
 */
const VIEW_PRICE = LEGACY_VIEW_SLICE;
const TRY_AGAIN_PRICE = CASTING_V2_VIEW_RETRY_PRICE_CREDITS;

import {
  FAILED_SLOT_CONFESSION,
  REFUNDED_SLOT_CONFESSION,
  landedViewAsset,
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
    pointsCost: VIEW_PRICE,
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
    status: { state: "failed", reason: "didn't arrive", refunded: VIEW_PRICE },
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
          status: { state: "failed", reason: "This view didn't arrive", refunded: VIEW_PRICE },
        }),
      ),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "backFull");
    expect(slot?.state).toBe("failed-refunded");
    expect(slot?.url).toBeNull();
    /* Its own share recorded, so the tile may say so (#2127). */
    expect(slot?.note).toBe(REFUNDED_SLOT_CONFESSION);
    expect(slot?.refundedCredits).toBe(VIEW_PRICE);
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
          // The refund itself failed to record. The room must say 0, not the view's price.
          status: { state: "failed", reason: "This view didn't arrive", refunded: 0 },
        }),
      ),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "backFull");
    expect(slot?.refundedCredits).toBe(0);
    /* And the tile's sentence makes no refund claim either — the negative
       control for #2127's "— refunded", which only a recorded share earns. */
    expect(slot?.note).toBe(FAILED_SLOT_CONFESSION);
    expect(slot?.note).not.toMatch(/refund/i);
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
          status: { state: "failed", reason: "This view didn't arrive", refunded: VIEW_PRICE },
        }),
      ),
      lineage,
    });
    const slot = projection.slots.find((entry) => entry.angle === "frontClose");
    // The customer is looking at the exact face they signed, so what she is owed
    // an explanation for is the refund rather than an absence.
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBe("https://cdn.example/anchor.png");
    expect(slot?.refundedCredits).toBe(VIEW_PRICE);
    /*
      ⚠ IT SAYS SO IN THE ROW'S ONE WORD NOW, NOT IN A SENTENCE UNDER THE TILE
      (#1347, his Desk reply 224). `ANCHOR_STANDIN_NOTE` is gone; the refund is
      what earns `reason: "refunded"`, and the room draws `Refunded · Try again`.
    */
    expect(slot?.note).toBeNull();
    /* ⚠ NO OFFER SINCE #2089 (his *"regenerate is the only option"*). It
       carried the refunded Try again here until then; the remedy is the
       whole-set redo, and the refund itself is still recorded above. */
    expect(slot?.retry).toBeUndefined();
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
          status: { state: "failed", reason: "This view didn't arrive", refunded: VIEW_PRICE },
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
    expect(projection.provenance).toBe("Created on 2 August");
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
    // The control: without a running retry this is a confession at rest. Since
    // #2089 it carries no offer either way, so the fact under test is the STATE.
    expect(atRest.state).toBe("failed-refunded");
    expect(atRest.note).not.toBeNull();
    expect(atRest.retry).toBeUndefined();
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
      A DELIVERED view: charged, kept, and nobody was able to look at it. Its
      picture is hers until a new one lands — the re-render never writes a
      failure marker over it (#1233), so the url stays and the room draws the
      working state over the top of it.

      ⚠ **WHAT PUTS IT IN `retryingAngles` IS NOW THE WHOLE-PACKAGE REDO — #1903
      slice 3.** This arm used to assert `retry` was a free offer at rest and
      read `unjudged: true` off the wire; both are retired, and a delivered view
      can no longer be asked for on its own at all. It can still be RE-RENDERED,
      because `listRunningViewRetryAngles` reads every view-replacing kind and
      the redo is one — so the #1233 question this arm exists for is live and
      arrives by a different road.
    */
    const unjudged = asset({
      viewType: "backFull",
      provenance: { conformanceMethod: "unavailable" },
    });
    const assets = ledger(anchor(), unjudged);

    const atRest = backFull(projectSignedCast({ model: model(), assets, lineage }));
    /* Nothing to ask for, and nothing said about it — the slice-3 rule. */
    expect(atRest.retry).toBeUndefined();
    expect(atRest.note).toBeNull();
    /* The control for the arm below: she really does have the picture at rest,
       so "the url survives" is about the retry and not about an empty slot. */
    expect(atRest.url).toBe(unjudged.storageUrl);

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
    /* Untouched means its confession too; no slot carries an offer since #2089. */
    expect(other.note).not.toBeNull();
    expect(other.retry).toBeUndefined();
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

  /*
    ⚠ `ANCHOR_STANDIN_NOTE` LEFT THIS POPULATION BY BEING DELETED (#1347), not by
    being excused — the population is every customer-facing failure sentence the
    projection still holds, and it is now two. Recorded because a suite that
    quietly loses a subject reads as coverage it no longer has
    (`directory-population-loses-promoted-subject`).
  */
  /* `REFUNDED_SLOT_CONFESSION` joined the population with #2127 — it is a
     customer-facing failure sentence, so it is held to the same arms. */
  for (const [name, sentence] of Object.entries({
    FAILED_SLOT_CONFESSION,
    REFUNDED_SLOT_CONFESSION,
    TOTAL_LOSS_CONFESSION,
  })) {
    it(`${name} names no unbuilt repair path`, () => {
      for (const promise of UNBUILT_PROMISES) {
        expect(sentence.toLowerCase()).not.toContain(promise);
      }
      // A positive control: these are real sentences, not empty strings that
      // would pass every arm above by containing nothing at all.
      expect(sentence.length).toBeGreaterThan(20);
      expect(sentence).toContain("didn't arrive");
      /*
        ⚠ **AND NEITHER MAY CLAIM MONEY CAME BACK FOR THIS VIEW — #1968.**
        `FAILED_SLOT_CONFESSION` said *"— refunded"* until his flat Sign price
        removed the per-view refund that made it true. `TOTAL_LOSS_CONFESSION`
        is about the whole Sign and is allowed to talk about money, so the ban
        is on the per-VIEW word rather than on the subject: a note that is
        drawn under one tile must not describe a refund.
      */
      if (name === "FAILED_SLOT_CONFESSION") {
        expect(sentence.toLowerCase(), "a per-view note cannot claim a refund (#1968)")
          .not.toContain("refund");
      }
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

describe("landedViewAsset — the picture a slot is actually showing (#1474)", () => {
  /*
    A retried full-length view dresses itself from its delivered sibling, and the
    entire worth of that is that the two pictures the customer ends up holding
    wear one outfit. So the reader that finds the sibling must answer with the
    SAME asset the room DISPLAYS. These arms are about that agreement, not about
    a selection rule of their own.
  */

  it("⚠ answers the same asset the projection shows for that slot — one law, not two", async () => {
    /*
      THE ARM THAT MATTERS. Anything else here could be satisfied by a second
      "newest filled one" written from scratch; this one reddens if the two ever
      diverge, which is the drift working law 4 exists for.
    */
    const assets = ledger(
      anchor(),
      asset({ id: 300, viewType: "frontFull", storageUrl: "https://cdn.example/old.png" }),
      asset({ id: 400, viewType: "frontFull", storageUrl: "https://cdn.example/new.png" }),
      failed("backFull"),
    );
    const projected = projectSignedCast({ model: model(), assets, lineage });
    const slot = projected.slots.find((candidate) => candidate.angle === "frontFull");

    const landed = landedViewAsset(assets, "frontFull");
    expect(landed).not.toBeNull();
    /* The room shows a URL and the reference road needs a KEY; the agreement is
       that they are the SAME ROW, which is what this asserts. */
    expect(slot?.url).toBe(landed?.storageUrl);
  });

  it("newest filled wins", () => {
    const assets = ledger(
      asset({ id: 300, viewType: "backFull", storageUrl: "https://cdn.example/old.png" }),
      asset({ id: 400, viewType: "backFull", storageUrl: "https://cdn.example/new.png" }),
    );
    expect(landedViewAsset(assets, "backFull")?.id).toBe(400);
  });

  it("a written-off slot has landed nothing — a confession is not an outfit", () => {
    /* Without this a retry would try to dress itself from a failure marker,
       whose `storageUrl` is the empty string. */
    expect(landedViewAsset(ledger(failed("frontFull")), "frontFull")).toBeNull();
  });

  it("the 1K anchor is not a delivered view — her face is no record of a hem", () => {
    /* `anchor()` is a `frontClose` at 1K. Asked for its own angle it must still
       answer null, because the anchor is identified by its resolution and role,
       never by being the only row there. */
    expect(landedViewAsset(ledger(anchor()), "frontClose")).toBeNull();
  });

  it("an angle with no rows at all is null, not a throw", () => {
    expect(landedViewAsset(ledger(anchor()), "backFull")).toBeNull();
  });
});

/**
 * WHO SHE IS ON CAMERA, AND HOW SHE SOUNDS, ON THE ROOM'S OWN PAYLOAD — N2b
 * (#1242).
 *
 * `castPersonaProjection.test.ts` drives the derivation itself over every
 * combination of the five columns. These three arms exist for a different
 * question, and it is the one invariant 7 asks: **does the thing a customer is
 * actually handed carry it.** A correct derivation that nothing calls is the
 * shape this repository has been bitten by, and this feature's entire surface
 * is one field on this one projection.
 */
describe("N2b's two lines on the signed Cast projection", () => {
  it("carries the two lines and the derived badge", () => {
    const projection = projectSignedCast({
      model: model({
        personality: "Unhurried, hands still.",
        voice: "Low and level.",
        personaDraftedAt: new Date("2026-10-09T01:00:00Z"),
      } as Partial<Model>),
      assets: ledger(anchor(), asset()),
      lineage,
    });
    expect(projection.persona).toEqual({
      personality: { text: "Unhurried, hands still.", drafted: true, ownWords: null },
      voice: { text: "Low and level.", drafted: true, ownWords: null },
    });
  });

  /* "Say it your way" (#2197 / #2205): the customer's own sentence reaches the
     room beside the line it produced — through the payload the room is really
     handed, not only through the little derivation. */
  it("carries the customer's own sentence beside the line it was kept from", () => {
    const projection = projectSignedCast({
      model: model({
        personality: "Shoulders squared at the door.",
        voice: "Gravel, slow.",
        personalityEditedAt: new Date("2026-10-10T01:00:00Z"),
        personalityOwnWords: "Basically a tired old bouncer.",
      } as Partial<Model>),
      assets: ledger(anchor(), asset()),
      lineage,
    });
    expect(projection.persona?.personality?.ownWords).toBe("Basically a tired old bouncer.");
    expect(projection.persona?.voice?.ownWords).toBeNull();
  });

  it("carries null for every Cast signed before N2b, so the room draws no card", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: ledger(anchor(), asset()),
      lineage,
    });
    expect(projection.persona).toBeNull();
  });

  /*
    ⚠ THE SAME QUESTION THE TOP OF THIS FILE ASKS, POINTED AT THE NEW FIELD.
    These two lines are CREATIVE CONTENT about a customer's cast — the same
    family as `masterPrompt` under his ruling of 2026-07-25 — so the arm that
    proves nothing sensitive escapes has to know they exist, or the field grows
    beside a guard that cannot see it.
  */
  it("the two lines are the ONLY new prose on the payload — no stamp, no schema", () => {
    const projection = projectSignedCast({
      model: model({
        personality: "Unhurried, hands still.",
        voice: "Low and level.",
        personaDraftedAt: new Date("2026-10-09T01:00:00Z"),
        personalityEditedAt: new Date("2026-10-09T02:00:00Z"),
      } as Partial<Model>),
      assets: ledger(anchor(), asset()),
      lineage,
    });
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(SECRET_PROMPT);
    /* The timestamps are the derivation's INPUT and never its output: a client
       handed `personaDraftedAt` could compute its own badge, which is the
       second reader working law 4 refuses. */
    expect(serialized).not.toContain("personaDraftedAt");
    expect(serialized).not.toContain("EditedAt");
    expect(projection.persona?.personality?.drafted).toBe(false);
  });
});
