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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readDelta } from "./refineDelta";
import { REFINE_ANSWERING_MAX_LENGTH, REFINE_INSTRUCTION_MAX_LENGTH } from "./refineLimits";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS } from "./refineSubjects";
import {
  REASK_HANDLE_MAX_LENGTH,
  REASK_KINDS,
  alreadyUpsweptReask,
  colourFacetLabel,
  colourFacetOf,
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
    expect(pendingReaskFor("piink hair", false)?.kind).toBe("did-you-mean");
  });

  it("rebuilds the cold-start question only when there is no colour history", () => {
    expect(pendingReaskFor("pinker", false)?.kind).toBe("which-facet");
    /* With a colour edit behind it, history answers silently and there was
       never a question to reopen. */
    expect(pendingReaskFor("pinker", true)).toBeNull();
  });

  it("is null for an ordinary instruction", () => {
    expect(pendingReaskFor("give her a fringe", false)).toBeNull();
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
    expect(pendingReaskFor("copy hair from reference", false)).toBeNull();
    expect(pendingReaskFor("copy this hair", false)).toBeNull();
  });

  it("still asks every question that was never hair's", () => {
    /* The typo door, on the same misspelled hair ask that used to reach the
       reference question through it. */
    expect(pendingReaskFor("copy hiar from reference", false)?.kind).toBe("did-you-mean");
    /* And the cold-start colour question, which sat directly beneath the
       deleted branch. */
    expect(pendingReaskFor("pinker", false)?.kind).toBe("which-facet");
    expect(pendingReaskFor("pinker", true)).toBeNull();
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
    const reask = glassesHideEyesReask("fox eyes");
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
      alreadyUpsweptReask("fox eyes"),
      glassesHideEyesReask("fox eyes"),
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
    { kind: "already-upswept", asked: "fox eyes", build: alreadyUpsweptReask },
    { kind: "glasses-hide-eyes", asked: "give her a cat eye", build: glassesHideEyesReask },
    { kind: "which-side", asked: "use this tattoo design on her arm", build: whichSideReask },
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
      build: (asked) => replaceDesignReask({
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
      build: (asked) => sameAgainReask({ asked, priceCredits: 25 }),
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
      const rebuilt = pendingReaskFor(answering, false);
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
    const rebuilt = pendingReaskFor(raised.about!, false);
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
      expect(pendingReaskFor(forged, false), forged).toBeNull();
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
    const rebuilt = pendingReaskFor(offer().about!, false)!;
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
    const rebuilt = pendingReaskFor(offer().about!, false)!;
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
    for (const option of whichSideReask(asked).options) {
      const side = option.label === "Her left" ? "left" : "right";
      /* The containment guard's own test, applied to our own chip. */
      expect(new RegExp(`\\b${side}\\b`, "i").test(option.resolves), option.label).toBe(true);
    }
  });

  it("keeps HER placement wording untouched", () => {
    /* A rewrite of that half is the product choosing a body part for her, and
       the take reads the placement out of this same string. */
    for (const option of whichSideReask(asked).options) {
      expect(option.resolves.startsWith(asked)).toBe(true);
    }
  });

  it("offers both sides and NOTHING ELSE — it may not guess and may not default", () => {
    /* R7-7G: 300 credits refunded twice for a design on the wrong anatomical
       side. A third chip that meant "you choose" would be that refund with a
       tap target. */
    const raised = whichSideReask(asked);
    expect(raised.options).toHaveLength(2);
    expect(raised.options.map((one) => one.resolves)).toEqual([
      `${asked} (her left)`,
      `${asked} (her right)`,
    ]);
  });

  it("carries its own name, because her words cannot rebuild it", () => {
    /* It is raised on a MODEL'S READING of her sentence — a placement and an
       absent side — and re-reading the words recovers neither. */
    const raised = whichSideReask(asked);
    expect(raised.about).toBe(reaskHandle("which-side", asked));
    expect(pendingReaskFor(raised.about!, false)?.kind).toBe("which-side");
    /* And without the handle her sentence rebuilds nothing at all, which is
       what the handle is for. */
    expect(pendingReaskFor(asked, false)).toBeNull();
  });

  it("says nothing about a price, because nothing has been claimed", () => {
    const said = whichSideReask(asked).question.toLowerCase();
    expect(said).toContain("her left or her right");
    for (const money of ["credit", "25", "charge you", "cost"]) {
      expect(said, money).not.toContain(money);
    }
  });
});
