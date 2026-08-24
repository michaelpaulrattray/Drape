/**
 * The two questions, proved WITHOUT the model (D-178, D-179, D-180).
 *
 * The founder's standard, set after the D-177 backstop turned out to be
 * structurally inert while every test around it passed: *if the only test goes
 * through the interpreter, the backstop is untested*. So every assertion here
 * calls the pure function directly. Nothing in this file can be rescued by a
 * well-behaved model.
 */
import { randomUUID } from "node:crypto";
import type { CastPronouns } from "./castPronouns";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* One Cast, one set of words for her. §5e made every question below a
   function of the Cast's own pronouns, so the fixture supplies them once. */
const HER: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

import { describe, expect, it } from "vitest";

import { SEXES } from "../../shared/castingVocabularies";
import { refineComposedWireLength, refineTypingAllowance } from "../../shared/refineLimits";
import { pronounsForSex } from "./castPronouns";
import { OPEN_KIND_NOUN_MAX_LENGTH } from "./openLaneKind";
import { readDelta } from "./refineDelta";
import { REFINE_ANSWERING_MAX_LENGTH, REFINE_INSTRUCTION_MAX_LENGTH } from "./refineLimits";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS } from "./refineSubjects";
import { SLOT_CATALOGUE } from "./referenceSlotCatalogue";
import { facetOfAxis, facetOfSubject } from "./refineFacets";
import {
  REASK_HANDLE_MAX_LENGTH,
  REASK_KINDS,
  alreadyUpsweptReask,
  colourFacetLabel,
  colourFacetOf,
  colourFacetOfScope,
  didYouMeanReask,
  glassesHideEyesReask,
  nearMiss,
  needsColourReferent,
  pendingReaskFor,
  reaskHandle,
  redirectColourTo,
  resolveAnswer,
  sameAgainReask,
  whichFacetReask,
  whichSideReask,
  designNamedIn,
  residentNamedIn,
  replaceDesignReask,
  replaceReaskHandle,
  thisDesignReask,
  DISCARD_THE_DESIGN,
  type Reask,
} from "./refineReask";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { INK_SIDES } from "../../shared/inkReleasedPlacements";

describe("needsColourReferent — the ask with nothing attached (D-178)", () => {
  it("is true for a bare comparative or a bare colour", () => {
    expect(needsColourReferent("pinker")).toBe(true);
    expect(needsColourReferent("a bit more pink")).toBe(true);
    expect(needsColourReferent("lighter")).toBe(true);
    expect(needsColourReferent("make it warmer")).toBe(true);
  });

  it("is false the moment the sentence names a feature", () => {
    /* They said which part. There is nothing to ask. */
    expect(needsColourReferent("make her hair pinker")).toBe(false);
    expect(needsColourReferent("lighter eyes")).toBe(false);
    expect(needsColourReferent("pink lips")).toBe(false);
    expect(needsColourReferent("warmer skin")).toBe(false);
  });

  it("is false for asks that are not about colour at all", () => {
    expect(needsColourReferent("give her a scar")).toBe(false);
    expect(needsColourReferent("remove the earrings")).toBe(false);
    expect(needsColourReferent("shorter")).toBe(false);
  });

  it("leaves a colour ask that names ANYTHING else to the parser and its walls", () => {
    /* The stage ask must meet its wall, not a question about her hair. */
    expect(needsColourReferent("make the lighting warmer")).toBe(false);
    expect(needsColourReferent("a darker background")).toBe(false);
    expect(needsColourReferent("pinker dress")).toBe(false);
  });
});

describe("colourFacetOf — the history that answers silently (D-178)", () => {
  it("finds the facet a guaranteed colour edit wrote", () => {
    const hair = colourFacetOf(readDelta({ hairColour: "copper" }));
    expect(hair).not.toBeNull();
    expect(colourFacetLabel(hair!)).toBe("the hair");

    const makeup = colourFacetOf(readDelta({ makeup: "a smoky eye" }));
    expect(makeup).not.toBeNull();
    expect(colourFacetLabel(makeup!)).toBe("makeup");
  });

  it("finds it in the free lane too", () => {
    const facet = colourFacetOf(readDelta({ free: { hairShade: "dyed pastel pink" } }));
    expect(facet).not.toBeNull();
    expect(colourFacetLabel(facet!)).toBe("the hair");
  });

  it("is null when nothing coloured has been touched", () => {
    expect(colourFacetOf(readDelta({ free: { marks: ["a small scar"] } }))).toBeNull();
    expect(colourFacetOf(null)).toBeNull();
    expect(colourFacetOf(undefined)).toBeNull();
  });
});

