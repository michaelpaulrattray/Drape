/**
 * THE CLIENT HALF OF "AN EXPIRED SHEET IS GONE" (#890).
 *
 * The server's arms (`server/castingV2SheetGone.test.ts`) prove the door shuts
 * before anything is read. These prove the two things that happen afterwards
 * and that nothing on the server can check:
 *
 *   - **the redirect fires on THIS door and nothing else.** `NOT_FOUND` is
 *     shared with the ownership refusal on purpose, so the discriminator is the
 *     `spoken` marker — and an arm for every other shape `getSession` can fail
 *     with, because the cost of getting this wrong is a customer thrown off a
 *     live sheet by a rate limit.
 *   - **the sentence survives the trip.** It rides history state, and history
 *     state is untyped and arrives as whatever a browser, an extension or last
 *     week's bundle left there.
 */
import { describe, expect, it } from "vitest";

import { readSheetGone, sheetGoneRefusal, sheetGoneState } from "./sheetGone";

/** A tRPC failure as the client receives it — JSON, no class left. */
function wireError(input: { code: string; message: string; spoken?: boolean }) {
  return {
    message: input.message,
    data: { code: input.code, ...(input.spoken ? { spoken: true } : {}) },
  };
}

const GONE = wireError({
  code: "NOT_FOUND",
  message: "That sheet expired and was cleared. Start a new one.",
  spoken: true,
});

describe("which refusal means the sheet is gone", () => {
  it("the door itself: the server's sentence comes back to be shown", () => {
    expect(sheetGoneRefusal(GONE)).toBe("That sheet expired and was cleared. Start a new one.");
  });

  it("an abandoned sheet takes the same road with its own sentence", () => {
    const sentence = "That sheet was closed and cleared. Start a new one.";
    expect(sheetGoneRefusal(wireError({ code: "NOT_FOUND", message: sentence, spoken: true }))).toBe(sentence);
  });

  /*
    THE FOUR THAT MUST NOT REDIRECT. Each is a real thing `getSession` answers,
    and each would, if it moved a customer to the casting page, take them off a
    sheet that is perfectly alive.
  */
  it("an unknown or foreign id does not: NOT_FOUND, but nobody wrote that sentence for a person", () => {
    expect(sheetGoneRefusal(wireError({ code: "NOT_FOUND", message: "Session not found" }))).toBeNull();
  });

  it("a rate limit does not", () => {
    expect(sheetGoneRefusal(wireError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." }))).toBeNull();
  });

  it("the casting flag being off does not", () => {
    expect(sheetGoneRefusal(
      wireError({ code: "PRECONDITION_FAILED", message: "Casting is not available for this account yet." }),
    )).toBeNull();
  });

  it("a future authored refusal on another code does not — it is meant to be shown in place", () => {
    expect(sheetGoneRefusal(
      wireError({ code: "BAD_REQUEST", message: "Something we wrote, but not this door.", spoken: true }),
    )).toBeNull();
  });

  it("no error at all does not — a loading sheet must never redirect", () => {
    expect(sheetGoneRefusal(null)).toBeNull();
    expect(sheetGoneRefusal(undefined)).toBeNull();
  });

  it("a marked refusal with an empty sentence does not — there would be nothing to say", () => {
    expect(sheetGoneRefusal(wireError({ code: "NOT_FOUND", message: "   ", spoken: true }))).toBeNull();
  });
});

describe("the sentence travels in history state, not in the address", () => {
  it("round-trips", () => {
    expect(readSheetGone(sheetGoneState("That sheet expired and was cleared. Start a new one.")))
      .toBe("That sheet expired and was cleared. Start a new one.");
  });

  it("a plain visit carries nothing, and the page is what it always was", () => {
    expect(readSheetGone(null)).toBe("");
    expect(readSheetGone(undefined)).toBe("");
  });

  it("anything that is not our shape reads as nothing rather than as a sentence", () => {
    expect(readSheetGone({ sheetGone: 42 })).toBe("");
    expect(readSheetGone({ brief: "the retired dock's own field" })).toBe("");
    expect(readSheetGone("a string somebody else left here")).toBe("");
  });
});
