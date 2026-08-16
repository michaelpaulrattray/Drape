import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE TWO MECHANICAL ARMS OF THE DOCTRINE FILE
 * (arm 1: fable-665 §4, from opus-507 §3. arm 2: fable-795 §1, from opus-586.)
 *
 * `docs/specs/INSTRUMENT_DOCTRINE.md` admits a sentence only when it has been
 * banked in a numbered Fable ruling with a real incident, and every entry
 * carries its mailbox citation. Ten minutes after the file was finished — it
 * landed at 08:34 and closed at 08:41 on 2026-08-16, and the finding was
 * reported at 08:51 — one entry of twelve turned out to cite **the order that
 * commissioned the file**: the sentence appeared there as four words in a seed
 * list, with no incident and no banking, and it had never been banked anywhere.
 * Circular — the order cannot also be the warrant.
 *
 * # What this test covers, and what it does NOT
 *
 * **Arm 1: no entry cites the message named in the file's own `Ordered:` line.**
 * That is the defect that actually occurred, and it is decidable from the file's
 * own text.
 *
 * **Arm 2: the closing sentence's count agrees with the number of entries.** The
 * file ends by calling itself the failure mode "all N of these describe", and on
 * 2026-08-17 that N read *fourteen* over **sixteen** entries. The count had been
 * kept correctly four times running — ten → twelve → thirteen → fourteen, each on
 * the commit that added its entry — and then broke twice, first when entry 15
 * rode inside a commit about something else entirely (`ed2c7c47`, whose subject
 * is the retro-mint work list) and then when entry 16 copied the state it found.
 * **A step attached to a task by habit survives exactly as long as the task keeps
 * its shape**, which is why this one now has an instrument instead. The expected
 * count is DERIVED from the entry headings — no second list to drift (working
 * law 4).
 *
 * Both arms fire on defects that have actually happened here. There is no arm for
 * a mistake nobody has made.
 *
 * Three checks that would look like coverage are deliberately absent, because
 * every one of them runs GREEN over the defect above:
 *
 *   - "every cited message exists"      — fable-662 exists.
 *   - "every cited section exists"      — fable-662 has a §3c.
 *   - "every entry has rule/incident/citation" — that entry had all three.
 *
 * The mailbox those citations point into (`.agents/`) is untracked and absent
 * from a clean checkout, so a resolver could not run here anyway — but the
 * reason not to build one is the first reason, not the second. A checker whose
 * green means less than its reader thinks is the failure mode half that file
 * documents.
 *
 * **The admission rule is otherwise enforced by reading** — one author opening
 * every citation in its own message, which is how the circular one was found.
 */

const repoRoot = path.resolve(__dirname, "..");
const DOCTRINE = path.join(repoRoot, "docs/specs/INSTRUMENT_DOCTRINE.md");

type Entry = { entry: string; citations: string[] };

/** Every `fable-NNN` in a chunk of prose, in order, deduplicated. */
const citationsIn = (text: string): string[] => [
  ...new Set((text.match(/fable-\d+/g) ?? [])),
];

/**
 * Reads the file the way its own convention writes it: an `**Ordered:**` block
 * in the header, then numbered entries, each closing with a `*Banked:*` block
 * that may wrap over several lines and ends at the first blank line.
 */
export function readDoctrine(markdown: string): {
  orderedCitation: string | null;
  entries: Entry[];
} {
  const ordered = /\*\*Ordered:\*\*([\s\S]*?)\n\s*\n/.exec(markdown)?.[1] ?? "";
  const orderedCitation = citationsIn(ordered)[0] ?? null;

  const entries: Entry[] = [];
  let current: string | null = null;
  let collecting = false;
  let banked: string[] = [];

  const flush = () => {
    if (current !== null && banked.length > 0) {
      entries.push({ entry: current, citations: citationsIn(banked.join("\n")) });
    }
    banked = [];
    collecting = false;
  };

  for (const line of markdown.split("\n")) {
    const heading = /^\*\*(\d+)\.\s/.exec(line);
    if (heading) {
      flush();
      current = heading[1]!;
    }
    /* LINE-INITIAL, which is how the convention writes it. `includes` was the
       first cut and it read the file's own prose ABOUT the convention — a
       sentence quoting `*Banked:*` mid-line — as a second, citation-less
       warrant block. The blank-reader guard below is what caught it. */
    if (/^\*Banked:\*/.test(line)) collecting = true;
    else if (collecting && line.trim() === "") flush();
    if (collecting) banked.push(line);
  }
  flush();

  return { orderedCitation, entries };
}

