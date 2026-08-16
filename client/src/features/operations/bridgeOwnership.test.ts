import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { bridgeShouldSpeak, ownsItsOwnSurface, selfReportingKinds } from "./surfaceOwnership";

/**
 * Who gets to tell the user what happened.
 *
 * `GenerationOperationBridge` polls every generation operation and toasts a
 * failed one's `publicMessage` from wherever the user happens to be. That is
 * right for work nobody is watching — a canvas draft landing on a board the
 * user has navigated away from. It is wrong for a surface that reports the
 * outcome in place.
 *
 * D-110: a toast is the fallback channel, never a second copy.
 *
 * # This file has now lost its copy of the rule TWICE, and the second time cost
 * # the founder eight nights
 *
 * It first carried its own copy of the whole predicate, so it described the
 * bridge rather than testing it; that was fixed by importing
 * `ownsItsOwnSurface`. But it went on restating the three clauses AROUND that
 * call — "the surrounding clauses are restated because they are three booleans
 * read off a DTO" — and the defect of 2026-08-17 lived in the relationship
 * between those clauses and the imported one, which is exactly what a
 * restatement cannot see.
 *
 * The whole decision is now `bridgeShouldSpeak`, and this file drives it.
 */

/**
 * AND THE BRIDGE ACTUALLY CALLS IT — invariant 7, at the one seam a predicate
 * test cannot see.
 *
 * Every arm below drives `bridgeShouldSpeak` directly, so all of them stay
 * green if `GenerationOperationBridge` stops calling it and decides for itself.
 * That is not hypothetical: the clauses lived inline in that file until today,
 * and the defect they caused was invisible to this suite for exactly that
 * reason. Reading the source is the cheap honest check that the call site is
 * there — `railWaitAnatomy.test.ts` does the same for the same reason.
 */
describe("the decision has a call site", () => {
  const BRIDGE = readFileSync(
    new URL("./GenerationOperationBridge.tsx", import.meta.url),
    "utf8",
  );

  it("is invoked by the bridge", () => {
    expect(BRIDGE).toContain("bridgeShouldSpeak({");
  });

  it("does not decide any of it a second time, beside the call", () => {
    /* The clauses that used to be here. If one comes back, the predicate is no
       longer the whole rule and this suite is testing half a decision. */
    expect(BRIDGE).not.toContain("ownsItsOwnSurface(");
    expect(BRIDGE).not.toMatch(/status === "failed"\s*\n?\s*&&/);
  });

  it("feeds it the per-request fact rather than leaving it undefined", () => {
    /* The whole fix is that argument. Dropping it silently restores the old
       behaviour for every refine, with every arm below still green. */
    expect(BRIDGE).toContain("outcomeShown: outcomeShownFor(");
  });
});

describe("the bridge does not double-report a surface that speaks for itself", () => {
  /*
    The list is pinned, not merely exercised. Both failure directions are
    silent: a kind wrongly added here goes quiet with nothing on screen, and a
    kind wrongly missing duplicates a notice the user is already reading.
  */
  it("names exactly the kinds whose surface can represent a terminal failure", () => {
    /*
      `castingV2.refine` was here until 2026-08-17 and its removal is a ruling
      (fable-825 §2 / fable-828 §3) — the refine panel's only channel is the
      return value of its own mutation, and a terminal refine failure is in
      neither of the sheet's two lists. Re-adding it re-opens the defect.
    */
    expect(selfReportingKinds()).toEqual(["castingV2.roll", "castingV2.sign"]);
    expect(ownsItsOwnSurface("castingV2.refine")).toBe(false);
  });

  it("stays silent on the cancelled roll the founder saw", () => {
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.roll",
        status: "failed",
        publicMessage: "That roll was cancelled. 160 credits were refunded.",
      }),
    ).toBe(false);
  });

  it("stays silent on a genuinely failed roll too — the sheet still shows it", () => {
    /*
      Deliberately not narrowed to cancellations. A failed V2 roll leaves
      `failed-refunded` tiles and a banner on the sheet, so the toast is a
      second telling either way. Narrowing to the cancel message would mean
      matching on copy, which breaks the first time the sentence is edited.
    */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.roll",
        status: "failed",
        publicMessage: "None of the sheet arrived. 160 credits were refunded.",
      }),
    ).toBe(false);
  });

  /*
    Sign joined when the room shipped. A permanently failed slot confesses in
    place ("this view didn't arrive — refunded") and a total loss says so at the
    top, both server-authored — so a toast would talk over the room.
  */
  it("leaves the Sign to the room", () => {
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.sign",
        status: "failed",
        publicMessage: "The package could not be built. 500 credits were refunded.",
      }),
    ).toBe(false);
  });

  it("STILL reports work that has no surface of its own", () => {
    // The negative control, and the reason this is scoped by kind rather than
    // switched off. A canvas draft failing while the user is elsewhere has
    // nowhere else to be told.
    for (const kind of ["canvas.cast", "canvas.recast", "canvas.variations", "casting.mint"]) {
      expect(
        bridgeShouldSpeak({
          kind,
          status: "failed",
          publicMessage: "The generation failed and the charged credits were refunded.",
        }),
        kind,
      ).toBe(true);
    }
  });

  it("treats an unknown kind as needing the fallback", () => {
    // Fail toward being told: a kind this build has never heard of has no
    // surface here by definition.
    expect(
      bridgeShouldSpeak({ kind: "something.new", status: "failed", publicMessage: "x" }),
    ).toBe(true);
  });

  it("keeps the existing suppressions intact", () => {
    expect(
      bridgeShouldSpeak({ kind: "canvas.cast", status: "failed", publicMessage: null }),
    ).toBe(false);
    expect(
      bridgeShouldSpeak({
        kind: "canvas.cast",
        status: "failed",
        publicMessage: "x",
        locallyNotifiedFailure: true,
      }),
    ).toBe(false);
    expect(
      bridgeShouldSpeak({ kind: "canvas.cast", status: "succeeded", publicMessage: "x" }),
    ).toBe(false);
  });
});

