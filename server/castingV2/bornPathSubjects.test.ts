/**
 * WHICH SUBJECTS A BRANCH MAY BE ASKED ABOUT — the path condition (item 8,
 * `CASTING_V2_TWO_PATHS_DESIGN.md` §7.1, shape ruled fable-1455 Q1).
 *
 * `bornPathsServing` is the second axis on `admittedOn`'s question: that field
 * asks which ROAD has measured a subject, this one asks which PATH a cast can
 * be born on and still be asked it. The refusal §7.2 describes is DERIVED from
 * it rather than hand-placed, which is the whole of Q1's ruling.
 *
 * # What this file is really guarding, and it is not the vocabulary
 *
 * The subject list goes STRAIGHT INTO THE INTERPRETER PROMPT. So a card added
 * here is a sentence added to every text call this product makes, and this
 * program's own measurement is that **prompt context is not additive**: a
 * SUBSET of context raised the stage wall twice as often as its superset. A new
 * subject that reached every branch would therefore be a live behaviour change
 * on a feature whose flag exists to keep it dark.
 *
 * The arm that matters is the one that says an UNPATHED branch — every roll in
 * production, both columns NULL — composes the prompt that shipped, character
 * for character.
 */
import { describe, expect, it } from "vitest";

import { SUBJECT_CARDS, type SubjectCard } from "./subjectCards";
import { FREE_SUBJECT_KEYS, pathRefusedNounIn, subjectsServedOnPath } from "./refineSubjects";
import { refineParseSystemPrompt } from "./refineInterpreter";

/** The derived view Q1's condition asks for a can-fail control on. */
function servedFrom(cards: Record<string, SubjectCard>, path: string | null): string[] {
  if (path === "wardrobe") return Object.keys(cards);
  return Object.keys(cards).filter((key) => cards[key]!.bornPathsServing === "everyPath");
}

describe("the born path narrows the free lane", () => {
  it("serves the whole vocabulary on the WARDROBE path", () => {
    expect(subjectsServedOnPath("wardrobe")).toEqual(FREE_SUBJECT_KEYS);
    expect(subjectsServedOnPath("wardrobe")).toContain("wardrobe");
  });

  it("⚠ withholds the wardrobe subject on BASICS — she IS her basics", () => {
    const served = subjectsServedOnPath("basics");
    expect(served).not.toContain("wardrobe");
    /* And nothing else moved: exactly one subject is path-conditional today, so
       a second one arriving quietly would show up here as a count. */
    expect(served).toHaveLength(FREE_SUBJECT_KEYS.length - 1);
  });

  it("⚠ withholds it from an UNPATHED branch too, which is every roll in production", () => {
    /*
      THE DIRECTION THAT MATTERS. It reads naturally as *"a Basics cast cannot be
      asked this, so everybody else can"*, and that would put the wardrobe
      subject in front of every customer the day this landed — both roll columns
      are NULL on every production roll, which is `unpathed`, which is not the
      Wardrobe path. What opens it is BUYING a cast on that path.
    */
    for (const path of [null, undefined]) {
      expect(subjectsServedOnPath(path), String(path)).not.toContain("wardrobe");
    }
  });

  it("CAN FAIL — a card that misvalues the field changes the derived view, both ways", () => {
    /*
      fable-1455 Q1's condition: the new view carries its own can-fail control,
      driven in both directions. Without this, `bornPathsServing` could be
      ignored by the derivation entirely and every arm above would still pass on
      the strength of the one card that happens to be right.
    */
    const asEveryPath = { ...SUBJECT_CARDS, wardrobe: { ...SUBJECT_CARDS.wardrobe, bornPathsServing: "everyPath" } } as unknown as Record<string, SubjectCard>;
    expect(servedFrom(asEveryPath, null)).toContain("wardrobe");
    expect(servedFrom(SUBJECT_CARDS as unknown as Record<string, SubjectCard>, null))
      .not.toContain("wardrobe");

    const armAsWardrobeOnly = { ...SUBJECT_CARDS, arms: { ...SUBJECT_CARDS.arms, bornPathsServing: "wardrobeOnly" } } as unknown as Record<string, SubjectCard>;
    expect(servedFrom(armAsWardrobeOnly, "basics")).not.toContain("arms");
    expect(subjectsServedOnPath("basics")).toContain("arms");
  });
});

