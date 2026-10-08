import { describe, expect, it, vi } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import { VIEW_RETRY_WORDS } from "../../client/src/features/castingV2/viewRetryRow";
import {
  castSlotRetryOffer,
  projectSignedCast,
} from "./castProjection";
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
const failed = (viewType: string, refunded = LEGACY_VIEW_SLICE) =>
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
  it("a view that failed was refunded, so asking again is a PAID ask at the Try again price", () => {
    /*
      ⚠ **IT WAS THE VIEW'S PRICE UNTIL 2026-10-01 AND THIS ARM COULD NOT TELL
      WHICH CONSTANT THE CODE READ.** Both callers passed
      the view's own slice into `castSlotRetryOffer`, so an arm asserting
      the view price proved only that the offer carried SOME number. A paid Try
      again is its own price under his approved pricing (#1601 item 1) — 1,850
      against a view's 1,000 — so the two are asserted apart and the arm names
      which one belongs on a tile.
    */
    const slots = slotsOf([anchor(), asset(), failed("backFull")]);
    expect(slots.get("backFull")?.state).toBe("failed-refunded");
    expect(slots.get("backFull")?.retry).toEqual({
      priceCredits: CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
      reason: "refunded",
    });
    /* The control that the arm above is about the Try again price and not
       about a view's: a code path still reading the view price fails here. */
    expect(CASTING_V2_VIEW_RETRY_PRICE_CREDITS).not.toBe(LEGACY_VIEW_SLICE);
  });

  /**
   * ⚠ **THIS ARM SAID *"asking again is FREE"* UNTIL #1903 SLICE 3, AND IT IS
   * THE SAME FIXTURE ASSERTING THE OPPOSITE — his ruling of 2026-10-07.**
   *
   * A view nobody could judge is still DELIVERED and still CHARGED: D-246 is
   * untouched, because charging nothing for a picture that may be perfect is
   * the worse answer. What has gone is the apology — the `Unchecked` word and
   * the free ask under it. His remedy for a view she does not like is the paid
   * whole-package redo, which re-makes every view together.
   *
   * **Kept as an arm rather than deleted, because the fixture is the thing most
   * likely to come back by accident**: a later reader that resurrects the
   * delivered-unchecked reading would turn a paid surface free again, and only
   * an arm standing on this exact row would notice.
   */
  it("a view nobody could check is DELIVERED and offers NOTHING — no label, no free ask", () => {
    const slots = slotsOf([anchor(), unjudged("closeUp")]);
    const slot = slots.get("closeUp");
    expect(slot?.state).toBe("ready");
    /* The picture is hers and it is on the tile — the delivery half of D-246. */
    expect(slot?.url).toBeTruthy();
    /* And the tile says nothing about it: no caption, no word, no link. */
    expect(slot?.note).toBeNull();
    expect(slot?.retry).toBeUndefined();
  });

  it("a view that arrived and WAS checked offers nothing at all", () => {
    const slots = slotsOf([anchor(), asset()]);
    const slot = slots.get("frontFull");
    expect(slot?.state).toBe("ready");
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
    /* What went BACK is the view's slice — that is what was charged for it. */
    expect(slot?.refundedCredits).toBe(LEGACY_VIEW_SLICE);
    /* What asking again COSTS is the Try again price, which is a different
       number since #1601 item 1. The two sit side by side here on purpose:
       this slot is the one place a refund and a re-purchase are both visible,
       and conflating them is exactly the mistake the old arm could not see. */
    expect(slot?.retry).toEqual({
      priceCredits: CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
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
    const building = slotsOf([anchor(), asset(), failed("backFull")], { status: "provisioning" });
    expect([...building.values()].every((slot) => slot.retry === undefined)).toBe(true);
    /*
      The positive control that keeps the arm above from passing for the wrong
      reason: the SAME rows, terminal, do offer.

      ⚠ **IT USED AN UNJUDGED SLOT UNTIL #1903 SLICE 3, AND THAT SLOT NOW OFFERS
      NOTHING WHATEVER THE STATUS** — so the control would have passed for
      exactly the wrong reason, agreeing with the arm above while proving
      nothing. A REFUNDED slot is the shape that still has something to ask for,
      and it is what makes `building` the fact under test rather than the
      fixture.
    */
    const terminal = slotsOf([anchor(), asset(), failed("backFull")]);
    expect(terminal.get("backFull")?.retry).toEqual({
      priceCredits: CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
      reason: "refunded",
    });
  });

  it("the rule is a pure reading of the slot, and it refuses every other state", () => {
    /*
      An INJECTED price, and a number that is neither of the product's two
      (a view's 1,000, a Try again's 1,850), so this arm is about the states
      and cannot accidentally pass because a caller happened to pass the same
      constant the function reached for. The function takes no constant of its
      own — both its callers hand it one.
    */
    const price = 777;
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
    /* ⚠ A DELIVERED VIEW IS NOW ONE OF THE REFUSED STATES — #1903 slice 3. This
       line read `.toEqual({ priceCredits: 0, reason: "unchecked" })` and the
       `unjudged` field it keyed on is off the wire entirely. A `ready` slot that
       is not a refunded stand-in has nothing to ask for at any price. */
    expect(castSlotRetryOffer(
      { state: "ready", refundedCredits: null },
      price,
    )).toBeNull();
    /* And the one `ready` shape that DOES still offer, so the line above is
       about delivery and not about `ready` being refused wholesale. */
    expect(castSlotRetryOffer(
      { state: "ready", standIn: true, refundedCredits: 200 },
      price,
    )).toEqual({ priceCredits: price, reason: "refunded" });
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
      /* Still in the population after #1903 slice 3, and now as a shape that
         must produce NO offer — which the floor below is what protects. */
      ["unjudged", slotsOf([anchor(), unjudged("closeUp")])],
      ["stand-in refunded", slotsOf([anchor(), failed("frontClose")])],
      ["all good", slotsOf([anchor(), asset()])],
      ["building", slotsOf([anchor(), asset(), failed("backFull")], { status: "provisioning" })],
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
    /* The floor, so a reader that found no offer at all cannot pass silently.
       Deliberately a floor and not an equality: the number is a property of how
       many slots these fixtures happen to leave unfilled, not of his ruling, and
       an equality here would redden on a fixture edit that changed nothing real. */
    expect(offers).toBeGreaterThanOrEqual(3);
  });

  /**
   * ⚠ **AND THE SHAPE THAT MUST CONTRIBUTE NOTHING, ASSERTED BY NAME — #1903
   * slice 3.**
   *
   * The arm above walks every shape and holds each offer to having a word. It
   * is satisfied by an `unjudged` slot that offers nothing AND by one that
   * offers `unchecked` with a word restored beside it — so on its own it cannot
   * see the free ask coming back. This is the half that can: a delivered view,
   * judged or unjudgeable, contributes no offer at all.
   */
  it("a DELIVERED view contributes no offer to that population, however it was judged", () => {
    const shapes = [
      ["nobody looked", slotsOf([anchor(), unjudged("closeUp")])],
      ["judged clean", slotsOf([anchor(), asset()])],
    ] as const;
    for (const [name, slots] of shapes) {
      for (const slot of slots.values()) {
        if (slot.state !== "ready" || slot.standIn === true) continue;
        expect(slot.retry, `${name}/${slot.angle}: a delivered view is offering something`)
          .toBeUndefined();
      }
    }
  });

  it("the row has no word the server cannot ask for — the map is not wider than the union", () => {
    /*
      The other direction, and the one working law 4 is about: a word sitting in
      the client's map with no reason producing it is a sentence nobody can ever
      read, and it would make the arm above pass forever.
    */
    expect(Object.keys(VIEW_RETRY_WORDS).sort()).toEqual(["refunded"]);
  });
});

