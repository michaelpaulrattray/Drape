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
  it("nothing to carry is no clause at all — a plain authored roll's prompt does not move", () => {
    expect(familyClause({ anchor: null, overrides: undefined })).toBeNull();
    expect(familyClause({ anchor: null, overrides: {} })).toBeNull();
    /* A null-valued override is not an edit (the compiler's own rule). */
    expect(familyClause({ anchor: null, overrides: { ageBand: undefined } })).toBeNull();
  });

  it("a FOLLOW carries sex, age, heritage, hair COLOUR and look — never the cut, never the realized axes (his answer 3)", () => {
    const carried = familyClause({ anchor: ANCHOR, overrides: undefined });
    expect(carried).toEqual({
      follow: true,
      overrides: {},
      clause:
        "Continue this family: cast a close relative of one person — a woman, in their 30s, of Nordic heritage, blonde hair, with a severe minimal look. "
        + "Same sex, same age, same heritage and same hair colour; the face itself is new.",
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
      "Continue this family: cast a close relative of one person — a person, in their 30s, of Nordic heritage, blonde hair, with a severe minimal look. "
        + "Same age, same heritage and same hair colour; the face itself is new.",
    );
    expect(unlockedSex?.clause).not.toContain("woman");
    expect(unlockedSex?.clause).not.toContain("same sex");

    const everything = familyClause({ anchor: { ...ANCHOR, sex: null, ageBand: null, heritage: [], hair: null, look: null }, overrides: undefined });
    /* Still a follow, so the engine is still told to continue the family — with nothing held. */
    expect(everything?.clause).toBe("Continue this family: cast a close relative of one person — a person. The face itself is new.");
  });

  it("an OVERRIDE on a follow REPLACES that axis in the family clause (hand adjustments run last, as on the house road)", () => {
    const carried = familyClause({ anchor: ANCHOR, overrides: { ageBand: "40s", agePhase: "late", heritage: "West African" } });
    expect(carried?.follow).toBe(true);
    expect(carried?.overrides).toEqual({ ageBand: "40s", agePhase: "late", heritage: "West African" });
    expect(carried?.clause).toContain("a woman, in their late 40s, of West African heritage, blonde hair, with a severe minimal look.");
    expect(carried?.clause).not.toContain("30s");
    expect(carried?.clause).not.toContain("Nordic");
    /* An override says it wins, because the verbatim brief above may still say the old value; a plain follow does not. */
    expect(carried?.clause.endsWith("the face itself is new. Where this differs from the request above, this wins.")).toBe(true);
    expect(familyClause({ anchor: ANCHOR, overrides: undefined })?.clause.endsWith("the face itself is new.")).toBe(true);
  });

  it("chip edits on a plain authored roll are ONE sentence — what the customer said with a control instead of the keyboard", () => {
    const carried = familyClause({
      anchor: null,
      overrides: { sex: "male", ageBand: "50s", build: "broad", energy: "grave", look: "quiet luxury", archetype: "screen presence" },
    });
    expect(carried).toEqual({
      follow: false,
      overrides: { sex: "male", ageBand: "50s", build: "broad", energy: "grave", look: "quiet luxury", archetype: "screen presence" },
      clause: "Cast as a man, in their 50s, broad build, with a quiet luxury look, a still, grave presence, cast in the screen presence direction; where this differs from the request above, this wins.",
    });
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
  for (const build of BUILDS) {
    for (const energy of ENERGY_KEYS) {
      for (const archetype of ARCHETYPE_KEYS) {
        for (const agePhase of AGE_PHASES) {
          const clause = familyClause({ anchor: null, overrides: { build, energy, archetype, agePhase, ageBand: "30s" } })?.clause;
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
});
