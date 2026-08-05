/**
 * A REMOVAL HAS TO SAY SO (D-189) — proved without the model, because the model
 * is the thing being second-guessed.
 *
 * The trial's sentence is the first case: "small gold hoop earrings" is
 * somebody naming a thing they want, and it was answered with "there's nothing
 * to take off".
 */
import { describe, expect, it } from "vitest";

import { namesRemoval } from "./removalWords";

describe("subtraction is stated", () => {
  it("does not see a removal in a bare noun phrase", () => {
    /* THE TRIAL'S SENTENCE. */
    expect(namesRemoval("small gold hoop earrings")).toBe(false);
    expect(namesRemoval("a warm open smile")).toBe(false);
    expect(namesRemoval("copper hair")).toBe(false);
    expect(namesRemoval("seafoam green eyes")).toBe(false);
    expect(namesRemoval("a small scar on her cheek")).toBe(false);
  });

  /*
    EVERY REMOVAL PHRASING THIS PROGRAM HAS ACTUALLY SEEN — from the drivers,
    the corpora and the founder's own walks. A backstop that reclassified one of
    these would break typed removal, which is the failure worth guarding
    against far more than the one it fixes.
  */
  it("sees a removal in every phrasing the product has met", () => {
    for (const phrase of [
      "remove the earrings",
      "remove earrings",
      "take the hoops off",
      "get rid of the glasses",
      "lose the glasses",
      "no earrings",
      "no more freckles",
      "undo",
      "undo the fringe",
      "go back",
      "revert",
      "nevermind",
      "without the necklace",
      "take those off",
      "drop the lipstick",
      "erase the tattoo",
    ]) {
      expect(namesRemoval(phrase), `"${phrase}" must read as a removal`).toBe(true);
    }
  });

  it("is case and punctuation blind", () => {
    expect(namesRemoval("REMOVE THE EARRINGS!")).toBe(true);
    expect(namesRemoval("Take them off, please.")).toBe(true);
  });
});
