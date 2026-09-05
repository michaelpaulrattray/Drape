/**
 * THE FOLLOW CLAUSE (#177 Row A) — the fixed paragraph code writes for an
 * anchored follow, superseding the #154/#166 axis clause.
 *
 * The clause is one constant now, so the sweep population is one clause — but
 * every reader still gets a POSITIVE control, because a green run of a reader
 * that cannot fail proves nothing (working law 2). The byte-pin arm is the
 * point: a clause is code's paragraph and is never re-asked, so a drifted
 * word here would reach the engine on every follow, unrefused.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FOLLOW_ANCHOR_CLAUSE, agePhrase, followClause } from "./familyClause";
import { neverWrittenIn } from "./promptAuthor";
import { containsHouseSentence, HOUSE_BLOCK_SENTENCES } from "./houseBlock";

describe("the Row A clause", () => {
  it("is his courted hand-test sentence, byte for byte (#177 court, arm A, minus its inline brief head)", () => {
    expect(FOLLOW_ANCHOR_CLAUSE).toBe(
      "Same casting brief as the attached look, new person: keep the same sex, age range, heritage, and hair-colour family. "
        + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression.",
    );
  });

  it("carries no axis value, no record word and no override — facts change at the roll, never at the follow", () => {
    const carried = followClause();
    expect(carried).toEqual({ follow: true, overrides: {}, clause: FOLLOW_ANCHOR_CLAUSE });
    /* The #176 ghost's channel is gone: nothing a dice record could say has anywhere to land. */
    for (const recordWord of ["South Asian", "Nordic", "woman", "man", "30s", "blonde", "low bun", "severe minimal"]) {
      expect(carried.clause).not.toContain(recordWord);
    }
  });

  it("never a NEVER_WRITTEN word or phrase", () => {
    expect(neverWrittenIn(FOLLOW_ANCHOR_CLAUSE)).toBeNull();
  });

  it("positive control: the reader catches a clause that counts the casts", () => {
    expect(neverWrittenIn(`${FOLLOW_ANCHOR_CLAUSE} Paint eight of them.`)).toBe("eight");
  });

  it("never a house sentence — the block is appended by code and nothing may compete with it", () => {
    expect(containsHouseSentence(FOLLOW_ANCHOR_CLAUSE)).toBeNull();
  });

  it("positive control: the house reader catches a real block sentence", () => {
    const [sentence] = HOUSE_BLOCK_SENTENCES;
    expect(sentence).toBeTruthy();
    expect(containsHouseSentence(`${FOLLOW_ANCHOR_CLAUSE} ${sentence}`)).toBe(sentence);
  });

  /*
    THE CLONE-STAMP WORDS (#166, founder verbatim: "Image models read 'close
    relative' as same skull, slight remix") — still forbidden, with the old
    clause shapes as positive controls so the reader is proven looking.
  */
  const CLONE_STAMPS: RegExp[] = [
    /\bclose relative\b/i,
    /\brelatives?\b/i,
    /\bdiffer mainly in expression\b/i,
    /\bfamily of one person\b/i,
    /\bthis wins\b/i,
    /\bdiffers from the request above\b/i,
  ];
  it("never a clone-stamp phrase (#166)", () => {
    expect(CLONE_STAMPS.some((re) => re.test(FOLLOW_ANCHOR_CLAUSE))).toBe(false);
  });

  it("positive control: the clone-stamp reader catches the old clause's own words", () => {
    const oldShape = "Continue this family: cast a close relative of one person — a woman.";
    expect(CLONE_STAMPS.some((re) => re.test(oldShape))).toBe(true);
    expect(CLONE_STAMPS.some((re) => re.test("the eight will differ mainly in expression"))).toBe(true);
    expect(CLONE_STAMPS.some((re) => re.test("where this differs from the request above, this wins."))).toBe(true);
  });

  it("the sheet no longer renders the expression-only line (#166: 'Kill that line on Follow sheets')", () => {
    const sheet = readFileSync(join(__dirname, "../../client/src/pages/CastingSheet.tsx"), "utf8");
    /* Positive control that this arm read the real sheet, not an empty path (#534 renamed the block). */
    expect(sheet).toContain("THE BRIEF, SHOWN");
    expect(sheet).not.toContain("differ mainly in expression");
    expect(sheet).not.toContain("close relative");
  });
});

describe("agePhrase — kept for briefRewrite's chip-edited age", () => {
  it("age reads the way a person says it", () => {
    expect(agePhrase("teens", null)).toBe("in their teens");
    expect(agePhrase("teens", "late")).toBe("in their late teens");
    expect(agePhrase("70s+", null)).toBe("in their seventies or older");
    expect(agePhrase("20s", "early")).toBe("in their early 20s");
  });
});
