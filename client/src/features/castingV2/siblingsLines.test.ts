import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { siblingsIntroLine, siblingsNoneLine } from "./siblingsLines";

describe("card 2141 — the Siblings card names the character", () => {
  it("names the cast in both lines", () => {
    expect(siblingsIntroLine("Pigman")).toBe(
      "Variants made alongside Pigman. Useful when a campaign needs a near-miss rather than a new face.",
    );
    expect(siblingsNoneLine("Pigman")).toBe("Nothing else was kept from when Pigman was created.");
  });

  it("trims the name, and an empty or missing name reads them / they were", () => {
    expect(siblingsIntroLine("  Yuna ")).toBe(
      "Variants made alongside Yuna. Useful when a campaign needs a near-miss rather than a new face.",
    );
    for (const empty of [null, undefined, "", "   "]) {
      expect(siblingsIntroLine(empty)).toBe(
        "Variants made alongside them. Useful when a campaign needs a near-miss rather than a new face.",
      );
      expect(siblingsNoneLine(empty)).toBe("Nothing else was kept from when they were created.");
    }
  });

  it("the room renders both lines through these functions, and the old wording is gone", () => {
    const room = readFileSync("client/src/pages/CastingRoom.tsx", "utf8").replace(/\s+/g, " ");
    expect(room).toContain("{siblingsIntroLine(data.name)}");
    expect(room).toContain("{siblingsNoneLine(data.name)}");
    expect(room).not.toContain("Variants from the same casting");
    expect(room).not.toContain("Nothing else was kept from {data.pronouns.possessive} casting");
  });
});
