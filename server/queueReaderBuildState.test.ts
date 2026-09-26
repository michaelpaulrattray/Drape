import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";

import {
  BUILD_BOARD_MODULE,
  QUEUE_READER_EXEMPTIONS,
  consultsBuildBoard,
  judgeQueueReaders,
  listsIssues,
} from "../scripts/lib/queueReaderPopulation.mts";

/* This suite walks the source tree, so it declares the contended timeout rather
   than racing vitest's 5 s default under a parallel run (#216 / PR #1250). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * NO SIXTH QUEUE READER MAY OFFER A CARD SOMEBODY IS ALREADY BUILDING (#1094,
 * piece 3).
 *
 * # What this is the guard for
 *
 * His order, 2026-09-26 (terminal), verbatim: ***"work on 1094 and 1307 next so
 * the desk shows whats built"*** — said after Background Work offered him #1231,
 * #1217, #1258, #1248 and #1288 as tonight's work while every one of them had a
 * pull request in the merge queue or a refusal written on the card.
 *
 * #1094's own sweep found the class in five readers by NAMING five files, and
 * said so in its body: *"A floor, not a proof — the reader is a grep for `\"pr\"`
 * over five named files, not a derived population."* Four of the five had the
 * defect. **The sixth one, written tomorrow, is what this arm is for.**
 *
 * # ⚠ IT IS DRIVEN IN BOTH DIRECTIONS, AND THE NEGATIVE ONE CANNOT COME FROM THE
 * TREE
 *
 * A walk of a repository where every reader consults the board produces a green
 * verdict whether the judgement works or not — the shape CLAUDE.md's working law
 * 2 is about, and the one this repository has been bitten by often enough to have
 * a memory file for it. So the judgement is a PURE function over `{ path → source
 * }` and the arms plant sources: a reader that lists issues and consults nothing
 * (RED), one that consults (green), one that is exempt for a written reason
 * (green), and an exemption for a file that no longer lists issues (RED, because
 * a stale exemption is a sentence that will later be believed about the wrong
 * thing). Only then is the real tree read through the same function.
 */

const REPO = resolve(__dirname, "..");
const SCRIPTS = join(REPO, "scripts");

/** Every `.ts`/`.mts` under `scripts/`, read through `readListedSource` (#223). */
function scriptSources(): Map<string, string> {
  const sources = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      /* `statSync` with `throwIfNoEntry: false` for the same race the reader
         handles: this tree carries hundreds of untracked disposables and one can
         leave between the listing and the stat. */
      if (entry.isDirectory()) {
        if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) walk(full);
        continue;
      }
      if (!/\.m?ts$/.test(entry.name)) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      sources.set(relative(REPO, full).replace(/\\/g, "/"), source);
    }
  };
  walk(SCRIPTS);
  return sources;
}

