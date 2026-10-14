/**
 * THE VOICE CARD'S TWO MUTATIONS, AT THE ROAD — the repair of #2470's finding,
 * items 3, 4 and 5.
 *
 * Both defects the first two arms are about were invisible to every suite that
 * existed: one is a RACE between two presses, which a sequential arm cannot
 * see, and the other is a LIMITER shared between a press and a page opening,
 * which only shows once something counts the two separately.
 *
 * ⚠ **THE RATE LIMITER AND THE DESIGN STORE ARE THE REAL ONES.** Only the
 * scope, the cast read and the provider service are stubbed. A mocked limiter
 * would have let these arms pass with the two buckets still being one — the
 * limiter's own keying IS the claim in item 4 — and a mocked store would have
 * done the same for the claim in item 3. Each arm takes its OWN user id,
 * because the real limiter is in-memory, keyed `user:<id>`, and has no reset
 * hook, so a shared id would leak one arm's presses into the next.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const MODEL_ID = 512;
const SENTENCE = "Low, unhurried, a north Atlantic rasp.";

let voiceOn = true;
let keepResult: unknown = { ok: true, clipBytes: 1_234 };
/** When set, the next design REFUSES with this key (#2471's refund arms). */
let designRefusal: string | null = null;
/**
 * When set, the next design THROWS this.
 *
 * A refusal and a throw are different roads through the money and the limiter —
 * the refusal comes back in the result (invariant 6) and a throw is a genuine
 * failure `withAtomicCredits` refunds and re-words. The repair of the relay's
 * finding on PR #2499 touches BOTH, so a lever that could only refuse would
 * have left the throw half of every arm below unproven.
 */
let designThrows: Error | null = null;
let keepability = { canKeep: true };
let keptRow: unknown = null;
const saves: string[] = [];
/** #2497 — the casts Remove was asked about, and whether it found a voice. */
const removals: number[] = [];
let removeFinds = true;

vi.mock("../castingV2/castingV2Scope", () => ({
  captureCastingV2Enabled: () => true,
  captureCastingVoiceEnabled: () => voiceOn,
}));

/*
  ⚠ **A CAST ID MAPS TO ITS OWN MODEL, AND THAT IS LOAD-BEARING SINCE #2471.**
  Every cast used to resolve to one model id, which was harmless while no limit
  was keyed on a cast. The free automatic design is now bounded at one per cast
  per day, so a fixture with a single model makes that bound look like a bound
  on the ACCOUNT — and the arms that drive the hourly bucket across many casts
  could not exist at all.
*/
const modelIds = new Map<string, number>();
function modelIdFor(castId: string): number {
  const existing = modelIds.get(castId);
  if (existing !== undefined) return existing;
  const next = MODEL_ID + modelIds.size;
  modelIds.set(castId, next);
  return next;
}

vi.mock("../db/castingV2Sign", () => ({
  getOwnedCastByPublicId: async (_userId: number, castId: string) => ({
    id: modelIdFor(castId),
    voice: SENTENCE,
    name: "Hallvard",
  }),
}));

/*
  ⚠ **THE LEDGER IS MOCKED AT `db/credits`, SO `withAtomicCredits` ITSELF IS
  THE REAL ONE.** The charge, the derived refund reference, the insufficient
  refusal and the refund-on-throw are the product's audited money path
  (`server/casting/atomicCredits.ts`), and mocking THAT would leave every money
  claim in this file proving only that a stub was called. `atomicCredits` binds
  these two from the declaring module rather than the `db` barrel for exactly
  this reason (#2483), so this is the sanctioned seam.
*/
let balance = 1_000_000;
let refundRecords = true;
const charges: { amount: number; toolKind: string | null; reference: string }[] = [];
const refunds: { amount: number; reference: string }[] = [];

vi.mock("../db/credits", () => ({
  deductCredits: async (
    _userId: number,
    amount: number,
    _type: string,
    _description: string,
    referenceId: string | undefined,
    attribution: { toolKind: string | null },
  ) => {
    if (balance < amount) return { success: false, insufficient: true as const };
    balance -= amount;
    charges.push({ amount, toolKind: attribution.toolKind, reference: referenceId ?? "" });
    return { success: true, newBalance: balance };
  },
  addCredits: async (
    _userId: number,
    amount: number,
    _type: string,
    _description: string,
    referenceId: string | undefined,
  ) => {
    if (!refundRecords) return { success: false, error: "ledger unavailable" };
    balance += amount;
    refunds.push({ amount, reference: referenceId ?? "" });
    return { success: true, newBalance: balance };
  },
  normalizeCreditReferenceId: (id: string) => id,
}));

/* The frozen-account read is a database one; `withAtomicCredits` skips it when
   there is no database, which is the honest shape for a unit arm. */
vi.mock("../db/connection", () => ({ getDb: async () => null }));

vi.mock("../db/castVoices", () => ({
  readCastVoice: async () => keptRow,
}));

