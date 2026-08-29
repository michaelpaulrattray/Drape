/**
 * A QUEUE CITATION CARRIES THE ROW'S NAME, BECAUSE AN ORDINAL ROTS QUIETLY.
 *
 * `POST_SIGN_ROADMAP.md` §10 is the active queue, and its own organisation
 * rule tells every mailbox message to cite it as *"§10 item N"* and not to
 * restate it. That rule is right — a queue living only in mailbox messages is
 * the mirror law violated — and **the citation form it mandates is the one
 * form that goes wrong without any symptom.**
 *
 * The measured instance that bought this arm (swept 2026-08-22, opus-1001):
 * the table was written `813a2152` at 20:25 and RENUMBERED `1c44e03d` at
 * 22:06 the same night, when THE TWO PATHS was inserted as item 5 and every
 * row below it moved by one — CAST-BORN INK DISCOVERY 5 -> 6, RETIREMENT +
 * CLEANUP 6 -> 7, OPEN-LANE REFERENCE ROAD 7 -> 8, ANY-FEATURE DISCOVERY
 * 8 -> 9. Three citations written against the old numbering were left behind,
 * and **all three still landed on a real row**, so nothing looked broken for a
 * day: §5c called CAST-BORN INK DISCOVERY *"§10 item 5"*, which is THE TWO
 * PATHS — an item blocked on a founder ceremony. A shift following the
 * pointer arrives at the wrong work with nothing to tell it so.
 *
 * `prosePointerDiscipline.test.ts` is this arm's sibling and states the
 * contrast it turns on: **a line number rots LOUDLY, by landing on nothing.
 * An ordinal rots QUIETLY, by landing on something else.**
 *
 * # TWO ARMS, AND WHY IT TAKES TWO
 *
 *   1. THE RENUMBER TRIPWIRE. The table's ordinal -> title map is pinned here.
 *      Any insert, reorder or rename reddens this file, and the failure
 *      message says what is owed: one grep for `§10 item` across the
 *      repository, in the same commit. It covers the BARE citations too,
 *      because it does not read them — it reads the event that invalidates
 *      them. The strike marker is stripped before comparison, so CLOSING an
 *      item does not redden it; only moving or renaming one does.
 *
 *   2. THE NAME MATCH. Every citation written as `§10 item N (NAME)` must
 *      name the row the table has at N. Two of the three stale citations
 *      carried their names and read as wrong on sight; the bare one took a
 *      paragraph of argument and a `git log -S` to settle, which is the whole
 *      argument for writing the name at all.
 *
 * # WHY THE NAME IS A PARENTHETICAL AND NOT AN EM-DASH CLAUSE
 *
 * The first draft read `§10 item N — NAME` as a name claim, because that is
 * how the two stale citations happened to be written. **Driven over the
 * repository it produced a false accusation**, and the false one is the reason
 * the form changed: `scripts/court-ink-removal-road-disposable.mts` opens
 * *"§10 item 3a — DOES THE REMOVAL ROAD THAT ALREADY EXISTS TAKE A TATTOO
 * OFF?"*, where the em-dash introduces a QUESTION and not a title. In this
 * repository's prose an em-dash means *"and now a sentence"* far more often
 * than it means *"whose name is"*, so a checker reading it as a name claim
 * accuses correct writing. A parenthetical immediately after the ordinal
 * cannot be anything else.
 *
 * # THE LIMITS, STATED RATHER THAN DISCOVERED
 *
 *   - **A citation with no parenthetical is not protected by arm 2, and a
 *     clean run is a floor rather than coverage.** Arm 1 covers those, and
 *     only at the moment the table moves — a citation ALREADY wrong before
 *     this arm existed sails through both. The three known ones were repaired
 *     by hand in the commit that added this file; nothing here found them.
 *   - **A parenthetical that does not begin with a capital is not read**, so
 *     `§10 item 2 (~$0.05 of reads)` is noise rather than a claim. Every row
 *     title in the table is capitalised, so this costs nothing today.
 *   - **This file excludes ITSELF from the scan.** Its red controls are
 *     planted stale citations, and a corpus that catalogues its own control
 *     specimens stops testing anything — the exclusion is by filename so a
 *     reader can see it and audit it.
 *
 * # BOTH REAL ARMS WERE DRIVEN, AND EACH REDDENS ALONE (2026-08-22)
 *
 *   - renaming one row in the table (`RETIREMENT + CLEANUP` ->
 *     `RETIREMENT AND CLEANUP`) reddened arm 1 and nothing else;
 *   - planting one stale bracketed citation in a real file
 *     (`CASTING_V2_TWO_PATHS_DESIGN.md`, table untouched) reddened arm 2 and
 *     nothing else.
 *
 * The first attempt at the first sabotage moved TWO arms, and that is what
 * bought the fixture split below — the negative controls had been reading the
 * live roadmap, so any table edit broke them alongside the tripwire. A bench
 * whose arms move together cannot say which one caught anything.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { readListedSource } from "./testing/listedSource";


import { allowTreeSweeps } from "./testing/suiteClocks";

/* This file walks the docs and mailbox trees with `readdirSync`. It timed out at the
   5s default TWICE across the runs on #233 (foreman-98 run 2; foreman-99 run 2).
   See `suiteClocks.ts` family 2. */
