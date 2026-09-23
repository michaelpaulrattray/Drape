/**
 * WHICH SUBJECTS A BRANCH MAY BE ASKED ABOUT — one list, for everybody
 * (item 8, `CASTING_V2_TWO_PATHS_DESIGN.md` §7.1, shape ruled fable-1455 Q1;
 * collapsed off the path axis by #203 slice 2, 2026-09-24).
 *
 * `bornPathsServing` is the second axis on `admittedOn`'s question: that field
 * asks which ROAD has measured a subject, this one asked which PATH a cast
 * could be born on and still be asked it. ⚠ **The path half is retired and the
 * WITHHOLDING is not**: the one card that says `wardrobeOnly` is served to
 * nobody, exactly as it was served to nobody on every branch a customer could
 * reach before, and whether that should change is **#1148** — his call, because
 * it is a capability rather than a cleanup.
 *
 * # What this file is really guarding, and it is not the vocabulary
 *
 * The subject list goes STRAIGHT INTO THE INTERPRETER PROMPT. So a card added
 * here is a sentence added to every text call this product makes, and this
 * program's own measurement is that **prompt context is not additive**: a
 * SUBSET of context raised the stage wall twice as often as its superset. A new
 * subject reaching every branch is therefore a live behaviour change, and the
 * arm that matters is the one saying the prompt that ships names no subject
 * nothing serves.
 *
 * ⚠ **THE COLLAPSE'S OWN BAR WAS THE BYTES AND IT IS NOT PINNED HERE.** The
 * four precomputed prompts were hashed before and after and did not move a
 * character; the sha256s are recorded in
 * `docs/specs/TWO_PATHS_PREDICATES_2026-09-24.md`. A pinned hash would redden
 * on every honest edit to a prompt sentence, which teaches a reader to
 * re-stamp it instead of reading it — so what is guarded below is the property
 * the collapse could actually break, not the artifact of one afternoon.
 */
import { describe, expect, it } from "vitest";

import { SUBJECT_CARDS, type SubjectCard } from "./subjectCards";
import { FREE_SUBJECT_KEYS, SERVED_SUBJECTS } from "./refineSubjects";
import { interpretRefinement, refineParseSystemPrompt, refusalMessage } from "./refineInterpreter";
import type { TextEngine } from "../providers/types";
import { assembleRecipe } from "./recipeAssembler";
import { pronounsForSex } from "./castPronouns";
import type { WardrobeResolution } from "./wardrobeLine";

/** The derived view Q1's condition asks for a can-fail control on. */
function servedFrom(cards: Record<string, SubjectCard>): string[] {
  return Object.keys(cards).filter((key) => cards[key]!.bornPathsServing === "everyPath");
}

describe("the free lane is one list and the wardrobe subject is on nobody's", () => {
  it("⚠ withholds the wardrobe subject from EVERY branch", () => {
    /*
      THE DIRECTION THAT MATTERS, and it survives the collapse unchanged. While
      the paths existed this read naturally as *"a Basics cast cannot be asked
      this, so everybody else can"* — and that would have put the wardrobe
      subject in front of every customer, because every production roll is
      unpathed. There is no longer an "everybody else": there is one list, and
      this subject is not on it.
    */
    expect(SERVED_SUBJECTS).not.toContain("wardrobe");
    /* And nothing else moved: exactly one subject is withheld today, so a
       second one arriving quietly would show up here as a count. */
    expect(SERVED_SUBJECTS).toHaveLength(FREE_SUBJECT_KEYS.length - 1);
    /* Every other key is served — an arm that only checked the count would pass
       if one subject were swapped for another. */
    for (const key of FREE_SUBJECT_KEYS) {
      if (key === "wardrobe") continue;
      expect(SERVED_SUBJECTS, key).toContain(key);
    }
  });

  it("CAN FAIL — a card that misvalues the field changes the derived view, both ways", () => {
    /*
      fable-1455 Q1's condition: the derived view carries its own can-fail
      control, driven in both directions. Without this, `bornPathsServing` could
      be ignored by the derivation entirely and every arm above would still pass
      on the strength of the one card that happens to be right.
    */
    const asEveryPath = { ...SUBJECT_CARDS, wardrobe: { ...SUBJECT_CARDS.wardrobe, bornPathsServing: "everyPath" } } as unknown as Record<string, SubjectCard>;
    expect(servedFrom(asEveryPath)).toContain("wardrobe");
    expect(servedFrom(SUBJECT_CARDS as unknown as Record<string, SubjectCard>))
      .not.toContain("wardrobe");

    const armAsWardrobeOnly = { ...SUBJECT_CARDS, arms: { ...SUBJECT_CARDS.arms, bornPathsServing: "wardrobeOnly" } } as unknown as Record<string, SubjectCard>;
    expect(servedFrom(armAsWardrobeOnly)).not.toContain("arms");
    expect(SERVED_SUBJECTS).toContain("arms");
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

describe("⚠ there are FOUR interpreter prompts and none of them names a withheld subject", () => {
  /**
   * The whole reachable output of `refineParseSystemPrompt`: two modes by two
   * lane states. A fifth existed — composed on the spot for a branch born on
   * the Wardrobe path — and it is retired with the paths (#203 slice 2).
   */
  const FOUR = [
    { name: "classify · closed", prompt: refineParseSystemPrompt() },
    { name: "classify · open", prompt: refineParseSystemPrompt(undefined, { openLane: true }) },
    { name: "edit · closed", prompt: refineParseSystemPrompt("edit") },
    { name: "edit · open", prompt: refineParseSystemPrompt("edit", { openLane: true }) },
  ];

  it("⚠ no prompt offers the model a subject nothing serves", () => {
    /*
      THE ARM THE COLLAPSE IS PROVEN BY, and it is derived rather than spelling
      `wardrobe` once: any card moved to `wardrobeOnly` in future is caught by
      the same line. A subject the model is SHOWN is a subject it will use, and
      an invited ask the code then refuses is the worst of both.
    */
    const withheld = FREE_SUBJECT_KEYS.filter((key) => !SERVED_SUBJECTS.includes(key));
    expect(withheld, "the population this arm is about").toEqual(["wardrobe"]);
    for (const { name, prompt } of FOUR) {
      for (const key of withheld) expect(prompt, `${name} / ${key}`).not.toContain(`, ${key}`);
    }
  });

  it("⚠ CONTROL — the reading really can see a subject in the prompt", () => {
    /*
      Without this the arm above passes on a prompt that lists no subjects at
      all, or on a reading that looks in the wrong half of the string. Every
      SERVED subject must be findable by the same `, <key>` spelling the
      negative arm uses.
    */
    for (const { name, prompt } of FOUR) {
      for (const key of SERVED_SUBJECTS.slice(1)) {
        expect(prompt, `${name} / ${key}`).toContain(`, ${key}`);
      }
    }
  });

  it("the mode and the open lane are the only two things that move it", () => {
    const seen = new Set(FOUR.map((one) => one.prompt));
    expect(seen.size, "four prompts, four distinct strings").toBe(4);
    /* The open lane ADDS its clause rather than replacing the prompt: the two
       axes are independent and a variant that dropped the other would be
       silent. */
    expect(FOUR[1]!.prompt.length).toBeGreaterThan(FOUR[0]!.prompt.length);
    expect(FOUR[3]!.prompt.length).toBeGreaterThan(FOUR[2]!.prompt.length);
  });
});
