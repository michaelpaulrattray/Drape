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
describe("#404 — the plan blurb map cannot drift from the ladder", () => {
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

  it("⚠ a line stays one line at the slot's size", () => {
    /*
      §6c's slot is `one line, 400 11px/1.55`. A long sentence wraps and pushes
      the action button out of alignment across the three cards, which is the
      exact complaint card 425 item 2 fixed on the current-plan marker. The
      bound is generous — this catches a paragraph pasted in, not a word added.
    */
    for (const [id, line] of Object.entries(PLAN_BLURBS)) {
      expect(line.length, `${id}'s blurb is long enough to wrap the slot`).toBeLessThanOrEqual(
        72,
      );
      expect(line, `${id}'s blurb has a line break in it`).not.toMatch(/\n/);
    }
  });
});
