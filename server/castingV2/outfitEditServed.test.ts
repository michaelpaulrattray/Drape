import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { acceptOpenKind } from "./openLaneAccept";
import {
  GARMENT_STAGE_WORDS, SCENERY_WORDS, readDelta, stageWordIn,
  type FreeLaneCheck,
} from "./refineDelta";
import {
  interpretRefinement, refineParseSystemPrompt, refusalMessage,
} from "./refineInterpreter";
import {
  SERVED_SUBJECTS, SERVED_SUBJECTS_WITH_WARDROBE, servedSubjectsFor,
} from "./refineSubjects";
import { SUBJECT_CARDS } from "./subjectCards";
import { validateCastingOutfitEditEnvironment } from "./castingV2Scope";

/**
 * CLOTHING IS AN EDITABLE SUBJECT IN REFINE — `CASTING_OUTFIT_EDIT_SCOPE`
 * (#2544 slice 1; design `docs/specs/OUTFIT_REFINE_DESIGN_2026-10-16.md`, PR
 * #2575, his GO on the card 2026-10-16).
 *
 * # What is actually at risk here, and it is not the capability
 *
 * The capability is one value made per-request. **The risk is the lexicon.**
 * `STAGE_WORDS` held two populations in one list — the shoot and the wardrobe —
 * and the whole of this slice is licensing ONE of them, under ONE subject, for
 * ONE account. The design says it plainly: *"the scenery half of this lexicon
 * is the only thing standing between an outfit edit and a paid edit that
 * repaints the room"*. So the arm that matters most is part 4 below, with the
 * flag ON, and it is the longest part of this file on purpose.
 *
 * # Three properties, in the order a reader should want them proved
 *
 *  1. **FLAG OFF IS TODAY, AT THE BYTES** (part 2). Not "we were careful": the
 *     two shipped prompts are re-hashed here against the sha256s recorded at
 *     `origin/main` `9622e69e` — the same two numbers `refineOpenLaneClause`
 *     holds — by a reader that does not import that file, so neither inherits
 *     the other's mistake. Flag-off is byte-identical by CONSTRUCTION
 *     (`SERVED_SUBJECTS` never moves and only the flag's own bit can select the
 *     other list), and this is the reading that says so.
 *  2. **SERVED, THE DOOR OPENS AND SAYS SO HONESTLY** (part 3): the subject is
 *     named, and the four prompt lines that called a garment the stage wall say
 *     the true thing instead — the relay's binding addition to the design,
 *     without which an outfit ask would route to `wall_stage` regardless.
 *  3. **SERVED, THE SCENERY HALF STILL REFUSES — AT ALL FIVE SITES** (part 4).
 *
 * # ⚠ THE SERVED PAIR'S HASHES ARE A CHANGE DETECTOR, NOT A BAR — SAID PLAINLY
 *
 * `refineOpenLaneClause.test.ts` is careful to record that its two hashes were
 * read BEFORE the cut they guard, because *"a control that re-records itself
 * marks its own homework"*. **The served pair has no before.** It did not exist
 * until this commit, so its numbers were necessarily read out of the very
 * function they pin — `refineParseSystemPrompt(mode, { outfitEdit: true })`,
 * hashed with the same `sha256` this file uses. What they buy is therefore
 * narrower and worth naming: from here on, an edit anywhere in the prompt body
 * that reaches the served pair cannot land silently. What they do NOT buy is
 * any assurance about what the served prompt should say — that is part 3's
 * arms, which read the sentences, and the shipped pair in part 2, which is a
 * real bar because it has a before.
 *
 * ⚠ **So if a deliberate prompt change moves them, the two lines below are
 * edited by hand after reading the diff — never by pasting whatever the
 * function now returns without looking at what moved.**
 *
 * The length deltas are equal on purpose and are asserted: the served pair
 * differs from the shipped pair only inside the base prompt, so if `classify`
 * and `edit` ever drift apart by different amounts, something has been added to
 * one mode and not the other.
 *
 * # Every absence arm here is preceded by a positive control
 *
 * The lesson #1150's sabotage drive paid for, and it bites hardest in part 4:
 * an arm asserting *"`backdrop` still refuses"* passes against a lexicon that
 * has lost every member, a reader that refuses everything, and a function that
 * throws nothing because it was never called. So each site proves it can also
 * FILE something before its refusals are believed.
 */

