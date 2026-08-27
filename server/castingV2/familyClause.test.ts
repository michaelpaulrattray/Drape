/**
 * THE FAMILY CLAUSE (#154) — the paragraph code writes from a follow's anchor
 * and the chip edits so the author road can carry them.
 *
 * Two kinds of arm. The PHRASING arms assert the sentence at the byte. The
 * VOCABULARY sweep drives every value the closed vocabularies can put into a
 * clause through `neverWrittenIn` and `containsHouseSentence` — the author's
 * own refusals — because a clause is code's paragraph and is never re-asked:
 * a forbidden word here would reach the engine on every follow, unrefused.
 * The sweep has a positive control (a clause forced to say "eight" is caught),
 * so a green run means the reader was looking.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { agePhrase, familyClause } from "./familyClause";
import { neverWrittenIn } from "./promptAuthor";
import { containsHouseSentence } from "./houseBlock";
import type { FollowAnchor } from "./cohortPhotorealHuman";
import {
  AGE_BANDS,
  AGE_PHASES,
  ARCHETYPE_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "./castingIntent";
import { HAIR_COLOURS } from "../../shared/castingVocabularies";

const ANCHOR: FollowAnchor = {
  sex: "female",
  ageBand: "30s",
  heritage: [{ heritage: "Nordic", pct: 100 }],
  hair: { family: "long", colour: "blonde" },
  look: "severe minimal",
  realized: {
    eyeColour: "blue",
    hairStyle: { name: "low bun", family: "long", worn: "worn up" },
    facialHair: null,
    hairTexture: "straight",
    hairModifiers: null,
    wornState: "worn up",
    browStyle: "feathered",
    skinCharacter: "plain",
  } as never,
};

describe("phrasing", () => {
  it("no anchor is no clause at all — a chip edit without a follow rewrites the brief instead (#164)", () => {
    expect(familyClause({ anchor: null, overrides: undefined })).toBeNull();
    expect(familyClause({ anchor: null, overrides: {} })).toBeNull();
    expect(familyClause({ anchor: null, overrides: { ageBand: undefined } })).toBeNull();
    /* The override paragraph is dead: an anchor-less edit lands in the brief itself (`briefRewrite.test.ts`). */
    expect(familyClause({ anchor: null, overrides: { sex: "male", ageBand: "50s" } })).toBeNull();
  });

  it("a FOLLOW casts a ROLE family (#166): same brief, new person — holds the booking axes, releases the face", () => {
    const carried = familyClause({ anchor: ANCHOR, overrides: undefined });
    expect(carried).toEqual({
      follow: true,
      overrides: {},
      clause:
        "Continue this family: same casting brief, new person — a woman, in their 30s, of Nordic heritage, blonde hair, with a severe minimal look. "
        + "Keep the same sex, age range, heritage, hair-colour family and grooming world. "
        + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
        + "Cast a different person who could be booked for the same role.",
    });
    for (const fineDetail of ["low bun", "blue", "feathered", "straight", "worn up", "plain"]) {
      expect(carried?.clause).not.toContain(fineDetail);
    }
  });

  it("a blended heritage reads through the house composer's own renderer (law 4: one phrasebook)", () => {
    const carried = familyClause({
      anchor: { ...ANCHOR, heritage: [{ heritage: "East Asian", pct: 60 }, { heritage: "Slavic", pct: 40 }] },
      overrides: undefined,
    });
    expect(carried?.clause).toContain("of mostly East Asian heritage with Slavic features");
  });

  it("an UNLOCK on a follow strips the axis — the anchor arrives with `withUnlocksApplied` already run", () => {
    const unlockedSex = familyClause({ anchor: { ...ANCHOR, sex: null }, overrides: undefined });
    expect(unlockedSex?.clause).toBe(
      "Continue this family: same casting brief, new person — a person, in their 30s, of Nordic heritage, blonde hair, with a severe minimal look. "
        + "Keep the same age range, heritage, hair-colour family and grooming world. "
        + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
        + "Cast a different person who could be booked for the same role.",
    );
    expect(unlockedSex?.clause).not.toContain("woman");
    expect(unlockedSex?.clause).not.toContain("same sex");

    const everything = familyClause({ anchor: { ...ANCHOR, sex: null, ageBand: null, heritage: [], hair: null, look: null }, overrides: undefined });
    /* Still a follow, so the engine is still told to continue the family — with nothing held, the release sentences stand alone. */
    expect(everything?.clause).toBe(
      "Continue this family: same casting brief, new person — a person. "
        + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
        + "Cast a different person who could be booked for the same role.",
    );
  });

  it("an OVERRIDE on a follow REPLACES that axis in the family clause — and NEVER carries a precedence sentence (#164)", () => {
    const carried = familyClause({ anchor: ANCHOR, overrides: { ageBand: "40s", agePhase: "late", heritage: "West African" } });
    expect(carried?.follow).toBe(true);
    expect(carried?.overrides).toEqual({ ageBand: "40s", agePhase: "late", heritage: "West African" });
    expect(carried?.clause).toContain("a woman, in their late 40s, of West African heritage, blonde hair, with a severe minimal look.");
    expect(carried?.clause).not.toContain("30s");
    expect(carried?.clause).not.toContain("Nordic");
    /*
      The brief itself now states the new value (`rewriteBrief`), so the
      clause and the brief agree and there is nothing to tie-break — an
      edited follow ends exactly like a plain one.
    */
    expect(carried?.clause.endsWith("booked for the same role.")).toBe(true);
    expect(familyClause({ anchor: ANCHOR, overrides: undefined })?.clause.endsWith("booked for the same role.")).toBe(true);
  });

  it("a phase-only override rides only beside a band the anchor supplies", () => {
    expect(familyClause({ anchor: null, overrides: { agePhase: "late" } })).toBeNull();
    /* Beside a band — from the anchor — the phase rides. */
    expect(familyClause({ anchor: ANCHOR, overrides: { agePhase: "late" } })?.clause).toContain("in their late 30s");
  });

  it("age reads the way a person says it", () => {
    expect(agePhrase("teens", null)).toBe("in their teens");
    expect(agePhrase("teens", "late")).toBe("in their late teens");
    expect(agePhrase("70s+", null)).toBe("in their seventies or older");
    expect(agePhrase("20s", "early")).toBe("in their early 20s");
  });
});