/**
 * THE TWO ARMS fable-825 §2b BOUNDED, driven rather than remembered.
 *
 * The measurement behind them: 1.7% of the founder's 199 production refines
 * answered past the observed ~305 s gateway wall, and 2.8% at or past 290 s —
 * where run-15 had already proved 293 s was too late. On those the panel shows
 * "We lost contact while that was rendering" and the server's own sentence,
 * carrying the actionable half, reaches nobody.
 */
describe("a refine's outcome is owned per REQUEST, not per kind", () => {
  const REFUSAL = "That one came back twice with glasses still in the picture, "
    + "so it wasn't delivered and your credits have been returned. "
    + "Try saying it a different way.";

  it("stays silent when the panel already showed the SERVER'S own sentence", () => {
    /*
      The founder's original complaint, kept as its own arm: an outcome he
      watched resolve on the surface is never said twice. This is the common
      case — 177 of the 180.
    */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.refine",
        status: "failed",
        publicMessage: REFUSAL,
        outcomeShown: "server",
      }),
    ).toBe(false);
  });

  it("SPEAKS when the panel fell back — the render outlived the gateway", () => {
    /*
      The whole point. The mutation died in transit, so the panel is showing
      LOST_CONTACT over a true answer that reached no one, and the row has
      already left the sheet's payload (`ready` and `queued|dispatched` are the
      only two lists). The bridge is the last thing holding the sentence.
    */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.refine",
        status: "failed",
        publicMessage: REFUSAL,
        outcomeShown: "fallback",
      }),
    ).toBe(true);
  });

  it("SPEAKS when nobody was watching at all", () => {
    /*
      A reload, or a panel closed on a slow edit. Absence is deliberately not
      spelled as either mark: today this case gets no word whatsoever, which is
      the larger silence, and it comes free with the same predicate.
    */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.refine",
        status: "failed",
        publicMessage: REFUSAL,
        outcomeShown: null,
      }),
    ).toBe(true);
  });

  it("still honours the legacy adapter's per-request answer first", () => {
    /* `locallyNotifiedFailure` is unchanged and still outranks the new fact:
       two producers of the same kind of truth, and the older one is not
       weakened by the newer arriving. */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.refine",
        status: "failed",
        publicMessage: REFUSAL,
        locallyNotifiedFailure: true,
        outcomeShown: "fallback",
      }),
    ).toBe(false);
  });

  it("never speaks for a refine that SUCCEEDED past the wall", () => {
    /*
      One of the three crossings delivered at 328 s. The panel showed
      LOST_CONTACT there too — and the copy already covers it ("if it landed it
      will appear here"), because the picture arrives in the rail. A toast would
      be announcing a failure that did not happen.
    */
    expect(
      bridgeShouldSpeak({
        kind: "castingV2.refine",
        status: "succeeded",
        publicMessage: null,
        outcomeShown: "fallback",
      }),
    ).toBe(false);
  });
});