allowTreeSweeps();
const REPO_ROOT = join(__dirname, "..");
const ROADMAP = join(REPO_ROOT, "docs/specs/POST_SIGN_ROADMAP.md");

/**
 * The §10 table as the file holds it, ordinal -> title, strike marker removed.
 *
 * A row is `4b THE STUDIO CAPABILITY CENSUS           615fe6eb — ...`: the
 * ordinal, an optional strike marker, the title, then two-or-more spaces
 * before the notes column. Continuation lines are indented and never match.
 */
const TABLE_ROW = /^(\d+[ab]?) {1,}(?:✅ |⛔ )?([^ ].*?) {2,}\S/;

export function parseQueueTable(markdown: string): Map<string, string> {
  const heading = markdown.indexOf("## §10 ACTIVE QUEUE");
  if (heading < 0) throw new Error("§10 ACTIVE QUEUE heading is gone — this arm has lost its subject");
  const open = markdown.indexOf("```", heading);
  const close = markdown.indexOf("```", open + 3);
  if (open < 0 || close < 0) throw new Error("§10's fenced table is gone — this arm has lost its subject");
  const rows = new Map<string, string>();
  for (const line of markdown.slice(open + 3, close).split("\n")) {
    const m = TABLE_ROW.exec(line);
    if (m) rows.set(m[1], m[2].trim());
  }
  return rows;
}

/**
 * THE PIN. Not a mirror of the table — it answers no question and nothing
 * reads it for an answer. It is a fingerprint whose only job is to go red the
 * day the table moves, on the commit that moves it.
 */
const PINNED_QUEUE: ReadonlyArray<readonly [string, string]> = [
  ["1", "SIGN-VIEW WIRE"],
  ["2", "THE TWO FREE READS"],
  ["3a", "ONE-TATTOO REMOVAL"],
  ["4", "POLISH SITTING"],
  ["4b", "THE STUDIO CAPABILITY CENSUS"],
  ["5", "THE TWO PATHS (Wardrobe / Basics)"],
  ["3b", "KEYING + MULTI-TATTOO REMOVAL"],
  ["6", "CAST-BORN INK DISCOVERY"],
  ["7", "RETIREMENT + CLEANUP"],
  ["8", "OPEN-LANE REFERENCE ROAD"],
  ["9", "ANY-FEATURE DISCOVERY"],
];

/** The name form: a capitalised parenthetical immediately after the ordinal. */
const NAMED_CITATION = /§10 items? (\d+[ab]?) \(([A-Z][^)\n]*)\)/g;

export interface Citation {
  readonly ordinal: string;
  readonly name: string;
}

