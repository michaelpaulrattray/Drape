import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../../../../server/testing/withoutComments";

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
  /*
    ⚠ **THE SERVER COMPOSES CUSTOMER SENTENCES TOO, AND THIS LIST DID NOT
    LOOK AT IT UNTIL PR #1924’s REVIEW.** Nine sentences about a Cast’s views
    hard-coded *her* and *she*, and they reach a paying customer verbatim — a
    refusal, two receipts and a refund description. A client-only guard cannot
    see them, so the surfaces that SPEAK about a Cast are listed here whichever
    side of the wire they live on.
  */
  ["packageRedoService.ts", new URL("../../../../server/castingV2/packageRedoService.ts", import.meta.url)],
  ["viewRetryRecovery.ts", new URL("../../../../server/castingV2/viewRetryRecovery.ts", import.meta.url)],
] as const;

/**
 * ⚠ **THIS LIST IS HAND-KEPT, AND THE REVIEW THAT ADDED THE SERVER HALF ALSO
 * SHOWED WHY THAT IS A FLOOR** (working law 4). The finding named FOUR
 * offending sentences in `packageRedoService.ts`; there were FIVE — a second
 * `Asking for all her views again` in the operation-time refusal that a
 * hand-read missed. A derived population is the real answer and is its own
 * card; until then a surface that speaks about a Cast and is not on this list
 * is unguarded, and that sentence is the honest state rather than a promise.
 */

/**
 * Comments are stripped before the scan.
 *
 * The prose explaining this rule necessarily contains the words it forbids, and
 * a lint that cannot survive its own documentation is one the next person
 * deletes rather than obeys.
 */
function rendered(source: string): string {
  return withoutComments(source);
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
