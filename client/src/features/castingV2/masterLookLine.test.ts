import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { masterLookLine } from "./masterLookLine";

const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);

describe("the line under the master picture names the cast, card 2124", () => {
  it("uses the cast's own name", () => {
    expect(masterLookLine("Pigman")).toBe("This is Pigman's master look. Every view starts from it.");
  });

  it("keeps 's for a name ending in s", () => {
    expect(masterLookLine("James")).toBe("This is James's master look. Every view starts from it.");
  });

  it("falls back to their when the name is empty", () => {
    for (const name of [null, undefined, "", "   "]) {
      expect(masterLookLine(name)).toBe("This is their master look. Every view starts from it.");
    }
  });

  it("does not promise shots, which are not built yet", () => {
    expect(masterLookLine("Pigman")).not.toMatch(/shot/i);
  });

  it("is what the room says once the views are done, and building is untouched", async () => {
    const source = await readFile(ROOM, "utf8");
    expect(source).toMatch(
      /\? `Building \$\{data\.pronouns\.possessive\} other views…`\s*: masterLookLine\(data\.name\)\}/,
    );
    expect(source).not.toContain('"The face you signed is locked across every view."');
  });
});