/** The single arm: entries whose warrant is the order that asked for the file. */
export function circularCitations(markdown: string): Entry[] {
  const { orderedCitation, entries } = readDoctrine(markdown);
  if (!orderedCitation) return [];
  return entries.filter((entry) => entry.citations.includes(orderedCitation));
}

/**
 * ARM 2 — the file's closing self-count against the entries it actually holds.
 *
 * English, not a mirror of anything: the words are how the sentence is written,
 * and the count they are checked against is derived from the headings.
 */
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two",
  "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven",
  "twenty-eight", "twenty-nine", "thirty",
];

export type ClosingCount = {
  /** The number-word as written, e.g. `sixteen`. */
  word: string;
  /** What that word means, or `null` for a word outside the range above. */
  claimed: number | null;
  /** How many numbered entries the file holds, counted from its own headings. */
  entries: number;
  agrees: boolean;
};

/**
 * Returns `null` only when the closing sentence is GONE — which the test treats
 * as a failure, not a pass. A reader that silently finds nothing is the blank
 * reader this file warns about: if the sentence is ever reworded, the arm must
 * say so and be re-pointed, never quietly stop looking.
 */
export function readClosingCount(markdown: string): ClosingCount | null {
  const match = /\ball\s+([a-z-]+)\s+of these describe/i.exec(markdown);
  if (!match) return null;
  const word = match[1]!.toLowerCase();
  const index = NUMBER_WORDS.indexOf(word);
  const claimed = index === -1 ? null : index;
  const entries = [...markdown.matchAll(/^\*\*(\d+)\.\s/gm)].length;
  return { word, claimed, entries, agrees: claimed === entries };
}

/* A doctrine-shaped fixture, so both controls drive the same reader as the real
   file. `__CITATION__` is what the arm is pointed at. */
const fixture = (citation: string) => `# Fixture doctrine

**Ordered:** fable-662 §3, from opus-504 §4 — *"build the file."*

**Admission rule.** Banked, with an incident, with a citation.

**1. A rule that is fine.**
*Incident:* something that happened.
*Banked:* fable-510 §3.

**2. The rule under test.**
*Incident:* something else that happened.
*Banked:* ${citation}.
`;

describe("instrument doctrine — the admission rule's one mechanical arm", () => {
  const markdown = fs.readFileSync(DOCTRINE, "utf8");

  it("no entry cites the message that ordered the file", () => {
    const circular = circularCitations(markdown);
    expect(
      circular,
      `An entry's warrant is the order that commissioned this file — the order `
        + `cannot also be the banking. Get the sentence banked in its own numbered `
        + `ruling and cite that: ${circular.map((e) => `entry ${e.entry}`).join(", ")}`,
    ).toEqual([]);
  });

  /* Without this, the assertion above is what a reader that parses nothing
     prints. A blank reader produces output shaped exactly like a fact. */
  it("the reader is not blank — it finds the order and every entry's warrant", () => {
    const { orderedCitation, entries } = readDoctrine(markdown);
    expect(orderedCitation).toMatch(/^fable-\d+$/);
    expect(entries.length).toBeGreaterThanOrEqual(12);
    for (const entry of entries) {
      expect(entry.citations.length, `entry ${entry.entry} has no citation`)
        .toBeGreaterThan(0);
    }
  });

  /*
    A floor is not coverage. `>= 12` above stays green when the reader skips the
    entry added last — which is the only entry anyone is ever unsure about, and
    exactly the doubt that prompted this check when entry 14 landed out of
    numeric order. So the expected set is DERIVED from the file's own headings
    rather than pinned to a number that would need editing every time (and that
    nobody would notice going stale).
  */
  it("the reader finds EVERY numbered entry the file contains", () => {
    const headings = [...markdown.matchAll(/^\*\*(\d+)\.\s/gm)].map((m) => m[1]!);
    const parsed = readDoctrine(markdown).entries.map((entry) => entry.entry);
    expect(headings.length).toBeGreaterThan(0);
    expect(parsed, "an entry the reader silently skipped has no warrant to check")
      .toEqual(headings);
  });

  it("POSITIVE CONTROL — names the entry when one cites the ordering message", () => {
    const found = circularCitations(fixture("fable-662 §3c"));
    expect(found.map((e) => e.entry)).toEqual(["2"]);
  });

  it("NEGATIVE CONTROL — silent when that same entry cites a real banking", () => {
    expect(circularCitations(fixture("fable-596 §1"))).toEqual([]);
  });
});

