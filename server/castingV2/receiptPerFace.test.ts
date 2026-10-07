/**
 * THE RECEIPT'S PER-FACE FIGURE — #1908's done-when, driven.
 *
 * The card's instruction is the whole subject: *"Compute the per-face figure
 * from the server's price (`rollPriceCredits` ÷ `rollCandidateCount`, through
 * `displayPrice`), so the legend cannot go stale the next time prices move."*
 * Yuna's draft of the sentence said **30 credits a face**, which was true of
 * the price table before 2026-10-01 and false on the day she wrote it.
 *
 * ⚠ **SO THE ARMS THAT MATTER DRIVE THE REAL CONSTANTS, NOT A FIXTURE.** An
 * arm asserting `perFaceDisplayCredits(1600, 8) === 40` proves the arithmetic
 * and nothing about this product: it would stay green through a repricing,
 * which is the one event the card is about. These arms import
 * `CASTING_V2_ROLL_PRICE_CREDITS` and `CASTING_V2_FOLLOW_PRICE_CREDITS` and
 * assert the figure the LIVE table produces — so a price change either keeps
 * the relationship or reddens here and says which half moved.
 *
 * **Roll AND Follow, because the card's done-when names both and because they
 * have moved twice in two days.** They are equal today (#1753, his *"one price
 * is better and we earn more for rolls simple"*) and were 1,200 against 1,600
 * for one day before that. The helper takes the sheet price as an ARGUMENT
 * precisely so the day they diverge is a price change rather than a code
 * change — and the arm that proves it is the one that drives both.
 *
 * ⚠ **AN EQUALITY ARM OVER TWO EQUAL NUMBERS PROVES NOTHING (working law 2),
 * which `castingCreditCosts.ts`'s own docblock already says of
 * `castingSliceCredits`.** So the Follow arm does not assert "the same as the
 * Roll": it asserts the figure derived from the FOLLOW total against the
 * follow slice's own declared price, which is a different reading of a
 * different constant and stays honest through a divergence.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { withoutComments } from "../testing/withoutComments";
import {
  CASTING_V2_COSTS,
  CASTING_V2_FOLLOW_PRICE_CREDITS,
  CASTING_V2_ROLL_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { displayPrice, formatCredits } from "../../shared/creditDisplay";
import {
  RECEIPT_REFUND_CLAUSE,
  perFaceDisplayCredits,
  receiptLegend,
} from "../../shared/castingReceipt";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("the per-face figure is derived from the live price table (#1908)", () => {
  it("a ROLL's per-face figure is the roll slice's own declared price, displayed", () => {
    expect(
      perFaceDisplayCredits(CASTING_V2_ROLL_PRICE_CREDITS, CASTING_V2_COSTS.rollCandidateCount),
      "the receipt's per-face figure must be the price of one roll candidate",
    ).toBe(displayPrice(CASTING_V2_COSTS.rollCandidate));
  });

  it("a FOLLOW's per-face figure is the follow slice's own declared price, displayed", () => {
    /*
      Read against `followCandidate`, never against the roll's answer. The two
      agree today; an arm comparing the two DERIVATIONS would pass with the
      branches swapped and would go on passing through a divergence.
    */
    expect(
      perFaceDisplayCredits(CASTING_V2_FOLLOW_PRICE_CREDITS, CASTING_V2_COSTS.rollCandidateCount),
      "the receipt's per-face figure must be the price of one follow candidate",
    ).toBe(displayPrice(CASTING_V2_COSTS.followCandidate));
  });

  it("⚠ CONTROL — the FOLLOW total is declared from the follow slice, read at the declaration", () => {
    /*
      THE ARM WITHOUT WHICH THE FOLLOW ARM ABOVE IS HOLLOW, AND IT WAS FOUND BY
      SABOTAGE RATHER THAN BY READING.
      `CASTING_V2_FOLLOW_PRICE_CREDITS` repointed at `rollCandidate` instead of
      `followCandidate` is **invisible to every value arm in this repository**
      while the two slices agree at 200 — driven: the swap leaves this suite
      green on values alone, and `server/castingV2/followSlicePrice.test.ts`
      stays green too (19/19), because its declaration arm guards the SLICE
      literal (`followCandidate: 200`) and not this total's derivation. One noun
      over from the gap that file's own docblock is about.

      So the shape is read as TEXT. It is this suite's own premise that is being
      protected: with the total repointed, the Follow arm above would be
      asserting the Roll's answer twice and reporting it as coverage.
    */
    const costs = withoutComments(
      readListedSource(join(HERE, "..", "casting", "castingCreditCosts.ts")) ?? "",
    );
    expect(costs.length, "the price module must be readable for this arm to mean anything")
      .toBeGreaterThan(400);
    const at = costs.indexOf("export const CASTING_V2_FOLLOW_PRICE_CREDITS");
    expect(at, "the follow total must exist to be read").toBeGreaterThan(-1);
    const declaration = costs.slice(at, costs.indexOf(";", at));
    expect(declaration, "a follow's total is the FOLLOW slice times the count").toContain(
      "CASTING_V2_COSTS.followCandidate",
    );
    /*
      ⚠ A WORD BOUNDARY, BECAUSE THE NEGATION CONTAINS THE TOKEN. A plain
      `not.toContain("CASTING_V2_COSTS.rollCandidate")` is red on the CORRECT
      declaration: `rollCandidateCount` — the count this very line multiplies
      by — contains `rollCandidate` as a prefix. `\b` fails against the `C` of
      `Count`, so it reaches the slice price and not the count.
    */
    expect(declaration, "and never the roll's").not.toMatch(/CASTING_V2_COSTS\.rollCandidate\b/);
    /* The positive control for that boundary, both ways. */
    expect(/CASTING_V2_COSTS\.rollCandidate\b/.test("CASTING_V2_COSTS.rollCandidateCount")).toBe(false);
    expect(/CASTING_V2_COSTS\.rollCandidate\b/.test("CASTING_V2_COSTS.rollCandidate * x")).toBe(true);
  });

  it("CONTROL — the table really was read, and it holds the shape these arms assume", () => {
    /*
      A floor, not a pin on the prices. If the import resolved to something
      empty, the two arms above would compare nothing with nothing and could
      pass for the wrong reason. What is asserted is that the numbers exist,
      are positive, and that each total is its slice times the count — which is
      the relationship the derivation inverts.

      ⚠ No price VALUE is pinned here on purpose: a repricing is his to make and
      must not have to edit a suite that is not about prices.
    */
    expect(CASTING_V2_COSTS.rollCandidateCount).toBeGreaterThan(0);
    expect(CASTING_V2_COSTS.rollCandidate).toBeGreaterThan(0);
    expect(CASTING_V2_COSTS.followCandidate).toBeGreaterThan(0);
    expect(CASTING_V2_ROLL_PRICE_CREDITS).toBe(
      CASTING_V2_COSTS.rollCandidate * CASTING_V2_COSTS.rollCandidateCount,
    );
    expect(CASTING_V2_FOLLOW_PRICE_CREDITS).toBe(
      CASTING_V2_COSTS.followCandidate * CASTING_V2_COSTS.rollCandidateCount,
    );
  });

  it("⚠ divides in LEDGER units and applies the scale LAST — the other order is a different function", () => {
    /*
      THE ARM THAT CAN SEE THE MISTAKE THE CARD'S OWN WORDING INVITES.
      `displayPrice(ledger) / faces` and `displayPrice(ledger / faces)` agree at
      today's figures, so no arm over the live table can tell them apart. This
      one uses a total that does not divide evenly on the display scale: the
      honest per-face price rounds the real charge up exactly once, while
      dividing an already-rounded display figure lands on a fraction that
      `formatCredits` would print.
    */
    const total = 1_601;
    const faces = 8;
    expect(perFaceDisplayCredits(total, faces)).toBe(displayPrice(total / faces));
    expect(Number.isInteger(perFaceDisplayCredits(total, faces))).toBe(true);
    /* The rejected order, driven, so "it is not that one" is a measurement. */
    expect(Number.isInteger(displayPrice(total) / faces)).toBe(false);
  });

  it("rounds a per-face price UP, so the figure is never under the charge", () => {
    /* `shared/creditDisplay.ts`'s asymmetry is the safety property; a per-face
       figure that rounded DOWN would quote eight faces below what eight cost. */
    expect(perFaceDisplayCredits(21, 1)).toBe(5);
  });
});

