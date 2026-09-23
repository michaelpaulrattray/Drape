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
import { FREE_SUBJECT_KEYS, subjectsServedOnPath } from "./refineSubjects";
import { interpretRefinement, refineParseSystemPrompt, refusalMessage } from "./refineInterpreter";
import type { TextEngine } from "../providers/types";
import { assembleRecipe } from "./recipeAssembler";
import { pronounsForSex } from "./castPronouns";
import type { WardrobeResolution } from "./wardrobeLine";

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

/**
 * §7.2'S DOOR IS RETIRED (#203 slice 2), AND WHAT REPLACED ITS ARMS IS THE
 * QUESTION THEY WERE REALLY ASKING.
 *
 * Five arms drove `pathRefusedNounIn` directly. Four of them described the
 * door's own mechanics — which noun it matched, which it did not — and they die
 * with it. The fifth is the one that mattered, and it is not a fact about a
 * helper: **an outfit ask must never come back as a refusal about a path**,
 * because reusing the prompt question's WITHHOLDING as the refusal's condition
 * once turned *"put her in a long black coat"* into a Basics refusal for the
 * entire customer base.
 *
 * So it is asked at the entrance instead, through the real interpreter with a
 * scripted engine — which is where a customer's sentence actually arrives, and
 * is a place the deletion cannot rescue: if a path-flavoured refusal ever comes
 * back, on any branch, these go red.
 */
describe("an outfit ask is refused the same way on every branch", () => {
  const FACE = {
    currentEyeColour: "brown",
    currentEyeShape: "almond",
    currentHairColour: "dark brown",
    currentHairStyle: "long, worn down",
    currentHairTexture: "straight",
    currentMakeup: null,
  };

  /** An engine that claims the wall with the garment word she used. The
   *  lexicon BACKS `coat`, so the code answers deterministically and spends no
   *  second call — `stageWallBackstop.test.ts` pins that mechanism itself. */
  function claimsTheWall(): TextEngine {
    return {
      id: "scripted",
      async complete() {
        return {
          text: JSON.stringify({ wall: "stage", asked: "a coat" }),
          provenance: { provider: "openrouter" as const, model: "scripted" },
          latencyMs: 0,
        };
      },
    } as unknown as TextEngine;
  }

  const ASK = "put her in a long black coat";

  it("⚠ an UNPATHED branch — every roll in production — meets the ordinary wall", async () => {
    for (const wardrobe of [undefined, { kind: "unpathed" } as const]) {
      const parse = await interpretRefinement({
        instruction: ASK, engine: claimsTheWall(), ...FACE,
        ...(wardrobe ? { wardrobe } : {}),
      });
      expect(parse.ok, String(wardrobe)).toBe(false);
      expect(parse.ok === false && parse.refusal.reason, String(wardrobe)).toBe("wall_stage");
    }
  });

  it("⚠ and so does a BASICS branch — the one state that used to open the door", async () => {
    /*
      THE ARM THE DELETION IS PROVEN BY. `basics` is the state §7.2 existed for,
      and after the retirement it must be answered exactly like every other
      branch. Thirteen pathed rolls survive on production and not one of them
      holds a candidate, so no customer can reach this — the arm exists because
      the TYPE still admits it and a future reader should not have to guess
      whether the collapse covered it.
    */
    const parse = await interpretRefinement({
      instruction: ASK, engine: claimsTheWall(), ...FACE,
      wardrobe: { kind: "line", line: "bare chested, in plain black shorts", source: "born", path: "basics" },
    });
    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
  });

  it("and the sentence she reads never names a path she can no longer buy", async () => {
    const parse = await interpretRefinement({
      instruction: ASK, engine: claimsTheWall(), ...FACE,
      wardrobe: { kind: "line", line: "bare chested, in plain black shorts", source: "born", path: "basics" },
    });
    const said = parse.ok === false ? refusalMessage(parse) : "";
    expect(said.length).toBeGreaterThan(0);
    expect(said).not.toMatch(/Basics|Wardrobe/);
  });
});

describe("the recipe says the outfit only when the photograph disagrees with it", () => {
  const MASTER = { key: "casting-v2/candidates/master.png" };
  const SHE = pronounsForSex("female");
  const recipeWith = (wardrobe: WardrobeResolution | undefined, editsIt = false) => assembleRecipe({
    master: MASTER, pronouns: SHE, library: [],
    asks: [{ slot: "lips" as never, noun: "lips", words: "a soft nude lip gloss" }],
    ...(wardrobe ? { wardrobe } : {}),
    ...(editsIt ? { presentation: [{ noun: "wardrobe", words: "a plain black tee" }] } : {}),
  });
  /* THE WHOLE PROMPT, not the reference sentences alone: the ask clause is a
     separate field, and an arm reading half the prompt would pass by looking in
     the wrong half. */
  const said = (result: ReturnType<typeof assembleRecipe>) => (result.ok ? result.prompt : "");

  it("⚠ says an EDITED line — the master wears what she took off", () => {
    /*
      §2's finding is why this exists: `identityClause` names five nouns and
      clothing is not one, so a removal re-render turned a grey tee BLACK on the
      founder's own cast. Every render is anchored on the pristine master, so a
      branch that changed its outfit is a branch the photograph contradicts —
      and the preservation tail's "the same clothing" points AT that photograph.
    */
    const line = "a plain black tee, dark jeans, plain boots";
    expect(said(recipeWith({ kind: "line", line, source: "edited", path: "wardrobe" })))
      .toContain(line);
  });

  it("⚠ says NOTHING for a BORN line — the photograph already carries it", () => {
    /*
      The arm that keeps this from being free-looking-and-not. Prompt context is
      not additive in this product, measured, so a sentence restating what the
      master already shows is a cost with no purchase.
    */
    const line = "a rough hide wrap draped across one shoulder, bare feet";
    expect(said(recipeWith({ kind: "line", line, source: "born", path: "wardrobe" })))
      .not.toContain(line);
  });

  it("⚠ says nothing for UNPATHED or INCOHERENT — which is every render in production", () => {
    for (const wardrobe of [
      undefined,
      { kind: "unpathed" } as const,
      { kind: "incoherent", path: "basics" } as const,
    ]) {
      const sentences = said(recipeWith(wardrobe));
      expect(sentences, JSON.stringify(wardrobe)).not.toContain("is wearing");
    }
  });

  it("⚠ says nothing when THIS render is the one changing it", () => {
    /* Restating an outfit in the same prompt that changes it is the
       two-instructions-about-one-feature fault the assembler refuses
       everywhere else. */
    const line = "a charcoal roll-neck jumper";
    const sentences = said(recipeWith(
      { kind: "line", line, source: "edited", path: "wardrobe" }, true,
    ));
    expect(sentences).not.toContain(line);
    expect(sentences, "and the ask itself still rides").toContain("a plain black tee");
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
