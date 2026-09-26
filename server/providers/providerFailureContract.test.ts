import { describe, expect, it, vi } from "vitest";

import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  REFUSES_AFTER_RENDER,
  RETRYABLE_FAILURES,
  VIEW_ARRIVAL_TERMINAL,
  isRetryable,
  mayStillArrive,
  refusesAfterRender,
  type ProviderFailureClass,
} from "./types";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";

/* This file sweeps the `server/` tree to measure which failure classes anything
   actually raises, so it declares the contended ceiling at FILE level (#741) —
   a number typed onto one `it(…)` is not inherited by its neighbour. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * WHICH PRODUCTION MODULES RAISE THIS FAILURE CLASS — measured, never listed.
 *
 * `new ProviderError("<class>"` is the only way a class enters the taxonomy at
 * runtime, so the raiser set is a grep over the declaration site rather than an
 * opinion. Tests are excluded because a suite throwing a class to drive a road
 * is not the product raising it; `providers/types.ts` is excluded because it
 * DECLARES the union and the sets, which every class appears in by definition.
 *
 * The read goes through `readListedSource`: this walk lists directories other
 * suites plant and unlink files in, and a file that vanishes between the listing
 * and the read is #223's ENOENT rather than a finding (`server/testing/listedSource.ts`).
 */
async function raisersOf(failureClass: ProviderFailureClass): Promise<string[]> {
  const serverRoot = path.resolve(import.meta.dirname, "..");
  const needle = `ProviderError("${failureClass}"`;
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const child of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, child.name);
      if (child.isDirectory()) {
        if (child.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!child.name.endsWith(".ts")) continue;
      if (child.name.includes(".test.")) continue;
      if (full === path.join(serverRoot, "providers", "types.ts")) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      if (source.includes(needle)) found.push(path.relative(serverRoot, full).replace(/\\/g, "/"));
    }
  };
  walk(serverRoot);
  return found.sort();
}

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
  it("is exactly these six, and every one of them is terminal in its own words", () => {
    expect([...VIEW_ARRIVAL_TERMINAL].sort()).toEqual([
      /* "the recipe will have the same nothing to say a second later" - and it
         refuses BEFORE the provider is contacted, so nothing was ever arriving. */
      "cannot_say",
      /* The request asks the same impossible thing a second time. */
      "capability",
      /* "the same inputs produce the same cut" (#1301). */
      "composite_fault",
      /* "Never retried - it will refuse again." */
      "content_policy",
      /* "every candidate after it will fail the same way, and no user action can
         fix it" (#1301) - and the only one of that card's three that is
         reachable on the paid view road, so the only measured win. */
      "provider_account",
      /* "asking the same engine the same question is not a different request"
         (#1301). */
      "removal_not_delivered",
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

    This arm listed SIX until #1301 decided three of them. Two are left because
    a redraw from a stochastic engine is genuinely a different draw and she has
    already paid for a frame she does not have; the third is HELD, and its reason
    is the look #1301 asked for rather than a deferral — `segment_store`'s own
    declaration qualifies itself with "in the same second" and this loop waits
    1.5 s then 4 s, so a transient blip is the case its words do not cover, and
    nothing in the product raises the class at all (the arm below measures that
    rather than asserting it).
  */
  it("leaves the stochastic pair and the held class retrying", () => {
    for (const failure of ["render_fault", "facts_missing", "segment_store"] as const) {
      expect(mayStillArrive(failure), failure).toBe(true);
    }
  });

  /*
    ⚠ THE HELD CLASS'S REASON, MEASURED RATHER THAN QUOTED. `segment_store` stays
    on the arrival budget partly because nothing raises it, and that is a fact
    about the tree which will stop being true the day somebody wires it. When it
    does, this arm goes red and the hold gets re-read with a real road behind it
    — which is the whole point of measuring it here instead of writing the
    sentence into a docblock and leaving it to rot.
  */
  it("nothing in the product raises segment_store — so the hold has no road to judge", async () => {
    const raised = await raisersOf("segment_store");
    expect(
      raised,
      "segment_store now has a raiser: re-read the hold in VIEW_ARRIVAL_TERMINAL's docblock (#1301)",
    ).toEqual([]);
    /* POSITIVE CONTROL: the same reader finds the raisers of a class that HAS
       them, so an empty answer above is a finding and not a broken search. */
    expect((await raisersOf("render_fault")).length).toBeGreaterThan(0);
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
