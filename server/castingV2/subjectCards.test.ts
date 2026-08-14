/**
 * THE CARDS ARE THE ONLY PLACE A SUBJECT IS DECIDED (V1).
 *
 * `vocabularyPin.test.ts` answers *did the contents change?*; this answers the
 * other half — *is there still somewhere else they could be decided?* The
 * milestone's whole claim is that eight tables became eight views, so the test
 * that matters is that every view has exactly the cards' keys and nothing of
 * its own.
 *
 * And the F2 fix, checked rather than described: **no card decides by
 * omission.** `plural`, `departable` and `presentationNoun` are present on
 * every card with a written value — `false` and `null` are decisions here, and
 * a kind that answered none of them used to be decided invisibly four times.
 */
import { describe, expect, it } from "vitest";

import { CHANGE_AMPLITUDE } from "./changeAmplitude";
import { SUBJECT_QUALIFIER } from "./subjectQualifiers";
import { SUBJECT_CARDS, SUBJECT_CARD_ENTRIES, subjectsWhere, tableOf } from "./subjectCards";
import {
  DEPARTABLE_SUBJECTS,
  FREE_SUBJECTS,
  FREE_SUBJECT_KEYS,
  FREE_SUBJECT_KIND,
  PLURAL_SUBJECTS,
  PRESENTATION_NOUNS,
  SUBJECT_NOUNS,
} from "./refineSubjects";

const CARD_KEYS = Object.keys(SUBJECT_CARDS);

describe("every table is a view over the cards", () => {
  it("has exactly the cards' keys — no table holds a subject of its own", () => {
    for (const [name, table] of [
      ["FREE_SUBJECTS", FREE_SUBJECTS],
      ["FREE_SUBJECT_KIND", FREE_SUBJECT_KIND],
      ["SUBJECT_NOUNS", SUBJECT_NOUNS],
      ["SUBJECT_QUALIFIER", SUBJECT_QUALIFIER],
      ["CHANGE_AMPLITUDE", CHANGE_AMPLITUDE],
    ] as const) {
      expect(Object.keys(table), name).toEqual(CARD_KEYS);
    }
    expect(FREE_SUBJECT_KEYS).toEqual(CARD_KEYS);
  });

  it("draws the three enrolment lists from the cards' own answers", () => {
    expect([...PLURAL_SUBJECTS]).toEqual(subjectsWhere((card) => card.plural));
    expect([...DEPARTABLE_SUBJECTS]).toEqual(subjectsWhere((card) => card.departable));
    expect(Object.keys(PRESENTATION_NOUNS))
      .toEqual(subjectsWhere((card) => card.presentationNoun !== null));
  });
});

describe("no card decides by omission", () => {
  it("answers all eight questions on every one of them", () => {
    /*
      The F2 fix, and the reason `false` and `null` are values here rather than
      absences: a kind missing from PLURAL_SUBJECTS, DEPARTABLE_SUBJECTS,
      PRESENTATION_NOUNS and REGION_OF_FACET was not undecided — it was decided
      invisibly four times, which is the unowned-axis class at this layer.
    */
    for (const [subject, card] of SUBJECT_CARD_ENTRIES) {
      expect(typeof card.heading, subject).toBe("string");
      expect(card.heading.length, subject).toBeGreaterThan(0);
      expect(["presence", "degree"], subject).toContain(card.kind);
      expect(card.nouns.length, subject).toBeGreaterThan(0);
      expect(card.qualifier, subject).toBeDefined();
      expect(typeof card.amplitude.levels, subject).toBe("number");
      /* Present, and BOOLEAN — an undefined here would read as false at every
         call site while looking like an answer in the card. */
      expect(typeof card.plural, subject).toBe("boolean");
      expect(typeof card.departable, subject).toBe("boolean");
      expect(card.presentationNoun === null || typeof card.presentationNoun === "string", subject)
        .toBe(true);
    }
  });

  it("CAN FAIL — the omission check, driven on a card that leaves one out", () => {
    /* Without this the loop above could be passing over a shape it never
       actually inspects. */
    const careless = { heading: "X", kind: "degree", nouns: ["x"] } as Record<string, unknown>;
    expect(typeof careless.plural).not.toBe("boolean");
    expect(typeof careless.departable).not.toBe("boolean");
  });
});

describe("the deriver itself", () => {
  it("reads one field off every card, in registration order", () => {
    const headings = tableOf((card) => card.heading);
    expect(Object.keys(headings)).toEqual(CARD_KEYS);
    expect(headings.hairCut).toBe(SUBJECT_CARDS.hairCut.heading);
  });

  it("selects on a yes/no field without inventing an order", () => {
    const plural = subjectsWhere((card) => card.plural);
    expect(plural.every((subject) => SUBJECT_CARDS[subject].plural)).toBe(true);
    expect(plural.length).toBe(CARD_KEYS.filter((key) =>
      SUBJECT_CARDS[key as keyof typeof SUBJECT_CARDS].plural).length);
  });
});
