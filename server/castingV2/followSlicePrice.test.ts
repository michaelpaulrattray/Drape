import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASTING_V2_COSTS,
  CASTING_V2_RETRY_PRICE_CREDITS,
  CASTING_V2_ROLL_PRICE_CREDITS,
  castingSliceCredits,
} from "../casting/castingCreditCosts";
import { createRollWithCandidates } from "../db/castingV2";
import { codeOnly } from "../testing/withoutComments";

/**
 * WHICH SLICE A SHEET IS PRICED IN — #1601 item 2.
 *
 * His rule for a Follow: *"pick the slice from `anchored` BEFORE the claim
 * (today the price is computed before `anchored` exists); write the slice as
 * each candidate row's `pointsCost`; a single-candidate retry charges and
 * refunds its own row's `pointsCost`."*
 *
 * # What was wrong, and why it had never shown
 *
 * The slice price was declared THREE times, by three sites that each
 * re-derived it from `CASTING_V2_COSTS.rollCandidate`:
 *
 *   1. `rollService.createRoll`  — the total charged, computed in the
 *      function's FIRST statement, 250 lines before `anchored` exists;
 *   2. `db/castingV2`            — the roll row's `priceCredits`;
 *   3. `db/castingV2`            — every candidate row's `pointsCost`, which
 *                                  is the refund authority.
 *
 * Two of the three are in the database layer, which is handed a parent linkage
 * and no price, so "is this a follow?" was being re-answered where it could
 * only be inferred. A fourth site, `retryService`, charged a constant read
 * before the row it was charging for.
 *
 * None of it could ever be WRONG, because there is exactly one slice price in
 * the tree and a Follow and a Roll both cost 8 × 20 = 160. It becomes wrong on
 * the commit that sets them to 150 and 200 (item 1 of this card), and it
 * becomes wrong in the worst available way: `retryService` would charge a
 * Follow tile the Roll price and then WRITE that price onto the tile's row, so
 * the mis-charge becomes its own refund authority and the ledger reconciles
 * perfectly against the wrong number.
 *
 * # ⚠ THE THING THIS SUITE HAD TO SOLVE FIRST
 *
 * **Every obvious arm here is vacuous while the two slices are equal.** An arm
 * asserting that an anchored roll is priced in `followCandidate` passes with
 * the two branches SWAPPED — 20 either way. That is an instrument that cannot
 * fail standing in front of the only decision that sets a customer's bill
 * (working law 2), and it is why `castingSliceCredits` takes its table as a
 * defaulted parameter: an ES const cannot be replaced from outside its own
 * module, so the seam is in the function and the arms below drive it with
 * **150 and 200**. A branch swap reddens them today.
 *
 * Where a divergence cannot be injected, the arm says so and a DIFFERENT
 * reading carries the weight — the retry arms hand the service a row at 200
 * while the constant is 20, which is a fully non-vacuous proof of the third
 * clause; the declaration arms read the source, because they are statements
 * about how the two prices are DECLARED rather than about behaviour.
 */

const repoRoot = join(import.meta.dirname, "..", "..");

/** Diverged numbers, standing in for item 1's table. Neither is today's 20. */
const DIVERGED = { rollCandidate: 150, followCandidate: 200 } as const;

describe("the selector picks the slice from the roll's own shape", () => {
  it("prices an UNANCHORED sheet in the roll slice — driven with diverged numbers", () => {
    expect(castingSliceCredits({ anchored: false }, DIVERGED)).toBe(150);
  });

  it("prices an ANCHORED sheet — a follow — in the follow slice", () => {
    expect(castingSliceCredits({ anchored: true }, DIVERGED)).toBe(200);
  });

  it("⚠ a branch swap is what these two arms exist to catch, so prove they disagree", () => {
    /* The whole point of the injected table. With the real one both sides are
       20 and this expectation is `20 !== 20` — false — which is exactly the
       vacuity the seam removes. */
    expect(castingSliceCredits({ anchored: true }, DIVERGED))
      .not.toBe(castingSliceCredits({ anchored: false }, DIVERGED));
  });

  it("defaults to the product's own table, so a production caller passes one argument", () => {
    expect(castingSliceCredits({ anchored: false })).toBe(CASTING_V2_COSTS.rollCandidate);
    expect(castingSliceCredits({ anchored: true })).toBe(CASTING_V2_COSTS.followCandidate);
  });
});

