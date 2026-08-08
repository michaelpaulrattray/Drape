import { describe, expect, it } from "vitest";

import { LOST_CONTACT, readableFailure, refineFailureMessage } from "./failureCopy";

/**
 * The specimen is production's, not invented: run-9's step 5 waited 304.9
 * seconds and put a JSON parser's complaint about a gateway's plain-text 502
 * into the panel where the product's refusal copy goes.
 */
describe("what the refine panel says when it does not come back", () => {
  it("never shows the parser's sentence — run-9's own string", () => {
    const raw = new Error(`Unexpected token 'u', "upstream error" is not valid JSON`);
    expect(refineFailureMessage(raw)).toBe(LOST_CONTACT);
  });

  it("does not promise the money is safe, because it cannot know", () => {
    /* A refine charges up front, so "nothing was charged" would be a guess.
       The recovery sweep's promise is the true thing to say. */
    expect(LOST_CONTACT).not.toMatch(/nothing was charged/i);
    expect(LOST_CONTACT).toMatch(/credits come back/i);
  });

  it("passes OUR refusals through verbatim — they were written for a reader", () => {
    const refusal = Object.assign(
      new Error("I can't find any glasses on this face — there's nothing to take off. Nothing was charged."),
      { data: { code: "BAD_REQUEST" } },
    );
    expect(refineFailureMessage(refusal)).toMatch(/nothing to take off/);
  });

  it("replaces a transport failure even when it arrives with a code we do not author", () => {
    const gateway = Object.assign(new Error("upstream error"), {
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(refineFailureMessage(gateway)).toBe(LOST_CONTACT);
  });

  it("replaces one of our codes carrying an EMPTY sentence rather than showing nothing", () => {
    const empty = Object.assign(new Error("   "), { data: { code: "BAD_REQUEST" } });
    expect(refineFailureMessage(empty)).toBe(LOST_CONTACT);
  });

  it("survives a thrown value that is not an Error at all", () => {
    expect(refineFailureMessage("upstream error")).toBe(LOST_CONTACT);
    expect(refineFailureMessage(null)).toBe(LOST_CONTACT);
  });

  /*
    THE SWEEP'S OTHER HALF. Keep, discard and signing all put `error.message`
    in a toast — the same defect, quieter. The rule is shared; the sentence
    stays with the caller, because "it may still be rendering" is false of a
    keep and misleading of a signing.
  */
  it("lets each caller say the true thing for ITS failure", () => {
    expect(readableFailure(new Error("upstream error"), "That didn't save."))
      .toBe("That didn't save.");
    const ours = Object.assign(
      new Error("That face has already been signed. Nothing was charged."),
      { data: { code: "PRECONDITION_FAILED" } },
    );
    expect(readableFailure(ours, "That didn't save.")).toMatch(/already been signed/);
  });
});