export function namedCitationsIn(text: string): Citation[] {
  NAMED_CITATION.lastIndex = 0;
  const found: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = NAMED_CITATION.exec(text)) !== null) {
    found.push({ ordinal: m[1], name: m[2].trim() });
  }
  return found;
}

function normalise(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** A citation may name the row's title in full or by its leading phrase. */
export function citationDisagrees(rows: Map<string, string>, cite: Citation): string | null {
  const title = rows.get(cite.ordinal);
  if (title === undefined) return `item ${cite.ordinal} is not a row in the §10 table`;
  if (normalise(title).startsWith(normalise(cite.name))) return null;
  return `"§10 item ${cite.ordinal} (${cite.name})" but item ${cite.ordinal} is "${title}"`;
}

const SCANNED_ROOTS = [
  "CLAUDE.md",
  "docs/specs",
  "docs/architecture",
  "scripts",
  "server",
  "shared",
  "client/src",
];
const SCANNED_EXTENSIONS = new Set([".md", ".ts", ".tsx", ".mts", ".mjs", ".yaml", ".json"]);

function filesUnder(absolute: string, into: string[]): void {
  const stat = statSync(absolute, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    if (SCANNED_EXTENSIONS.has(extname(absolute))) into.push(absolute);
    return;
  }
  for (const entry of readdirSync(absolute)) {
    if (entry === "node_modules" || entry === "dist") continue;
    filesUnder(join(absolute, entry), into);
  }
}

describe("a §10 queue citation names its row", () => {
  const rows = parseQueueTable(readFileSync(ROADMAP, "utf8"));

  /*
    THE CONTROLS READ THE PIN, NOT THE LIVE TABLE, and that separation was
    bought by a sabotage rather than foreseen: renaming one row to prove arm 1
    could fire reddened a NEGATIVE control at the same time, because the
    control's fixture was the live file. Two arms moving on one sabotage is a
    bench sharing state. So the controls now prove the CHECKER against a fixed
    table — the world as it stood on 2026-08-22 — and only the two real arms
    read the roadmap.
  */
  const fixture = new Map<string, string>(PINNED_QUEUE.map(([o, t]) => [o, t]));

  /*
    THE RED CONTROLS FIRST — "it passed" and "it never looked" are the same
    text, so the planted defects run before the real assertions. Both planted
    strings are the actual stale citations found on 2026-08-22.
  */
  it("CAN FAIL — the real stale citation is caught", () => {
    const planted = namedCitationsIn("- **§10 item 5 (CAST-BORN INK DISCOVERY). UNGATED, and it does not wait**");
    expect(planted).toEqual([{ ordinal: "5", name: "CAST-BORN INK DISCOVERY" }]);
    expect(citationDisagrees(fixture, planted[0])).toBe(
      '"§10 item 5 (CAST-BORN INK DISCOVERY)" but item 5 is "THE TWO PATHS (Wardrobe / Basics)"',
    );
  });

  it("CAN FAIL — the other real stale citation is caught", () => {
    const planted = namedCitationsIn("- **§10 item 8 (ANY-FEATURE DISCOVERY). This section proper.**");
    expect(citationDisagrees(fixture, planted[0])).toBe(
      '"§10 item 8 (ANY-FEATURE DISCOVERY)" but item 8 is "OPEN-LANE REFERENCE ROAD"',
    );
  });

  it("CAN FAIL — an ordinal past the end of the table is caught, not ignored", () => {
    const planted = namedCitationsIn("§10 item 12 (SOMETHING THAT DOES NOT EXIST)");
    expect(citationDisagrees(fixture, planted[0])).toBe("item 12 is not a row in the §10 table");
  });

  /*
    AND THE NEGATIVE CONTROLS, which are what stop the rule forbidding the
    sentence it asks for.
  */
  it("passes the repaired forms, and the leading-phrase form", () => {
    for (const text of [
      "- **§10 item 6 (CAST-BORN INK DISCOVERY). UNGATED**",
      "- **§10 item 9 (ANY-FEATURE DISCOVERY). This section proper.**",
      "the Two Paths card (§10 item 5 (THE TWO PATHS))",
      "§10 item 7 (RETIREMENT + CLEANUP)'s three-symbol debt",
    ]) {
      const cites = namedCitationsIn(text);
      expect(cites.length, text).toBe(1);
      expect(citationDisagrees(fixture, cites[0]), text).toBeNull();
    }
  });

  it("does not fire on a bare citation — that is arm 1's job, and it is stated as a limit", () => {
    expect(namedCitationsIn("closed by §10 item 3a), and the MULTI case (§10 item 3b) needs")).toEqual([]);
    expect(namedCitationsIn("it needs **§10 items 1 and 2** and nothing else")).toEqual([]);
  });

  /*
    THE FALSE ACCUSATION THAT CHANGED THE FORM, kept as an arm so nobody
    re-widens the regex without meeting it: a real sentence in this repository
    where the em-dash after the ordinal introduces a question, not a title.
  */
  it("does not accuse an em-dash clause of being a name", () => {
    expect(
      namedCitationsIn("§10 item 3a — DOES THE REMOVAL ROAD THAT ALREADY EXISTS TAKE A TATTOO OFF?"),
    ).toEqual([]);
  });

  it("does not read a lowercase parenthetical as a name claim", () => {
    expect(namedCitationsIn("Item 2's two free reads (§10 item 2 (~$0.05)) SIZE it")).toEqual([]);
  });

  /* ARM 1 — THE RENUMBER TRIPWIRE. */
  it("the §10 table still parses, and to more than a handful of rows", () => {
    expect(rows.size).toBeGreaterThanOrEqual(8);
    expect(rows.get("5")).toBe("THE TWO PATHS (Wardrobe / Basics)");
  });

  it("the queue's ordinals have not moved since they were last swept", () => {
    expect(
      [...rows.entries()],
      "the §10 queue table has been renumbered or renamed. That is allowed — what is "
        + "owed with it is ONE GREP, in this same commit: search the repository for "
        + "`§10 item` and repair every citation the move invalidated, then update "
        + "PINNED_QUEUE here. An ordinal rots quietly, by landing on something else: "
        + "three citations survived the 2026-08-21 renumber pointing at real but wrong rows.",
    ).toEqual(PINNED_QUEUE.map(([ordinal, title]) => [ordinal, title]));
  });

  /* ARM 2 — EVERY NAMED CITATION IN THE REPOSITORY. */
  it("every named citation in the repository names its own row", () => {
    const files: string[] = [];
    for (const root of SCANNED_ROOTS) filesUnder(join(REPO_ROOT, root), files);
    expect(files.length, "the scan found no files — a checker that cannot look cannot fail").toBeGreaterThan(100);

    const disagreements: string[] = [];
    let citationsRead = 0;
    for (const file of files) {
      /* See the header: this file's red controls ARE stale citations. */
      if (file.endsWith("queueOrdinalDiscipline.test.ts")) continue;
      /* `filesUnder` already tolerates an entry that vanishes at the STAT step
         (`throwIfNoEntry: false`); the read is the other half of the same race
         and it is the half that refused the deploy rite (#223). */
      const text = readListedSource(file);
      if (text === null || !text.includes("§10 item")) continue;
      for (const cite of namedCitationsIn(text)) {
        citationsRead += 1;
        const problem = citationDisagrees(rows, cite);
        if (problem) disagreements.push(`${file.slice(REPO_ROOT.length + 1)}: ${problem}`);
      }
    }

    expect(citationsRead, "no named citation was read at all — arm 2 is blind, not clean").toBeGreaterThan(0);
    expect(
      disagreements,
      "a queue citation names a row the §10 table does not have at that ordinal. "
        + "Either the citation is stale (repair it) or the table moved without its sweep.",
    ).toEqual([]);
  });
});