describe("the two slices are two prices, not one price read twice", () => {
  it("is EQUAL today, which is what makes this slice safe to ship", () => {
    /* Not an aspiration — the reason item 2 could move the money path at all.
       When this arm fails, item 1 has landed and the tripwire below is the
       thing to read. */
    expect(CASTING_V2_COSTS.followCandidate).toBe(CASTING_V2_COSTS.rollCandidate);
  });

  it("declares `followCandidate` as its own numeric literal, never derived from the roll slice", () => {
    /*
      A source read on purpose: this is a statement about the DECLARATION, not
      about a value. `followCandidate: CASTING_V2_COSTS.rollCandidate` would
      satisfy every behavioural arm in this file and would silently make item
      1's edit move BOTH prices — a Roll repriced to a Follow, by a diff that
      looks like it changed one number. Working law 4 bans a mirror of a source
      of truth; it does not ask two independent facts to pretend to be one.
    */
    const source = readFileSync(join(repoRoot, "server/casting/castingCreditCosts.ts"), "utf8");
    const declaration = /^\s*followCandidate:\s*([^,\n]+),/m.exec(source);
    expect(declaration, "`followCandidate` is no longer declared in CASTING_V2_COSTS").not.toBeNull();
    expect(declaration![1].trim()).toMatch(/^\d+$/);
  });

  it("derives the quoted roll price from its own slice and the candidate count", () => {
    expect(CASTING_V2_ROLL_PRICE_CREDITS)
      .toBe(CASTING_V2_COSTS.rollCandidate * CASTING_V2_COSTS.rollCandidateCount);
  });

  it("declares NO follow total, because nothing quotes one yet", async () => {
    /*
      The matching `CASTING_V2_FOLLOW_PRICE_CREDITS` was written and removed
      inside this slice: `CASTING_V2_ROLL_PRICE_CREDITS` exists because
      `castingV2.config` quotes it to the client, and a follow total has no
      quoter until the dock's single price line is split (item 1, with #1600's
      display helper). An exported price with no production reader is the shape
      invariant 7 is about, and `check-cleanup-dispositions` caught it as
      `unread` on this branch's first preflight.

      This arm is here so the constant cannot come back WITHOUT its reader: a
      module export is cheap to add and the next person's instinct will be
      symmetry. Add it in the commit that quotes it, and delete this arm then.
    */
    const costs = await import("../casting/castingCreditCosts") as Record<string, unknown>;
    expect("CASTING_V2_FOLLOW_PRICE_CREDITS" in costs).toBe(false);
  });
});

describe("the row writer writes the slice it is handed and refuses one it cannot charge", () => {
  /* Eight seeds, because the candidate-count check runs first and this suite
     is about the price check behind it. */
  const seeds = Array.from({ length: CASTING_V2_COSTS.rollCandidateCount }, (_, index) => ({
    publicId: `11111111-1111-4111-8111-00000000000${index}`,
    position: index,
    internalPrompt: null,
  }));

  function create(slicePriceCredits: unknown) {
    /* No database is reached: every validation in `createRollWithCandidates`
       runs before `withTransaction`, and the module's connection is lazy — so
       these arms run everywhere, including under the stripped `DATABASE_URL`
       that `vitest.setup.ts` enforces. */
    return createRollWithCandidates({
      userId: 7,
      sessionPublicId: "55555555-5555-4555-8555-555555555555",
      operationId: "44444444-4444-4444-8444-444444444444",
      briefText: "a wiry cyclist in her 20s",
      candidates: seeds,
      slicePriceCredits,
    } as never);
  }

  for (const [label, value] of [
    ["zero — what the column's own `.default(0)` lands if a writer omits it", 0],
    ["negative", -20],
    ["fractional", 20.5],
    ["not a number at all", Number.NaN],
  ] as const) {
    it(`refuses a slice that is ${label}`, async () => {
      await expect(create(value)).rejects.toThrow(/slicePriceCredits must be a positive integer/);
    });
  }

  it("⚠ does not DECLARE a price of its own — only the candidate count", () => {
    /*
      THIS ARM EXISTS BECAUSE SABOTAGE FOUND A HOLE AND THE HOLE IS A REAL ONE.

      Put `pointsCost: CASTING_V2_COSTS.rollCandidate` back in the row writer
      and nothing in the always-run suites notices: the roll service's suite
      MOCKS `createRollWithCandidates`, so it cannot see what gets written, and
      the arm that reads the real rows lives in
      `castingV2-roll-domain-db.test.ts`, which skips without a disposable
      database. The one site whose value IS the refund authority would have had
      no always-run cover at all.

      So this is a statement about the declaration, which is what actually
      changed: this layer is handed a parent linkage and no price, and must
      therefore never choose one. `rollCandidateCount` is a shape, not a price,
      and stays — the arm names it rather than banning the whole symbol.
    */
    /*
      Read through `codeOnly`, the house reader — comments gone and string
      literal contents gone with them (#548, #741, #1638). The first draft of
      this arm matched on the raw source and went red on the DOCBLOCK two
      files over, which explains what the old behaviour was and names the
      member while doing it. A guard that reads its own explanation is #1636's
      class exactly, and it is the reason that helper exists.
    */
    const source = codeOnly(readFileSync(join(repoRoot, "server/db/castingV2.ts"), "utf8"));
    const priceReads = [...source.matchAll(/CASTING_V2_COSTS\.(\w+)/g)]
      .map((match) => match[1])
      .filter((member) => member !== "rollCandidateCount");
    expect(priceReads, "the db layer is reading a PRICE again — the caller owns that choice").toEqual([]);
  });

  it("⚠ refuses it BEFORE the transaction, so eight rows are never half-written", async () => {
    /* The refusal is the cheap half; the ordering is the half that matters. A
       throw from inside `withTransaction` under a stripped DATABASE_URL would
       be a connection error, not this message — so the message IS the proof of
       where the check sits. */
    await expect(create(0)).rejects.toThrow(/positive integer/);
    await expect(create(0)).rejects.not.toThrow(/database|connection|ECONNREFUSED/i);
  });
});