describe("§7.2's door — the noun she used, refused by the path she chose", () => {
  it("names the wardrobe noun in a Basics ask", () => {
    expect(pathRefusedNounIn("put him in a plain black tee", "basics"))
      .toEqual({ subject: "wardrobe", noun: "tee" });
    expect(pathRefusedNounIn("give her a long black coat", "basics")?.subject).toBe("wardrobe");
  });

  it("⚠ NEVER fires on an UNPATHED branch — which is every roll in production", () => {
    /*
      THE ARM THAT COST A RED SUITE TO LEARN, kept because the mistake is the
      natural one. `subjectsServedOnPath` withholds the wardrobe subject from
      `unpathed` as well as from `basics` — correctly, so the prompt stays
      byte-identical — and reusing that withholding as this door's condition
      turned *"put her in a long black coat"* into a Basics refusal for the
      entire customer base. `stageWallBackstop.test.ts`'s positive control was
      what went red.

      A path nobody chose is not a path that refuses.
    */
    for (const path of [null, undefined]) {
      expect(pathRefusedNounIn("put her in a long black coat", path), String(path)).toBeNull();
    }
  });

  it("never fires on the WARDROBE path — the subject is served there", () => {
    expect(pathRefusedNounIn("put him in a plain black tee", "wardrobe")).toBeNull();
  });

  it("says nothing about an ask that names no noun — the declared limit", () => {
    /* *"something smarter"* is a real ask and we genuinely cannot tell what it
       is, so it falls to the generic wall exactly as it does today. */
    expect(pathRefusedNounIn("put him in something smarter", "basics")).toBeNull();
  });

  it("does not fire on a word that merely CONTAINS a noun", () => {
    /* Single-word nouns are matched against the sentence's own words rather
       than as substrings, so `top` never matches `topaz`. */
    expect(pathRefusedNounIn("give her topaz eyes", "basics")).toBeNull();
  });
});

describe("⚠ the prompt an unpathed branch gets is the prompt that shipped", () => {
  for (const mode of ["classify", "edit"] as const) {
    it(`is byte-identical with no path, mode ${mode}`, () => {
      const shipped = refineParseSystemPrompt(mode);
      for (const path of [null, undefined, "basics" as const]) {
        expect(refineParseSystemPrompt(mode, { bornPath: path }), String(path)).toBe(shipped);
      }
      /* And the subject really is absent from it — an arm that only compared
         two prompts would pass if BOTH carried the subject. */
      expect(shipped).not.toContain(", wardrobe");
    });

    it(`names the wardrobe subject ONLY on the wardrobe path, mode ${mode}`, () => {
      const pathed = refineParseSystemPrompt(mode, { bornPath: "wardrobe" });
      expect(pathed).toContain(", wardrobe");
      expect(pathed).not.toBe(refineParseSystemPrompt(mode));
      /* One subject longer and otherwise the same prompt: a composed variant
         that had drifted from the shipped one in any other line would be a
         second prompt nobody measured. */
      expect(pathed.replace(", wardrobe", "")).toBe(refineParseSystemPrompt(mode));
    });
  }

  it("the open lane's flag and the path compose rather than replacing each other", () => {
    const open = refineParseSystemPrompt("edit", { openLane: true, bornPath: "wardrobe" });
    expect(open).toContain(", wardrobe");
    /* The open lane's own clause is still in it — the two flags are independent
       and a composed prompt that dropped one would be silent. */
    expect(open).not.toBe(refineParseSystemPrompt("edit", { bornPath: "wardrobe" }));
    expect(open.length).toBeGreaterThan(
      refineParseSystemPrompt("edit", { bornPath: "wardrobe" }).length,
    );
  });
});