/** An engine that answers from a script and records what it was asked. */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)]!;
      index += 1;
      return { text: reply, provenance: { provider: "openrouter" as const, model: "scripted" }, latencyMs: 0 };
    },
  } as TextEngine & { seen: TextRequest[] };
}

const FACE = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "straight",
  currentMakeup: null,
};

/** The reply a model gives when it refuses on stage grounds, naming the word. */
const claimsStage = (asked: string) => JSON.stringify({ wall: "stage", asked });

/** The five words the design names for part 4, plus the whole derived half. */
const DESIGN_SCENERY = ["backdrop", "set", "prop", "chair", "holding"] as const;

/**
 * ⚠ THE POPULATION EVERY SITE IN PART 4 IS DRIVEN OVER, AND IT IS A UNION FOR A
 * MEASURED REASON.
 *
 * The first sabotage drive of this file moved `backdrop` INTO the garment half
 * and four arms reddened — but **site 2's scenery loop stayed green**, because
 * it iterated the derived `SCENERY_WORDS` and `backdrop` had just left it. A
 * derived population is exactly right for catching a word that quietly
 * disappears from the lexicon and **blind to one that moves between the
 * halves**, which is the likelier mistake here and the more dangerous one.
 *
 * So: the design's own five are the FLOOR, asserted as members below and driven
 * at every site whatever the halves say, and the derived half is the WIDENING.
 * Neither alone would have caught the sabotage at every site.
 */
const SCENERY_UNDER_TEST: readonly string[] =
  [...new Set<string>([...DESIGN_SCENERY, ...SCENERY_WORDS])];