describe("nearMiss — one slip, never two (D-179)", () => {
  it("catches a single-slip typo of a word the product knows", () => {
    expect(nearMiss("piink hair")).toEqual({ typed: "piink", meant: "pink" });
    expect(nearMiss("make her hair coppr")).toEqual({ typed: "coppr", meant: "copper" });
  });

  it("catches a transposition, which is one slip and not two", () => {
    /* Two fingers out of order — the commonest typo there is, and plain
       Levenshtein scores it as a different word. */
    expect(nearMiss("pink hiar")).toEqual({ typed: "hiar", meant: "hair" });
  });

  it("questions a slip in the word that names the DRAWER, not only the value", () => {
    /* "Pink hiar" buys exactly as wrong a render as "piink hair". */
    expect(nearMiss("pink hiar")?.meant).toBe("hair");
  });

  it("leaves correctly spelled asks alone", () => {
    expect(nearMiss("pink hair")).toBeNull();
    expect(nearMiss("copper hair")).toBeNull();
  });

  it("does not guess at words that are simply not colours", () => {
    /* Two slips is a different word, and offering one would be the guessing
       this exists to avoid. */
    expect(nearMiss("give her a scarf")).toBeNull();
    expect(nearMiss("remove the earrings")).toBeNull();
  });

  /*
    THE FOUNDER'S WALK, AS A TEST (D-205).

    "Add light freckles around her nose" came back asking "did you mean rose?"
    on a correctly spelled word, in production, while they were trying to sign.
    The rule is absolute and this is the direction that enforces it: erring
    toward a missed typo costs a free correction; erring this way calls the user
    illiterate and stops the work.
  */
  describe("never fires on a word that is valid in context", () => {
    it("leaves the walk's own sentence alone", () => {
      expect(nearMiss("add light freckles around her nose")).toBeNull();
    });

    it.each([
      ["nose", "add freckles across her nose"],
      ["brow", "raise her left brow slightly"],
      ["lash", "give her one lash extension"],
      ["glasses", "give her thin wire glasses"],
      ["frames", "give her darker frames"],
      ["wider", "make her jaw wider"],
      ["cooper", "her surname is cooper"],
      ["reach", "let her hair reach her collarbone"],
      ["team", "she is on a swim team"],
    ])("does not call %s a typo", (_word, sentence) => {
      expect(nearMiss(sentence)).toBeNull();
    });

    it("treats every word it can name as spelled correctly", () => {
      /* The list is derived from the vocabulary now, so drift is impossible
         rather than merely unlikely — this is what proves the derivation. */
      for (const subject of FREE_SUBJECT_KEYS) {
        for (const word of FREE_SUBJECTS[subject].toLowerCase().split(" ")) {
          if (word.length <= 3) continue;
          expect(nearMiss(`change her ${word} please`)).toBeNull();
        }
      }
    });

    /*
      A CORPUS, because one example fixes one example.

      The founder hit "nose"; sweeping 46 ordinary refine sentences found
      "thin" (→ chin) and "hairs" (→ hair) waiting behind it. Both were live
      before this ran. The list is the regression net for the whole class, and
      new entries belong here rather than in a scratch script.
    */
    it.each([
      "add light freckles around her nose",
      "give her thin wire glasses",
      "make her eyes seafoam green",
      "give her a blunt bob",
      "add small gold hoop earrings",
      "make her hair copper",
      "remove her glasses",
      "give her fox eyes",
      "raise her left brow a little",
      "make her brows fuller and darker",
      "soften her jaw",
      "make her lips slightly fuller",
      "add a small scar above her right eyebrow",
      "make her skin tone warmer",
      "give her longer lashes",
      "make her hair shorter and straighter",
      "give her a middle parting",
      "make her nose a little narrower",
      "give her tortoiseshell frames",
      "remove the freckles on her cheeks",
      "add a thin gold chain",
      "give her tousled waves",
      "make her cheekbones sharper",
      "give her a fringe that covers her forehead",
      "make her teeth slightly less even",
      "give her silver studs in both ears",
      "make her hair a warm chestnut",
      "add stubble along her jaw",
      "make the lenses clear rather than tinted",
      "give her hazel eyes with a green ring",
      "make her hairline a little higher",
      "add a few grey hairs at the temples",
      "give her a sharper chin",
      "soften the shadows under her eyes",
    ])("stays silent on %s", (sentence) => {
      expect(nearMiss(sentence)).toBeNull();
    });

    it("still catches a real slip in the same sentence", () => {
      /* Both directions, per the founder's brief: the guard must not have been
         bought by switching the question off. */
      expect(nearMiss("add light freckles around her nsoe")).toEqual({
        typed: "nsoe",
        meant: "nose",
      });
      expect(nearMiss("make her hair coppr")).toEqual({ typed: "coppr", meant: "copper" });
    });
  });
});

describe("redirectColourTo — the referent is enforced, not instructed (D-178)", () => {
  const hair = colourFacetOf(readDelta({ hairColour: "copper" }))!;
  const eyes = colourFacetOf(readDelta({ eyeColour: "green" }))!;

  it("moves a bare colour the model filed as makeup into the remembered drawer", () => {
    /* The exact miss the corpus caught: "pinker" after a hair edit came back
       as {makeup: "pinker"} on one run and hair on the next. */
    const moved = redirectColourTo(readDelta({ makeup: "pinker" })!, hair);
    expect(moved.makeup).toBeUndefined();
    expect(moved.free?.hairShade).toBe("pinker");
  });

  it("promotes into the closed vocabulary when it can hold the value", () => {
    const moved = redirectColourTo(readDelta({ makeup: "auburn" })!, hair);
    expect(moved.hairColour).toBe("auburn");
    expect(moved.free?.hairShade).toBeUndefined();
  });

  it("moves it to the eyes when the eyes are what was last coloured", () => {
    const moved = redirectColourTo(readDelta({ free: { hairShade: "green" } })!, eyes);
    expect(moved.eyeColour).toBe("green");
    expect(moved.free?.hairShade).toBeUndefined();
  });

  it("leaves a delta that already writes the remembered facet alone", () => {
    const delta = readDelta({ hairColour: "copper" })!;
    expect(redirectColourTo(delta, hair)).toBe(delta);
  });

  it("moves nothing when there is no colour in the delta at all", () => {
    const delta = readDelta({ free: { marks: ["a small scar"] } })!;
    expect(redirectColourTo(delta, hair)).toBe(delta);
  });
});