vi.mock("../castingV2/voiceService", () => ({
  designCastVoices: async () => {
    if (designThrows !== null) throw designThrows;
    if (designRefusal !== null) return { ok: false, refusal: designRefusal };
    return {
      ok: true,
      designSentence: SENTENCE,
      previews: [
        { previewId: "gen-a", bytes: Buffer.from("a"), contentType: "audio/mpeg", durationSeconds: 19 },
        { previewId: "gen-b", bytes: Buffer.from("b"), contentType: "audio/mpeg", durationSeconds: 21 },
        { previewId: "gen-c", bytes: Buffer.from("c"), contentType: "audio/mpeg", durationSeconds: 20 },
      ],
      latencyMs: 7_000,
    };
  },
  /*
    ⚠ **THE SAVE IS RECORDED, AND IT IS SLOW ON PURPOSE.** One monthly voice
    operation is what a save spends, so the COUNT of these calls is the money
    assertion in item 3 — and the await is what lets two presses overlap the way
    they do in a browser.
  */
  keepCastVoice: async () => {
    saves.push("save");
    await new Promise((resolve) => setTimeout(resolve, 20));
    return keepResult;
  },
  readVoiceKeepability: async () => keepability,
  /* #2497 — what Remove found, recorded so an arm can count the calls. */
  removeCastVoiceForCast: async (input: { userId: number; modelId: number }) => {
    removals.push(input.modelId);
    return { ok: true, removed: removeFinds, slotReleased: removeFinds ? true : null };
  },
}));

const { designVoicesForCard, keepVoiceForCard, readVoiceCardStatus, removeVoiceForCard } =
  await import("./castingVoice");
const {
  CASTING_V2_VOICE_DESIGN_PRICE_CREDITS: VOICE_DESIGN_PRICE,
  CASTING_V2_VOICE_KEEP_PRICE_CREDITS: VOICE_KEEP_PRICE,
} = await import("../casting/castingCreditCosts");
const { RATE_LIMITS, checkRateLimit } = await import("../security/rateLimit");
const { resetVoiceDesignStore, voiceDesignStoreSize } =
  await import("../castingV2/voiceDesignStore");

beforeEach(() => {
  voiceOn = true;
  keepResult = { ok: true, clipBytes: 1_234 };
  designRefusal = null;
  designThrows = null;
  keepability = { canKeep: true };
  keptRow = null;
  saves.length = 0;
  removals.length = 0;
  removeFinds = true;
  balance = 1_000_000;
  refundRecords = true;
  charges.length = 0;
  refunds.length = 0;
  resetVoiceDesignStore();
});

/** A fresh account per arm, so the real limiter's buckets never overlap. */
let nextUser = 9_000;
function freshUser(): number {
  nextUser += 1;
  return nextUser;
}

describe("two presses of Keep on one handle", () => {
  it("⚠ MAKE EXACTLY ONE PROVIDER SAVE — the double-press, driven at the road", async () => {
    /*
      THE CLAIM OF THIS SUITE. Before the repair both presses resolved the same
      handle and both called the provider: the loser released its slot, but its
      operation was spent out of the month's 95 and no delete refunds it.
    */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    expect(design.ok).toBe(true);
    if (!design.ok) throw new Error("unreachable");

    const press = {
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[0].handle,
    };
    const [first, second] = await Promise.all([
      keepVoiceForCard(press),
      keepVoiceForCard(press),
    ]);

    expect(saves).toHaveLength(1);
    /* One press kept the voice; the other was told to make them again, which is
       the same answer a replayed handle has always had. */
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
  });

  it("gives the design back when a Keep is REFUSED, so three voices are not lost", async () => {
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    if (!design.ok) throw new Error("unreachable");
    keepResult = { ok: false, refusal: "no_operations_left" };

    const refused = await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[1].handle,
    });

    /* ⚠ **AND THE MONEY CAME BACK** (#2471). `refunded` is the ledger's own
       answer, not an assumption, and it is what lets the card say "nothing was
       charged" truthfully — a spent month must not cost a customer 100 credits
       for a voice they did not get. The refund lands under the DERIVED
       reference, which is what makes a retry idempotent. */
    /* ⚠ **AND NO REFERENCE, BECAUSE THE REFUND RECORDED.** A reference quoted
       beside credits that came back is machinery with nothing to do; it is
       carried ONLY on the road where the customer is genuinely out of pocket
       (the relay's finding on PR #2499, item 4). */
    expect(refused).toEqual({
      ok: false,
      refusal: "no_operations_left",
      refunded: true,
      refundReference: null,
    });
    /* TWO charges — the design press, then the Keep — and only the KEEP's comes
       back: the three voices were delivered and paid for, the voice was not. */
    expect(charges.map((charge) => charge.amount)).toEqual([
      VOICE_DESIGN_PRICE,
      VOICE_KEEP_PRICE,
    ]);
    expect(refunds).toEqual([
      { amount: VOICE_KEEP_PRICE, reference: `refund:${charges[1].reference}` },
    ]);
    /* Restored: a spent month must not also cost the customer the three voices
       they could keep a minute later. */
    expect(voiceDesignStoreSize()).toBe(1);
    keepResult = { ok: true, clipBytes: 99 };
    expect(await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[1].handle,
    })).toMatchObject({ ok: true });
  });

  it("⚠ a Keep that LOST A LOCK RACE is refunded AND leaves the three voices keepable (#2506)", async () => {
    /*
      The card's own test. A lock wait that ran out on a live cast used to
      arrive here as `cast_not_available` and end the design; the service now
      calls it `lost_race`, and this arm proves the route answers that with
      the money back and the same three handles still good.
    */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A", automatic: true });
    if (!design.ok) throw new Error("unreachable");
    keepResult = { ok: false, refusal: "lost_race" };

    const press = {
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[2].handle,
    };
    expect(await keepVoiceForCard(press)).toEqual({
      ok: false,
      refusal: "lost_race",
      refunded: true,
      refundReference: null,
    });
    expect(charges.map((charge) => charge.amount)).toEqual([VOICE_KEEP_PRICE]);
    expect(refunds).toEqual([
      { amount: VOICE_KEEP_PRICE, reference: `refund:${charges[0].reference}` },
    ]);

    /* The same handle keeps on the next press — the design was given back. */
    expect(voiceDesignStoreSize()).toBe(1);
    keepResult = { ok: true, clipBytes: 77 };
    expect(await keepVoiceForCard(press)).toMatchObject({ ok: true });
  });

  it("⚠ does NOT give it back when the cast itself is gone", async () => {
    /* Nothing can ever be kept against a deleted cast, so a restorable handle
       there is a name with no referent. */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-A" });
    if (!design.ok) throw new Error("unreachable");
    keepResult = { ok: false, refusal: "cast_not_available" };

    await keepVoiceForCard({
      userId,
      castId: "KI-A",
      designId: design.designId,
      handle: design.voices[0].handle,
    });

    expect(voiceDesignStoreSize()).toBe(0);
  });
});