/**
 * ⚠ **THE SECOND ROAD TO A FREE TRY AGAIN — #1612 part 2, his ruling
 * 2026-09-30.**
 *
 * A view whose FRAMING or WARDROBE the judge turned down is now delivered
 * rather than refunded, so the customer is holding a picture they paid for that
 * nothing can vouch for — which is the same fact D-246 already answers with a
 * free retry, arrived at by a different road. These arms are here and not only
 * beside the orchestrator because the PRICE is what the customer sees: the
 * entrance authorizes with this same function, so a reading that drifted would
 * drift at the till in the same direction and nothing would disagree with
 * itself.
 */
/**
 * ⚠ **THESE ARMS DESCRIBE HISTORY NOW, AND THEY ARE WORTH MORE FOR IT — #1903,
 * his ruling of 2026-10-07.**
 *
 * The framing and wardrobe axes are DELETED, so no view delivered from here on
 * can reach this state: every axis the judge still has is a catastrophe and
 * refuses. But the rows below are not fixtures of a dead road — **three real
 * production rows carry exactly this shape** (assets 383, 389 and 391, written
 * in the hours #1612 part 2 was live).
 *
 * ⚠ **AND WHAT THEY HOLD IS NOW THE OPPOSITE ANSWER — SLICE 3 TOOK THE FREE
 * ASK AWAY, AND THESE THREE ROWS ARE EXACTLY WHO IT WAS TAKEN FROM.** This
 * header used to end *"each is a view somebody paid for that is owed a free Try
 * again"*, and the arms held the price at 0. They now hold that the same rows
 * are offered NOTHING.
 *
 * **That is a money change, so it was measured before it was made, not after**
 * (`scripts/_1903-unchecked-population-disposable.mts`, production, read-only):
 * six rows in the whole product read unchecked — 317, 322 and 324 under
 * `unavailable` and these three — and **every one of them belongs to user 1.**
 * The only other account that has ever cast is the team's design agent. So the
 * withdrawal reaches no paying stranger, and the arms below are the record of
 * what it does reach.
 */
