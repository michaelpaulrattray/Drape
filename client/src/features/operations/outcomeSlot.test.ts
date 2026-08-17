import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { adoptSettledOutcome, settledDismissalFor, type HeldOutcome } from "./outcomeSlot";
import { LOST_CONTACT } from "@/features/castingV2/failureCopy";
import { bridgeShouldSpeak } from "./surfaceOwnership";

/**
 * THE ARM THE SUITE NEVER RAN (fable-847 §3).
 *
 * Landing A shipped with its own tests, and all of them ask what happens when
 * the slot is EMPTY. His lived sequence is the one nobody drove: the panel
 * already holds its fallback when the true sentence arrives, and `current ??
 * newest.message` keeps the fallback.
 *
 * The sentences below are production's. `TRUE_SENTENCE` is the shape the server
 * writes on the operation row for a refine that came back undelivered — it
 * carries the actionable half — and `LOST_CONTACT` is imported rather than
 * retyped, because a test that spells a copy string is a test that passes the
 * day the copy is edited and the rule is broken.
 */
const TRUE_SENTENCE = "That one came back twice without fox eyes, so it wasn't delivered "
  + "and your credits have been returned. Try saying it a different way.";

const fallback = (requestId: string): HeldOutcome =>
  ({ text: LOST_CONTACT, origin: "fallback", requestId });
const server = (text: string, requestId: string | null = "req-1"): HeldOutcome =>
  ({ text, origin: "server", requestId });

const NONE: ReadonlySet<string> = new Set();