describe("the first three, made when a card opens", () => {
  it("⚠ BROWSING CANNOT SPEND A PRESS — the automatic road has its own bucket", async () => {
    /*
      #2470's finding, item 4. The card designs three voices on open, and the
      automatic call was enforced against the PRESS limit of twelve an hour — so
      opening a thirteenth signed cast threw `TOO_MANY_REQUESTS`, which the card
      turned into *"try again"* on a road where trying again failed identically.

      Thirty automatic opens is the auto bucket's whole hour. The press that
      follows them is the arm: before the repair it was refused.
    */
    const userId = freshUser();
    /*
      ⚠ **TWENTY, NOT THIRTY, AND THE REASON IS #2471's DAILY CEILING.** The
      hourly automatic bucket is thirty, but the account's DAILY free ceiling is
      twenty — so twenty is the whole free road for a day and the hourly bucket
      can never be the one that bites. That domination is stated on the hourly
      bucket itself in `server/security/rateLimit.ts`; this arm is where it is
      driven.

      Each open is a DIFFERENT cast, because one cast gets one free design a
      day. That is also what browsing a library is.
    */
    for (let index = 0; index < 20; index += 1) {
      expect(
        (await designVoicesForCard({ userId, castId: `KI-BROWSE-${index}`, automatic: true })).ok,
      ).toBe(true);
    }
    await expect(
      designVoicesForCard({ userId, castId: "KI-BROWSE-20", automatic: true }),
    ).rejects.toThrow(/too many/i);

    /* THE CLAIM, and it is the one item 4 was about: the customer's own presses
       are untouched by all that browsing. */
    expect((await designVoicesForCard({ userId, castId: "KI-BROWSE-0" })).ok).toBe(true);

    /* AND THE OTHER CLAIM, #2471's: not one of those twenty opens was charged. */
    expect(charges.filter((charge) => charge.amount === VOICE_DESIGN_PRICE)).toHaveLength(1);
  });

  it("a PRESS is still bounded at twelve an hour, and the automatic road survives it", async () => {
    const userId = freshUser();
    for (let index = 0; index < 12; index += 1) {
      expect((await designVoicesForCard({ userId, castId: "KI-A" })).ok).toBe(true);
    }
    await expect(designVoicesForCard({ userId, castId: "KI-A" }))
      .rejects.toThrow(/too many/i);

    /* The other direction of the same separation: the automatic road still
       answers for a cast that has not had its free one today. */
    expect((await designVoicesForCard({ userId, castId: "KI-B", automatic: true })).ok).toBe(true);

    /* ⚠ TWELVE PRESSES, TWELVE CHARGES — and the refused thirteenth is NOT
       among them, because the limiter runs before the charge. */
    expect(charges).toHaveLength(12);
    expect(charges.every((charge) => charge.amount === VOICE_DESIGN_PRICE)).toBe(true);
    expect(refunds).toHaveLength(0);
  });

  it("⚠ a caller that does not say gets the PRESS bucket, never the larger one", async () => {
    /*
      `automatic` is optional so a bundle loaded before this shipped still works
      (`.strict()` rejects an unknown key, not a missing optional one). The
      default has to be the STRICTER of the two, or omitting it would be a way
      to buy thirty designs an hour.
    */
    const userId = freshUser();
    for (let index = 0; index < 12; index += 1) {
      await designVoicesForCard({ userId, castId: "KI-A" });
    }
    await expect(designVoicesForCard({ userId, castId: "KI-A", automatic: undefined }))
      .rejects.toThrow(/too many/i);
  });
});