/* A fixture whose entry count and closing count can be set independently, so the
   controls drive the same reader the live file gets. */
const counted = (entries: number, word: string) =>
  `# Fixture doctrine\n\n**Ordered:** fable-662 §3.\n\n`
  + Array.from({ length: entries }, (_, index) =>
    `**${index + 1}. A rule.**\n*Incident:* something.\n*Banked:* fable-510 §3.\n`).join("\n")
  + `\n## Adding to this file\n\nA doctrine file long enough to skim past is an `
  + `instrument nobody reads, which is the failure mode all ${word} of these describe.\n`;

describe("instrument doctrine — arm 2: the closing sentence counts the entries", () => {
  const markdown = fs.readFileSync(DOCTRINE, "utf8");

  it("the file's closing count is the number of entries it holds", () => {
    const reading = readClosingCount(markdown);
    expect(
      reading,
      "the closing self-count sentence is gone or reworded — re-point this arm "
        + "rather than letting it look green while reading nothing",
    ).not.toBeNull();
    expect(
      reading!.agrees,
      `the file closes on "all ${reading!.word} of these" and holds `
        + `${reading!.entries} entries. Adding an entry means updating that word — `
        + `it was dropped twice when the entry rode inside a commit about `
        + `something else.`,
    ).toBe(true);
  });

  /* Without this the assertion above is also what a reader parsing nothing
     prints: `agrees` would be false-on-null, and a zero-entry file would agree
     with the word "zero". Prove it reads BOTH halves off the real file. */
  it("the reader is not blank — it finds a real word and a real entry count", () => {
    const reading = readClosingCount(markdown)!;
    expect(reading.claimed).toBeGreaterThan(0);
    expect(reading.entries).toBeGreaterThan(0);
    expect(NUMBER_WORDS).toContain(reading.word);
  });

  it("POSITIVE CONTROL — catches the exact drift that occurred (14 over 16)", () => {
    const drifted = readClosingCount(counted(16, "fourteen"))!;
    expect(drifted.agrees).toBe(false);
    expect(drifted.claimed).toBe(14);
    expect(drifted.entries).toBe(16);
  });

  it("NEGATIVE CONTROL — silent when the same fixture says sixteen", () => {
    expect(readClosingCount(counted(16, "sixteen"))!.agrees).toBe(true);
  });

  it("a word it cannot read is a disagreement, never a pass", () => {
    // `several` is not a count. The arm must refuse it rather than treat an
    // unparsed word as nothing to say.
    const vague = readClosingCount(counted(16, "several"))!;
    expect(vague.claimed).toBeNull();
    expect(vague.agrees).toBe(false);
  });

  it("a reworded closing sentence reads as ABSENT, so the arm can be re-pointed", () => {
    expect(readClosingCount("# Doctrine\n\n**1. A rule.**\n\nNo closing sentence.\n"))
      .toBeNull();
  });
});
