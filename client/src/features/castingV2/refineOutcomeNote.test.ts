import { describe, expect, it } from "vitest";

import { refineOutcomeNote } from "./refineOutcomeNote";

/**
 * The reader that was the wall.
 *
 * These are cheap and the reason they exist is not: the rule they encode was
 * written on the SERVER, ruled twice (D-181, fable-386 §2), composed into every
 * likeness result that has ever been delivered — and thrown away here, by one
 * `kind === "selected"` in the only line that read the field. A rule that reads
 * a field its reader drops is inert on arrival, and nothing in a green suite
 * says so, because both halves were individually correct.
 */
describe("which refine outcomes get to say something", () => {
  it("says a PAID outcome's note — the half that had never reached a screen", () => {
    expect(refineOutcomeNote({
      kind: "rendered",
      note: "This photograph is framed from the mid-torso up, so her waist is not in it.",
    })).toContain("her waist is not in it");
  });

  it("still says a FREE outcome's note (D-163 rule 4)", () => {
    expect(refineOutcomeNote({
      kind: "selected",
      note: "Left her as she is — nothing was charged.",
    })).toBe("Left her as she is — nothing was charged.");
  });

  it("says nothing when the outcome carries no note", () => {
    /* The negative control. A reader that answered every outcome with a
       sentence would put a grey line under a picture that is simply the
       picture they asked for. */
    expect(refineOutcomeNote({ kind: "rendered" })).toBeNull();
    expect(refineOutcomeNote({ kind: "selected", note: "   " })).toBeNull();
    expect(refineOutcomeNote(null)).toBeNull();
    expect(refineOutcomeNote(undefined)).toBeNull();
  });

  it("yields to a question, because the question IS the line (D-180)", () => {
    expect(refineOutcomeNote({ kind: "asked", note: "ignored" })).toBeNull();
  });

  it("does not decide on `kind`, so the next confession inherits the rule", () => {
    /* The point of the whole module: an outcome kind this file has never heard
       of, carrying a note, is said. That is what makes the defect above
       un-repeatable rather than merely fixed. */
    expect(refineOutcomeNote({ note: "something happened" } as { note: string }))
      .toBe("something happened");
  });
});
