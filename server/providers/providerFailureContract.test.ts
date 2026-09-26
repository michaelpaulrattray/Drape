import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import {
  REFUSES_AFTER_RENDER,
  RETRYABLE_FAILURES,
  VIEW_ARRIVAL_TERMINAL,
  isRetryable,
  mayStillArrive,
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


/**
 * THE THIRD QUESTION, AND THE ONE THAT WAS BEING ANSWERED IN A LOOP (#1212).
 *
 * *"The customer has already paid for this view. Is asking again the way to get
 * it to her?"* Two sets in this module already read the same union — retry
 * policy and refund contract — and the Sign package's view loop was holding a
 * third opinion in a hand-written `failureClass === "content_policy" ||
 * failureClass === "capability"`. Three answers, one union, and only two of
 * them anywhere a reader would look.
 *
 * ⚠ **THIS SUITE'S JOB IS THE RELATIONSHIP BETWEEN THE THREE, NOT THE
 * MEMBERSHIP OF ONE.** A list can be re-read; a contradiction between two lists
 * about the same event cannot be seen by reading either.
 */
describe("the did-it-arrive contract", () => {
  it("is exactly these three, and every one of them is terminal in its own words", () => {
    expect([...VIEW_ARRIVAL_TERMINAL].sort()).toEqual([
      /* "the recipe will have the same nothing to say a second later" - and it
         refuses BEFORE the provider is contacted, so nothing was ever arriving. */
      "cannot_say",
      /* The request asks the same impossible thing a second time. */
      "capability",
      /* "Never retried - it will refuse again." */
      "content_policy",
    ]);
  });

  /*
    ⚠ THE ARM THE WHOLE SET EXISTS FOR. The transport contract calls `unknown`
    terminal on purpose so an unmapped fault fails closed rather than spinning.
    A paid view is the opposite case: an unmapped engine fault is the commonest
    way one does not arrive, and she has already paid. Deriving this from
    `isRetryable` was written, driven and reverted inside #1208.
  */
  it("keeps an unmapped fault RETRYING, which is where it parts from the transport", () => {
    expect(mayStillArrive("unknown")).toBe(true);
    expect(isRetryable("unknown")).toBe(false);
  });

  /*
    The two sets must never contradict each other about the same event: a class
    the transport will happily retry cannot also be one this road gives up on.
    Stated as a relationship so neither list can drift into the other.
  */
  it("never gives up on something the transport contract would retry", () => {
    for (const failure of RETRYABLE_FAILURES) {
      expect(mayStillArrive(failure as ProviderFailureClass)).toBe(true);
    }
  });

  /*
    ⚠ AND THE CLASSES DELIBERATELY LEFT RETRYING, pinned so that adding one is a
    visible act rather than a quiet narrowing of a road the customer paid for.
    Two because a redraw from a stochastic engine is genuinely a different draw;
    four because narrowing them is a money decision, carded rather than taken.
  */
  it("leaves every candidate class retrying until somebody decides otherwise", () => {
    for (const failure of [
      "render_fault",
      "facts_missing",
      "provider_account",
      "composite_fault",
      "segment_store",
      "removal_not_delivered",
    ] as const) {
      expect(mayStillArrive(failure), failure).toBe(true);
    }
  });

  /*
    ⚠ THE WIRE, AND IT IS THE HALF THAT WAS MISSING BEFORE THIS CARD. Every arm
    above passes over a loop that ignores the set entirely - which is exactly
    the state the product was in, with the contract sitting here and the paid
    road naming its own classes. So the road's source is read: it must ASK the
    question rather than restate its answer. `packageOrchestrator.test.ts`
    drives the behaviour; this is what says no second list came back.
  */
  it("is what the Sign package's view loop actually asks", async () => {
    const road = await readFile(
      new URL("../castingV2/packageOrchestrator.ts", import.meta.url),
      "utf8",
    );
    const guard = road
      .split(/\r?\n/)
      .filter((line) => line.includes("break;") && !line.trim().startsWith("*"));
    expect(guard.some((line) => line.includes("mayStillArrive"))).toBe(true);
    /* Positive control: the file was read and does contain the loop at all. */
    expect(road).toContain("arrivalFailures");
    /* And no hand-written class comparison came back beside it. */
    const code = road
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
      .join("\n");
    expect(code).not.toContain('failureClass === "content_policy"');
    expect(code).not.toContain('failureClass === "capability"');
  });
});
