import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE ONE MECHANICAL ARM OF THE DOCTRINE FILE'S ADMISSION RULE
 * (fable-665 §4, from the finding in opus-507 §3).
 *
 * `docs/specs/INSTRUMENT_DOCTRINE.md` admits a sentence only when it has been
 * banked in a numbered Fable ruling with a real incident, and every entry
 * carries its mailbox citation. On the file's second day, one entry of twelve
 * turned out to cite **the order that commissioned the file** — the sentence
 * appeared there as four words in a seed list, with no incident and no banking,
 * and it had never been banked anywhere. Circular: the order cannot also be the
 * warrant.
 *
 * # What this test covers, and what it does NOT
 *
 * It asserts ONE thing: **no entry cites the message named in the file's own
 * `Ordered:` line.** That is the defect that actually occurred, it is decidable
 * from the file's own text, and it is the whole of the mechanical coverage.
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

  it("POSITIVE CONTROL — names the entry when one cites the ordering message", () => {
    const found = circularCitations(fixture("fable-662 §3c"));
    expect(found.map((e) => e.entry)).toEqual(["2"]);
  });

  it("NEGATIVE CONTROL — silent when that same entry cites a real banking", () => {
    expect(circularCitations(fixture("fable-596 §1"))).toEqual([]);
  });
});