describe("a figure nobody has read yet is not a figure of zero (#1725's family)", () => {
  it("no count means no per-face clause — null, never zero", () => {
    expect(perFaceDisplayCredits(CASTING_V2_ROLL_PRICE_CREDITS, undefined)).toBeNull();
    expect(perFaceDisplayCredits(CASTING_V2_ROLL_PRICE_CREDITS, null)).toBeNull();
    expect(perFaceDisplayCredits(CASTING_V2_ROLL_PRICE_CREDITS, 0)).toBeNull();
  });

  it("no price means no figure either", () => {
    expect(perFaceDisplayCredits(undefined, 8)).toBeNull();
    expect(perFaceDisplayCredits(null, 8)).toBeNull();
    expect(perFaceDisplayCredits(0, 8)).toBeNull();
  });

  it("a non-finite or fractional count is refused rather than rendered", () => {
    expect(perFaceDisplayCredits(Number.NaN, 8)).toBeNull();
    expect(perFaceDisplayCredits(Number.POSITIVE_INFINITY, 8)).toBeNull();
    /* A fractional "count" is not a count; dividing by it would invent a price. */
    expect(perFaceDisplayCredits(1_600, 7.5)).toBeNull();
  });
});

describe("the legend says the whole sentence, or the half that is still true", () => {
  it("states the derived figure and the refund promise", () => {
    const perFace = perFaceDisplayCredits(
      CASTING_V2_ROLL_PRICE_CREDITS,
      CASTING_V2_COSTS.rollCandidateCount,
    );
    expect(perFace).not.toBeNull();
    const line = receiptLegend(perFace);
    expect(line).toBe(
      `${formatCredits(displayPrice(CASTING_V2_COSTS.rollCandidate))} credits a face.`
        + ` ${RECEIPT_REFUND_CLAUSE}`,
    );
    /* The word, spelled out — the whole point of the card. */
    expect(line).toContain("credits a face");
    expect(line).not.toMatch(/\bCR\b/);
  });

  it("⚠ READS ITS ARGUMENT — the arm a hand-typed figure cannot survive", () => {
    /*
      THE ARM THE CARD IS ACTUALLY ABOUT, AND THE ONE EVERY OTHER ARM HERE
      FAILS TO BE. The arm above compares the legend against the figure the live
      table produces — so a `receiptLegend` that returned the literal
      *"40 credits a face"* would pass it, today, which is precisely the defect
      Yuna's *"30 credits a face"* draft was. A sentence is only derived if a
      different input gives a different sentence.
    */
    expect(receiptLegend(displayPrice(500))).toContain("100 credits a face");
    expect(receiptLegend(displayPrice(5))).toContain("1 credits a face");
    expect(receiptLegend(displayPrice(500))).not.toEqual(receiptLegend(displayPrice(5)));
  });

  it("⚠ the module types NO credit figure of its own — the staleness, banned at the source", () => {
    /*
      The done-when's second half: *"an arm fails if … a hand-typed per-face
      number comes back"*. The arm above sees a CONSTANT return; this sees a
      number typed into the arithmetic — `ledger / 5`, `* 40`, a default of
      `200`. Read on the emitted code with comments stripped, because this
      module's docblocks quote his prices on purpose and quoting a price is the
      opposite of declaring one.
    */
    const source = withoutComments(
      readListedSource(join(HERE, "..", "..", "shared", "castingReceipt.ts")) ?? "",
    );
    expect(source.length, "the module must be readable for this arm to mean anything").toBeGreaterThan(400);
    /* The only numerals allowed are the comparisons that refuse a bad input. */
    const numerals = source.match(/\d+/g) ?? [];
    expect(numerals, "a numeral in this module is a price waiting to go stale").toEqual(["0", "0"]);
    expect(source).toContain("displayPrice(");
    expect(source).toContain("formatCredits(");
  });

  it("the matcher would see a typed figure", () => {
    /* The positive control for the arm above: the shape it must refuse. */
    expect((withoutComments("const perFace = 40;\n").match(/\d+/g) ?? [])).toEqual(["40"]);
    expect((withoutComments("return ledger / 5;\n").match(/\d+/g) ?? [])).toEqual(["5"]);
  });

  it("omits the per-face clause rather than guessing, and keeps the promise", () => {
    /* #1703's convention: a sentence renders the clauses it can stand behind. */
    expect(receiptLegend(null)).toBe(RECEIPT_REFUND_CLAUSE);
    expect(receiptLegend(null)).not.toMatch(/\d/);
  });

  it("the refund clause is the product's promise, in the customer's words", () => {
    /* D-109 and the recovery sweep: eight independently refundable units. It is
       the same fact the tilde on the price carries in one character. */
    expect(RECEIPT_REFUND_CLAUSE).toBe("Any face that doesn't arrive is refunded.");
  });
});
