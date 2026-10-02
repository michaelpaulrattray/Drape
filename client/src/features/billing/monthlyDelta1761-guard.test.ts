/**
 * #1761 — A ONE-TIME GRANT IS NOT A MONTHLY ALLOWANCE, AND EVERY
 * `+ N credits a month` ON ADD CREDITS SUBTRACTED ONE FROM THE OTHER.
 *
 * The pane's headline number is a delta — the brief's §7.2 calls it the
 * decision (*"name the DELTA, not the tier"*) — computed as the target rung's
 * `monthlyCredits` minus the account's own. On the free rung that second figure
 * is a **ONE-TIME signup grant**: `drizzle/schema.ts` says so on the row
 * itself, verbatim, *"`monthlyCredits` is a ONE-TIME signup grant on this rung
 * and nothing else reads it as monthly"*. So a free account opening Add credits
 * read **"+ 11,300 credits a month"** where Starter's whole allowance is
 * **14,000** — told it would get 2,700 fewer credits a month than it would.
 *
 * ## What these arms hold, and why none of them is a pinned sentence
 *
 * - **The arithmetic is driven over the real `PLAN_TIERS`**, never quoted. The
 *   card's own body says 11,300 and 14,000, true of the ladder he rounded on
 *   2026-10-01 (#1602) and not a property of it; what is held below is the
 *   RELATION — the broken figure was strictly smaller than the honest one, and
 *   the honest one is the target rung's own allowance.
 * - **`grantsMonthly` is driven as the rule rather than asserted at the free
 *   row.** Keying on `id === "free"` is the fixed list his N3 principle rules
 *   out, so the arm reads every offered rung and holds the answer against the
 *   PRICE. `creditsTail` reads the same declaration, and an arm holds that it
 *   does — two copies of a four-character test is working law 4 at its
 *   smallest, and the copy is what drifts.
 * - **The surface arms are SLICED** between anchors that appear once each, so
 *   an arm about the option row cannot be satisfied by the button above it. A
 *   missing anchor fails loudly rather than returning an empty band, which
 *   every `not.toContain` here would otherwise pass.
 *
 * Comments are stripped before every source match, so this docblock and the
 * surface's own ⚠ paragraphs — which quote the defect at length — cannot
 * satisfy an arm about the code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { PLAN_TIERS } from "../../../../drizzle/schema";
import { OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import { CASTING_V2_ONE_CHARACTER_CREDITS } from "../../../../server/castingV2/castViewPackage";
import { displayBalance, formatCredits } from "../../../../shared/creditDisplay";
import { charactersFor, creditsTail, grantsMonthly } from "../settings/planLadder";

const MODAL = "client/src/features/billing/AddCreditsModal.tsx";
const LADDER = "client/src/features/settings/planLadder.ts";

const read = (relative: string) =>
  withoutComments(readFileSync(join(process.cwd(), relative), "utf8"));

/** The offered ladder, as the surface sees it — the hidden rung is not on it. */
const offered = () =>
  OFFERED_PLAN_ORDER.map((id) => ({
    id,
    ...PLAN_TIERS[id as keyof typeof PLAN_TIERS],
  }));

/**
 * The slice of a surface between two anchors, so an arm about one sentence
 * cannot be satisfied by another sentence in the same file.
 */
function band(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  expect(start, "the opening anchor is gone from the surface: " + from).toBeGreaterThan(-1);
  const end = source.indexOf(to, start + from.length);
  expect(end, "the closing anchor is gone from the surface: " + to).toBeGreaterThan(-1);
  return source.slice(start, end);
}

