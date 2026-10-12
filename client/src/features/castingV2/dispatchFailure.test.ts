import { describe, expect, it } from "vitest";

import { classifyDispatchFailure, failureIsStale } from "./dispatchFailure";

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

  // Card 2386: an outage arrived as BAD_REQUEST and read as the brief's fault.
  it("reads a reader outage as the studio's, never as the brief's", () => {
    const outage = classifyDispatchFailure(
      trpcError("SERVICE_UNAVAILABLE", "The studio couldn't read your brief just now. Try again in a moment."),
    );
    expect(outage.kind).toBe("busy");
    expect(outage.message).toBe("The studio couldn't read your brief just now. Try again in a moment.");
    expect(classifyDispatchFailure(trpcError("SERVICE_UNAVAILABLE", "")).message).toMatch(/try again/i);
    // Negative control: a refusal about the words is still the brief's.
    expect(classifyDispatchFailure(trpcError("BAD_REQUEST", "Describe who you want.")).kind).toBe("refused");
  });

  it("classifies the account and rate-limit cases apart from transport", () => {
    expect(classifyDispatchFailure(trpcError("TOO_MANY_REQUESTS")).kind).toBe("busy");
    expect(classifyDispatchFailure(trpcError("PRECONDITION_FAILED")).kind).toBe("credits");
    expect(classifyDispatchFailure(trpcError("FORBIDDEN")).kind).toBe("credits");
  });
});

/**
 * #2387's SHEET HALF: a short balance's notice must outlive the unpaid roll it
 * leaves behind, while every other failure still dismisses itself the moment a
 * newer roll renders. Both directions are pinned — a predicate that never goes
 * stale passes the credits arm and resurrects the "lost contact" banner over a
 * roll that arrived; one that always goes stale is the defect.
 */
describe("which failures a newer roll dismisses", () => {
  const failure = (kind: "refused" | "credits" | "busy" | "unavailable", afterRollId: string | null) => ({
    kind,
    message: "x",
    afterRollId,
  });

  it("a newer roll dismisses a transport failure, a busy and a refusal (the original rule)", () => {
    expect(failureIsStale(failure("unavailable", null), "roll-1")).toBe(true);
    expect(failureIsStale(failure("busy", "roll-1"), "roll-2")).toBe(true);
    expect(failureIsStale(failure("refused", "roll-1"), "roll-2")).toBe(true);
  });

  it("the roll it fired on top of does not dismiss it, and no roll at all does not either", () => {
    expect(failureIsStale(failure("unavailable", "roll-1"), "roll-1")).toBe(false);
    expect(failureIsStale(failure("unavailable", null), null)).toBe(false);
  });

  it("a short balance stands over the unpaid roll its own failed charge wrote", () => {
    /* From the casting page (no roll before) and from the sheet (an older roll before). */
    expect(failureIsStale(failure("credits", null), "unpaid-roll")).toBe(false);
    expect(failureIsStale(failure("credits", "roll-1"), "unpaid-roll")).toBe(false);
  });

  it("no failure is never stale", () => {
    expect(failureIsStale(null, "roll-1")).toBe(false);
  });
});
