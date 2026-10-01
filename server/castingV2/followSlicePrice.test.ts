import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASTING_V2_COSTS,
  CASTING_V2_FOLLOW_PRICE_CREDITS,
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
 * None of it could ever have been WRONG while it was being built, because
 * there was exactly one slice price in the tree and a Follow and a Roll both
 * cost 8 × 20 = 160. ⚠ **That stopped being true on 2026-10-01: item 1 set
 * them to 150 and 200, so every reading above is now load-bearing.** The shape
 * it would have failed in is the worst available one: `retryService` would
 * charge a Follow tile the Roll price and then WRITE that price onto the
 * tile's row, so the mis-charge becomes its own refund authority and the
 * ledger reconciles perfectly against the wrong number.
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
 * **150 and 200** — which, since item 1, is also what the real table holds.
 * The seam stays anyway: the arms must keep failing for a reason that does not
 * depend on today's two numbers.
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
  it("DISAGREE as of 2026-10-01, which is the day every arm in this file was written for", () => {
    /*
      ⚠ **THIS ARM READ `toBe` UNTIL #1601 ITEM 1 AND IT WAS NOT AN
      ASPIRATION** — it recorded the one fact that made item 2 safe to ship at
      all: a money path taught to pick between two prices that happened to be
      equal could not charge anybody the wrong one while it was being built.
      Its own instruction was *"when this arm fails, item 1 has landed"*. Item
      1 has landed, so the arm states the new fact rather than being deleted:
      a later change that quietly re-equalised the two slices would reprice a
      Follow to a Roll, and this is where that shows.
    */
    expect(CASTING_V2_COSTS.followCandidate).not.toBe(CASTING_V2_COSTS.rollCandidate);
    expect(CASTING_V2_COSTS.rollCandidate).toBe(150);
    expect(CASTING_V2_COSTS.followCandidate).toBe(200);
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

  it("derives the follow total from its own slice, and it exists because something quotes it", () => {
    /*
      ⚠ **THIS ARM REPLACES ONE THAT PINNED THE CONSTANT'S ABSENCE, ON THAT
      ARM'S OWN INSTRUCTION: *"add it in the commit that quotes it, and delete
      this arm then."*** `CASTING_V2_FOLLOW_PRICE_CREDITS` was written inside
      item 2 and removed the same day, because `check-cleanup-dispositions`
      read it as `unread` — an exported price with no production reader is
      invariant 7's shape, and inventing a reader to justify a constant is the
      coupling item 2 existed to defer.

      The quoter arrived with item 1 and it had to: `castingV2.config` handed
      the sheet ONE price line for Roll again and Follow together (his ruling,
      2026-08-02), which was true only while the two slices agreed. The dock
      now names the price of the button it fires, so the sheet needs both
      numbers — and the arm below reads the router to prove the quote is real
      rather than taking this constant's existence as evidence of it.
    */
    expect(CASTING_V2_FOLLOW_PRICE_CREDITS)
      .toBe(CASTING_V2_COSTS.followCandidate * CASTING_V2_COSTS.rollCandidateCount);
    expect(CASTING_V2_FOLLOW_PRICE_CREDITS).not.toBe(CASTING_V2_ROLL_PRICE_CREDITS);
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

describe("⚠ THE TRIPWIRE FIRED AND WAS DISCHARGED — neither account-level quote survives the divergence", () => {
  /*
    WHAT THIS BLOCK WAS, AND WHY IT IS NOT DELETED.

    Item 2 left a `throw` here that fired the moment the two slices stopped
    agreeing. It was the law-7 sweep's remainder ARMED rather than written
    down, and it named two surfaces that each handed the client ONE number
    standing for what was about to be two prices:

      • `config.rollPriceCredits` — the sheet dock's `~ N credits`, carrying
        the price once for Roll again AND Follow by his ruling of 2026-08-02;
      • `config.retryPriceCredits` — the tile's `Retry · N credits`, while the
        server had charged the tile's own recorded slice since item 2.

    It fired on this commit, which is exactly what it was for. The arms below
    are its discharge: each one reads the site the tripwire named and proves
    the repair is THERE, so the next person who re-folds two prices into one
    account-level quote meets a red suite rather than a sentence in a card.

    The repairs were different in kind, and the asymmetry is the finding:

      • the RETRY quote had no design question in it — the server already
        charged the row, so the quote LEFT `config` (the tripwire's own second
        option) and the sheet derives the number from the roll row's own total;
      • the DOCK's did. One line cannot state 240 and 320, and cost is metadata
        rather than button text (D-109), so where a tile's Follow price goes is
        a founder decision. What shipped is the dock naming the price of the
        button the DOCK fires — strictly truer than one number in every case —
        and the uncovered case (an unfollowed sheet's tile Follow) is on his
        desk as **#1699**. That is named here rather than left to be found.
  */
  const repoFile = (path: string) => codeOnly(readFileSync(join(repoRoot, path), "utf8"));

  it("the account-level RETRY quote has left `castingV2.config` entirely", () => {
    /*
      Read through `codeOnly` on purpose and it is load-bearing here: the
      router, the sheet and the tile all EXPLAIN this removal in prose that
      names the symbol, and a raw source match would read its own explanation
      as the defect (#1636's class). `retryEnabled` — the door, always its own
      field — must survive, so the arm names the price rather than banning the
      word.
    */
    const router = repoFile("server/routes/castingV2.ts");
    expect(router).not.toContain("retryPriceCredits");
    expect(router).toContain("retryEnabled");
  });

  it("the tile's retry price is derived from the ROLL ROW, not from the config quote", () => {
    const sheet = repoFile("client/src/pages/CastingSheet.tsx");
    /* The number the tile prints is this roll's own total over its own count. */
    expect(sheet).toContain("const retryPrice = sliceCredits > 0 ? sliceCredits : undefined;");
    expect(sheet).toContain("roll.data?.priceCredits");
    /* And it is no longer read off the account. */
    expect(sheet).not.toContain("config.data?.retryPriceCredits");
  });

  it("the dock states the price of the roll its own button will fire", () => {
    /*
      The sheet is handed BOTH totals and picks on `standingFollowId` — server
      truth (`lineage.fromCandidateId`), not a client guess. An arm on the
      source rather than on a render because this is a statement about which
      WIRE FIELD feeds the line; what the line looks like is law 6's business
      and the frames are on the PR.
    */
    const sheet = repoFile("client/src/pages/CastingSheet.tsx");
    expect(sheet).toContain("config.data?.followPriceCredits");
    expect(sheet).toContain("config.data?.rollPriceCredits");
    expect(sheet).toContain("standingFollowId !== null");
  });

  it("serves both totals, and they are the two slices times the count", () => {
    expect(repoFile("server/routes/castingV2.ts")).toContain("followPriceCredits");
    expect(CASTING_V2_ROLL_PRICE_CREDITS).toBe(1200);
    expect(CASTING_V2_FOLLOW_PRICE_CREDITS).toBe(1600);
  });

  it("⚠ names the one case the dock still cannot state, so it is not mistaken for finished", () => {
    /*
      A tile's **Follow** on a sheet that is not already following charges
      1,600 while the dock quotes 1,200, because that line describes the dock's
      own button. It is the narrowest remainder of his 2026-08-02 ruling, whose
      premise — one price for both — died with the price table, and it is HIS
      to answer: **#1699**, with two options and a recommendation.

      This arm exists so the remainder cannot be read as an oversight. It
      asserts the only thing that is actually true today — that the two totals
      differ, which is precisely what makes a single dock line unable to cover
      both — and the day one surface states both, this is the arm to rewrite.
    */
    expect(CASTING_V2_FOLLOW_PRICE_CREDITS).toBeGreaterThan(CASTING_V2_ROLL_PRICE_CREDITS);
  });
});
