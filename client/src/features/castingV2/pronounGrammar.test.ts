import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The product refers to a Cast the way her own record does.
 *
 * Founder finding, on his own roster: the room called Jericho "she" — the
 * Siblings card told him to open the sheet *she* came from. A small thing that
 * reads as the product not having looked at the person it is describing.
 *
 * The fix derives pronouns server-side (`castPronouns`) and projects three
 * words. What this file guards is the RE-INTRODUCTION: the next sentence
 * somebody writes about "her", on a surface that serves every Cast.
 */

const SURFACES = [
  ["CastingRoom.tsx", new URL("../../pages/CastingRoom.tsx", import.meta.url)],
  ["CastingSheet.tsx", new URL("../../pages/CastingSheet.tsx", import.meta.url)],
  ["CandidateTile.tsx", new URL("./components/CandidateTile.tsx", import.meta.url)],
  ["KeptTray.tsx", new URL("./components/KeptTray.tsx", import.meta.url)],
  ["SignConfirm.tsx", new URL("./components/SignConfirm.tsx", import.meta.url)],
] as const;

/**
 * Comments are stripped before the scan.
 *
 * The prose explaining this rule necessarily contains the words it forbids, and
 * a lint that cannot survive its own documentation is one the next person
 * deletes rather than obeys.
 */
function rendered(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const GENDERED = /\b(she|her|hers|his|him)\b/i;

describe("no casting surface hardcodes a pronoun", () => {
  it("leaves none in a rendered string", async () => {
    const offenders: string[] = [];
    for (const [name, url] of SURFACES) {
      const source = rendered(await readFile(url, "utf8"));
      for (const line of source.split("\n")) {
        if (GENDERED.test(line)) offenders.push(`${name}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(
      offenders,
      "A Cast is referred to by pronouns derived from her own record "
      + "(castPronouns), or by name. Hardcoding one is how Jericho got called "
      + "the wrong thing on his own page.\n  " + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("derives them from the projection, not from a guess in the client", async () => {
    const room = await readFile(SURFACES[0][1], "utf8");
    // The room reads the server's three words rather than inferring anything.
    expect(room).toContain("data.pronouns.subject");
    expect(room).toContain("data.pronouns.possessive");
    // And agreement travels with them, so no call site has to remember it.
    expect(room).toContain("data.pronouns.plural");
  });
});
