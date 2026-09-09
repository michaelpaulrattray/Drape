/**
 * A BRIEFING FIELD THAT NOTHING DRAWS (#329, and #293's class one size smaller).
 *
 * The journal was removed because every shift wrote it and the page drew none
 * of it. The law-7 sweep of that removal asked the same question of every OTHER
 * field of the briefing schema, and one came back empty: **`updatedAt` — written
 * by every edition since the page existed, referenced by the client ZERO
 * times.** So the foot of his page named who wrote the edition he was reading
 * and never said when, and a page left open all night looked identical whether
 * the last edition landed two minutes or nine hours ago.
 *
 * # Why this is an arm and not a one-off count
 *
 * The count was run by hand twice — once by #293's sweep, once by #329's fix —
 * and the interesting thing about both is that nothing would have run it again.
 * A field added to the schema next month, written faithfully by every shift and
 * drawn nowhere, is invisible: it costs nothing, breaks nothing, and reads as
 * working. **The population is derived from the schema's own declaration**
 * (`crewBriefingSchema.shape`, not a list typed here and not a regex over the
 * source — the Atlas's own lesson about reading at a shape where a declaration
 * exists), so a new field joins this arm by existing.
 *
 * # What it deliberately does NOT claim
 *
 * A textual reference is not proof the field reaches a pixel — a mention in a
 * comment counts. It is a floor, and the floor is the thing that was breached:
 * `updatedAt` had no mention of any kind. The arm's job is to make the NEXT
 * zero loud, not to audit rendering.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { crewBriefingSchema } from "./crew/crewBriefing";

/** Every file that draws his Crew page. */
function pageSources(): { path: string; text: string }[] {
  const dir = join(__dirname, "..", "client", "src", "features", "admin", "components", "crew");
  const files = readdirSync(dir)
    .filter((name) => (name.endsWith(".tsx") || name.endsWith(".ts")) && !name.includes(".test."))
    .map((name) => join(dir, name));
  files.push(join(__dirname, "..", "client", "src", "pages", "AdminCrew.tsx"));
  return files.map((path) => ({ path, text: readFileSync(path, "utf8") }));
}

function referencesTo(field: string, sources: { text: string }[]): number {
  /* The boundary is built with String.raw and concatenation on purpose: a
     `\b` inside a TEMPLATE LITERAL is a backspace character, not a word
     boundary, and this file shipped that way for one run — every field read
     ZERO and the arm asserting zero stayed green. */
  const pattern = new RegExp(String.raw`\b` + field + String.raw`\b`, "g");
  return sources.reduce((total, source) => total + (source.text.match(pattern)?.length ?? 0), 0);
}

describe("every field the briefing schema declares is read by the page", () => {
  const sources = pageSources();
  const fields = Object.keys(crewBriefingSchema.shape);

  it("the population is the schema's own declaration, and it is not empty", () => {
    /* A reader that can come up empty THROWS rather than passing quietly — the
       collector class CLAUDE.md's Atlas section names. An arm over zero fields
       is green and proves nothing. */
    expect(fields.length).toBeGreaterThan(5);
    expect(fields).toContain("updatedAt");
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(fields)("`%s` has at least one reader on the page", (field) => {
    expect(referencesTo(field, sources)).toBeGreaterThan(0);
  });

  it("⚠ `updatedAt` specifically — the field this card was filed about", () => {
    /* It was 0. If it returns to 0 the page has quietly stopped saying when the
       edition he is reading was written, which is exactly how it shipped. */
    expect(referencesTo("updatedAt", sources)).toBeGreaterThan(0);
  });

  it("the reader can report ZERO, and it can COUNT — both controls", () => {
    /* ⚠ THE FIRST HALF ALONE IS NOT A CONTROL, AND IT PASSED WHILE THE READER
       WAS BROKEN. With the boundary eaten (see above) `referencesTo` returned 0
       for everything, and an arm asserting zero is green under exactly that.
       What caught it was the real arms going red — luck, not design. So the
       reader is shown COUNTING as well as reporting nothing. */
    expect(referencesTo("aFieldNoBriefingHasEverCarried", sources)).toBe(0);
    expect(referencesTo("briefing", sources)).toBeGreaterThan(10);
  });
});

describe("the stamp says when, and says it differently from the bar", () => {
  const stamp = readFileSync(join(__dirname, "..", "client", "src", "pages", "AdminCrew.tsx"), "utf8");

  it("draws updatedAt through the page's own formatter, not a fourth copy", () => {
    /* Three hand-rolled formatters is how one 24-hour fix reached one of them
       (#415's residue, recorded in `shortDate`'s docblock). */
    expect(stamp).toContain("shortDate(stateQuery.data.briefing.updatedAt)");
  });

  it("keeps the author, which is the half #415 deliberately left here", () => {
    expect(stamp).toContain("Briefing edition {stateQuery.data.briefing.edition}");
    expect(stamp).toContain("briefing.shift");
  });
});
