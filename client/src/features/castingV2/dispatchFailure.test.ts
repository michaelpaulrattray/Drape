import { describe, expect, it } from "vitest";

import { classifyDispatchFailure, failureActionLabel } from "./dispatchFailure";

/**
 * A transport failure is not a refusal, and must not be reported as one.
 *
 * The founder followed a candidate, saw "The roll didn't start — nothing was
 * charged", and roll 02 generated anyway, eight tiles casting under the banner.
 * Nothing malfunctioned server-side: `createRoll` does not return until all
 * eight land (~70s) and rows commit BEFORE dispatch, so a gateway giving up on
 * that request leaves the server working while the client's mutation rejects.
 *
 * Two claims were wrong in one banner. That the roll had not started — it had.
 * And that nothing was charged — we never heard back, so we cannot know.
 */

const trpcError = (code: string, message = "boom") => ({ message, data: { code } });

describe("only say what we actually know", () => {
  it("never claims money is safe when we never heard back", () => {
    const failure = classifyDispatchFailure(new Error("upstream error"));
    expect(failure.kind).toBe("unavailable");
    expect(failure.message).not.toMatch(/nothing was charged/i);
    expect(failure.message).not.toMatch(/didn't start|did not start/i);
  });

  it("says a roll may still be coming, because it may be", () => {
    expect(classifyDispatchFailure(new Error("network")).message).toMatch(/appear here/i);
  });

  it("never leaks a parser or proxy message to the reader", () => {
    const failure = classifyDispatchFailure(
      new Error(`Unexpected token 'u', "upstream error" is not valid JSON`),
    );
    expect(failure.message).not.toMatch(/unexpected token|json/i);
  });

  it("still passes through the server's own sentence when the server refused", () => {
    // These the server told us about before claiming anything, so they can be
    // definite — and their copy was written for a reader.
    const refused = classifyDispatchFailure(trpcError("BAD_REQUEST", "That brief can't be cast."));
    expect(refused.kind).toBe("refused");
    expect(refused.message).toBe("That brief can't be cast.");
  });

  it("classifies the account and rate-limit cases apart from transport", () => {
    expect(classifyDispatchFailure(trpcError("TOO_MANY_REQUESTS")).kind).toBe("busy");
    expect(classifyDispatchFailure(trpcError("PRECONDITION_FAILED")).kind).toBe("credits");
    expect(classifyDispatchFailure(trpcError("FORBIDDEN")).kind).toBe("credits");
  });
});

/*
  #2387 — a customer short of credits is not told their brief is the problem.
  The sentences here are the server's own (`server/lib/chargeRefusal.ts` and
  the roll's price sentence); `server/castingV2/rollService.test.ts` drives the
  real refusal through this classifier from the other end.
*/
describe("a short balance is an account problem, never a brief one", () => {
  it("the not-enough-credits refusal keeps its sentence and its price, and offers no brief edit", () => {
    const sentence = "Not enough credits. A roll costs 160 credits.";
    const failure = classifyDispatchFailure(trpcError("PRECONDITION_FAILED", sentence));
    expect(failure).toEqual({ kind: "credits", message: sentence });
    expect(failureActionLabel(failure.kind)).not.toBe("Edit the brief");
  });

  it("negative control: the shape that shipped WAS read as the brief's refusal", () => {
    const failure = classifyDispatchFailure(trpcError("BAD_REQUEST", "Insufficient credits"));
    expect(failure.kind).toBe("refused");
    expect(failureActionLabel(failure.kind)).toBe("Edit the brief");
  });
});
