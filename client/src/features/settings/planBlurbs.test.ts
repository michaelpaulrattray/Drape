import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HIDDEN_PLAN_TIERS, OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import { PLAN_BLURBS, blurbFor } from "./planBlurbs";

/**
 * #404 — every offered rung has a line, and nothing else does.
 *
 * The blurb is marketing copy on a client-side map, which is the right shape
 * for words the founder rewrites (no schema, no wire field, one table). The
 * cost of that shape is the one working law 4 names: **a second list beside a
 * source of truth drifts from it.** The ladder is the source of truth and it
 * has already moved once — #391 folded twelve rungs to seven — so this suite
 * derives its population from `OFFERED_PLAN_ORDER` rather than restating it.
 *
 * ⚠ **IT IS PINNED IN BOTH DIRECTIONS ON PURPOSE, BECAUSE THE TWO FAILURES
 * LOOK NOTHING ALIKE.** A rung with no line draws a card with a hole in it,
 * which a customer sees. A line for a rung nobody is served is invisible
 * forever — the shape that leaves a repository full of copy for products that
 * no longer exist, and the shape this program keeps digging out of documents.
 * Only the first would ever be reported.
 */
describe("card 404 — the plan blurb map cannot drift from the ladder", () => {
  it("every offered rung has a line, and it is not blank", () => {
    for (const tier of OFFERED_PLAN_ORDER) {
      const line = blurbFor(tier);
      expect(line, `${tier} has no blurb — its card ships with an empty slot`).toBeTruthy();
      expect(line!.trim().length, `${tier}'s blurb is blank`).toBeGreaterThan(0);
    }
  });

  it("no line exists for a rung the product does not offer", () => {
    const offered = new Set<string>(OFFERED_PLAN_ORDER as readonly string[]);
    for (const id of Object.keys(PLAN_BLURBS)) {
      expect(offered.has(id), `${id} has a blurb but is not on the offered ladder`).toBe(true);
    }
  });

  it("⚠ the hidden rung has none, and that is the point rather than an oversight", () => {
    /*
      `ultimate` is off the ladder (#391) and its door is the email line under
      the modal. A blurb for it would be copy for a rung `getPlans` never
      serves — written, shipped, and unreachable.
    */
    for (const hidden of HIDDEN_PLAN_TIERS) {
      expect(blurbFor(hidden), `${hidden} is hidden and must have no blurb`).toBeNull();
    }
  });

  it("⚠ an unknown rung yields null, never the word undefined on a card", () => {
    expect(blurbFor("no_such_rung")).toBeNull();
  });

  it("⚠ a PROTOTYPE key yields null too — this arm's claim used to be false", () => {
    /*
      PR #619 review, finding 1. The lookup was `PLAN_BLURBS[planId] ?? null`,
      and a plain object literal inherits from `Object.prototype`, so three
      strings answered with a FUNCTION rather than null — truthy, not a string,
      and rendered into JSX it crashes the card. The arm above asserted
      "an unknown rung yields null" and was passing while that was untrue of
      `constructor`, `toString` and `hasOwnProperty`, because it only ever
      tried one friendly string.

      Not reachable today — `plan.id` comes from the server's `planOrder`
      walk — which is why this is hardening. The reason it was taken anyway is
      that a suite making a claim wider than it tests is the thing this
      repository keeps paying for.
    */
    for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(blurbFor(key), `${key} answered with something other than null`).toBeNull();
    }
  });

  it("⚠ the FREE line is the one that makes product claims, and it is named not hidden", () => {
    /*
      PR #619 review, finding 2. The module used to say every line was free of
      capability claims; six are, and *"Try the studio. A few casts a month, no
      card."* is not — it carries a volume and a signup fact, both true today
      and both changeable by a product decision.

      ⚠ **It is NOT rewritten.** He named these seven and said *"Build to
      those"*; editing his approved copy to make a docblock of mine true would
      be the worse error. This arm exists so the exception is a FACT IN THE
      SUITE rather than a sentence in a comment — if a later shift softens the
      free line into the who-it-is-for shape the other six use, this arm goes
      red and makes them read this paragraph first.
    */
    expect(PLAN_BLURBS.free).toBe("Try the studio. A few casts a month, no card.");
  });

  it("⚠ no line claims a CAPABILITY — that is what makes a placeholder safe to ship", () => {
    /*
      These seven are the relay's words under his order, not his own, and he
      will replace them. The bar that survives from his 2026-09-02 placeholder
      ruling is that a placeholder must not make a promise: a line saying who a
      plan is FOR cannot be made false by the product changing, while a line
      claiming what it DOES can — and would then be an invented user-visible
      claim, which the quotation-not-requirement law forbids outright.

      ⚠ **This arm cannot read English, and it says so rather than pretending.**
      It catches the specific shapes a capability claim takes — a number of
      things, a speed, a turnaround, a guarantee, a named feature. It is a
      floor under the copy, not a proof of its honesty; his eye is that.
    */
    const forbidden = [
      /\bunlimited\b/i,
      /\bguarantee/i,
      /\binstant/i,
      /\bfastest\b/i,
      /\bpriority\b/i,
      /\b\d[\d,]*\s*(casts?|frames?|images?|credits?|models?)\b/i,
      /\b(per|a)\s+(second|minute|hour)\b/i,
      /\bsupport\b/i,
      /\bAPI\b/,
      /\bSLA\b/i,
    ];
    for (const [id, line] of Object.entries(PLAN_BLURBS)) {
      for (const pattern of forbidden) {
        expect(pattern.test(line), `${id}'s blurb makes a capability claim: "${line}"`).toBe(
          false,
        );
      }
    }
  });

  it("⚠ the slot reserves two lines, so a wrap cannot misalign the cards", () => {
    /*
      ⚠ **THIS ARM IS A PROXY FOR A DRIVEN FACT AND SAYS SO.** What actually
      matters is a pixel reading — the three cards’ action buttons share a top
      edge — and no unit test in this repository can take it; the frames in the
      PR are the evidence. What this holds is the one CSS declaration that
      reading depends on, so it cannot be deleted as dead weight by someone who
      never saw the misalignment it fixes.

      Measured before the fix, at 1440 in the running app: two of the seven
      lines wrap at this card width, the shorter card’s action sat at y=439
      against its neighbours’ 456, and every element below it — credits, what
      it makes, rollover, perks — carried the same 17px offset.
    */
    const css = readFileSync(fileURLToPath(new URL("./settings.css", import.meta.url)), "utf8");
    const at = css.indexOf(".dp-plan__blurb");
    expect(at, "the blurb has no style block at all").toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}", at));
    expect(block, "the blurb slot stopped reserving its height — cards will misalign on a wrap").toContain(
      "min-height",
    );
  });

  it("⚠ a line stays inside the slot's RESERVED two lines", () => {
    /*
      ⚠ **THIS ARM'S FIRST SHAPE WAS WRONG AND THE RUNNING APP IS WHAT SAID
      SO.** It was written as *"a line stays one line"* with a 72-character cap,
      on §6c's word that the blurb is one line. Driven at 1440 (law 6), two of
      the seven approved lines WRAP — 58 and 54 characters against a 233px text
      column — and both passed this cap while doing it, because **a character
      count cannot model a width.** They pulled the shorter card's action and
      credits block 17px above its neighbours, which is card 425 item 2's exact
      complaint.

      The layout fix reserves two lines of height for every card, so wrapping no
      longer misaligns anything and the real bound became THREE lines rather
      than one. This cap is calibrated to that: ~72 characters is comfortably
      inside two lines at this width, and a third line is where the reserved box
      overflows again.

      ⚠ **It is still a proxy and says so.** The honest instrument for this is
      the driven frame, not the string length; this arm catches a paragraph
      pasted into the table, and his eye catches the rest.
    */
    for (const [id, line] of Object.entries(PLAN_BLURBS)) {
      expect(line.length, `${id}'s blurb is long enough to wrap the slot`).toBeLessThanOrEqual(
        72,
      );
      expect(line, `${id}'s blurb has a line break in it`).not.toMatch(/\n/);
    }
  });
});
