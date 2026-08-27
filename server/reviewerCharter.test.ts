/**
 * THE REVIEWER'S CHARTER CANNOT DRIFT FROM CLAUDE.MD (#161).
 *
 * `docs/REVIEWER_CHARTER.md` is the distilled project law an ordinary PR
 * review reads instead of the full CLAUDE.md (founder-approved 2026-08-27:
 * same Fable, same eyes, half the reading — money/auth PRs still read
 * CLAUDE.md in full). The charter is a DERIVED summary, never a second
 * authority — which is exactly working law 4's warning: a second list
 * shadowing a source of truth always drifts from it. So this guard DERIVES
 * the populations from CLAUDE.md itself:
 *
 *   - every working-law heading (the bold lead of each numbered item under
 *     "## Working laws") must appear in the charter verbatim;
 *   - every enforcement-invariant heading (same shape under
 *     "### Enforcement invariants") must appear in the charter verbatim;
 *   - so when CLAUDE.md GAINS or RENAMES a law or invariant, this suite
 *     reddens until the charter carries it — the list-stops-being-the-list
 *     class, pointed at the charter.
 *
 * Headings are compared whitespace-normalized (the charter wraps at ~76
 * columns; CLAUDE.md does not), because a comparison that a line break can
 * fail is a comparison that fails for the wrong reason.
 *
 * Instrument controls (working law 2): the extractor is proven on a fixture
 * with a known answer before its verdict on the real file counts, and the
 * counts are floored at today's populations (10 laws including 7b, 9
 * invariants) so an extractor regression cannot pass as an empty-but-green
 * sweep — a collector that can come up empty must refuse instead.
 *
 * What this deliberately does NOT check: the charter's prose beyond the
 * headings. The charter compresses histories into rules by design; pinning
 * its sentences to CLAUDE.md's would forbid the compression that is its
 * whole point. The headings are the contract; the header's "CLAUDE.md wins"
 * clause (asserted below) is what keeps the compression honest.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const claudeMd = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
const charter = readFileSync(path.join(repoRoot, "docs/REVIEWER_CHARTER.md"), "utf8");
const reviewYml = readFileSync(path.join(repoRoot, ".github/workflows/review.yml"), "utf8");

/** The text of `source` from the line matching `from` up to the next line matching `until`. */
function section(source: string, from: RegExp, until: RegExp): string {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => from.test(line));
  if (start === -1) throw new Error(`[reviewerCharter] section start not found: ${from}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => until.test(line));
  if (end === -1) throw new Error(`[reviewerCharter] section end not found after ${from}: ${until}`);
  return rest.slice(0, end).join("\n");
}

/** The bold lead heading of every numbered item ("1. **…**", "7b. **…**") in `text`. */
function numberedBoldHeadings(text: string): string[] {
  return [...text.matchAll(/^\d+b?\.\s+\*\*(.+?)\*\*/gm)].map((match) => match[1]!);
}

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

describe("the extractor itself (instrument controls before the verdict)", () => {
  const fixture = [
    "## Some laws",
    "",
    "1. **First law.** Prose after it.",
    "2. **Second law with `code` — and a dash.** More prose.",
    "2b. **A lettered sub-law.** Prose.",
    "   Not a heading: **indented bold** never counts.",
    "",
    "## Next section",
  ].join("\n");

  it("extracts exactly the numbered bold headings from a known fixture", () => {
    const body = section(fixture, /^## Some laws/, /^## /);
    expect(numberedBoldHeadings(body)).toEqual([
      "First law.",
      "Second law with `code` — and a dash.",
      "A lettered sub-law.",
    ]);
  });

  it("refuses a section it cannot find rather than answering with nothing", () => {
    expect(() => section(fixture, /^## Absent/, /^## /)).toThrow(/section start not found/);
  });

  it("can fail: a heading absent from a text is reported absent", () => {
    expect(normalize("some charter text").includes(normalize("First law."))).toBe(false);
  });
});

describe("the charter carries every working law CLAUDE.md declares", () => {
  const laws = numberedBoldHeadings(
    section(claudeMd, /^## Working laws/, /^## /),
  );

  it("found the population (extraction floor — today 1–9 plus 7b)", () => {
    expect(laws.length).toBeGreaterThanOrEqual(10);
  });

  it.each(laws.map((law) => [law] as const))("carries law: %s", (law) => {
    expect(
      normalize(charter).includes(normalize(law)),
      `CLAUDE.md declares working law "${law}" and docs/REVIEWER_CHARTER.md does not carry it — `
      + "the charter is derived from CLAUDE.md and must gain the heading (and its rule) in the same change",
    ).toBe(true);
  });
});

describe("the charter carries every enforcement invariant CLAUDE.md declares", () => {
  const invariants = numberedBoldHeadings(
    section(claudeMd, /^### Enforcement invariants/, /^###? /),
  );

  it("found the population (extraction floor — today 9)", () => {
    expect(invariants.length).toBeGreaterThanOrEqual(9);
  });

  it.each(invariants.map((invariant) => [invariant] as const))("carries invariant: %s", (invariant) => {
    expect(
      normalize(charter).includes(normalize(invariant)),
      `CLAUDE.md declares enforcement invariant "${invariant}" and docs/REVIEWER_CHARTER.md does not carry it — `
      + "the charter is derived from CLAUDE.md and must gain the heading (and its rule) in the same change",
    ).toBe(true);
  });
});

describe("the wiring and the authority clause", () => {
  it("the charter's header says CLAUDE.md wins on any conflict", () => {
    expect(charter.slice(0, 1500)).toContain("CLAUDE.md wins");
  });

  it("review.yml sends ordinary reviews to the charter and money/auth reviews to full CLAUDE.md", () => {
    // Both documents must be named in the workflow: dropping either silently
    // reverts half of #161 (all-charter would dull money reviews; all-CLAUDE.md
    // would silently undo the diet).
    expect(reviewYml).toContain("docs/REVIEWER_CHARTER.md");
    expect(reviewYml).toContain("CLAUDE.md in full");
  });

  it("the charter quotes the review priorities from review.yml's prompt", () => {
    // The prompt stays the source (it must work standalone on the money road);
    // the charter QUOTES it, and these anchors pin that the quotation exists.
    for (const phrase of [
      "Correctness bugs",
      "Enforcement-invariant violations",
      "Flag discipline",
      "name what was bolted to the deleted path",
      "do not invent findings",
    ]) {
      expect(normalize(charter)).toContain(phrase);
    }
  });
});