describe("resolveAnswer — the sentence never dead-ends (D-180)", () => {
  const which = whichFacetReask("pinker");

  it("takes the chip's words typed by hand", () => {
    expect(resolveAnswer(which, "the hair")).toBe("pinker — the hair");
    expect(resolveAnswer(which, "hair")).toBe("pinker — the hair");
    expect(resolveAnswer(which, "makeup")).toBe("pinker — makeup");
  });

  it("takes the feature named inside an ordinary reply", () => {
    expect(resolveAnswer(which, "the eyes please")).toBe("pinker — the eyes");
    expect(resolveAnswer(which, "do the hair")).toBe("pinker — the hair");
  });

  it("returns null for anything that is not an answer, so it runs as a new instruction", () => {
    /* THE POINT OF THE WHOLE FUNCTION. A question that rejects everything but
       its own two answers is a dead end wearing a sentence. */
    expect(resolveAnswer(which, "actually give her a fringe")).toBeNull();
    expect(resolveAnswer(which, "hair and eyes")).toBeNull();
    expect(resolveAnswer(which, "yes")).toBeNull();
  });

  it("takes yes and no on the typo question, and keeps their word on no", () => {
    const miss = nearMiss("piink hair")!;
    const typo = didYouMeanReask("piink hair", miss);
    expect(typo.question).toBe("Did you mean pink?");
    /* The answers live in the chips now, so the sentence stops naming them —
       but typing them must still work, which is the rest of this block. */
    expect(typo.question).not.toContain("Say yes");
    expect(resolveAnswer(typo, "yes")).toBe("pink hair");
    expect(resolveAnswer(typo, "yeah")).toBe("pink hair");
    expect(resolveAnswer(typo, "pink")).toBe("pink hair");
    /* Their word survives a "no" — the record keeps what they wrote (D-172). */
    expect(resolveAnswer(typo, "no")).toContain("piink hair");
  });
});

describe("pendingReaskFor — the question is re-derived, never trusted", () => {
  it("rebuilds the typo question from the sentence alone", () => {
    expect(pendingReaskFor("piink hair", false, HER)?.kind).toBe("did-you-mean");
  });

  it("rebuilds the cold-start question only when there is no colour history", () => {
    expect(pendingReaskFor("pinker", false, HER)?.kind).toBe("which-facet");
    /* With a colour edit behind it, history answers silently and there was
       never a question to reopen. */
    expect(pendingReaskFor("pinker", true, HER)).toBeNull();
  });

  it("is null for an ordinary instruction", () => {
    expect(pendingReaskFor("give her a fringe", false, HER)).toBeNull();
  });

  /*
    AND NO HAIR QUESTION IS REBUILT, because there is no hair question
    (founder ruling 2026-08-19, fable-1087, superseding his own earlier one).

    Six arms stood here proving the reference question's re-derivation, and they
    went with the door. These two replace them, and they are the ones worth
    keeping: a hair ask WITH a picture attached must raise nothing at all — that
    is the ruling, *"if they are vague and say copy this hair it just means the
    whole lot"* — while every other question in this family is untouched by it.

    The second arm is the one that could fail silently. Deleting a branch from
    a chain of doors is how the door BELOW it stops being reached, so the
    cold-start colour question is driven here rather than assumed.
  */
  it("raises nothing for a hair ask — the vague ask is not ambiguous", () => {
    expect(pendingReaskFor("copy hair from reference", false, HER)).toBeNull();
    expect(pendingReaskFor("copy this hair", false, HER)).toBeNull();
  });

  it("still asks every question that was never hair's", () => {
    /* The typo door, on the same misspelled hair ask that used to reach the
       reference question through it. */
    expect(pendingReaskFor("copy hiar from reference", false, HER)?.kind).toBe("did-you-mean");
    /* And the cold-start colour question, which sat directly beneath the
       deleted branch. */
    expect(pendingReaskFor("pinker", false, HER)?.kind).toBe("which-facet");
    expect(pendingReaskFor("pinker", true, HER)).toBeNull();
  });
});

describe("a chip submits ONE instruction — the compound the parser cannot hold", () => {
  /*
    THE MEASUREMENT BEHIND THIS BLOCK.

    The glasses chip shipped as *"remove her glasses, then fox eyes"* until it
    was driven through the live interpreter (`scripts/drive-compound-chip.mts`):
    the compound carried both halves 0 times in 5 while each half alone carried
    5 in 5. It files as `intent: remove` and the eye ask is gone — and it cannot
    do otherwise, because `RefineParse` is a union in which a removal has no
    delta and an edit has no intent. A compound chip is unrepresentable, not
    badly worded.

    Driven here without a model, per this file's own standard: the sentence a
    chip submits is a pure function of the sentence a person typed.
  */
  const COMPOUND = /,\s*then\s|\sand then\s|;/i;

  it("the glasses chip takes the frames off and asks for nothing else", () => {
    const reask = glassesHideEyesReask("fox eyes", HER);
    expect(reask.options[0]!.resolves).toBe("remove her glasses");
    /* And the other chip is still exactly her own sentence. */
    expect(reask.options[1]!.resolves).toBe("fox eyes");
    expect(resolveAnswer(reask, "Take them off first")).toBe("remove her glasses");
    expect(resolveAnswer(reask, "yes")).toBe("remove her glasses");
    expect(resolveAnswer(reask, "no")).toBe("fox eyes");
  });

  it("no question in the family offers a chip carrying two instructions", () => {
    /* Every constructor, with an instruction that reaches it — the sweep is the
       fix (law 7). A new question added without a row here is the next place
       this defect lands. */
    const every = [
      whichFacetReask("pinker"),
      alreadyUpsweptReask("fox eyes", HER),
      glassesHideEyesReask("fox eyes", HER),
      didYouMeanReask("piink hair", nearMiss("piink hair")!),
    ];
    for (const reask of every) {
      for (const option of reask.options) {
        expect(`${reask.kind}: ${option.resolves}`).not.toMatch(COMPOUND);
      }
    }
  });
});