describe("what the card is told before it designs anything", () => {
  it("⚠ SAYS WHEN NOTHING CAN BE KEPT, so three voices are not made on house money", async () => {
    /* #2470's finding, item 5. The card skips its automatic design on this. */
    keepability = { canKeep: false };

    const status = await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" });

    expect(status).toMatchObject({ available: true, hasLine: true, canKeep: false });
  });

  it("⚠ ASKS FOR A CAST THAT ALREADY HAS A VOICE TOO, since Change voice can design (#2497)", async () => {
    /*
      This arm read *"does not ask the provider at all for a cast that already
      has a voice"* and pinned `canKeep: true` there — right while a kept voice
      could not be changed. Change voice designs three new voices, and a
      replacing Keep needs a free slot like any Keep, so the card must hear
      "nothing can be kept" before it makes voices nobody can keep.
    */
    keptRow = { clipBytes: 2_100_000, keptAt: new Date() };
    keepability = { canKeep: false };

    const status = await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" });

    expect(status.canKeep).toBe(false);
    expect(status.kept).not.toBeNull();
  });

  it("answers `available: false` with the road dark, and never reads an allowance", async () => {
    voiceOn = false;
    keepability = { canKeep: false };

    expect(await readVoiceCardStatus({ userId: freshUser(), castId: "KI-A" })).toEqual({
      available: false,
      hasLine: false,
      canKeep: false,
      kept: null,
      /* Served even while dark (#2471): the shape is uniform so the card never
         has to tell "no price yet" apart from "no voice road". */
      designPriceCredits: VOICE_DESIGN_PRICE,
      keepPriceCredits: VOICE_KEEP_PRICE,
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT A VOICE COSTS — N4b-3 (#2471), his word of 2026-10-13 setting the two
   prices and his word of 2026-10-14 on the free three and the spam ceilings.

   Every arm here drives the REAL `withAtomicCredits` over a mocked ledger, so
   what is proven is the product's money path and not a stub.
   ═══════════════════════════════════════════════════════════════════════════ */

describe("the press is charged and the automatic three are not", () => {
  it("a PRESS costs 125 ledger, and it is booked as AUDIO", async () => {
    const userId = freshUser();

    expect((await designVoicesForCard({ userId, castId: "KI-PAY" })).ok).toBe(true);

    expect(charges).toEqual([
      {
        amount: VOICE_DESIGN_PRICE,
        /*
          ⚠ **`audio`, AND IT IS THE FIRST CHARGE IN THE PRODUCT THAT IS NOT AN
          IMAGE.** `CreditToolKind` grew for this road under its own documented
          rule (*"but it can grow"*). Writing `"text"` here would have been the
          cheap lie — the charge pays for a recording, not for words — and it is
          asserted at the WIRE rather than beside the constant (invariant 5).
        */
        toolKind: "audio",
        reference: expect.stringContaining(`pending-${userId}-`),
      },
    ]);
    expect(refunds).toHaveLength(0);
  });

  it("the automatic three cost the customer nothing — his *real cost is neglible we absorb it*", async () => {
    const userId = freshUser();

    expect((await designVoicesForCard({ userId, castId: "KI-FREE", automatic: true })).ok).toBe(
      true,
    );

    /* Not a cheaper charge — NO charge. The card designs three voices the
       moment it opens, nobody pressed anything, and billing for an arrival is
       not a price. */
    expect(charges).toHaveLength(0);
  });

  it("a KEEP costs 500 ledger", async () => {
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-KEEP", automatic: true });
    if (!design.ok) throw new Error("unreachable");

    const kept = await keepVoiceForCard({
      userId,
      castId: "KI-KEEP",
      designId: design.designId,
      handle: design.voices[0].handle,
    });

    expect(kept.ok).toBe(true);
    /* The design was the free automatic one, so the Keep is the only charge. */
    expect(charges.map((charge) => charge.amount)).toEqual([VOICE_KEEP_PRICE]);
    expect(refunds).toHaveLength(0);
  });
});

describe("a refusal gives the money back", () => {
  it("a DESIGN the provider refuses is refunded, and says so", async () => {
    const userId = freshUser();
    designRefusal = "provider_failed";

    const refused = await designVoicesForCard({ userId, castId: "KI-BAD" });

    expect(refused).toEqual({
      ok: false,
      refusal: "provider_failed",
      refunded: true,
      refundReference: null,
    });
    expect(charges.map((charge) => charge.amount)).toEqual([VOICE_DESIGN_PRICE]);
    expect(refunds).toEqual([
      { amount: VOICE_DESIGN_PRICE, reference: `refund:${charges[0].reference}` },
    ]);
  });

  it("a refund that did NOT record is reported as such — never as *nothing was charged*", async () => {
    /*
      `server/casting/atomicCredits.ts` states this law in its own words: a
      refund that failed to record is NEVER reported as "you weren't charged".
      The card's sentence turns on this boolean, so if it could lie here the
      customer would be told their money was safe while it was not.
    */
    const userId = freshUser();
    designRefusal = "provider_failed";
    refundRecords = false;

    const refused = await designVoicesForCard({ userId, castId: "KI-OWED" });

    /* ⚠ **AND THE REFERENCE TRAVELS WITH IT** (the relay's finding on PR
       #2499, item 4). Telling a customer their credits have not come back and
       then giving them nothing to quote makes them the lookup key for a problem
       the rest of the product hands them the answer to — `refundTruth` quotes
       this same reference on every other money surface. It is the DERIVED
       refund reference, which is what support reconciles against and what makes
       a manual retry idempotent. */
    expect(refused).toEqual({
      ok: false,
      refusal: "provider_failed",
      refunded: false,
      refundReference: `refund:${charges[0].reference}`,
    });
    /* Charged, and genuinely still charged — which is exactly why the sentence
       must change. */
    expect(charges).toHaveLength(1);
    expect(refunds).toHaveLength(0);
  });
});

describe("the charge comes BEFORE the claim, so a short balance costs no voices", () => {
  it("refuses the Keep, keeps the three voices, and takes nothing", async () => {
    /*
      THE ORDER IS THE WHOLE ASSERTION. Charging after the claim would consume
      the design and give nothing back: the customer would lose the three voices
      they were choosing between AND be told they cannot afford the one they
      picked. Nothing in the ledger would look wrong, which is what makes the
      other order the dangerous one.
    */
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-BROKE", automatic: true });
    if (!design.ok) throw new Error("unreachable");

    balance = VOICE_KEEP_PRICE - 1; // one short

    /*
      ⚠ **AND THE REFUSAL QUOTES WHAT A CUSTOMER READS, NOT THE LEDGER FIGURE.**
      The price is 500 ledger and the sentence says 100 — `displayPrice`'s
      divide-by-five (#1600). A refusal that quoted 500 would be telling a
      customer they need five times what they actually do.
    */
    await expect(
      keepVoiceForCard({
        userId,
        castId: "KI-BROKE",
        designId: design.designId,
        handle: design.voices[0].handle,
      }),
    ).rejects.toThrow(/insufficient credits\. need 100 credits/i);

    /* THE CLAIM: the design is still there to keep once they top up. */
    expect(voiceDesignStoreSize()).toBe(1);
    /* And the provider was never asked to save anything. */
    expect(saves).toHaveLength(0);
    expect(charges).toHaveLength(0);
  });
});

describe("the free road cannot be farmed — his *stop people being able to spam generate new voices*", () => {
  it("ONE free automatic design per cast per day, and a reload cannot get a second", async () => {
    const userId = freshUser();

    expect((await designVoicesForCard({ userId, castId: "KI-ONCE", automatic: true })).ok).toBe(
      true,
    );

    /*
      The same cast, asked again — which is what a RELOAD is, and what a scripted
      `automatic: true` loop is. Before #2471 the only thing in the way was a
      module-level Set in the client's own page session, which a reload empties
      by definition.
    */
    await expect(
      designVoicesForCard({ userId, castId: "KI-ONCE", automatic: true }),
    ).rejects.toThrow(/too many/i);

    /* ⚠ AND IT REFUSED RATHER THAN FALLING THROUGH TO THE CHARGE. Nobody
       pressed anything, so a charge here would bill for an arrival. */
    expect(charges).toHaveLength(0);

    /* A DIFFERENT cast still gets its free three — the bound is per cast, which
       is what keeps the feature working for a real library. */
    expect((await designVoicesForCard({ userId, castId: "KI-OTHER", automatic: true })).ok).toBe(
      true,
    );
  });

  it("the customer can still PAY for more voices on a cast that has had its free one", async () => {
    /* The free road closing must not close the paid one — otherwise the ceiling
       reads as "this cast is finished" rather than "the free one is used up". */
    const userId = freshUser();
    expect((await designVoicesForCard({ userId, castId: "KI-MORE", automatic: true })).ok).toBe(
      true,
    );

    expect((await designVoicesForCard({ userId, castId: "KI-MORE" })).ok).toBe(true);
    expect(charges.map((charge) => charge.amount)).toEqual([VOICE_DESIGN_PRICE]);
  });
});

describe("the daily ceilings are declared where the limiter can read them", () => {
  it("carries his three numbers, with the windows a day long", () => {
    /*
      A DECLARATION arm, and it says why rather than pretending to be a drive.
      The per-cast bound is driven at the road above; the two ACCOUNT ceilings
      are not, because the real limiter has no reset hook and the hourly buckets
      (12 presses, 30 automatic) bite long before 20 or 50 inside one run. What
      this arm protects is the NUMBERS and the WINDOW LENGTH — #2493 exists
      because a 24-hour window was being swept at one hour, which silently turned
      "a day" into "an hour or so".
    */
    expect(RATE_LIMITS.castingVoiceAutoDesignDaily).toMatchObject({
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 1,
    });
    expect(RATE_LIMITS.castingVoiceAutoDesignDay).toMatchObject({
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 20,
    });
    expect(RATE_LIMITS.castingVoiceDesignDay).toMatchObject({
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 50,
    });
  });

  it("pins the ONE place these buckets dominate an hourly one, so a change has to read the reason", () => {
    /*
      THE FREE DAILY CEILING (20) IS BELOW THE HOURLY AUTOMATIC BUCKET (30), so
      on the happy road the hourly one is never the limit that bites. That is
      stated on the bucket itself; this arm is what makes it impossible to
      change one number without meeting the fact.

      ⚠ **IT IS NO LONGER UNREACHABLE, AND THIS COMMENT SAID IT WAS UNTIL
      2026-10-14.** The hand-back added for the relay's finding 3 returns the
      DAILY token when no voices came back and deliberately keeps the hourly
      one — so on the refusal road the daily ceiling stops accumulating and the
      hourly 30 becomes the ceiling that actually binds. That is the point of
      the asymmetry rather than a side effect: it is what stops a caller
      provoking refusals all day on house money. The two numbers now have a
      second relationship, and 30 is the real bound on provider calls an hour.

      The PRESS pair is deliberately NOT like that: 12 an hour and 50 a day are
      complementary, because 12 an hour reaches 50 in about four hours.
    */
    expect(RATE_LIMITS.castingVoiceAutoDesignDay.maxRequests).toBeLessThan(
      RATE_LIMITS.castingVoiceAutoDesign.maxRequests,
    );
    expect(RATE_LIMITS.castingVoiceDesignDay.maxRequests).toBeGreaterThan(
      RATE_LIMITS.castingVoiceDesign.maxRequests,
    );
  });
});

/* ----------------------------------------------------------------------------
   THE RELAY'S FINDINGS ON PR #2499, DRIVEN.

   All four are one subject from different sides: on a charged road, what the
   card SAYS about the money is part of the money. Every arm below was
   confirmed to fail against the code as the relay read it.
---------------------------------------------------------------------------- */

describe("a free design that delivered nothing is handed back (finding 3)", () => {
  /**
   * The bucket key the server spends a cast's free design from.
   *
   * ⚠ **IT IS PROVEN BEFORE IT IS TRUSTED, by the positive control in the
   * first arm.** This is a second spelling of a key the route derives
   * (`bucketIdentifier`), and a wrong one would make every arm here pass for
   * the worst possible reason: it would read a bucket nobody ever spent, find
   * it free, and call that a successful hand-back.
   */
  const freeDesignKey = (userId: number, castId: string) =>
    `user:${userId}:cast:${modelIdFor(castId)}`;

  it("⚠ A PROVIDER REFUSAL DOES NOT COST THE CAST ITS FREE THREE FOR THE DAY", async () => {
    const userId = freshUser();

    /* THE POSITIVE CONTROL FOR THE KEY, first: a design that SUCCEEDS spends
       the cast's one free token, so this key must read as spent afterwards. If
       it does not, the key is wrong and every hand-back arm here is worthless. */
    expect(await designVoicesForCard({ userId, castId: "KI-KEY", automatic: true }))
      .toMatchObject({ ok: true });
    expect(checkRateLimit(freeDesignKey(userId, "KI-KEY"), RATE_LIMITS.castingVoiceAutoDesignDaily))
      .toMatchObject({ allowed: false });

    /* Now the finding. The provider refuses, so no voices came back at all. */
    designRefusal = "provider_failed";
    const refused = await designVoicesForCard({ userId, castId: "KI-FREE", automatic: true });
    expect(refused).toMatchObject({ ok: false, refusal: "provider_failed" });
    /* The automatic road never charges, so there is no money in this one — what
       the customer loses without the repair is the ENTITLEMENT. */
    expect(charges).toHaveLength(0);

    /* AND THE FREE THREE ARE STILL THERE. Without the hand-back this second
       call refuses with TOO_MANY_REQUESTS, and that cast has no free voices
       until tomorrow having never been given any. */
    designRefusal = null;
    expect(await designVoicesForCard({ userId, castId: "KI-FREE", automatic: true }))
      .toMatchObject({ ok: true });
    /* Still FREE — the hand-back restores the entitlement; it does not turn the
       retry into a charge. */
    expect(charges).toHaveLength(0);
  });

  it("a THROWN failure hands it back too, which is the commoner road", async () => {
    /* A refusal is the provider saying no; a throw is the transport, the SDK or
       a bug, and it takes a different path out of the route. The second is what
       a real outage looks like. */
    const userId = freshUser();
    designThrows = new Error("socket hang up");

    await expect(designVoicesForCard({ userId, castId: "KI-THROW", automatic: true }))
      .rejects.toThrow("socket hang up");

    designThrows = null;
    expect(await designVoicesForCard({ userId, castId: "KI-THROW", automatic: true }))
      .toMatchObject({ ok: true });
    expect(charges).toHaveLength(0);
  });

  it("⚠ THE ACCOUNT'S DAY REFUSING DOES NOT ALSO SPEND THAT CAST'S OWN TOKEN", async () => {
    /*
      The subtlest half of the finding. The two buckets are checked in order —
      per cast, then per account — so when the ACCOUNT's day is exhausted the
      per-cast token has already been taken. Without the repair a customer who
      hits their twenty-a-day ceiling also loses the free three on whichever
      cast they happened to open next, silently, for the rest of the day.
    */
    const userId = freshUser();
    for (let index = 0; index < RATE_LIMITS.castingVoiceAutoDesignDay.maxRequests; index += 1) {
      expect(await designVoicesForCard({ userId, castId: `KI-DAY-${index}`, automatic: true }))
        .toMatchObject({ ok: true });
    }

    /* The twenty-first arrival, on a cast that has never had its free three. */
    await expect(designVoicesForCard({ userId, castId: "KI-DAY-NEXT", automatic: true }))
      .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    /* ITS OWN TOKEN IS UNSPENT: tomorrow the account's day rolls over and this
       cast still has the free three it was never given. */
    expect(checkRateLimit(
      freeDesignKey(userId, "KI-DAY-NEXT"),
      RATE_LIMITS.castingVoiceAutoDesignDaily,
    )).toMatchObject({ allowed: true });
  });

  it("⚠ AND THE HOURLY FLOOD BUCKET IS NOT HANDED BACK — it is what bounds house money", async () => {
    /*
      THE NEGATIVE CONTROL, AND THE REASON THE HAND-BACK IS SAFE AT ALL. Every
      refusal still costs us a provider call, so a repair that handed back the
      HOURLY bucket too would let a scripted caller provoke refusals without
      limit and spend house money all day. The buckets that grant the CUSTOMER
      something give their slot back; the one that protects the HOUSE keeps it.

      The arithmetic, stated because the number is otherwise a magic one: the
      hourly bucket allows 30, the refused design below spends 1, and this check
      spends another (`checkRateLimit` increments on an allowed read), so 28
      remain. Were the design's hourly slot wrongly handed back, 29 would.
    */
    const userId = freshUser();
    designRefusal = "provider_failed";
    await designVoicesForCard({ userId, castId: "KI-HOUR", automatic: true });

    expect(checkRateLimit(`user:${userId}`, RATE_LIMITS.castingVoiceAutoDesign))
      .toMatchObject({ remaining: RATE_LIMITS.castingVoiceAutoDesign.maxRequests - 2 });
  });
});

describe("a shut road is not a money refusal (finding 2)", () => {
  it("⚠ REFUSES WITH A CODE THE CARD'S MONEY READER CANNOT CATCH", async () => {
    /*
      THE DEFECT THIS PINS, in the customer's terms: narrow
      `CASTING_VOICE_SCOPE` while somebody has the card open, let them press,
      and they were told *"Not enough credits"* — a lie about their money,
      caused by two unrelated refusals sharing one tRPC code.

      `chargeRefusal` answers `PRECONDITION_FAILED` for a short balance
      deliberately, so a surface can tell that one case apart without parsing
      prose, and `CastVoiceStudio`'s `isShortOfCredits` reads exactly that code.
      So this road may not throw it. The two halves are one contract; the client
      half is driven in `CastVoiceStudio.test.ts`.
    */
    const userId = freshUser();
    voiceOn = false;

    for (const act of [
      () => designVoicesForCard({ userId, castId: "KI-DARK" }),
      () => keepVoiceForCard({ userId, castId: "KI-DARK", designId: "d-1", handle: "h-1" }),
    ]) {
      const error = await act().then(() => null, (thrown: unknown) => thrown);
      expect(error).toMatchObject({ code: "FORBIDDEN" });
      /* Asserted on its own rather than left implied by the line above: THIS is
         the regression, and a change that gives this road back
         `PRECONDITION_FAILED` must meet a red arm that names the reason. */
      expect(error).not.toMatchObject({ code: "PRECONDITION_FAILED" });
    }

    /* And nothing was taken, which is what makes any money sentence wrong. */
    expect(charges).toHaveLength(0);
  });
});

describe("a thrown failure's sentence carries the refund reference (finding 1's premise)", () => {
  it("⚠ NAMES THE REFERENCE THE CUSTOMER MUST QUOTE, so the card has one to show", async () => {
    /*
      THE CONTRACT THE CLIENT REPAIR DEPENDS ON. The card's catch-all used to
      answer every throw with *"Nothing was charged — try again."*; it now hands
      the server's own sentence through (`readableFailure`). That is only worth
      doing because the sentence `withAtomicCredits` throws has already had
      `refundTruth` appended to it — including, when the refund did not record,
      the reference support reconciles against.

      So this arm is not about the client: it proves the thing the client now
      relies on actually travels. If this sentence ever stopped carrying the
      reference, the card would go quietly back to telling a customer to get in
      touch with nothing to quote.
    */
    const userId = freshUser();
    designThrows = new Error("provider exploded");
    refundRecords = false;

    const error = await designVoicesForCard({ userId, castId: "KI-OWED-THROW" })
      .then(() => null, (thrown: unknown) => thrown);

    expect(charges).toHaveLength(1);
    expect(refunds).toHaveLength(0);
    const message = (error as { message?: string })?.message ?? "";
    expect(message).toContain(`refund:${charges[0].reference}`);
    /* And it must not claim the money came back. */
    expect(message).not.toContain("have been returned");
  });
});

describe("handing a free design back may not become free provider calls", () => {
  /*
    THE CORRECTION THIS SUITE EXISTS TO PIN, and it is a HOUSE-money fact
    rather than a customer one.

    The repair above hands a cast's free three back when nothing came back.
    Handing the ACCOUNT's day back on the same terms would have raised what the
    free road can spend from **twenty a day to thirty an hour** — the hourly
    bucket being the only thing left bounding it — because a refusal the
    provider produced has already cost us the call. Thirty-six times the house
    spend, arriving inside a customer repair.

    So the per-cast token always returns and the account's day returns only
    when no provider call was made. These two arms are the difference, and the
    arithmetic is stated because the numbers are otherwise magic ones:
    `checkRateLimit` increments on an allowed read, so a bucket this request
    spent once reads `max - 2` after the arm's own check, and `max - 1` if it
    was handed back.
  */
  const accountDayRemaining = (userId: number) =>
    checkRateLimit(`user:${userId}`, RATE_LIMITS.castingVoiceAutoDesignDay).remaining;

  it("⚠ A PROVIDER-REACHING REFUSAL KEEPS THE ACCOUNT'S DAY SPENT", async () => {
    /* `provider_failed` comes back from the engine's own error
       (`voiceService.ts`), so by the time we see it the call has been made and
       paid for. The customer keeps that cast's free three; the house keeps its
       ceiling. */
    const userId = freshUser();
    designRefusal = "provider_failed";
    await designVoicesForCard({ userId, castId: "KI-COST", automatic: true });

    expect(accountDayRemaining(userId))
      .toBe(RATE_LIMITS.castingVoiceAutoDesignDay.maxRequests - 2);
  });

  it("but a refusal that never reached the provider hands it back", async () => {
    /* `no_voice_line` is decided before the engine is touched, so nothing was
       spent and there is nothing to bound. */
    const userId = freshUser();
    designRefusal = "no_voice_line";
    await designVoicesForCard({ userId, castId: "KI-NOLINE", automatic: true });

    expect(accountDayRemaining(userId))
      .toBe(RATE_LIMITS.castingVoiceAutoDesignDay.maxRequests - 1);
  });

  it("⚠ AND AN UNKNOWN REFUSAL IS TREATED AS HAVING REACHED THE PROVIDER", async () => {
    /*
      THE FAIL-SAFE DIRECTION, driven rather than asserted in a comment. A
      refusal key the classifier does not recognise — a new one added later —
      must keep the slot: being wrong that way costs a customer one of twenty,
      and being wrong the other way is unbounded house spend.
    */
    const userId = freshUser();
    designRefusal = "something_added_later";
    await designVoicesForCard({ userId, castId: "KI-UNKNOWN", automatic: true });

    expect(accountDayRemaining(userId))
      .toBe(RATE_LIMITS.castingVoiceAutoDesignDay.maxRequests - 2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   CHANGE AND REMOVE — #2497.
   ═══════════════════════════════════════════════════════════════════════════ */

describe("a replacing Keep is a normal paid Keep (#2497)", () => {
  it("a Keep on a cast that already has a voice reaches the service and is charged 500", async () => {
    /* The road used to refuse this inside the service (`already_kept`); the
       route adds no rule of its own, so a cast with a voice is charged and kept
       exactly as a first Keep is. */
    keptRow = { clipBytes: 2_100_000, keptAt: new Date() };
    const userId = freshUser();
    const design = await designVoicesForCard({ userId, castId: "KI-CHG", automatic: true });
    if (!design.ok) throw new Error("unreachable");

    const kept = await keepVoiceForCard({
      userId,
      castId: "KI-CHG",
      designId: design.designId,
      handle: design.voices[1].handle,
    });

    expect(kept.ok).toBe(true);
    expect(saves).toEqual(["save"]);
    expect(charges.map((charge) => charge.amount)).toEqual([VOICE_KEEP_PRICE]);
    expect(refunds).toHaveLength(0);
  });
});

describe("Remove voice (#2497)", () => {
  it("⚠ CHARGES NOTHING AND REFUNDS NOTHING — his *No refund — the customer had the voice*", async () => {
    const userId = freshUser();

    expect(await removeVoiceForCard({ userId, castId: "KI-RM" })).toEqual({ ok: true, removed: true });

    expect(removals).toEqual([modelIdFor("KI-RM")]);
    expect(charges).toHaveLength(0);
    expect(refunds).toHaveLength(0);
  });

  it("answers `removed: false` for a cast with no voice, and still moves no money", async () => {
    removeFinds = false;

    expect(await removeVoiceForCard({ userId: freshUser(), castId: "KI-RM2" })).toEqual({
      ok: true,
      removed: false,
    });
    expect(charges).toHaveLength(0);
  });

  it("⚠ is refused on a shut road before anything is asked of the service", async () => {
    voiceOn = false;

    await expect(removeVoiceForCard({ userId: freshUser(), castId: "KI-RM3" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(removals).toHaveLength(0);
  });

  it("is paced by the person's own mutation bucket and refuses with a real TOO_MANY_REQUESTS", async () => {
    const userId = freshUser();
    const ceiling = RATE_LIMITS.castingSheet.maxRequests;
    for (let index = 0; index < ceiling; index += 1) {
      await removeVoiceForCard({ userId, castId: "KI-RM4" });
    }

    await expect(removeVoiceForCard({ userId, castId: "KI-RM4" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(removals).toHaveLength(ceiling);
  });
});