describe("vocabulary sweep — nothing the closed vocabularies can produce is a word this studio never sends", () => {
  const clauses: string[] = [];
  for (const sex of [...SEXES, null]) {
    for (const ageBand of [...AGE_BANDS, null]) {
      for (const heritage of [...HERITAGES, null]) {
        const anchor: FollowAnchor = {
          ...ANCHOR,
          sex,
          ageBand,
          heritage: heritage ? [{ heritage, pct: 100 }] : [],
        };
        const clause = familyClause({ anchor, overrides: undefined })?.clause;
        if (clause) clauses.push(clause);
      }
    }
  }
  for (const colour of HAIR_COLOURS) {
    for (const look of [...LOOK_KEYS, null]) {
      const clause = familyClause({ anchor: { ...ANCHOR, hair: { family: "long", colour }, look }, overrides: undefined })?.clause;
      if (clause) clauses.push(clause);
    }
  }
  /* Overrides reach a clause only on a FOLLOW now (#164) — swept on the anchor. */
  for (const build of BUILDS) {
    for (const energy of ENERGY_KEYS) {
      for (const archetype of ARCHETYPE_KEYS) {
        for (const agePhase of AGE_PHASES) {
          const clause = familyClause({ anchor: ANCHOR, overrides: { build, energy, archetype, agePhase, ageBand: "30s" } })?.clause;
          if (clause) clauses.push(clause);
        }
      }
    }
  }

  it("covers a real population", () => {
    expect(clauses.length).toBeGreaterThan(500);
  });

  it("never a NEVER_WRITTEN word or phrase, in any clause", () => {
    const offenders = clauses.filter((clause) => neverWrittenIn(clause) !== null);
    expect(offenders).toEqual([]);
  });

  it("never a house sentence — the block is appended by code and nothing may compete with it", () => {
    const offenders = clauses.filter((clause) => containsHouseSentence(clause) !== null);
    expect(offenders).toEqual([]);
  });

  it("positive control: the reader catches a clause that counts the casts", () => {
    expect(neverWrittenIn(`${clauses[0]} Paint eight of them.`)).toBe("eight");
  });

  /*
    THE CLONE-STAMP WORDS (#166, founder verbatim: "Image models read 'close
    relative' as same skull, slight remix"). Forbidden in any clause the
    closed vocabularies can produce, with a positive control so a green run
    means the reader was looking.
  */
  const CLONE_STAMPS: RegExp[] = [
    /\bclose relative\b/i,
    /\brelatives?\b/i,
    /\bdiffer mainly in expression\b/i,
    /\bfamily of one person\b/i,
    /* #164: the tie-breaker is dead — a clause describing a fight inside the prompt is the defect itself. */
    /\bthis wins\b/i,
    /\bdiffers from the request above\b/i,
  ];
  it("never a clone-stamp phrase, in any clause (#166)", () => {
    const offenders = clauses.filter((clause) => CLONE_STAMPS.some((re) => re.test(clause)));
    expect(offenders).toEqual([]);
  });

  it("positive control: the clone-stamp reader catches the old clause's own words", () => {
    const oldShape = "Continue this family: cast a close relative of one person — a woman.";
    expect(CLONE_STAMPS.some((re) => re.test(oldShape))).toBe(true);
    expect(CLONE_STAMPS.some((re) => re.test("the eight will differ mainly in expression"))).toBe(true);
    expect(CLONE_STAMPS.some((re) => re.test("where this differs from the request above, this wins."))).toBe(true);
  });

  it("the sheet no longer renders the expression-only line (#166: 'Kill that line on Follow sheets')", () => {
    const sheet = readFileSync(join(__dirname, "../../client/src/pages/CastingSheet.tsx"), "utf8");
    /* Positive control that this arm read the real sheet, not an empty path. */
    expect(sheet).toContain("THE PROMPT, SHOWN");
    expect(sheet).not.toContain("differ mainly in expression");
    expect(sheet).not.toContain("close relative");
  });
});