describe("Card 1761 - the free rung's monthly delta, driven on the real ladder", () => {
  it("⚠ THE DELTA FROM FREE IS THE TARGET RUNG'S OWN ALLOWANCE, NOT A SUBTRACTION", () => {
    /*
      THE DEFECT AND ITS REPAIR IN ONE ARM, because the only honest measure of
      what was wrong is the two figures side by side. Read on 2026-10-02: the
      broken sentence said **11,300 a month**, the honest one says **14,000**.

      The relation is what is held — the subtraction can only ever UNDERSTATE,
      and by exactly the grant, which is the sentence the card is about.
    */
    const free = PLAN_TIERS.free;
    const target = PLAN_TIERS.starter;

    const honest = target.monthlyCredits - 0;
    const broken = target.monthlyCredits - free.monthlyCredits;

    expect(honest, "the delta from free is no longer the whole allowance").toBe(
      target.monthlyCredits,
    );
    expect(broken, "the free grant is zero, so this arm has stopped measuring anything").toBeLessThan(
      honest,
    );
    expect(
      honest - broken,
      "the understatement was exactly the one-time grant",
    ).toBe(free.monthlyCredits);

    /* And on the display scale the customer actually reads, through P1-1's
       helper rather than a division spelled here. */
    expect(formatCredits(displayBalance(honest))).not.toBe(
      formatCredits(displayBalance(broken)),
    );
  });

  it("⚠ THE REPAIR IS A NO-OP ON EVERY PAID RUNG — the arm that says it is narrow", () => {
    /*
      The card's own claim: *"It is only wrong on the free rung."* Every paid
      rung's `monthlyCredits` really is monthly, so the baseline is unchanged
      there and a Starter subscriber reading the Pro option sees exactly the
      figure it saw before. An arm that only proved the free rung moved would
      not have proved the rest stood still.
    */
    for (const rung of offered().filter((entry) => entry.price > 0)) {
      const baseline = grantsMonthly(rung.price) ? rung.monthlyCredits : 0;
      expect(
        baseline,
        `${rung.id}: a paid rung's own allowance stopped being its baseline`,
      ).toBe(rung.monthlyCredits);
    }
    /* The free rung is the one that moves, and it moves to zero. */
    expect(grantsMonthly(PLAN_TIERS.free.price)).toBe(false);
    expect(
      grantsMonthly(PLAN_TIERS.free.price) ? PLAN_TIERS.free.monthlyCredits : 0,
    ).toBe(0);
  });

  it("⚠ `grantsMonthly` IS THE PRICE AND NOT THE RUNG'S NAME, ON EVERY OFFERED RUNG", () => {
    /*
      The rule, driven over the whole ladder rather than asserted at the one row
      that is false today. A rung with nothing recurring to charge has nothing
      recurring to grant, whatever it is next called — his N3 principle
      (*"we really cannot be working from fixed lists"*) is why this is the
      test, and why neither surface may key on an id.
    */
    for (const rung of offered()) {
      expect(grantsMonthly(rung.price), `${rung.id}: the rule read the wrong way`).toBe(
        rung.price > 0,
      );
    }
    /* THE NEGATIVE CONTROL: a free rung that somehow carried a price would be
       monthly, and a paid rung at zero would not. The predicate reads the
       argument, never the ladder it came from. */
    expect(grantsMonthly(0)).toBe(false);
    expect(grantsMonthly(1)).toBe(true);
    expect(grantsMonthly(PLAN_TIERS.starter.price)).toBe(true);
  });

  it("⚠ THE RULE HAS ONE DECLARATION AND THE PLAN CARDS' ARRIVAL WORD READS IT", () => {
    /*
      `creditsTail` has derived the plan cards' *credits a month* / *credits to
      start* from the price since #1607, and it carried its own `> 0` test.
      With Add credits needing the same fact, two copies would be working law 4
      — so the function is the declaration and the tail reads it. Held at the
      bytes as well as at the behaviour, because identical behaviour is exactly
      what a second copy has on the day it is written.
    */
    expect(creditsTail(PLAN_TIERS.free.price)).not.toMatch(/month/i);
    expect(creditsTail(PLAN_TIERS.starter.price)).toContain("credits a month");

    const ladder = read(LADDER);
    expect(ladder, "the rule is not declared at all").toContain(
      "export function grantsMonthly",
    );
    const tail = band(ladder, "export function creditsTail", "export function grantsMonthly");
    expect(tail, "the arrival word has its own copy of the test again").toContain(
      "grantsMonthly(priceInCents)",
    );
    expect(tail, "a second `> 0` beside the one declaration").not.toMatch(
      /priceInCents\s*>\s*0/,
    );
  });
});

