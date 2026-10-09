import { describe, expect, it, vi } from "vitest";

import type { Model, ModelAsset } from "../../drizzle/schema";
import {
  castSlotRetryOffer,
  REFUNDED_SLOT_CONFESSION,
  projectSignedCast,
} from "./castProjection";
import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
/**
 * What a view's slice was refunded under the rule #1968 retired — a LEDGER and
 * ROW fact, not a product constant.
 *
 * ⚠ **It was `LEGACY_VIEW_SLICE` and that constant is gone.** His word of
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
  /**
   * ⚠ **EVERY ARM IN THIS BLOCK NOW ASSERTS THE SAME ANSWER — NOTHING — AND
   * THAT IS #2089, his word of 2026-10-08 (terminal), verbatim and entire:
   * *"regenerate is the only option"*.**
   *
   * Until then a REFUNDED view (and the legacy stand-in whose close-up was
   * refunded) offered a paid Try again at `CASTING_V2_VIEW_RETRY_PRICE_CREDITS`,
   * and these arms held that price. The fixtures are kept exactly as they were,
   * because they are the shapes most likely to bring a per-view offer back by
   * accident; what they assert is the retirement. The remedy for any view is
   * the whole-set redo, whose offer is a different function and is held below
   * to stay ON for the very Cast whose slots offer nothing.
   */
  it("a view that failed was refunded — it confesses, and offers NOTHING", () => {
    const projection = projectSignedCast({
      model: model(),
      assets: [anchor(), asset(), failed("backFull")].sort((a, b) => b.id - a.id),
      lineage,
      promisedAngles: ["frontFull", "threeQuarter", "sideFull", "backFull", "closeUp"],
    });
    const slot = projection.slots.find((candidate) => candidate.angle === "backFull");
    expect(slot?.state).toBe("failed-refunded");
    /*
      The one true sentence the tile keeps. ⚠ **IT NO LONGER ENDS IN
      "— refunded", AND THIS FIXTURE IS NOW A LEGACY ROW — #1968.** The note
      said the refund was real *"(the Sign's per-view slice)"*; his flat price
      removes that slice, so a view refused today refunds nothing and the
      sentence claims nothing. The marker below still carries a figure because
      Casts signed before the reprice really were refunded per view, and the
      room must keep reading them honestly.

      ⚠ **AND SINCE #2127 IT SAYS SO AGAIN, because the marker says money
      recorded.** A view lost to a sheet the provider refused is refunded its
      share, and any marker carrying a recorded figure — this legacy one
      included, which really was refunded — earns the word back.
    */
    expect(slot?.note).toBe(REFUNDED_SLOT_CONFESSION);
    expect(slot?.refundedCredits).toBe(LEGACY_VIEW_SLICE);
    expect(slot?.retry).toBeUndefined();
    /*
      THE REMEDY, ON THE SAME CAST — and it is the control that matters: an
      arm that only said "no per-view offer" would pass on a projection that
      offered nothing at all, which would leave her with no remedy.
    */
    expect(projection.redo).not.toBeNull();
    expect(projection.redo?.priceCredits).toBeGreaterThan(0);
  });

  it("a view nobody could check is DELIVERED and offers NOTHING — no label, no free ask", () => {
    const slots = slotsOf([anchor(), unjudged("closeUp")]);
    const slot = slots.get("closeUp");
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBeTruthy();
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

  it("the headshot standing in for a refunded close-up offers NOTHING too", () => {
    const slots = slotsOf([anchor(), failed("frontClose")]);
    const slot = slots.get("frontClose");
    expect(slot?.standIn).toBe(true);
    /* What went back is still recorded — the refund happened. */
    expect(slot?.refundedCredits).toBe(LEGACY_VIEW_SLICE);
    expect(slot?.retry).toBeUndefined();
    expect(slot?.note).toBeNull();
  });

  it("a stand-in with NOTHING refunded is a Cast that never bought that view — no offer", () => {
    const slots = slotsOf(
      [anchor(), asset()],
      {},
      ["frontClose", "frontFull", "threeQuarter", "sideFull", "backFull", "closeUp"],
    );
    expect(slots.get("frontClose")?.standIn).toBe(true);
    expect(slots.get("frontClose")?.retry).toBeUndefined();
  });

  it("nothing is offered while building, AND nothing once terminal — building is no longer the only refusal", () => {
    const building = slotsOf([anchor(), asset(), failed("backFull")], { status: "provisioning" });
    expect([...building.values()].every((slot) => slot.retry === undefined)).toBe(true);
    const terminal = slotsOf([anchor(), asset(), failed("backFull")]);
    /* The same rows, terminal, hold a refunded slot — the shape that offered
       until #2089 — so this is about the refunded slot and not an empty fixture. */
    expect(terminal.get("backFull")?.state).toBe("failed-refunded");
    expect([...terminal.values()].every((slot) => slot.retry === undefined)).toBe(true);
  });

  it("the rule answers null for EVERY state the slot can be in, at any price", () => {
    /*
      An INJECTED price that is neither of the product's numbers, so this arm
      cannot pass because a caller happened to pass a constant the function
      reached for. Every shape that offered before #2089 is here by name.
    */
    const price = 777;
    const shapes: Array<Parameters<typeof castSlotRetryOffer>[0]> = [
      { state: "building", refundedCredits: null },
      { state: "pending", refundedCredits: null },
      { state: "failed-refunded", refundedCredits: null },
      { state: "failed-refunded", refundedCredits: LEGACY_VIEW_SLICE },
      { state: "ready", refundedCredits: null },
      { state: "ready", standIn: true, refundedCredits: 200 },
      { state: "ready", standIn: true, refundedCredits: null },
    ];
    for (const shape of shapes) {
      expect(castSlotRetryOffer(shape, price), JSON.stringify(shape)).toBeNull();
      expect(castSlotRetryOffer(shape, CASTING_V2_VIEW_RETRY_PRICE_CREDITS), JSON.stringify(shape)).toBeNull();
    }
  });

  /**
   * THE WHOLE POPULATION, WALKED — every slot of every shape the projection can
   * produce from these fixtures carries no offer. The FLOOR below is what keeps
   * the walk honest: it must actually visit the refunded and stand-in slots
   * that offered before #2089, or an empty walk would pass.
   */
  it("no slot of any projected shape carries an offer, and the walk visits the shapes that used to", () => {
    const shapes: Array<[string, ReturnType<typeof slotsOf>]> = [
      ["failed", slotsOf([anchor(), asset(), failed("backFull")])],
      ["unjudged", slotsOf([anchor(), unjudged("closeUp")])],
      ["stand-in refunded", slotsOf([anchor(), failed("frontClose")])],
      ["all good", slotsOf([anchor(), asset()])],
      ["building", slotsOf([anchor(), asset(), failed("backFull")], { status: "provisioning" })],
    ];
    let formerlyOffered = 0;
    for (const [name, slots] of shapes) {
      for (const slot of slots.values()) {
        expect(slot.retry, `${name}/${slot.angle} carries a per-view offer`).toBeUndefined();
        if (
          (slot.state === "failed-refunded")
          || (slot.state === "ready" && slot.standIn === true && slot.refundedCredits !== null)
        ) formerlyOffered += 1;
      }
    }
    expect(formerlyOffered).toBeGreaterThanOrEqual(3);
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
    /* The row's word map (`viewRetryRow.ts`) that this line used to hold
       against is deleted with the row itself (#2089) — no word can come back
       without a module to live in. */
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
