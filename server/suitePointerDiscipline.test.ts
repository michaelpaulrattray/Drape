import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { DELIBERATELY_ABSENT, suitePointers } from "./testing/suitePointers";

/**
 * A DOCBLOCK THAT NAMES ITS OWN GUARD MUST NAME ONE THAT EXISTS (#647).
 *
 * The harm this closes is not untidiness. A reader who follows a docblock's
 * pointer, finds nothing, and concludes the guard was never written has
 * re-filed a LIVE control as a dead one — the wrong-road class `CLAUDE.md`'s
 * law-7 section is about, which has cost this repository months twice.
 *
 * ⚠ No example filename is backticked anywhere in this file, and that is the
 * rule rather than a stylistic choice: a backticked name in prose IS a pointer
 * to this reader, and it caught this suite's own first draft.
 *
 * The reasoning for a basename rather than a line-number resolver, and the
 * stated scope, are in `testing/suitePointers.ts`.
 */

/* This suite runs `git ls-files` over the tree, so it is in #548's population
   and declares the class's timeout. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = resolve(import.meta.dirname, "..");

/** Pointers that name nothing and are not enumerated. See suitePointers.ts on
    why this join lives here and not beside the data. */
const danglingPointers = (root: string) =>
  suitePointers(root).filter((row) => !row.resolves && !(row.names in DELIBERATELY_ABSENT));

describe("every backticked suite pointer resolves (#647)", () => {
  it("sweeps a real population — a clean answer over no pointers is not an answer", () => {
    /* Measured at 359 on the day this landed. The floor is deliberately far
       below it: this arm exists to catch a reader that has stopped reading,
       not to pin a number that moves every week. */
    expect(suitePointers(ROOT).length).toBeGreaterThan(100);
  });

  it("names nothing that does not exist", () => {
    const dangling = danglingPointers(ROOT).map((row) => `${row.file}:${row.line} -> ${row.names}`);
    expect(
      dangling,
      "Each of these names a test file that is not tracked. Either repoint it at the " +
        "suite that really drives the claim, or — if the absence is the POINT, as it is " +
        "for a control that was deleted — add the basename to DELIBERATELY_ABSENT in " +
        "server/testing/suitePointers.ts with the reason a later reader will need.",
    ).toEqual([]);
  });
});

describe("the reading can be wrong in both directions (#647)", () => {
  it("POSITIVE CONTROL — a fabricated pointer IS caught", () => {
    /* The sweep that produced this card had no positive control and would have
       reported all twelve of its raw hits. */
    const rows = suitePointers(ROOT);
    const invented = "aSuiteThatHasNeverExisted.test.ts";
    expect(rows.some((row) => row.names === invented)).toBe(false);
    expect(invented in DELIBERATELY_ABSENT).toBe(false);
  });

  it("NEGATIVE CONTROL — a module documenting this defect about ITSELF is not indicted", () => {
    /* `client/src/features/settings/planLadder.ts:41` reads "`planLadder.test.ts`
       for a file that has never existed". A guard that reddens on the sentence
       describing its own subject is a guard that teaches people to delete the
       history. */
    const dangling = danglingPointers(ROOT);
    expect(dangling.map((row) => row.file)).not.toContain("client/src/features/settings/planLadder.ts");

    /* And the absence-only half is not left to stand alone: the pointer IS
       still read, it is simply excused, so a reader that stopped seeing it
       would fail here rather than passing quietly. */
    const seen = suitePointers(ROOT).filter((row) => row.names === "planLadder.test.ts");
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((row) => !row.resolves)).toBe(true);
  });

  it("every enumerated absence is still absent, and still mentioned", () => {
    /* ⚠ AN ALLOWLIST THAT OUTLIVES ITS POPULATION IS THE DRIFT THIS GUARD IS
       ABOUT, POINTED AT THE GUARD. Two ways an entry rots: the suite comes back
       into existence (the excuse is now wrong), or nothing mentions it any more
       (the entry is dead weight nobody can audit). Both redden here. */
    const rows = suitePointers(ROOT);
    const stale: string[] = [];
    for (const name of Object.keys(DELIBERATELY_ABSENT)) {
      const mentions = rows.filter((row) => row.names === name);
      if (mentions.length === 0) stale.push(`${name} — enumerated, but nothing mentions it`);
      else if (mentions.some((row) => row.resolves)) stale.push(`${name} — it exists now; delete the entry`);
    }
    expect(stale).toEqual([]);
  });

  it("every enumerated absence carries a REASON, not just a name", () => {
    const reasonless = Object.entries(DELIBERATELY_ABSENT)
      .filter(([, entry]) => entry.why.trim().length < 40)
      .map(([name]) => name);
    expect(reasonless).toEqual([]);
  });
});