describe("1 · the flag's grammar and its chain", () => {
  const ON = { scope: "users:1", castingScope: "users:1" };

  it("off, and ABSENT means off", () => {
    for (const scope of [undefined, "off"]) {
      expect(validateCastingOutfitEditEnvironment({ scope, castingScope: "all" }).kind).toBe("off");
    }
  });

  it("CONTROL — a well-formed value its parent covers is accepted", () => {
    /* Without this, every refusal arm below would pass against a validator that
       refused everything, including the positions production actually wants. */
    expect(validateCastingOutfitEditEnvironment(ON).kind).toBe("users");
    expect(validateCastingOutfitEditEnvironment({ scope: "all", castingScope: "all" }).kind)
      .toBe("all");
  });

  it("refuses a value that is not the scope grammar, naming the variable", () => {
    expect(() => validateCastingOutfitEditEnvironment({ scope: "yes", castingScope: "all" }))
      .toThrow(/CASTING_OUTFIT_EDIT_SCOPE/);
    expect(() => validateCastingOutfitEditEnvironment({ scope: "users:0", castingScope: "all" }))
      .toThrow(/CASTING_OUTFIT_EDIT_SCOPE/);
  });

  it("⚠ refuses to boot when it reaches past its parent — the chain, not a preference", () => {
    /* A child naming a user the parent does not serve would be a capability
       switched on for an account with no casting studio to use it in. */
    expect(() => validateCastingOutfitEditEnvironment({ scope: "users:1,2", castingScope: "users:1" }))
      .toThrow(/names users outside CASTING_V2_SCOPE: 2/);
    expect(() => validateCastingOutfitEditEnvironment({ scope: "all", castingScope: "users:1" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingOutfitEditEnvironment({ scope: "users:1", castingScope: "off" }))
      .toThrow(/there is no cast to dress/);
  });
});

describe("2 · ⚠ FLAG OFF IS TODAY, AT THE BYTES", () => {
  /*
    Read at `origin/main` `9622e69e` through the real function, before any of
    this slice existed — the same two numbers `refineOpenLaneClause.test.ts`
    holds, re-asserted by a reader that does not import it. Two readers of one
    fact, neither resolving through the other.
  */
  const SHIPPED = {
    classify: { sha: "5166fdbcbef357f66191aae5029ffd60d3da33339d5c7a06d78909000f794756", len: 12_990 },
    edit: { sha: "d938853edbc22068b696eab704ad0ae80849457583b3a3a58e103b7420e9cb57", len: 10_547 },
  } as const;

  const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

  for (const mode of ["classify", "edit"] as const) {
    it(`the ${mode} prompt an unserved request gets has not moved a character`, () => {
      const asked = mode === "classify" ? undefined : mode;
      /* All three roads to an unserved prompt: no options at all, the option
         absent, and the option explicitly false. A caller that has never heard
         of this flag is the commonest of the three. */
      for (const options of [undefined, {}, { outfitEdit: false }]) {
        const prompt = refineParseSystemPrompt(asked, options);
        expect(prompt.length, `${mode} length`).toBe(SHIPPED[mode].len);
        expect(sha(prompt), `${mode} sha256`).toBe(SHIPPED[mode].sha);
      }
    });
  }

  it("⚠ the served list is a SEPARATE constant and the shipped one never moved", () => {
    expect(SERVED_SUBJECTS).not.toContain("wardrobe");
    expect(SERVED_SUBJECTS_WITH_WARDROBE).toContain("wardrobe");
    /* Derived, not re-filtered: every other member is the same list in the same
       order, so the two cannot come to disagree about the other subjects. */
    expect(SERVED_SUBJECTS_WITH_WARDROBE.slice(0, -1)).toEqual([...SERVED_SUBJECTS]);
    expect(SERVED_SUBJECTS_WITH_WARDROBE).toHaveLength(SERVED_SUBJECTS.length + 1);
    /* And one function answers which list a request gets, for every reader. */
    expect(servedSubjectsFor(false)).toEqual([...SERVED_SUBJECTS]);
    expect(servedSubjectsFor(true)).toEqual([...SERVED_SUBJECTS_WITH_WARDROBE]);
  });

  it("⚠ unserved, a garment ask meets exactly the wall it has met since #203", async () => {
    const engine = scripted([claimsStage("a coat")]);
    const parse = await interpretRefinement({
      instruction: "put them in a long black coat", engine, ...FACE,
    });
    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    /* The lexicon backs `coat`, so the code answers deterministically and
       spends no second call — unchanged by this slice. */
    expect(engine.seen).toHaveLength(1);
  });

  it("and the sentence it reads is today's, word for word", async () => {
    const engine = scripted([claimsStage("a coat")]);
    const parse = await interpretRefinement({
      instruction: "put them in a long black coat", engine, ...FACE,
    });
    const said = parse.ok === false ? refusalMessage(parse) : "";
    expect(said).toContain("is a garment, a prop or the set, which comes after Sign");
    expect(said).toContain("Jewellery, glasses and piercings do work here");
    expect(said).toContain("Nothing was charged.");
    /* And not the served sentence, which would be a promise this account cannot
       keep — the defect this branch exists to prevent. */
    expect(said).not.toContain("Clothing, jewellery and glasses do work here");
  });
});

describe("3 · served, the door opens and the prompt says the true thing", () => {
  const servedPrompt = (mode?: "edit") => refineParseSystemPrompt(mode, { outfitEdit: true });

  it("names the wardrobe subject in the free lane's vocabulary", () => {
    expect(servedPrompt()).toContain("wardrobe");
    expect(servedPrompt("edit")).toContain("wardrobe");
  });

  it("⚠ none of the four lines still calls a garment the stage wall", () => {
    /*
      THE RELAY'S BINDING ADDITION TO THE DESIGN, verified at `origin/main`
      before his GO: opening the subject without these would route every outfit
      ask to `wall_stage` regardless of the flag. The CONTROL is the unserved
      prompt in the same assertion — these phrases must still be there, or this
      arm is passing because it is looking at nothing.
    */
    for (const mode of [undefined, "edit" as const]) {
      const shipped = refineParseSystemPrompt(mode);
      const served = servedPrompt(mode);
      for (const phrase of [
        "garments, headwear, the backdrop, props and the scene are the stage wall",
        "Only GARMENTS, HEADWEAR, the backdrop",
        'stage: garments, headwear, the backdrop, props, the scene',
      ]) {
        expect(shipped, `CONTROL ${String(mode)}: ${phrase}`).toContain(phrase);
        expect(served, `${String(mode)}: ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it("⚠ and says what IS still the stage in the same breath", () => {
    /* A half-corrected instruction invites the model to assume the set moved
       too, which is the one reading this slice cannot afford. */
    const served = servedPrompt();
    expect(served).toContain("AND CLOTHING IS THE PERSON TOO");
    expect(served).toContain("files under wardrobe in their own words");
    expect(served).toContain("are still the stage and still");
    expect(served).toContain("a garment against a red backdrop is still refused");
  });

  it("the served pair is pinned — a change detector from this commit on", () => {
    /*
      ⚠ Read out of the function it pins (see this file's header): the served
      prompts have no earlier tree to be compared against. What it buys is that
      nothing edits them silently.
    */
    const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
    const SERVED = {
      classify: { sha: "f1d4a72c2e1216f92848675ac926fd32f59752acf6a2e3f5f7c7d66769d92a4a", len: 13_472 },
      edit: { sha: "9c80bae190bc530f9a8fced8e19d1d130a7b55ae56b72fc33be70c9fb74bc160", len: 11_029 },
    } as const;
    expect(servedPrompt().length).toBe(SERVED.classify.len);
    expect(sha(servedPrompt())).toBe(SERVED.classify.sha);
    expect(servedPrompt("edit").length).toBe(SERVED.edit.len);
    expect(sha(servedPrompt("edit"))).toBe(SERVED.edit.sha);
    /* ⚠ THE DELTAS ARE EQUAL, and that is the arm with teeth: the difference
       lives entirely in the base prompt, so a sentence reaching one mode and
       not the other is a mistake this catches and the hashes alone would not
       explain. */
    const classifyDelta = servedPrompt().length - refineParseSystemPrompt().length;
    const editDelta = servedPrompt("edit").length - refineParseSystemPrompt("edit").length;
    expect(classifyDelta).toBe(editDelta);
    expect(classifyDelta).toBeGreaterThan(0);
  });

  it("⚠ served, a wardrobe ask FILES instead of walling — the capability itself", async () => {
    const engine = scripted([JSON.stringify({
      intent: "edit", free: { wardrobe: "a long black coat" },
    })]);
    const parse = await interpretRefinement({
      instruction: "put them in a long black coat",
      engine, outfitEditServed: true, ...FACE,
    });
    expect(parse.ok).toBe(true);
    expect(parse.ok === true && "delta" in parse ? parse.delta.free?.wardrobe : undefined)
      .toBeDefined();
  });

  /* The re-look constraint is appended per CALL rather than living in the
     prompt body, so it is driven at the wire in site 3 below — where the
     second system string is read off the engine — rather than read here. */
});

describe("4 · ⚠ SERVED, THE SCENERY HALF STILL REFUSES — ALL FIVE SITES", () => {
  /*
    THE ARM THE DESIGN CALLS THE ONE THAT MATTERS MOST. Every assertion in this
    block runs with the flag ON.

    The populations are DERIVED from the lexicon rather than retyped
    (`SCENERY_WORDS`, `GARMENT_STAGE_WORDS`), so a word quietly leaving the
    scenery half reddens here instead of passing a list that no longer matches
    the code. The design's own five words are asserted as members first, which
    is what stops a derived population from silently becoming empty.
  */
  it("the two halves are the one list, split in meaning and not in membership", () => {
    for (const word of DESIGN_SCENERY) {
      expect(SCENERY_WORDS, `the design names ${word}`).toContain(word);
    }
    expect(SCENERY_WORDS.length).toBeGreaterThan(5);
    expect(GARMENT_STAGE_WORDS.length).toBeGreaterThan(0);
    /* Disjoint, and together they are the whole lexicon in its own order. */
    for (const word of GARMENT_STAGE_WORDS) {
      expect(SCENERY_WORDS, `${word} is not scenery`).not.toContain(word);
    }
  });

  describe("site 1 — the lexicon", () => {
    it("CONTROL — licensed, the garment half genuinely stops firing", () => {
      /* Without this, every refusal below could pass against a licence that was
         never applied at all. */
      for (const word of GARMENT_STAGE_WORDS) {
        if (word === "wearing") continue; /* already exempt for accessories (D-160) */
        expect(stageWordIn(`a new ${word}`), `unlicensed ${word}`).toBe(word);
        expect(stageWordIn(`a new ${word}`, { garmentLicensed: true }), `licensed ${word}`)
          .toBeNull();
      }
    });

    it("⚠ licensed or not, every scenery word still answers", () => {
      for (const word of SCENERY_UNDER_TEST) {
        expect(stageWordIn(`against a ${word}`, { garmentLicensed: true }), word).toBe(word);
        expect(stageWordIn(`against a ${word}`), `unlicensed ${word}`).toBe(word);
      }
    });

    it("⚠ and a garment beside scenery still refuses, on the scenery", () => {
      const asked = stageWordIn("a red coat against a grey backdrop", { garmentLicensed: true });
      expect(asked).toBe("backdrop");
    });
  });

  describe("site 2 — wall (b), over the parsed values", () => {
    const read = (subject: string, words: string, served: boolean) => {
      const check: FreeLaneCheck = {
        instruction: `give them ${words}`,
        ...(served ? { outfitEditServed: true } : {}),
      };
      const delta = readDelta({ free: { [subject]: words } }, check);
      return { delta, wall: check.wall };
    };

    it("CONTROL — served, a plain garment value files", () => {
      const { delta, wall } = read("wardrobe", "a long black coat", true);
      expect(wall).toBeUndefined();
      expect(delta?.free?.wardrobe).toBeDefined();
    });

    it("⚠ served, every scenery word in a wardrobe value still walls", () => {
      for (const word of SCENERY_UNDER_TEST) {
        const { delta, wall } = read("wardrobe", `a coat and a ${word}`, true);
        expect(wall?.reason, word).toBe("wall_stage");
        expect(wall && "asked" in wall && wall.asked, word).toBe(word);
        expect(delta, word).toBeNull();
      }
    });

    it("⚠ and the licence needs BOTH terms — the subject as well as the account", () => {
      /*
        The flag alone would license `coat` inside a `skinCharacter` value, which
        is the smuggling this wall exists to catch; the subject alone would open
        garments for everybody the moment the model filed one under `wardrobe`,
        which it can do today.
      */
      const smuggled = read("skinCharacter", "weathered skin and a coat", true);
      expect(smuggled.wall?.reason).toBe("wall_stage");
      const unserved = read("wardrobe", "a long black coat", false);
      expect(unserved.wall?.reason).toBe("wall_stage");
      expect(unserved.delta).toBeNull();
    });
  });

  describe("site 3 — the interpreter's backing check", () => {
    it("CONTROL — served, a garment claim becomes a misfile and gets its re-look", async () => {
      /*
        The design's own answer: nothing new. A claim backed only by a garment
        word is no longer backed, so the existing single re-look fires — and a
        second reply that files is served.
      */
      const engine = scripted([
        claimsStage("a coat"),
        JSON.stringify({ intent: "edit", free: { wardrobe: "a long black coat" } }),
      ]);
      const parse = await interpretRefinement({
        instruction: "put them in a long black coat",
        engine, outfitEditServed: true, ...FACE,
      });
      expect(engine.seen).toHaveLength(2);
      expect(parse.ok).toBe(true);
      /* And the re-look was told the truth about what the code checked. */
      const relook = engine.seen[1]!.system ?? "";
      expect(relook).toContain("CHECKED THEIR SENTENCE FOR SCENERY AND PROPS AND FOUND NONE");
      expect(relook).not.toContain("SCENERY, WARDROBE AND PROPS");
      expect(relook).toContain("clothing files under wardrobe");
    });

    it("⚠ served, a scenery claim is backed on the FIRST pass and spends nothing", async () => {
      for (const word of DESIGN_SCENERY) {
        const engine = scripted([claimsStage(word)]);
        const parse = await interpretRefinement({
          instruction: `put them against a grey ${word}`,
          engine, outfitEditServed: true, ...FACE,
        });
        expect(parse.ok, word).toBe(false);
        expect(parse.ok === false && parse.refusal.reason, word).toBe("wall_stage");
        /* No re-look: the lexicon backed it, so no second text call was bought
           — the property that keeps a scenery refusal free and immediate. */
        expect(engine.seen, word).toHaveLength(1);
      }
    });
  });

  describe("sites 4 and 5 — the open lane's two doors", () => {
    const openAsk = async (kind: string, instruction: string, served: boolean) => acceptOpenKind({
      instruction,
      unowned: [{ subject: kind, value: instruction }],
      engine: scripted([JSON.stringify({ kind })]),
      ...(served ? { outfitEditServed: true } : {}),
    });

    it("CONTROL — an ordinary open kind is still accepted, served", async () => {
      /* Without this, every refusal below passes against a lane that refuses
         everything. */
      const opened = await openAsk("fangs", "give them vampire fangs", true);
      expect(opened?.ok).toBe(true);
    });

    it("⚠ served, a scenery noun is still refused by the lane", async () => {
      for (const word of SCENERY_UNDER_TEST) {
        const opened = await openAsk(word, `put them against a grey ${word}`, true);
        expect(opened?.ok, word).toBe(false);
        expect(opened && opened.ok === false && opened.outcome, word).toBe("refused");
      }
    });

    it("⚠ site 4 — served, a garment collision becomes the routing miss it now is", async () => {
      /*
        The design's table, exactly: the OUTCOME is `refused` either way and the
        REASON moves. Unserved, a garment noun colliding with the closed lane is
        the most ordinary refusal this lane makes and keeps the stage's answer
        (`unfileable`); served, the closed interpreter should have filed it under
        `wardrobe`, so arriving here is a misroute and is worth the warn.
      */
      const served = await openAsk("coat", "put them in a long black coat", true);
      expect(served?.ok).toBe(false);
      expect(served && served.ok === false && served.outcome).toBe("refused");
      expect(served && served.ok === false && served.reason).toBe("collides");

      const unserved = await openAsk("coat", "put them in a long black coat", false);
      expect(unserved?.ok).toBe(false);
      expect(unserved && unserved.ok === false && unserved.outcome).toBe("refused");
      expect(unserved && unserved.ok === false && unserved.reason).toBe("unfileable");
    });
  });
});

describe("5 · the refusal a served account reads is true of that account", () => {
  const saidFor = async (instruction: string, asked: string, served: boolean) => {
    const engine = scripted([claimsStage(asked)]);
    const parse = await interpretRefinement({
      instruction, engine, ...(served ? { outfitEditServed: true } : {}), ...FACE,
    });
    return parse.ok === false ? refusalMessage(parse) : "";
  };

  it("⚠ served, it stops claiming clothing comes after Sign", async () => {
    const said = await saidFor("put them against a grey backdrop", "the backdrop", true);
    expect(said).toContain("is part of the set, which a refine never touches");
    expect(said).toContain("Clothing, jewellery and glasses do work here");
    expect(said).toContain("Nothing was charged.");
    /* The false half is gone, which is the whole repair. */
    expect(said).not.toContain("comes after Sign");
  });

  it("CONTROL — unserved, the same ask reads today's sentence", async () => {
    const said = await saidFor("put them against a grey backdrop", "the backdrop", false);
    expect(said).toContain("comes after Sign");
    expect(said).not.toContain("a refine never touches");
  });

  it("neither branch names an engine, and both say what to do", async () => {
    for (const served of [true, false]) {
      const said = await saidFor("put them against a grey backdrop", "the backdrop", served);
      expect(said, String(served)).toMatch(/do work here/);
      expect(said, String(served)).not.toMatch(/sunburst|nano|banana|gpt|fal\b|openrouter/i);
    }
  });
});

describe("6 · headwear joined the subject in the same act", () => {
  it("⚠ hat and scarf are wardrobe nouns now — the gate's question 2", () => {
    /* Served, *"add a beanie"* refusing while *"add a hoodie"* works is a
       distinction no customer has any basis to predict. */
    const nouns = SUBJECT_CARDS.wardrobe.nouns as readonly string[];
    expect(nouns).toContain("hat");
    expect(nouns).toContain("scarf");
    /* CONTROL: the list is the real one and still holds what it always did. */
    expect(nouns).toContain("coat");
    expect(nouns).toContain("hoodie");
  });

  it("and they stay in the garment half, which is what still refuses them", () => {
    /* The half is what licenses them under this subject — and what refuses them
       under every other subject and every unserved account. */
    expect(GARMENT_STAGE_WORDS).toContain("hat");
    expect(GARMENT_STAGE_WORDS).toContain("scarf");
    expect(stageWordIn("a wide-brimmed hat")).toBe("hat");
    expect(stageWordIn("a wide-brimmed hat", { garmentLicensed: true })).toBeNull();
  });
});
