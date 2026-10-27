import { describe, expect, it } from "vitest";

import {
  SUBJECT_QUALIFIER,
  TEETH,
  exemptSubjects,
  qualifierFor,
} from "./subjectQualifiers";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";
import { repaintAsksFor } from "./repaintAsks";
import { assembleRecipe } from "./recipeAssembler";

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

/*
  ⚠ WHERE THESE CLAUSES ACTUALLY GO, PINNED SO THE HEADER CANNOT GO QUIET AGAIN
  (#2596).

  The module's header says, with a court behind it, that no qualifier reaches an
  engine: the road that renders is `repaintAsksFor` -> `assembleRecipe`, and
  neither names this table. That fact went unnoticed for about two months
  because nothing anywhere asserted it — the suite above proves every subject is
  ARMED and nothing proved the arming was connected to anything.

  **This is a DECISION PIN, not a wall.** If a later card wires the floor into
  the repaint road, this arm is supposed to turn red: read #2596's court first
  (wardrobe and marks both measured no effect, and the bare clause delivered
  18 of 18 at the frames), state the reason the court does not cover, derive the
  clause FROM this table rather than copying it (law 4), and then delete this
  arm in the same commit as the header paragraph it guards.
*/
describe("the floor and the road that renders (#2596)", () => {
  /* Stands in for `EDIT_PROSE` with recognisably different text, so an arm
     cannot pass by accidentally reproducing production prose. Importing the
     real one would pull `refineService` into a leaf suite. */
  const prose = {
    eyeColour: (value: string) => `iris prose for ${value}`,
    eyeShape: (value: string) => `shape prose for ${value}`,
    hairStyle: (value: string) => `a ${value} (family)`,
    hairColour: (value: string) => `colour prose for ${value}`,
    hairTexture: (value: string) => `texture prose for ${value}`,
  } as unknown as Parameters<typeof repaintAsksFor>[0]["prose"];

  const promptFor = (words: string): string => {
    const asks = repaintAsksFor({
      delta: { free: { marks: [words] } } as never,
      prose,
      pronouns: { subject: "they", object: "them", possessive: "their", plural: true },
    });
    if (!asks.ok) throw new Error(`expected asks, got ${asks.reason}`);
    const recipe = assembleRecipe({
      master: { key: "casting-v2/candidates/pin.png" },
      pronouns: { subject: "they", object: "them", possessive: "their", plural: true },
      library: [],
      asks: asks.asks,
      ...(asks.presentation ? { presentation: asks.presentation } : {}),
    });
    if (!recipe.ok) throw new Error(`the assembler refused: ${recipe.reason}`);
    return recipe.prompt;
  };

  it("sends the customer's words bare — the delivery floor is not in the dispatched prompt", () => {
    const sent = promptFor("freckles across the nose and cheeks");
    /* THE POSITIVE CONTROL, and it is deliberately NOT keyed on the sentence
       ENDING here: an arm that demanded the full stop would redden on its own
       control the moment anything were appended, and the failure would read as
       "the ask went missing" rather than as "the floor arrived". So this proves
       the prompt is real and carries the ask, and the next line alone carries
       the finding. */
    expect(sent).toContain("Change only their skin: freckles across the nose and cheeks");
    expect(sent, "THE FLOOR NOW REACHES THE ENGINE — read the pin above before changing this")
      .not.toContain(TEETH);
  });

  it("is not merely missing the floor — the whole marks qualifier is absent", () => {
    /* Keyed on the class's own `describe` wording as well as the shared floor,
       so a change that drops `TEETH` while keeping per-class prose does not
       read as compliance. */
    const sent = promptFor("a beauty mark on the left cheek");
    expect(sent).toContain("Change only their skin: a beauty mark on the left cheek");
    expect(sent, "the marks qualifier now reaches the engine").not.toContain(qualifierFor("marks"));
    expect(sent, "the marks `describe` wording now reaches the engine")
      .not.toContain("following the form of the face rather than painted flat");
  });

  it("the bare clause really does end there — nothing is appended after the words", () => {
    /* The other half of the control above: with the full stop checked in its
       own arm, a prompt that grew a tail is still caught, and it is caught by
       an assertion whose name says what happened. */
    expect(promptFor("freckles across the nose and cheeks"))
      .toContain("Change only their skin: freckles across the nose and cheeks.");
  });
});