/**
 * EVERY QUESTION IS ANSWERABLE ON THE ANSWER PATH — the sweep that was missing
 * (found opus-827 §0, ordered fable-1120 §2).
 *
 * # The defect this exists to make impossible
 *
 * The client submits a chip's LABEL, never its `resolves`
 * (`RefinePanel.tsx` — *"a chip submits its own LABEL, which is exactly what
 * someone typing the answer would send"*). So the server has to REBUILD the
 * outstanding question from `answering` and map that label back. A question
 * `pendingReaskFor` cannot rebuild is a question whose chips run as raw
 * sentences: *"Take them off first"* reaches the interpreter with no referent
 * for *them*, and *"Go ahead anyway"* throws her ask away.
 *
 * `glasses-hide-eyes` was exactly that, live, on the founder's own account —
 * and its sibling twenty lines above it in `refineService.ts` carries a comment
 * naming this defect as fixed. The class was named; the sweep was not done.
 *
 * # Why every arm here rebuilds rather than constructing
 *
 * Every other `resolveAnswer` assertion in this file drives a reask THE TEST
 * built. That is the shape that could not see this: the object under test was
 * never the object the answer path produces. So each row below goes through
 * `pendingReaskFor` with what the CLIENT would send, which is `about` when the
 * question carries one and the typed sentence when it does not.
 */
describe("the answer path rebuilds every question it asks", () => {
  /*
    ONE ROW PER KIND, and the table is checked against `REASK_KINDS` rather than
    trusted — a question added without a row here fails the arm below, which is
    the whole point of a sweep (law 7).
  */
  const ROWS: Array<{
    kind: string;
    asked: string;
    build: (asked: string) => Reask;
    /** Why this one is not rebuilt here, when it is not. */
    exempt?: string;
  }> = [
    { kind: "which-facet", asked: "pinker", build: whichFacetReask },
    {
      kind: "did-you-mean",
      asked: "piink hair",
      build: (asked) => didYouMeanReask(asked, nearMiss(asked)!),
    },
    { kind: "already-upswept", asked: "fox eyes", build: (asked: string) => alreadyUpsweptReask(asked, HER) },
    { kind: "glasses-hide-eyes", asked: "give her a cat eye", build: (asked: string) => glassesHideEyesReask(asked, HER) },
    { kind: "which-side", asked: "use this tattoo design on her arm", build: (asked: string) => whichSideReask(asked, HER) },
    {
      /*
        The shown cut. Its handle names a DESIGN as well as a sentence, because
        the decline has to be able to delete the row — so the round trip this
        row drives is the one that would break if the two halves were ever put
        back in the wrong order.
      */
      kind: "this-design",
      asked: "use this tattoo design on her left upper arm",
      build: (asked) => thisDesignReask({ designPublicId: "d-minted", asked }),
    },
    {
      /*
        The replace offer. Its handle names TWO rows and an ADDRESS, and the two
        rows are destroyed by OPPOSITE answers — so this round trip is the one
        that would break silently if the parts were ever put back in the wrong
        order, and the break would be a customer's design deleted instead of
        kept.
      */
      kind: "replace-design",
      asked: "use this tattoo design on her left upper arm",
      build: (asked: string) => replaceDesignReask({
        pronouns: HER,
        newDesignPublicId: "d-minted",
        residentDesignPublicId: "d-resident",
        placement: "upperArm",
        side: "left",
        asked,
      }),
    },
    {
      kind: "same-again",
      asked: "gold hoops please",
      build: (asked) => sameAgainReask({ asked, priceCredits: 25, pronouns: HER }),
      /*
        DELIBERATELY OUT, and it is the one exemption with teeth: answering the
        offer sets `confirmedRegenerate`, which stands doors down that exist to
        stop somebody paying for a render that changes nothing. It is re-derived
        in `refineService` by comparing two strings THIS SERVER WROTE — the
        sentence being answered against the version's own `requestText` — and a
        handle must never be the thing that turns a door off.
      */
      exempt: "re-derived from the version's own requestText, never from a handle",
    },
  ];

  it("covers every kind the product can ask — no question joins without a row", () => {
    expect([...REASK_KINDS].sort()).toEqual(ROWS.map((row) => row.kind).sort());
  });

  for (const row of ROWS.filter((entry) => !entry.exempt)) {
    it(`${row.kind}: every chip resolves the same way on the answer path`, () => {
      const raised = row.build(row.asked);
      /* What the CLIENT sends back — `about` when the question carries one,
         the sentence they typed when it does not (`CastingSheet.tsx`). */
      const answering = raised.about ?? row.asked;
      const rebuilt = pendingReaskFor(answering, false, HER);
      expect(rebuilt, `${row.kind} could not be rebuilt from ${JSON.stringify(answering)}`)
        .not.toBeNull();
      expect(rebuilt!.kind).toBe(row.kind);
      for (const option of raised.options) {
        expect(
          resolveAnswer(rebuilt!, option.label),
          `${row.kind} lost the chip ${JSON.stringify(option.label)}`,
        ).toBe(option.resolves);
      }
    });
  }
});

/**
 * THE HANDLE FITS THROUGH THE DOOR IT HAS TO TRAVEL THROUGH.
 *
 * `about` is echoed back by the client in `answering`, and `about` defaults to
 * the sentence they typed. So the two fields were the same width, which was
 * exactly enough — until a question put its own handle in front of the
 * sentence. A full-length ask would then overflow `answering` and the schema
 * would refuse the ANSWER: a dead end quieter than the one the handle closes,
 * because it fires only on the longest sentences.
 *
 * Read at the ROUTER'S OWN TEXT rather than against the two constants, which
 * would be a suite comparing local constants to themselves — the shape that let
 * a deleted control keep a live reputation for six months.
 */