describe("⚠ THE TRIPWIRE — two account-level quotes stop being truthful the day the slices diverge", () => {
  it("names both surfaces that must become per-sheet, the moment item 1 lands", () => {
    /*
      THIS IS THE LAW-7 SWEEP'S REMAINDER, ARMED RATHER THAN WRITTEN DOWN.

      `castingV2.config` hands the client TWO single numbers for the whole
      account, and both of them stand for what is about to be two prices:

        • `rollPriceCredits` — drawn by the sheet's DOCK as `~ N credits`
          (`client/src/pages/CastingSheet.tsx`). It covers Roll AND Follow
          together by the founder's own ruling of 2026-08-02, recorded in
          `CandidateTile`'s `rollPriceCredits` docblock: *"the dock states it
          once, persistently, for rolls and follows together"*. Roll again and
          Follow deliberately carry no price of their own BECAUSE that line
          does. One number, two prices, from item 1 onward.

        • `retryPriceCredits` — drawn on the tile as `Retry · N credits`. Since
          this card's item 2 the SERVER charges the tile's own recorded slice,
          so a Follow tile would be charged more than its own button said.

      Both are display and both belong to #1600's routing slice plus item 1,
      which is why neither is touched here — his rule of 2026-10-01 holds P1 to
      its ten cards, and folding a surface into another card's slice is how a
      half-built change ships under a cleanup's name. What this arm does is make
      the coupling impossible to forget: it fails on the commit that diverges
      the two prices, and it says what to do.

      Not an instance, checked and recorded so it is not re-swept: the sheet's
      own per-candidate `sliceCredits` divides `roll.priceCredits` — the ROW's
      total — by that row's candidate count, so it follows a follow correctly;
      and the Sign's view-count qualifier is already compared against
      `plannedCredits` in `signRecovery`, which parks rather than assuming.
    */
    const slicesAgree = CASTING_V2_COSTS.followCandidate === CASTING_V2_COSTS.rollCandidate;
    if (!slicesAgree) {
      throw new Error(
        "The Roll and Follow slices now differ, so both of `castingV2.config`'s single "
        + "price quotes are wrong for a Follow and the server charges the real thing:\n"
        + "  1. `rollPriceCredits` — the sheet dock's `~ N credits`, which covers Roll AND "
        + "Follow by his 2026-08-02 ruling. A Follow now costs more than the dock says.\n"
        + "  2. `retryPriceCredits` — the tile's `Retry · N credits`. A Follow tile is "
        + "charged its own row's slice.\n"
        + "Both become per-sheet/per-tile with #1600's display helper, or they leave "
        + "`config`. Sites: server/routes/castingV2.ts (`rollPriceCredits`, "
        + "`retryPriceCredits`), client/src/pages/CastingSheet.tsx (the dock line), "
        + "client/src/features/castingV2/components/CandidateTile.tsx (the retry label).",
      );
    }
    /* While they agree, both quotes are coherent exactly because they ARE the
       slice every sheet and every tile carries. */
    expect(CASTING_V2_RETRY_PRICE_CREDITS).toBe(CASTING_V2_COSTS.rollCandidate);
    expect(CASTING_V2_RETRY_PRICE_CREDITS).toBe(CASTING_V2_COSTS.followCandidate);
    /* The dock's quote is the roll total, and it is only true of a follow sheet
       while the slice it is built from is the follow's slice too. */
    expect(CASTING_V2_ROLL_PRICE_CREDITS)
      .toBe(CASTING_V2_COSTS.followCandidate * CASTING_V2_COSTS.rollCandidateCount);
  });
});