describe("the population is DERIVED, and the judgement can fail", () => {
  it("⚠ a reader that lists issues and consults nothing is RED — the negative control", () => {
    const planted = new Map([[
      "scripts/the-sixth-reader.mts",
      'const rows = gh(["issue", "list", "--state", "open", "--json", "number,labels"]);\n'
      + "console.log(`NEXT UP: ${rows.length}`);\n",
    ]]);
    const verdict = judgeQueueReaders(planted, []);
    expect(verdict.population).toEqual(["scripts/the-sixth-reader.mts"]);
    expect(verdict.verdicts).toEqual([
      { path: "scripts/the-sixth-reader.mts", ok: false, why: "lists issues and consults nothing" },
    ]);
  });

  it("consulting the one reader clears it, and so does a written exemption", () => {
    const consulting = new Map([[
      "scripts/the-sixth-reader.mts",
      'import { buildBoard } from "./lib/cardBuildState.mts";\n'
      + 'const rows = gh(["issue", "list", "--state", "open"]);\n',
    ]]);
    expect(judgeQueueReaders(consulting, [])[ "verdicts" ])
      .toEqual([{ path: "scripts/the-sixth-reader.mts", ok: true, why: "consults" }]);

    const exempted = new Map([[
      "scripts/labels-only.mts",
      'const rows = gh(["issue", "list", "--state", "open"]);\n',
    ]]);
    expect(judgeQueueReaders(exempted, [{ path: "scripts/labels-only.mts", because: "it files labels" }]).verdicts)
      .toEqual([{ path: "scripts/labels-only.mts", ok: true, why: "exempt" }]);
  });

  it("⚠ an exemption for a file that no longer lists issues is STALE, and named", () => {
    const sources = new Map([["scripts/quiet.mts", "export const x = 1;\n"]]);
    const verdict = judgeQueueReaders(sources, [{ path: "scripts/quiet.mts", because: "it used to list" }]);
    expect(verdict.population).toEqual([]);
    expect(verdict.staleExemptions).toEqual(["scripts/quiet.mts"]);
  });

  it("⚠ PROSE IS NOT A READING — a docblock naming `gh issue list` is not in the population", () => {
    /* The matcher is the ARRAY form on purpose: `scripts/lib/nextUpItems.mts`
       discusses `gh issue list` at length and takes its rows as an argument. A
       comment-stripping matcher would be its own source of silence. */
    expect(listsIssues("/** Read it WIDE: `gh issue list --state open --limit 200`. */\n")).toBe(false);
    expect(listsIssues('gh(["issue", "list"]);')).toBe(true);
    expect(listsIssues('gh([\n  "issue",\n  "list",\n]);')).toBe(true);
  });

  it("the consultation test reads an import of the one module, or its board type", () => {
    expect(consultsBuildBoard(`import { buildBoard } from "../lib/${BUILD_BOARD_MODULE}";`)).toBe(true);
    expect(consultsBuildBoard("function f(board: CardBuildBoard) { return board; }")).toBe(true);
    expect(consultsBuildBoard('import { findCardPullRequests } from "../../shared/crewShiftState.js";'))
      .toBe(false);
  });
});

describe("the real tree", () => {
  it("⚠ EVERY script that lists issues consults the one reader, or says why it does not", () => {
    const sources = scriptSources();
    /* A walk that read nothing would pass every assertion below — the positive
       control on the reader itself (working law 2). */
    expect(sources.size).toBeGreaterThan(50);
    const { population, verdicts, staleExemptions } = judgeQueueReaders(sources);

    /* The five readers #1094 named must all be IN the population: an arm that
       only checked "nothing is red" would stay green if the matcher went blind. */
    for (const reader of [
      "scripts/next-up-escalation.mts",
      "scripts/shift-digest.mts",
      "scripts/queue-standing-exceptions.mts",
      "scripts/crew-desk-sweep.mts",
      "scripts/lib/crewQueueCount.mts",
    ]) {
      expect(population, `${reader} left the population — the matcher has gone blind`)
        .toContain(reader);
      expect(verdicts.find((row) => row.path === reader), reader)
        .toEqual({ path: reader, ok: true, why: "consults" });
    }

    const failing = verdicts.filter((row) => !row.ok).map((row) => row.path);
    expect(
      failing,
      "these scripts list open issues and consult no build board — either call"
      + " `scripts/lib/cardBuildState.mts`'s `buildBoard`, or add a row to"
      + " `QUEUE_READER_EXEMPTIONS` saying why the script offers nobody a card",
    ).toEqual([]);
    expect(staleExemptions, "an exemption whose file no longer lists issues — delete the row")
      .toEqual([]);
  });

  it("every exemption carries a reason somebody wrote", () => {
    for (const row of QUEUE_READER_EXEMPTIONS) {
      /* A row is a founder-visible act in the sense the capability atlas's
         `KNOWN_DEBTS` means: it must say something, not sit as a path. */
      expect(row.because.length, row.path).toBeGreaterThan(40);
    }
  });
});
