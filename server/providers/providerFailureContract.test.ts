import { describe, expect, it } from "vitest";

import {
  REFUSES_AFTER_RENDER,
  isRetryable,
  refusesAfterRender,
  type ProviderFailureClass,
} from "./types";

/**
 * WHO MAY TAKE THE MONEY BACK — pinned, because the founder decides this list.
 *
 * > *"the verification layer was trash… only give refunds on catastrophic
 * > failures because it couldn't truly detect something as subtle as
 * > freckles."* (founder, ruled unconditionally in fable-721)
 *
 * The list is short and the reason each member is on it is different in kind
 * from the reason the others are — which is exactly why it must be written
 * down rather than derived from a predicate somebody can widen. A class that
 * joins it starts refunding real customers on a machine's opinion; a class
 * that leaves it starts charging for pictures nobody can use. Both are founder
 * decisions, like adding a public endpoint, so both fail this file first.
 *
 * The behaviour of the doors that ASK this contract is proved where they run
 * (`castingV2/refineService.test.ts`): a set nobody consults is not a contract,
 * it is a comment (working law 7).
 */
describe("the post-render refund contract", () => {
  it("is exactly these three, and adding one is a founder decision", () => {
    expect([...REFUSES_AFTER_RENDER].sort()).toEqual([
      /* Our own compositor cut a frame the provider got right. Our damage. */
      "composite_fault",
      /* Not a photograph of one person — torn, corrupt, the wrong human. */
      "render_fault",
      /* We could not read what she already has, so no honest render was ever
         possible. Refuses as infrastructure, not as a judgment about her
         picture (fable-723 §3). */
      "segment_store",
    ]);
  });

  it("leaves the READER'S OPINION of a healthy frame off the money path", () => {
    /*
      The two classes the ruling moved, named here rather than left implicit:
      both are a machine disputing a picture that passed the damage detector,
      and both are now the customer's judgment with Regenerate as the remedy.
    */
    expect(refusesAfterRender("facts_missing")).toBe(false);
    expect(refusesAfterRender("removal_not_delivered")).toBe(false);
  });

  it("keeps every catastrophic class refunding", () => {
    expect(refusesAfterRender("render_fault")).toBe(true);
    expect(refusesAfterRender("composite_fault")).toBe(true);
    expect(refusesAfterRender("segment_store")).toBe(true);
  });

  it("says nothing about failures that never reached a picture", () => {
    /*
      Pre-render refusals are a different axis and the ruling does not touch
      them (fable-721 §2c): no provider was contacted, no picture exists, and
      the whole charge goes back through paths this set has no opinion about.
      Asserted so a later reader cannot mistake `false` here for "charges".
    */
    for (const before of ["cannot_say", "capability", "content_policy"] as const) {
      expect(refusesAfterRender(before)).toBe(false);
    }
  });

  it("is a different question from retryability, and the two do not drift", () => {
    /*
      A refund contract and a retry policy both key off this union and mean
      opposite things: everything that refuses after a render is terminal (a
      verdict about bytes that already exist), while everything retryable never
      got a verdict at all. If a class ever satisfied both, one of the two
      tables would be wrong about the same event.
    */
    for (const failure of REFUSES_AFTER_RENDER) {
      expect(isRetryable(failure as ProviderFailureClass)).toBe(false);
    }
  });
});