describe("a settled row's true sentence against the panel's fallback", () => {
  it("SUPERSEDES the fallback for the same request — his lived sequence", () => {
    /*
      The whole hazard in five lines: the gateway died, the panel said the only
      honest thing it had, and the server's own answer arrived a moment later.
      Before fable-847 §3 this returned the fallback and the true sentence — with
      "try saying it a different way" inside it — reached nobody.
    */
    const next = adoptSettledOutcome({
      held: fallback("req-1"),
      settled: [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
      dismissed: NONE,
    });
    expect(next?.text).toBe(TRUE_SENTENCE);
    expect(next?.origin).toBe("server");
    expect(next?.requestId).toBe("req-1");
  });

  it("makes the mark honest by construction — the bridge yields to a sentence that is REALLY on screen", () => {
    /*
      Landing A marks the request `server` one loop above this decision, which
      silences the bridge. That mark was a promise the display did not keep. This
      arm is the two halves in one place: after superseding, the words the bridge
      is standing down for are the words in the slot.
    */
    const next = adoptSettledOutcome({
      held: fallback("req-1"),
      settled: [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
      dismissed: NONE,
    });
    const bridgeSilent = !bridgeShouldSpeak({
      kind: "castingV2.refine",
      status: "failed",
      publicMessage: TRUE_SENTENCE,
      outcomeShown: "server",
    });
    expect(bridgeSilent).toBe(true);
    expect(next?.text).toBe(TRUE_SENTENCE);
  });

  it("does NOT supersede a sentence the server authored for the edit being read", () => {
    /* D-154: an outcome stands until it is dismissed or until their own next
       ask supersedes it. A settled row is neither. */
    const held = server("Makeup isn't something I can place yet. Nothing was charged.");
    const next = adoptSettledOutcome({
      held,
      settled: [{ clientRequestId: "req-9", message: TRUE_SENTENCE }],
      dismissed: NONE,
    });
    expect(next).toBe(held);
  });

  it("does NOT replace one request's fallback with another request's answer", () => {
    /*
      fable-465, in a new place: another request's sentence must not speak over
      this one. The fallback is about the edit he typed; the settled row is about
      a different one, and showing it would be a wrong-request sentence wearing
      a fix's clothes.
    */
    const held = fallback("req-1");
    const next = adoptSettledOutcome({
      held,
      settled: [{ clientRequestId: "req-OTHER", message: TRUE_SENTENCE }],
      dismissed: NONE,
    });
    expect(next).toBe(held);
  });

  it("finds the row for the held request even when a newer one has settled", () => {
    const next = adoptSettledOutcome({
      held: fallback("req-1"),
      settled: [
        { clientRequestId: "req-2", message: "A different edit's answer." },
        { clientRequestId: "req-1", message: TRUE_SENTENCE },
      ],
      dismissed: NONE,
    });
    expect(next?.text).toBe(TRUE_SENTENCE);
  });

  it("leaves a dismissed sentence closed — a poll may not re-raise it", () => {
    const held = fallback("req-1");
    const next = adoptSettledOutcome({
      held,
      settled: [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
      dismissed: new Set(["req-1"]),
    });
    expect(next).toBe(held);
  });

  it("does not flap: once superseded, the same rows leave the slot alone", () => {
    const settled = [{ clientRequestId: "req-1", message: TRUE_SENTENCE }];
    const once = adoptSettledOutcome({ held: fallback("req-1"), settled, dismissed: NONE });
    const twice = adoptSettledOutcome({ held: once, settled, dismissed: NONE });
    expect(twice).toBe(once);
  });
});

describe("the behaviour Landing A shipped, unchanged", () => {
  it("adopts the newest row into an EMPTY slot", () => {
    const next = adoptSettledOutcome({
      held: null,
      settled: [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
      dismissed: NONE,
    });
    expect(next?.text).toBe(TRUE_SENTENCE);
  });

  it("adopts nothing when the newest row carries no sentence", () => {
    expect(adoptSettledOutcome({
      held: null,
      settled: [{ clientRequestId: "req-1", message: null }],
      dismissed: NONE,
    })).toBeNull();
  });

  it("adopts nothing into an empty slot the user has already closed", () => {
    expect(adoptSettledOutcome({
      held: null,
      settled: [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
      dismissed: new Set(["req-1"]),
    })).toBeNull();
  });
});

/**
 * AND THE SHEET ACTUALLY CALLS IT — doctrine 19's corollary, at the one seam a
 * pure-function test cannot see.
 *
 * Every arm above stays green if `CastingSheet` keeps deciding this inline,
 * which is precisely how the hazard survived Landing A's own tests. Reading the
 * source is the cheap honest check, and `bridgeOwnership.test.ts` does the same
 * thing one file away for the same reason.
 */
describe("the decision has a call site", () => {
  const SHEET = readFileSync(new URL("../../pages/CastingSheet.tsx", import.meta.url), "utf8");

  it("is invoked by the sheet's adoption effect", () => {
    expect(SHEET).toContain("adoptSettledOutcome({");
  });

  it("does not keep the expression the fix replaced", () => {
    /*
      The hazard was `setRefineOutcome((current) => current ?? newest.message)`.
      If it comes back, every arm above still passes and the true sentence goes
      back in the bin.

      Asserted on the SETTER SHAPE, not on the bare expression: the first version
      of this line read `not.toContain("current ?? newest.message")` and failed
      on the comment three lines above the call site, which QUOTES the defect it
      replaced. A guard that cannot tell code from prose about code would have
      forced the explanation out of the file to keep itself green — the wrong
      way round, and the same class as a typo gate that owns a real word.
    */
    expect(SHEET).not.toMatch(/setRefineOutcome\(\(current\) => current\b/);
  });

  it("records a dismissal through the matcher rather than by comparing words", () => {
    expect(SHEET).toContain("settledDismissalFor(");
    expect(SHEET).not.toContain("refineOutcome === newest.message");
  });
});

describe("what a dismissal records", () => {
  it("names the request whose settled sentence is on screen", () => {
    expect(settledDismissalFor(
      server(TRUE_SENTENCE, "req-1"),
      [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
    )).toBe("req-1");
  });

  it("records nothing when the slot holds the panel's own words", () => {
    expect(settledDismissalFor(
      server("The edit you started earlier just arrived and was added to this face.", "req-1"),
      [{ clientRequestId: "req-1", message: TRUE_SENTENCE }],
    )).toBeNull();
  });

  it("does not name a DIFFERENT request that happens to have said the same thing", () => {
    /* Two edits refused the same way is not exotic, and recording the wrong id
       leaves the real one free to be re-raised by a dismissal that looked like
       it worked. */
    expect(settledDismissalFor(
      server(TRUE_SENTENCE, "req-1"),
      [{ clientRequestId: "req-2", message: TRUE_SENTENCE }],
    )).toBeNull();
  });

  it("records nothing for an empty slot", () => {
    expect(settledDismissalFor(null, [{ clientRequestId: "req-1", message: TRUE_SENTENCE }])).toBeNull();
  });
});