describe("the answering field is wide enough for a handled question", () => {
  const ROUTER = readFileSync(
    fileURLToPath(new URL("../routes/castingV2.ts", import.meta.url)),
    "utf8",
  );

  it("the wire spends the derived caps rather than literals", () => {
    expect(ROUTER).toContain("instruction: z.string().trim().min(1).max(REFINE_INSTRUCTION_MAX_LENGTH)");
    expect(ROUTER).toContain("answering: z.string().trim().min(1).max(REFINE_ANSWERING_MAX_LENGTH)");
  });

  it("the longest handle on the longest ask still fits", () => {
    const longest = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    for (const kind of REASK_KINDS) {
      expect(reaskHandle(kind, longest).length).toBeLessThanOrEqual(REFINE_ANSWERING_MAX_LENGTH);
    }
  });

  it("AND SO DOES THE ONE THAT NAMES A DESIGN — built the way the server builds it", () => {
    /*
      The arm above walks the kinds through `reaskHandle`, which is the handle
      every OTHER question travels in. The shown cut's is longer by a `publicId`
      and is built by its own speller, so a cap derived without that allowance
      would pass there and refuse a real answer here — the quiet dead end the
      whole derivation exists to prevent, on the longest sentences only.
    */
    const longest = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    const handle = thisDesignReask({ designPublicId: randomUUID(), asked: longest }).about!;
    expect(handle.length).toBeLessThanOrEqual(REFINE_ANSWERING_MAX_LENGTH);
    /* And it still names the design it was built for, at full length. */
    expect(designNamedIn(handle)).toHaveLength(randomUUID().length);
  });

  it("the allowance is DERIVED over the kinds, not a number somebody chose", () => {
    /*
      Not `toBe(51)`: a longer kind name must move the cap by existing, and so
      must a kind that starts naming a design.

      **The derivation grew on 2026-08-20 and this arm grew with it, which is
      the only honest way to move a bar** — `this-design` puts a `publicId` in
      front of the sentence, so the widest handle is no longer the longest NAME.
      Measured off a real `randomUUID()` here as well, so the two sides of the
      assertion cannot agree on a number neither of them checked.

      **AND IT GREW AGAIN THE SAME DAY**, for the replace offer: that handle
      names TWO designs and carries the address they are at, so the widest is no
      longer the one that names one. Every term is re-measured here — the ids
      off `randomUUID()`, the address off the two vocabularies — so the two
      sides of this assertion cannot agree on a number neither of them checked.
    */
    const DESIGN_NAMES: Record<string, number> = { "this-design": 1, "replace-design": 2 };
    const idAllowance = randomUUID().length + 1;
    const addressAllowance =
      Math.max(...INK_PLACEMENTS.map((placement) => placement.length)) + 1
      + Math.max(...INK_SIDES.map((side) => side.length)) + 1;
    expect(REFINE_ANSWERING_MAX_LENGTH).toBe(REFINE_INSTRUCTION_MAX_LENGTH + REASK_HANDLE_MAX_LENGTH);
    expect(REASK_HANDLE_MAX_LENGTH).toBe(
      Math.max(...REASK_KINDS.map((kind) => reaskHandle(kind, "").length
        + (DESIGN_NAMES[kind] ?? 0) * idAllowance
        + (kind === "replace-design" ? addressAllowance : 0))),
    );
  });

  it("AND THE ONE THAT NAMES TWO — the widest handle the wire has to carry", () => {
    /*
      The arm above proves the derivation; this one proves it is enough for the
      question that actually spends it, built the way the server builds it and
      at the longest placement, the longest side and the longest sentence.
    */
    const longest = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    const widest = (list: readonly string[]) =>
      [...list].sort((a, b) => b.length - a.length)[0]!;
    const handle = replaceDesignReask({
      pronouns: HER,
      newDesignPublicId: randomUUID(),
      residentDesignPublicId: randomUUID(),
      placement: widest(INK_PLACEMENTS) as "upperChest",
      side: widest(INK_SIDES) as "centre",
      asked: longest,
    }).about!;
    expect(handle.length).toBeLessThanOrEqual(REFINE_ANSWERING_MAX_LENGTH);
    /* And both names survive at full length, in their own roles. */
    expect(designNamedIn(handle)).toHaveLength(randomUUID().length);
    expect(residentNamedIn(handle)).toHaveLength(randomUUID().length);
    expect(designNamedIn(handle)).not.toBe(residentNamedIn(handle));
  });
});

/**
 * AND THE SAME DEAD END ON THE OTHER FIELD — the one nobody derived.
 *
 * The describe above exists because a handle in front of a full-length sentence
 * would overflow `answering`. **The region popover does the identical thing to
 * `instruction` and it was never given the identical treatment**: `FaceRegions`
 * submits `prefill + said` — *"his upper chest tattoo — "* and then her words —
 * while its field capped `said` alone at the router's number.
 *
 * So the box composed asks the router refused, and the refusal said *"please
 * keep it to 200 characters or fewer"* to somebody the box had already held to
 * 200. Advice about characters she cannot see: exactly the quieter dead end the
 * derivation above was built to prevent, one field over.
 *
 * It was correct until `44369835` moved the prefill out of the field on the
 * founder's own ruling (fable-1270 §1). The ruling is right; the arithmetic was
 * bolted to the prefill's location and went with it — no failing test, no
 * error. This is that failing test, arriving late.
 *
 * **Every term is measured off the product**, never re-typed: the nouns come
 * from the catalogue, the possessives from `pronounsForSex` over `SEXES`, and
 * the open lane's width from its own exported bound. The arm cannot agree with
 * the code about a number neither of them checked.
 */
