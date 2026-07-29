import { describe, expect, it } from "vitest";
import { looksLikeTattooInstruction } from "../shared/inkInstructionRoute";

describe("natural-language tattoo routing hint", () => {
  it.each([
    "Add a black dragon tattoo to his right full arm",
    "Give her a fine-line forearm tattoo",
    "Add a Japanese full sleeve on the left arm",
    "ink a small swallow on the upper back",
  ])("routes tattoo language through the evidence planner: %s", (value) => {
    expect(looksLikeTattooInstruction(value)).toBe(true);
  });

  it.each([
    "make the hair pink",
    "brighten the lighting",
    "give him a long sleeve shirt",
    "make the expression warmer",
  ])("leaves ordinary refinements on their existing route: %s", (value) => {
    expect(looksLikeTattooInstruction(value)).toBe(false);
  });
});