describe("Card 1761 - the three sentences on the surface take one baseline", () => {
  const source = () => read(MODAL);

  it("the baseline is derived from the price, on this surface, through the shared rule", () => {
    const code = source();
    expect(code, "the surface no longer derives a monthly baseline").toContain(
      "const currentMonthlyCredits",
    );
    expect(code, "the baseline stopped reading the shared rule").toContain(
      "grantsMonthly(currentPrice)",
    );
    /* The one thing this must never become: a branch on the rung's id. */
    expect(code, "the baseline keys on the rung's name").not.toMatch(
      /currentId\s*===\s*["']free["']/,
    );
    /* An unread rung is still `null` rather than a zero baseline — the free
       rung's 0 is a real answer and the two must stay distinguishable (#1747). */
    expect(code).toMatch(/currentCredits === null \|\| currentPrice === null/);
  });

  it("⚠ THE DELTA AND THE OPTION ROW BOTH READ IT, AND NEITHER SUBTRACTS THE RAW COLUMN", () => {
    /*
      Two readers, sliced apart so one cannot answer for the other. The option
      row does its own arithmetic in the JSX, which is why it was the site the
      card's body missed — it named two and there are three.
    */
    const code = source();

    const deltaDecl = band(code, "const delta =", "const rateComparable");
    expect(deltaDecl).toContain("selected.credits - currentMonthlyCredits");
    expect(deltaDecl, "the chosen plan's delta subtracts the raw column again").not.toMatch(
      /selected\.credits\s*-\s*currentCredits\b/,
    );

    const optionRow = band(code, 'className="dp-topup__options"', "dp-topup__optionprice");
    expect(optionRow).toContain("option.credits - currentMonthlyCredits");
    expect(optionRow, "the option row subtracts the raw column again").not.toMatch(
      /option\.credits\s*-\s*currentCredits\b/,
    );
    expect(optionRow, "the option row lost its unread state").toContain(
      "currentMonthlyCredits === null",
    );
  });

  it("⚠ `up from` COUNTS THE BASELINE, SO THE FREE RUNG HAS NOTHING TO BE UP FROM", () => {
    /*
      The sentence is *"That is about N finished characters **a month**, up from
      about M"*. Off the raw column that M counted what a ONE-TIME grant covers,
      inside a clause governed by *a month*. The baseline makes it 0, and 0 is
      falsy where the clause is drawn — so the comparison drops and the claim
      stands.
    */
    const code = source();
    const nowCount = band(code, "const nowCount =", "const nextPhrase");
    expect(nowCount).toContain("charactersFor(currentMonthlyCredits, oneCharacterCredits)");
    expect(nowCount, "the count reads the raw column again").not.toMatch(
      /charactersFor\(currentCredits\b/,
    );

    /* Driven rather than reasoned: the helper's answer at the free baseline, and
       that the JSX's gate is the falsy test rather than a null check that would
       print `up from about 0`. */
    expect(charactersFor(0, CASTING_V2_ONE_CHARACTER_CREDITS)).toBe(0);
    const bullets = band(code, 'className="dp-topup__bullets"', "dp-topup__renewal");
    expect(bullets, "the clause is drawn on an unread or absent baseline").toContain(
      "nowCount ?",
    );
    expect(bullets, "the comparison stopped being a clause at all").toContain("up from about");

    /* THE POSITIVE CONTROL for the two `not.toMatch` arms above: `currentCredits`
       is still on the surface and still read by the rate chip, so their silence
       is the arithmetic having moved and not the reader failing to see a name. */
    expect(code, "the raw column left the surface, so the arms above prove nothing").toContain(
      "currentCredits",
    );
    const rateChip = band(code, 'className="dp-set__value"', 'className="dp-topup__select"');
    expect(rateChip, "the rate comparison stopped reading the declared credits").toContain(
      "currentCredits",
    );
  });

  it("the third copy of the delta is gone from the options memo, not corrected in place", () => {
    /*
      `delta: entry.credits - currentCredits` sat in the mapped row with a
      `currentCredits` read for it alone, and nothing has ever read it — the
      empty-array branch's own annotation does not even list the field. A mirror
      of a figure computed three lines away is working law 4, and a WRONG mirror
      is what the next reader of this memo copies.
    */
    const memo = band(source(), "const options = useMemo", "const selectedId");
    expect(memo, "the dead third copy of the subtraction is back").not.toMatch(/\bdelta\b/);
    expect(memo, "the memo reads the credits column for a figure nobody uses").not.toContain(
      "monthlyCredits",
    );
    /* The positive control: the memo is still the thing being read. */
    expect(memo).toContain("plans.subscriptions");
    /* And no consumer anywhere reads a `delta` off an option row. */
    expect(source(), "something started reading a per-row delta again").not.toContain(
      "option.delta",
    );
  });
});