describe("a scoped ask cannot compose more than the door accepts", () => {
  /* The prefill the panel builds, spelled the way `facePanel.ts` spells it —
     possessive, noun, em-dash — and asserted against that speller below so the
     two cannot drift apart in silence. */
  const prefillOf = (possessive: string, noun: string) => `${possessive} ${noun} — `;

  const POSSESSIVES = Array.from(
    new Set(SEXES.map((sex) => pronounsForSex(sex).possessive)),
  );

  /**
   * Every noun the panel can put in front of a customer's sentence.
   *
   * ⚠ The plural is at `instances.pairNoun` and only on a `perSide` slot — it
   * is NOT a top-level field. The first cut of this arm read
   * `definition.pairNoun`, which is `undefined` on every entry, so the whole
   * plural class was silently absent from a population this arm reports as
   * complete. **Vitest was green on it; `pnpm check` is what said so** — the
   * both-instruments rule earning its keep on the very arm written to stop a
   * mirror.
   */
  const NOUNS: string[] = [
    ...Object.values(SLOT_CATALOGUE).flatMap((definition) => [
      definition.noun,
      ...(definition.instances.of === "perSide" ? [definition.instances.pairNoun] : []),
    ]),
    /* The open lane's worst case: a kind nobody catalogued, at the widest the
       lane will accept. This is the row that gives the least room, and it is
       the row a mirror of the constant would have stopped covering. */
    "z".repeat(OPEN_KIND_NOUN_MAX_LENGTH),
  ];

  const PREFILLS = POSSESSIVES.flatMap((possessive) =>
    NOUNS.map((noun) => prefillOf(possessive, noun)),
  );

  it("the population is real — the catalogue, both nouns, every possessive", () => {
    /*
      A magic count would pin the fixture rather than the product (a catalogued
      slot arriving must not redden this). What is asserted is that the arm is
      looking at something: the catalogue is non-empty, every possessive the
      product speaks is represented, and the open lane's worst case is present.
    */
    expect(PREFILLS.length).toBeGreaterThan(NOUNS.length);
    expect(POSSESSIVES.length).toBeGreaterThan(1);
    expect(NOUNS).toContain("z".repeat(OPEN_KIND_NOUN_MAX_LENGTH));
    /*
      AND THE PLURAL CLASS IS PRESENT — the arm's own negative control against
      the defect it was born with. Derived from the catalogue rather than named,
      so a renamed pair does not redden it and a VANISHED plural class does.
    */
    const plurals = Object.values(SLOT_CATALOGUE)
      .filter((definition) => definition.instances.of === "perSide");
    expect(plurals.length).toBeGreaterThan(0);
    for (const definition of plurals) {
      const pairNoun = (definition.instances as { of: "perSide"; pairNoun: string }).pairNoun;
      expect(NOUNS, `the plural ${JSON.stringify(pairNoun)} is not in the population`)
        .toContain(pairNoun);
    }
  });

  it("a field filled to its allowance still fits through the door", () => {
    for (const prefill of PREFILLS) {
      const allowance = refineTypingAllowance(prefill);
      /* A room of zero or less is a box nobody can type in — a different
         defect, and one this assertion would otherwise pass over silently. */
      expect(allowance, `${JSON.stringify(prefill)} leaves no room to type`)
        .toBeGreaterThan(0);
      const said = "x".repeat(allowance);
      expect(
        refineComposedWireLength(prefill, said),
        `${JSON.stringify(prefill)} composes past the door`,
      ).toBeLessThanOrEqual(REFINE_INSTRUCTION_MAX_LENGTH);
    }
  });

  it("AND ONE CHARACTER MORE DOES NOT — the arm's own negative control", () => {
    /*
      Without this, an allowance of zero would pass the arm above by making
      every composition trivially short. The bound has to BITE.
    */
    for (const prefill of PREFILLS) {
      const said = "x".repeat(refineTypingAllowance(prefill) + 1);
      expect(
        refineComposedWireLength(prefill, said),
        `${JSON.stringify(prefill)} has slack the allowance did not spend`,
      ).toBeGreaterThan(REFINE_INSTRUCTION_MAX_LENGTH);
    }
  });

  it("the allowance is the door's number minus the prefill, not a second number", () => {
    /*
      Derived, not chosen: raising the router's cap must raise the room by the
      same amount on the same day, which is the whole reason the constant moved
      to `shared/`. A literal here would re-create the mirror one layer down.
    */
    for (const prefill of PREFILLS) {
      expect(refineTypingAllowance(prefill))
        .toBe(REFINE_INSTRUCTION_MAX_LENGTH - prefill.length);
    }
    /* An unscoped ask carries no noun, so it spends the whole allowance — the
       ask box's own case, and the reason that field needs no arithmetic. */
    expect(refineTypingAllowance("")).toBe(REFINE_INSTRUCTION_MAX_LENGTH);
  });

  it("the prefill is spelled the way the PANEL spells it, not the way this test does", () => {
    /*
      The one place this arm could be quietly wrong: if `facePanel.ts` changed
      its prefill shape, every assertion above would keep passing against a
      string the product no longer builds. Read at the panel's own source.
    */
    const panel = readFileSync(
      fileURLToPath(new URL("./facePanel.ts", import.meta.url)),
      "utf8",
    );
    expect(panel).toContain("return `${spoken} — `;");
    expect(panel).toContain("return `${possessive} ${nounOf(definition, paired)}`;");
  });
});

/**
 * REPLACE-ON-CONFIRM — the question that destroys a different row depending on
 * which way it is answered (founder ruling relayed fable-1158 §1, atomic shape
 * countersigned fable-1163 §4).
 *
 * Every other question in this file is safe to get slightly wrong: a chip that
 * stops resolving is a sentence that runs as a fresh instruction. This one is
 * not. Its two answers delete OPPOSITE rows, so a handle read back in the wrong
 * order is a customer's design destroyed instead of kept — which is why the two
 * readers have different names and both are driven here.
 */