describe("a delivered view whose row carries a RETIRED failing axis (history, and three live rows)", () => {
  /** Delivered, judged, and one axis did not hold (#1612 part 2, retired by #1903). */
  const deliveredUnchecked = (viewType: string, failing: "angle" | "wardrobe") =>
    asset({
      viewType: viewType as ModelAsset["viewType"],
      provenance: {
        provider: "fal",
        engine: "fal-ai/nano-banana-pro",
        conformanceMethod: "judge:openrouter:anthropic/claude-sonnet-5",
        conformance: {
          identity: { pass: true, verdict: "matches", note: "same person" },
          angle: { pass: failing !== "angle", verdict: failing === "angle" ? "differs" : "matches", note: "" },
          wardrobe: {
            pass: failing !== "wardrobe",
            verdict: failing === "wardrobe" ? "unsure" : "matches",
            note: "",
          },
        },
      },
    });

  it("was charged and kept, and is now offered NOTHING — the free ask is retired", () => {
    const slots = slotsOf([anchor(), deliveredUnchecked("closeUp", "angle")]);
    const slot = slots.get("closeUp");
    /* She keeps the picture. That half never changed and is not being retired:
       the view was delivered and charged, and it is still on her tile. */
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBeTruthy();
    /* What changed: no word, no link, no price. */
    expect(slot?.note).toBeNull();
    expect(slot?.retry).toBeUndefined();
    /* And the word itself is off the row's map, so a reader cannot put the
       label back without this arm and the map's own guard both objecting. */
    expect(Object.keys(VIEW_RETRY_WORDS)).not.toContain("unchecked");
  });

  it("reads the same whether the axis said differs or unsure", () => {
    const slots = slotsOf([anchor(), deliveredUnchecked("closeUp", "wardrobe")]);
    expect(slots.get("closeUp")?.retry).toBeUndefined();
  });

  it("⚠ CONTROL — a view whose retired axes all passed still offers nothing", () => {
    const slots = slotsOf([
      anchor(),
      asset({
        provenance: {
          provider: "fal",
          engine: "fal-ai/nano-banana-pro",
          conformanceMethod: "judge:openrouter:anthropic/claude-sonnet-5",
          conformance: {
            identity: { pass: true, note: "" },
            angle: { pass: true, note: "" },
            wardrobe: { pass: true, note: "" },
          },
        },
      }),
    ]);
    const slot = slots.get("frontFull");
    expect(slot?.retry).toBeUndefined();
  });

  /*
    ⚠ **THE ARM THAT DECIDED HOW THE READING IS WRITTEN, AND IT IS A MONEY ARM.**

    Read at production before a line was written: of 69 landed views, 46 carry a
    full judged record, 3 carry `unavailable`, and **20 carry no `conformance`
    key at all** — views that landed before the field existed. A reading that
    treated an ABSENT record as "unchecked" would have handed every one of those
    20 a free Try again tonight, retroactively, on a money surface, for a change
    about something else entirely. So absence keeps today's answer, and this arm
    is what holds it there.
  */
  it("⚠ a view that predates the conformance record is UNCHANGED — absence is not a failing axis", () => {
    const slots = slotsOf([
      anchor(),
      asset({ provenance: { provider: "fal", engine: "fal-ai/nano-banana-pro" } }),
    ]);
    const slot = slots.get("frontFull");
    expect(slot?.state).toBe("ready");
    expect(slot?.retry).toBeUndefined();
  });
});
