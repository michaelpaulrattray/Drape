import { describe, expect, it } from "vitest";

import {
  SUBJECT_QUALIFIER,
  TEETH,
  exemptSubjects,
  qualifierFor,
} from "./subjectQualifiers";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";

/*
  THE TABLE IS DERIVED, AND THIS IS THE HALF THE COMPILER CANNOT DO.

  `Record<FreeSubject, …>` already refuses to build when a new subject has no
  entry. It says nothing about an entry left behind by a subject that was
  renamed or removed, and nothing about an entry that exists but promises
  nothing — which is precisely the state nineteen of these were in.
*/
describe("every subject is armed, and the map cannot drift from the vocabulary", () => {
  it("covers the subject vocabulary exactly, from both directions", () => {
    expect(Object.keys(SUBJECT_QUALIFIER).sort()).toEqual([...FREE_SUBJECT_KEYS].sort());
  });

  it("gives every non-exempt subject the floor", () => {
    /*
      The defect, stated as a test: `marks` used to return "" and the whole
      instruction was `MARKS: a beauty mark, freckles.` Measured — the bare
      clause moved 17.6% of her face skin at freckle amplitude against the
      qualified clause's 26.1%, and the reader called the bare one absent twice
      on the founder's walk.
    */
    const exempt = new Set(exemptSubjects().map((entry) => entry.subject));
    for (const subject of FREE_SUBJECT_KEYS) {
      if (exempt.has(subject)) continue;
      expect(qualifierFor(subject), `${subject} is unarmed`).toContain(TEETH);
    }
  });

  it("says whose face it is, and that failing to appear is a failure", () => {
    /* The two promises the accessory clause made and the other twenty-two did
       not. Asserted on the FLOOR itself, so tuning a class's own wording can
       never quietly weaken them. */
    expect(TEETH).toMatch(/this person's own face/);
    expect(TEETH).toMatch(/does not appear at all is a failed render/);
  });

  it("enforces EXISTENCE and never PROMINENCE — anywhere in the table", () => {
    /*
      FOUNDER RULING, 2026-08-07, and it caught this module's own first version.

      The floor shipped saying "plainly visible at a normal viewing distance"
      and `marks` said "dense enough to read as theirs". Both are amplitude
      instructions, and they collide with the user's own adjective: someone
      asking for LIGHT freckles would have had the qualifier arguing against
      her, and either got a render inflated past her ask or — if the render was
      honest — a reader that could not see it. Her words are the spec; the floor
      may insist a thing is there and may not decide how much of it there is.

      Swept across every entry, not just the two that were caught, because the
      next qualifier someone tunes is the one that reintroduces it.
    */
    /*
      Phrases that PUSH, not words that merely mention strength — the first
      version of this listed `strong(ly)?` and fired on the floor's own
      "neither weaker nor stronger", which is the clause FORBIDDING amplitude.
      A guard built against a property the thing is correct not to have is this
      program's most repeated instrument error; it deserved to happen once more
      in the test that exists to prevent the original.
    */
    const PUSHES_AMPLITUDE = /plainly visible|clearly visible|prominent|unmistakable|striking\b|\bbold\b|dense enough|obvious|heavil|dramatic|pronounced|at a normal viewing distance|as (strong|dark|bright) as/i;
    expect(TEETH, "the floor pushes amplitude").not.toMatch(PUSHES_AMPLITUDE);
    for (const subject of FREE_SUBJECT_KEYS) {
      const entry = SUBJECT_QUALIFIER[subject];
      if ("exempt" in entry) continue;
      expect(entry.describe, `${subject} pushes amplitude rather than existence`)
        .not.toMatch(PUSHES_AMPLITUDE);
    }
  });

  it("defers to the strength the user's own words describe", () => {
    /* The positive half of the same ruling: the floor must actively say the ask
       governs intensity, not merely avoid overriding it. */
    expect(TEETH).toMatch(/strength their own words describe/);
    expect(TEETH).toMatch(/neither weaker nor stronger/);
  });

  it("never states the teeth twice", () => {
    /* Two sentences of teeth read as nagging and dilute both. The accessory
       clause carried its own before the floor existed; keeping both would have
       been the mirror this table replaces. */
    for (const subject of FREE_SUBJECT_KEYS) {
      const entry = SUBJECT_QUALIFIER[subject];
      if ("exempt" in entry) continue;
      expect(entry.describe, `${subject} restates the floor`)
        .not.toMatch(/fails? to appear|plainly visible/i);
    }
  });

  it("makes every exemption state its reason", () => {
    /* A declared shortcut is engineering; one that falls through a default is
       what put nineteen classes in the dark. */
    for (const { subject, because } of exemptSubjects()) {
      expect(because.length, `${subject} is exempt without saying why`).toBeGreaterThan(20);
    }
  });

  it("keeps the exemption list SHORT and named", () => {
    /* Pinned, so widening it is a deliberate edit rather than a quiet habit. */
    expect(exemptSubjects().map((entry) => entry.subject)).toEqual(["ink"]);
  });

  it("reads as a clause continuing the sentence, never as a new one", () => {
    /* Callers append this straight after the items they listed, so a qualifier
       that forgot its leading comma would produce "freckles rendered on…". */
    const exempt = new Set(exemptSubjects().map((entry) => entry.subject));
    for (const subject of FREE_SUBJECT_KEYS) {
      if (exempt.has(subject)) continue;
      expect(qualifierFor(subject).startsWith(", "), `${subject} does not continue the clause`).toBe(true);
    }
  });
});

describe("the one that is exempt, and why it has to be", () => {
  it("gives ink nothing, because ink builds a clause per item", () => {
    expect(qualifierFor("ink" as FreeSubject)).toBe("");
    expect(exemptSubjects()[0]?.because).toMatch(/placement/i);
  });
});

describe("headings and qualifiers describe the same vocabulary", () => {
  it("has a heading for every qualifier", () => {
    /* Two tables over one vocabulary is a mirror unless something checks them
       against each other (law 4). */
    for (const subject of FREE_SUBJECT_KEYS) {
      expect(FREE_SUBJECTS[subject], `${subject} has no heading`).toBeTruthy();
    }
  });
});
