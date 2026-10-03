import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  DELIBERATELY_ABSENT,
  POINTER_POPULATION,
  SUITE_POPULATION,
  suitePointers,
} from "./testing/suitePointers";

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
    /* Measured at 359 on the day this landed, and 1,976 after #1821 widened the
       population to `.mts` and `.md`. The floor is deliberately far below both:
       this arm exists to catch a reader that has stopped reading, not to pin a
       number that moves every week. */
    expect(suitePointers(ROOT).length).toBeGreaterThan(100);
  });

  /* ── THE WIDENING HAS ITS OWN ARMS (#1821) ───────────────────────────────
     A floor of 100 is satisfied by the `.ts`/`.tsx` half alone, so nothing above
     would notice `.mts` or `.md` quietly leaving the glob again — and a
     population that can shrink back to the one its own header used to declare
     out of scope is the memory `directory-population-loses-promoted-subject` is
     about: widening a derived population without widening its test leaves a
     folder-shaped arm green. These name the families, so a narrowing says WHICH
     one went rather than passing. */

  it("reads every file family it claims, and names the one that went", () => {
    const seen = new Set(
      suitePointers(ROOT).map((row) =>
        row.file.endsWith(".md") ? ".md" : row.file.endsWith(".mts") ? ".mts" : ".ts/.tsx",
      ),
    );
    expect([...seen].sort()).toEqual([".md", ".mts", ".ts/.tsx"]);
  });

  it("does not let the resolution target inherit the widening", () => {
    /* The two lists are the whole reason a `.md` cannot become a thing a pointer
       resolves TO. If a later edit collapses them into one read, this is what
       says so — and it is pinned at the VALUES, because the names agreeing is
       not the claim. */
    expect([...SUITE_POPULATION]).toEqual(["*.ts", "*.tsx"]);
    expect([...POINTER_POPULATION]).toEqual(["*.ts", "*.tsx", "*.mts", "*.md"]);
    expect(POINTER_POPULATION.length).toBeGreaterThan(SUITE_POPULATION.length);
  });

  it("POSITIVE CONTROL for the widening — a dangling pointer in a .md and in an .mts is SEEN", () => {
    /* Both halves of the new population drive a real, non-resolving pointer, so
       a reader that silently stopped opening one of the two file types fails
       here by name rather than by a count. `CLAUDE.md`'s own law-7 section
       names the deleted credit-velocity suite; `capabilityAtlas.mts` names the
       segment-store route suite #1160 removed. */
    const rows = suitePointers(ROOT);

    const inMarkdown = rows.filter((row) => row.file === "CLAUDE.md");
    expect(inMarkdown.length).toBeGreaterThan(0);
    expect(inMarkdown.some((row) => row.names === "velocityLimits.test.ts" && !row.resolves)).toBe(true);

    const inScript = rows.filter((row) => row.file === "scripts/lib/capabilityAtlas.mts");
    expect(inScript.length).toBeGreaterThan(0);
    expect(inScript.some((row) => !row.resolves)).toBe(true);

    /* And the other direction in the same breath: a pointer in a `.md` that
       names a LIVE suite resolves, so a reader answering "no" to everything in
       the new half cannot pass the lines above. */
    expect(rows.some((row) => row.file.endsWith(".md") && row.resolves)).toBe(true);
    expect(rows.some((row) => row.file.endsWith(".mts") && row.resolves)).toBe(true);
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
  it("POSITIVE CONTROL — the reader DOES report a pointer that resolves to nothing", () => {
    /* ⚠ RETITLED AND REWRITTEN, PR #651's review finding 3. The first version
       was called a positive control and drove nothing: it asserted that an
       invented name was ABSENT from the readings and the allowlist, which is
       true of any string nobody typed. An arm whose title claims a drive its
       body does not perform is the import-is-not-a-call-site shape, and the
       sibling suite had already fixed exactly that in itself.

       This drives the capability the guard depends on — that a real,
       non-resolving pointer is SEEN and reported as unresolved — against live
       bytes. Both halves in one breath, so a reader that stopped reading, and a
       reader that resolved everything, each fail here. */
    const seen = suitePointers(ROOT).filter((row) => row.names === "velocityLimits.test.ts");
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((row) => !row.resolves)).toBe(true);

    /* And the other direction: a pointer at a suite that DOES exist resolves.
       Without this, a reader answering "no" to everything passes the line
       above. */
    const real = suitePointers(ROOT).filter((row) => row.names === "prosePointerDiscipline.test.ts");
    expect(real.length).toBeGreaterThan(0);
    expect(real.every((row) => row.resolves)).toBe(true);

    /* The fixture name itself is neither read nor allowlisted — kept because a
       future allowlist typo is a real way this guard goes quiet. */
    const invented = "aSuiteThatHasNeverExisted.test.ts";
    expect(suitePointers(ROOT).some((row) => row.names === invented)).toBe(false);
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