describe("the replace offer names what it would destroy", () => {
  const ASKED = "put this tattoo on her left upper arm";
  const offer = (over: Partial<Parameters<typeof replaceDesignReask>[0]> = {}) =>
    replaceDesignReask({
      pronouns: HER,
      newDesignPublicId: "d-new",
      residentDesignPublicId: "d-resident",
      placement: "upperArm",
      side: "left",
      asked: ASKED,
      ...over,
    });

  it("names the RESIDENT'S PLACE in the sentence — the offer's whole content", () => {
    /*
      fable-1158 §1: *"the offer names what is there and asks"*. We have no
      words for what the resident depicts and inventing some would put a vision
      reader's opinion between her and her own design (law 9) — so what it names
      is the place, which is the thing she can check.
    */
    expect(offer().question).toContain("Her left upper arm");
    expect(offer({ placement: "neck", side: "centre" }).question).toContain("Her neck");
    /* And it says the place ONCE — the "her left left" class, killed 2026-08-20. */
    expect(offer().question.match(/left/gi)).toHaveLength(1);
  });

  it("names no price, because nothing has been claimed", () => {
    const question = offer().question;
    expect(question).toContain("Nothing has been charged.");
    expect(question).not.toMatch(/credit/i);
    for (const option of offer().options) expect(option.label).not.toMatch(/credit/i);
  });

  it("ADOPT resolves into her own sentence, unchanged", () => {
    /*
      The same road the shown cut takes: the take reads the placement out of her
      words a second time, so the source containment that guards the side has
      something to contain. A chip resolving into a server-authored paraphrase
      would put the model's reading where her word belongs.
    */
    expect(offer().options[0]!.resolves).toBe(ASKED);
  });

  it("DISCARD resolves into the sentinel, so it can never be rendered", () => {
    /* There is no sentence meaning "throw that away", so it travels as the
       constant `refineCandidate` answers before the parse. A decline that fell
       through would be read as an ordinary ask and RENDERED — the charge this
       question stands in front of. */
    expect(offer().options[1]!.resolves).toBe(DISCARD_THE_DESIGN);
  });

  it("the DECLINE names the NEW design and the ADOPT names the RESIDENT", () => {
    /*
      THE LOAD-BEARING ARM. Declining throws away the picture she just pointed
      at and leaves the resident standing; adopting does the opposite. Two
      readers, two roles, and this is what proves they have not been swapped.
    */
    const handle = offer().about!;
    expect(designNamedIn(handle)).toBe("d-new");
    expect(residentNamedIn(handle)).toBe("d-resident");
  });

  it("a shown-cut handle names no resident, so nothing of hers can die by it", () => {
    /* The other question that names a design names ONE, and an adopt read off
       it must find nothing rather than the design itself. */
    const handle = thisDesignReask({ designPublicId: "d-minted", asked: ASKED }).about!;
    expect(designNamedIn(handle)).toBe("d-minted");
    expect(residentNamedIn(handle)).toBeNull();
  });

  it("rebuilds the IDENTICAL sentence, which is why the address rides in the handle", () => {
    /*
      The handle carries `(placement, side)` rather than the finished phrase
      precisely so this holds: the rebuild composes the question through
      `inkAddressPhrase`, the same owner that wrote it the first time. A rebuild
      that could not say the place would be a second, vaguer version of a
      sentence this server already wrote.
    */
    const raised = offer();
    const rebuilt = pendingReaskFor(raised.about!, false, HER);
    expect(rebuilt).toEqual(raised);
  });

  it("a handle carrying a place this product never measured is NOT a handle", () => {
    /*
      Positive admission against the two closed vocabularies. A forged string
      naming `sleeve` is not a question anybody asked, and the honest answer is
      that it is not a handle at all — the sentence falls through to the word
      doors, which is what every ordinary sentence does. A throw here would turn
      a forged string into a 500.
    */
    for (const forged of [
      replaceReaskHandle({
        newDesignPublicId: "d-new",
        residentDesignPublicId: "d-resident",
        placement: "sleeve" as "neck",
        side: "left",
        asked: ASKED,
      }),
      replaceReaskHandle({
        newDesignPublicId: "d-new",
        residentDesignPublicId: "d-resident",
        placement: "neck",
        side: "middle" as "centre",
        asked: ASKED,
      }),
      "«replace-design» d-new",
      "«replace-design» d-new d-resident neck",
    ]) {
      expect(pendingReaskFor(forged, false, HER), forged).toBeNull();
      expect(designNamedIn(forged), forged).toBeNull();
      expect(residentNamedIn(forged), forged).toBeNull();
    }
  });

  it("is answerable by TYPING, both ways (D-180)", () => {
    /*
      The box is the interface: a chip and the word are one code path.

      The vocabulary is the shared `YES`/`NO` list every yes/no question here
      answers to — *"yes please"* is not on it and resolves to nothing on this
      question exactly as it does on the other four, which is that list's
      standing behaviour rather than anything this offer decides. What matters
      here is that this question was ADMITTED to the branch at all: a kind left
      off it would refuse both words and only ever be answerable by tapping.
    */
    const rebuilt = pendingReaskFor(offer().about!, false, HER)!;
    for (const yes of ["yes", "Yes", "yep", "ok"]) {
      expect(resolveAnswer(rebuilt, yes), yes).toBe(ASKED);
    }
    for (const no of ["no", "No", "nope", "nah"]) {
      expect(resolveAnswer(rebuilt, no), no).toBe(DISCARD_THE_DESIGN);
    }
  });

  it("an unrecognised reply answers NOTHING — she has moved on, and both rows stand", () => {
    /*
      The null return is what stops a resident dying by accident: a reply that
      is not an answer runs as a fresh instruction, and `refineService` reads
      the adopt off a RECOGNISED answer only.
    */
    const rebuilt = pendingReaskFor(offer().about!, false, HER)!;
    for (const other of ["make her hair red", "actually put it on her neck", "hmm"]) {
      expect(resolveAnswer(rebuilt, other), other).toBeNull();
    }
  });
});

