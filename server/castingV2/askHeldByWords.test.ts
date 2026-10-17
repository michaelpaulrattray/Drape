import { describe, expect, it } from "vitest";
import { chainAsksBySlot, wordsHoldAsks } from "./askHeldByWords";

describe("the fixed word test behind #2650", () => {
  it("holds an ask when every claim-bearing word appears, endings forgiven", () => {
    expect(wordsHoldAsks(["Short textured pixie cut, closely cropped at the sides"], ["short crop"], "hair")).toBe(true);
    expect(wordsHoldAsks(["freckles scattered over the nose and both cheeks"], ["freckles across the nose and cheeks"], "skin")).toBe(true);
  });

  it("does not hold an ask the words argue with, or say nothing about", () => {
    expect(wordsHoldAsks(["Dark brown hair pulled into a high top bun"], ["short crop"], "hair")).toBe(false);
    expect(wordsHoldAsks([], ["short crop"], "hair")).toBe(false);
  });

  it("reads the chain's asks per whole slot, and leaves per-side slots and picture-taken asks alone", () => {
    const asks = chainAsksBySlot({ free: { hairCut: "short crop" }, eyeColour: "green" } as never);
    expect(asks.get("hair")).toEqual(["short crop"]);
    /* Ruling C: the library, not the delta, remembers which eye is green. */
    expect(Array.from(asks.keys()).some((slot) => slot.includes("@"))).toBe(false);
    const pictured = chainAsksBySlot({
      free: { hairCut: "the hair in the attached picture" }, fromPicture: ["hairCut"],
    } as never);
    expect(pictured.has("hair")).toBe(false);
  });
});
