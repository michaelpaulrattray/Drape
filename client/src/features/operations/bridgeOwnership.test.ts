import { describe, expect, it } from "vitest";

/**
 * Who gets to tell the user what happened.
 *
 * `GenerationOperationBridge` polls every generation operation and toasts a
 * failed one's `publicMessage` from wherever the user happens to be. That is
 * right for work nobody is watching — a canvas draft landing on a board the
 * user has navigated away from.
 *
 * It is wrong for a casting sheet, which polls itself and already reports
 * every outcome in place. The founder hit the worst version: cancelling a roll
 * makes `createRoll` reject a minute or two later, so "That roll was
 * cancelled. 160 credits were refunded." appeared bottom-right while they were
 * doing something else — describing a thing they chose on purpose and had
 * already watched resolve, live, on the sheet.
 *
 * D-40: feedback renders where the action happened.
 */

/** Exactly the predicate the bridge applies, kept somewhere it can be tested. */
function shouldToastFailure(operation: {
  kind: string;
  status: string;
  publicMessage: string | null;
  locallyNotified?: boolean;
}): boolean {
  const ownsItsOwnSurface = operation.kind === "castingV2.roll";
  return (
    operation.status === "failed"
    && Boolean(operation.publicMessage)
    && !operation.locallyNotified
    && !ownsItsOwnSurface
  );
}

describe("the bridge does not double-report casting V2", () => {
  it("stays silent on the cancelled roll the founder saw", () => {
    expect(
      shouldToastFailure({
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
      shouldToastFailure({
        kind: "castingV2.roll",
        status: "failed",
        publicMessage: "None of the sheet arrived. 160 credits were refunded.",
      }),
    ).toBe(false);
  });

  it("STILL reports work that has no surface of its own", () => {
    // The negative control, and the reason this is scoped by kind rather than
    // switched off. A canvas draft failing while the user is elsewhere has
    // nowhere else to be told.
    expect(
      shouldToastFailure({
        kind: "canvas.cast",
        status: "failed",
        publicMessage: "The generation failed and the charged credits were refunded.",
      }),
    ).toBe(true);
  });

  it("keeps the existing suppressions intact", () => {
    expect(
      shouldToastFailure({ kind: "canvas.cast", status: "failed", publicMessage: null }),
    ).toBe(false);
    expect(
      shouldToastFailure({
        kind: "canvas.cast",
        status: "failed",
        publicMessage: "x",
        locallyNotified: true,
      }),
    ).toBe(false);
    expect(
      shouldToastFailure({ kind: "canvas.cast", status: "succeeded", publicMessage: "x" }),
    ).toBe(false);
  });
});