/**
 * THE SIDE QUESTION — and the property that makes it answerable at all.
 *
 * Every other question here can be checked by reading its chips. This one has a
 * condition the chips must satisfy DOWNSTREAM: the take accepts a side only
 * when the word is in HER SENTENCE (source containment, D-79), so a chip that
 * put the side beside her words instead of inside them would resolve into a
 * sentence that raises the SAME question again — the loop a question exists to
 * end. The end-to-end proof of that is in `refineService.test.ts`, driving the
 * real take; these are the properties that can be read here.
 */
describe("which-side — the word has to land IN her sentence", () => {
  const asked = "use this tattoo design on her upper arm";

  it("puts the side word inside the sentence it resolves to", () => {
    for (const option of whichSideReask(asked, HER).options) {
      const side = option.label === "Her left" ? "left" : "right";
      /* The containment guard's own test, applied to our own chip. */
      expect(new RegExp(`\\b${side}\\b`, "i").test(option.resolves), option.label).toBe(true);
    }
  });

  it("keeps HER placement wording untouched", () => {
    /* A rewrite of that half is the product choosing a body part for her, and
       the take reads the placement out of this same string. */
    for (const option of whichSideReask(asked, HER).options) {
      expect(option.resolves.startsWith(asked)).toBe(true);
    }
  });

  it("offers both sides and NOTHING ELSE — it may not guess and may not default", () => {
    /* R7-7G: 300 credits refunded twice for a design on the wrong anatomical
       side. A third chip that meant "you choose" would be that refund with a
       tap target. */
    const raised = whichSideReask(asked, HER);
    expect(raised.options).toHaveLength(2);
    expect(raised.options.map((one) => one.resolves)).toEqual([
      `${asked} (her left)`,
      `${asked} (her right)`,
    ]);
  });

  it("carries its own name, because her words cannot rebuild it", () => {
    /* It is raised on a MODEL'S READING of her sentence — a placement and an
       absent side — and re-reading the words recovers neither. */
    const raised = whichSideReask(asked, HER);
    expect(raised.about).toBe(reaskHandle("which-side", asked));
    expect(pendingReaskFor(raised.about!, false, HER)?.kind).toBe("which-side");
    /* And without the handle her sentence rebuilds nothing at all, which is
       what the handle is for. */
    expect(pendingReaskFor(asked, false, HER)).toBeNull();
  });

  it("says nothing about a price, because nothing has been claimed", () => {
    const said = whichSideReask(asked, HER).question.toLowerCase();
    expect(said).toContain("her left or her right");
    for (const money of ["credit", "25", "charge you", "cost"]) {
      expect(said, money).not.toContain(money);
    }
  });
});

/*
  THE PART SHE POINTED AT, AS A REFERENT — census card C2.

  A tap answers *which part?*, so the question must not be asked of somebody who
  already answered it. These arms are about the DERIVATION; the service arms
  (`refineService.test.ts`) drive what the answer is used for.
*/
describe("a scope can be a colour referent", () => {
  it("answers the one colour-bearing facet a scoped slot carries", () => {
    expect(colourFacetOfScope("eye@left")).toBe(facetOfSubject("eyeColourFree"));
    expect(colourFacetOfScope("eye@right")).toBe(facetOfSubject("eyeColourFree"));
    expect(colourFacetOfScope("hair")).toBe(facetOfSubject("hairShade"));
  });

  it("answers NULL for a scope that cannot hold a colour, and for none at all", () => {
    /* `brow@left` and `lips` are real slots with real facets and no colour
       among them — the question is still the honest reply there. */
    expect(colourFacetOfScope("brow@left")).toBeNull();
    expect(colourFacetOfScope("lips")).toBeNull();
    expect(colourFacetOfScope(undefined)).toBeNull();
    expect(colourFacetOfScope(null)).toBeNull();
    /* A key the catalogue cannot name at all — the service refuses those long
       before this point, and the derivation must not invent an answer either. */
    expect(colourFacetOfScope("kneecap")).toBeNull();
  });

  it("THE PREMISE, PINNED — no slot carries two colour-bearing facets today", () => {
    /*
      ⚠ THIS ARM EXISTS BECAUSE A SABOTAGE FOUND NOTHING.

      `colourFacetOfScope` refuses to answer when a slot carries MORE than one
      colour-bearing facet, and removing that guard reddens no test — because no
      slot in the catalogue carries two. A branch with no test, under a comment
      calling itself unreachable, is the shape this codebase has paid for
      before.

      So the premise is pinned instead of the branch: the day a slot gains a
      second colour-bearing facet, THIS goes red, the guard becomes reachable,
      and whoever made that change owns writing its arm. That is a test that
      cannot be satisfied by editing a number, and it fails for a real reason.
    */
    const colourBearing = new Set([
      facetOfSubject("hairShade"), facetOfSubject("eyeColourFree"), facetOfAxis("makeup"),
    ]);
    const twoOrMore = SLOT_CATALOGUE
      .filter((entry) => entry.facets.filter((facet) => colourBearing.has(facet)).length > 1)
      .map((entry) => entry.feature);
    expect(twoOrMore).toEqual([]);
    /* And the positive half: some catalogue entry really does carry exactly
       one, so an empty catalogue could not pass the line above. */
    const exactlyOne = SLOT_CATALOGUE
      .filter((entry) => entry.facets.filter((facet) => colourBearing.has(facet)).length === 1);
    expect(exactlyOne.length).toBeGreaterThan(0);
  });
});
