/**
 * THE WORDS INK ROAD — one placement list, no flag (#1577 slice D3).
 *
 * `CASTING_INK_WORDS_SCOPE` decided whether a words-born tattoo could land past
 * the neck: `WORDS_ROAD_PLACEMENTS` (`neck` alone) against
 * `WORDS_ROAD_PLACEMENTS_OPEN` (`neck`, `upperArm`, `upperChest`). It stood at
 * `all` on the service — read by name with a negative control before the cut —
 * so the narrow list was a road nobody was on, and it is retired on his word of
 * 2026-10-15 (*"yes approve the plan and switch off the six settings"*).
 *
 * # ⚠ THIS FILE REPLACES `inkWordsScope.test.ts`, AND IT IS NOT A RENAME
 *
 * That suite's boot-guard and both-sides-of-the-flag arms die with the flag —
 * the fence is gone and there is no second side to assert. **But most of it was
 * never about the flag at all**, and slice D2's finding is the reason this file
 * exists rather than a deletion: a retirement can orphan an arm aimed at
 * something else entirely. Carried over here, each still driven through the real
 * classifier:
 *
 *   1. all three measured placements are served, and the chest is refused by
 *      the OUTFIT rather than by the road — which is why the 2026-08-23
 *      widening was dark in production;
 *   2. an unmeasured surface is refused, so the road reaches the vocabulary and
 *      never past it;
 *   3. the two refusals are told apart — a thigh nobody has measured against an
 *      upper chest the product can see and cannot keep;
 *   4. visibility beats the vocabulary: the nape is a neck word and is refused;
 *   5. the mark lane is untouched and the face stays retired on the ink lane;
 *   6. the refusal sentence names every served placement, with its articles
 *      agreeing.
 *
 * ⚠ **One arm could NOT be carried and is replaced rather than dropped.** The
 * dead suite's last control asserted that the OPEN and CLOSED sentences DIFFER,
 * *"so neither can pass by never changing"* — it existed to catch the
 * derivation being quietly replaced by a constant again (census finding 4(c),
 * where the sentence was hard-coded and told accounts the product was smaller
 * than it is). With one road there is one sentence and no difference to assert.
 * The replacement holds the sentence and the road to the SAME list, placement
 * by placement, so the two cannot drift apart.
 *
 * ⚠ **AND ITS LIMIT IS STATED RATHER THAN DISCOVERED, because the sabotage pass
 * found it: a constant frozen to TODAY'S list is invisible to it.** Driven —
 * replacing the derivation with a hard-coded sentence naming all three served
 * placements leaves this suite 15 of 15 GREEN. That is not a hole so much as an
 * identity: a constant equal to the derived value is observationally the same
 * value, and no test outside this module can tell them apart while the list
 * holds still. What the arm does catch is the pair DISAGREEING, which is the
 * failure that has actually shipped here (census finding 4(c), where the
 * sentence named one placement and the road served two) — proven by freezing
 * the sentence AND shrinking the list in one sabotage, which reddens this arm
 * by name. The dead suite's two-sentence control could catch a function
 * ignoring its argument; with no argument left, this is the claim that remains
 * available, and it is the one that matters on the day a fourth surface is
 * measured.
 *
 * ⚠ **And the per-lane arm (5) is kept here even though it is NOT the only
 * cover — checked rather than assumed.** `refineDelta.test.ts` drives the same
 * carve-out through the real `readDelta` entrance (a forehead MARK files, a
 * forehead TATTOO is refused), which is the better cover of the two. It is
 * carried anyway because this is the file that names the list, and that is
 * where a future edit would widen the wrong one.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  INK_PLACEMENTS, inkPlacementBareNoun, inkPlacementEntry,
} from "../../shared/inkPlacementVocabulary";
import { declaredEnvNames, serverAndSharedSources } from "../../scripts/lib/declaredEnvNames.mts";
import {
  FLAG_CATALOGUE,
  LAW_SURFACES,
  cataloguedFlags,
  flagCatalogue,
  indexedFlags,
} from "../../scripts/lib/lawText.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../../scripts/lib/productionFlagPositions.mts";
import {
  classifyInkPlacement,
  inkNeedsDocumentMessage,
  servedAndBarePlacements,
  wordsRoadServes,
  type InkPlacement,
} from "./inkPlacement";
/* The three sentences #2562's sweep filed as #2580 — read through the real
   derivation here, where an outfit exists to move them. */
import { cannotSaySentence } from "./cannotSayCopy";
/* #2601's arm reads the coverage REASONS, which the nouns above cannot show:
   `covered` and `unknown` both leave the list empty and only one of them was
   ever what the sentence claimed. */
import { wardrobeCoversSurface } from "./inkSurfaceCoverage";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import type { WardrobeResolution } from "./wardrobeLine";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* `source: "born"` with a path was #1577 slice 2's retired shape; the one
   source that still reads a line's coverage is `edited`, so that is what a
   bare outfit is written as here (inkCoverageDemandReach.test.ts's shape). */
const born = (_path: "wardrobe" | "basics", line: string): WardrobeResolution =>
  ({ kind: "line", line, source: "edited" });

/** Every roll in both worlds: no line recorded, which answers the house tee. */
const UNPATHED: WardrobeResolution = { kind: "unpathed" };
/** An outfit that leaves all three surfaces showing. */
const BARE = born("basics", basicsWardrobeLine("male"));

const ink = (said: string, wardrobe?: WardrobeResolution) =>
  classifyInkPlacement(said, "ink", wardrobe);

/**
 * AN OUTFIT THAT LEAVES NOTHING SHOWING — the empty case has a real sentence
 * (#2562), and it no longer claims to have read the outfit (#2601).
 *
 * ⚠ **IT WAS NAMED FOR THE WRONG REASON, AND THAT WAS THE CONFLATION THE
 * DEFECT WAS MADE OF.** A jumper is not on `BASICS_LINES` and is not the house
 * line, so `coverageOfWardrobeLine` does not recognise it and answers
 * **`unknown` on all three surfaces** — never `covered`. Only `bare` survives
 * `bareSurfaces`, so the list arrives empty either way and the old sentence
 * told the customer the first reason. The name says the reason now, because a
 * fixture that misnames its own reason is how a suite comes to pin the very
 * sentence it should be refusing.
 *
 * ⚠ **And it is the ONLY reachable empty case** — driven in the reasons arm
 * below: the one `covered` answer in either table is the house chest, and the
 * house table leaves the neck and upper arm bare, so any line the reader knows
 * leaves at least two surfaces showing.
 */
const UNREADABLE_OUTFIT = born("basics", "a charcoal roll-neck jumper");

/**
 * THE PLACES A REFUSAL CARRIES, read off the classifier rather than retyped.
 *
 * #2562: the sentence no longer derives its own list, so the arms below compose
 * it exactly the way the product does — classify an ask against an outfit, then
 * say what that classification handed over. A test that typed the list itself
 * would pass while the two readers disagreed, which is the whole defect.
 */
const offered = (placement: InkPlacement): readonly string[] =>
  ("alternatives" in placement ? placement.alternatives : []);

/** The refusal sentence an ask with no measured place earns on this outfit. */
const saidFor = (wardrobe?: WardrobeResolution) =>
  inkNeedsDocumentMessage(offered(ink("a rose tattoo on her thigh", wardrobe)));

describe("the words road serves every measured placement, with no flag to ask", () => {
  it("all three land on an outfit that leaves them showing", () => {
    for (const said of [
      "a small rose tattoo on her neck",
      "a band tattoo on her left upper arm",
      "a swallow tattoo on her upper chest",
    ]) {
      expect(ink(said, BARE).kind, said).toBe("in_frame");
    }
  });

  it("⚠ and the chest is refused by the OUTFIT, never by the road", () => {
    /* THE UNPATHED CAST — every roll in both worlds. The house crew tee covers
       the chest and the coverage owner is what says so, which is why the
       2026-08-23 widening was dark in production and stays dark now. */
    const chest = ink("a swallow tattoo on her upper chest", UNPATHED);
    expect(chest.kind).toBe("not_carried");
    expect(
      chest.kind === "not_carried" ? chest.place : null,
      "the sentence needs the surface",
    ).toContain("upper chest");
    /* The neck on the same cast is served, so this is the garment talking and
       not a road that refuses everything. */
    expect(ink("a small rose tattoo on her neck", UNPATHED).kind).toBe("in_frame");
  });

  it("reaches the measured vocabulary and never past it", () => {
    /* His own condition is that the mint can find and crop the result, and a
       surface with no `readerWord` fails it. */
    for (const said of [
      "a full sleeve tattoo on her left arm",
      "a large back piece",
      "a rose tattoo on her thigh",
    ]) {
      expect(ink(said, BARE).kind, said).toBe("needs_document");
    }
  });

  it("⚠ tells the two refusals apart — a place unmeasured vs one it cannot keep", () => {
    /* Collapsing them would tell somebody who named a real surface that they
       need a design document, which is neither true nor actionable — and it is
       what they got before the words-road court. */
    expect(ink("a rose tattoo on her thigh", UNPATHED).kind).toBe("needs_document");
    expect(ink("a swallow tattoo on her upper chest", UNPATHED).kind).toBe("not_carried");
  });

  it("⚠ never reaches a hidden place, even though the neck is served", () => {
    /* Visibility beats the vocabulary: the nape is a neck word and the anchor
       cannot see it, so `neck` being served must not carry it in. */
    for (const said of ["a word tattooed on the nape of her neck", "a star behind her ear"]) {
      expect(ink(said, BARE).kind, said).toBe("needs_document");
    }
  });

  it("⚠ and no environment can take it back — the retired name changes nothing", () => {
    /*
      THE BEHAVIOURAL HALF of the retirement, and the one the textual shapes
      below cannot give. Every value the flag ever took is set in turn, and the
      road answers identically — so a resurrection by configuration is
      impossible rather than merely undocumented.
    */
    const name = "CASTING_INK_WORDS_SCOPE";
    const before = process.env[name];
    try {
      for (const value of ["off", "all", "users:1", ""]) {
        process.env[name] = value;
        expect(ink("a band tattoo on her left upper arm", BARE).kind, value).toBe("in_frame");
        expect(ink("a swallow tattoo on her upper chest", BARE).kind, value).toBe("in_frame");
        expect(saidFor(BARE), value).toContain("upper arm");
      }
    } finally {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    }
  });
});

describe("the refusal sentence comes off the same list the road does", () => {
  it("names every served placement, and its articles agree", () => {
    /* ⚠ ON A CAST WHOSE OUTFIT LEAVES ALL THREE SHOWING — #2562. The sentence
       asks both questions now, so the population it names is the road's list
       intersected with this outfit's bare surfaces; `BARE` is the fixture where
       those two are the same set, which is what keeps this arm about the ROAD. */
    const said = saidFor(BARE);
    expect(said).toContain("Tell me where");
    expect(said).toContain("neck");
    expect(said).toContain("upper arm");
    expect(said).toContain("upper chest");
    /* "an upper arm", never "a upper arm" — the article agrees with the word
       after it, which is the kind of thing that makes a careful product look
       careless when it is wrong. */
    expect(said).toContain("an upper arm");
    expect(said).not.toContain("a upper arm");
    /* Both things every refusal on this road owes. */
    expect(said).toContain("body-art studio is coming");
    expect(said).toContain("Nothing was charged");
  });

  it("⚠ CONTROL — the sentence and the road are held to ONE list, placement by placement", () => {
    /*
      THE REPLACEMENT FOR THE DEAD TWO-SENTENCE CONTROL, and it is the stronger
      claim. A pair of assertions about one string is satisfied by a string that
      ignores its argument — which is exactly what census finding 4(c) found
      shipped: a hard-coded *"a neck tattoo is the one I can do"* said to
      accounts whose upper arm the road served.

      So the two readers are compared to each other over the whole vocabulary:
      what the road SERVES and what the sentence NAMES must agree key by key.

      ⚠ This catches the two DISAGREEING, not a constant that happens to equal
      today's derivation — see the header. Sabotage: freezing the sentence alone
      leaves this green; freezing it and shrinking the list reddens this arm by
      name.
    */
    const said = saidFor(BARE);
    expect(INK_PLACEMENTS.length, "the vocabulary is a real population").toBeGreaterThan(0);
    let served = 0;
    for (const key of INK_PLACEMENTS) {
      const noun = inkPlacementEntry(key).noun.replace(/^(?:her|his|their)\s+/, "");
      if (wordsRoadServes(key)) {
        served += 1;
        expect(said, `${key} is served, so the sentence must name it`).toContain(noun);
      } else {
        expect(said, `${key} is NOT served, so the sentence must not offer it`).not.toContain(noun);
      }
    }
    expect(served, "and the road serves something, so the arm above asserted something")
      .toBeGreaterThan(0);
  });

  it("⚠ does not claim face ink works", () => {
    /* It said "face and neck ink works today" for as long as this road existed
       and the face half was never true — the sentence is what the 2026-08-21
       retirement was FOR, so a future edit putting it back goes red here. */
    expect(saidFor(BARE).toLowerCase()).not.toContain("face");
  });
});

/**
 * ⚠ AND IT COMES OFF THE OUTFIT TOO, WHICH IT DID NOT UNTIL #2562.
 *
 * The sentence was derived from the road and from nothing else, so from the day
 * the upper chest joined `WORDS_ROAD_PLACEMENTS_OPEN` (2026-08-23) it offered an
 * upper chest to a cast in the house crew tee — and `gate_ink_uncarried`, the
 * door one ask later, refuses exactly that chest. Three places named, one of
 * them shut.
 *
 * The arms come in PAIRS on the same ask, because an arm that only watches the
 * chest DISAPPEAR is satisfied by a sentence that has simply shrunk — census
 * 4(c)'s own lesson, where a frozen *"a neck tattoo"* passed every assertion
 * anybody had written about it. One ask, three outfits, three sentences.
 */
describe("⚠ the sentence names only what THIS cast's outfit leaves showing (#2562)", () => {
  it("drops the chest under the house tee, and keeps it on a bare one", () => {
    /* THE DEFECT, and it is one ask read against two outfits. `UNPATHED` is
       every roll in both worlds; `BARE` is a cast whose own line leaves all
       three showing. */
    const tee = saidFor(UNPATHED);
    expect(tee, "the tee covers the chest, so the chest is not on offer")
      .not.toContain("upper chest");
    expect(tee, "and the two that do work are still named").toContain("neck");
    expect(tee).toContain("upper arm");

    const bare = saidFor(BARE);
    expect(bare, "a bare chest is a real place, so it is offered").toContain("upper chest");

    /* ⚠ THE CONTROL: the ask is byte-identical in both, so the only thing that
       moved is the outfit. Without this an arm pair above is satisfied by a
       sentence that ignores its argument. */
    expect(bare).not.toBe(tee);
  });

  it("⚠ and the places it names are the SAME set the covering door offers", () => {
    /*
      The two sentences a customer can meet one ask apart must describe one
      product. `gate_ink_uncarried` already carried `servedAndBare`'s answer;
      this door derived its own, and that is how they came to disagree. So the
      claim is not "the chest is absent" — it is that both doors, on the same
      cast, offer the same places.
    */
    const covered = ink("a swallow tattoo on her upper chest", UNPATHED);
    expect(covered.kind, "the covering door, on the cast the tee answers").toBe("not_carried");
    const nowhere = ink("a rose tattoo on her thigh", UNPATHED);
    expect(nowhere.kind).toBe("needs_document");
    expect(offered(nowhere), "one derivation, two doors").toEqual(offered(covered));
    expect(offered(nowhere).length, "and it is a real population").toBeGreaterThan(0);
  });

  it("⚠ an outfit that leaves nothing showing gets an honest sentence, not a gap", () => {
    /*
      A roll-neck jumper leaves none of the three showing, and the old sentence
      would have read *"Tell me where it goes —  from a description alone"*: a
      refusal that names nothing and reads as broken. `elsewhereClause` answers
      this case for the three sibling gates and says *"nowhere ELSE"*, which is
      wrong at this door — it is reached by an ask that named no place at all.

      ⚠ **AND IT NO LONGER CLAIMS THE OUTFIT COVERS ANYTHING — #2601.** This
      arm asserted *"covers every place that works"* on a fixture the coverage
      reader answers `unknown` for, so the suite was pinning the defect.
    */
    expect(offered(ink("a rose tattoo on her thigh", UNREADABLE_OUTFIT)), "the premise of this arm")
      .toEqual([]);
    const said = saidFor(UNREADABLE_OUTFIT);
    expect(said).toContain("nowhere showing");
    expect(said, "#2601 — it must not assert a coverage reading it is not holding")
      .not.toContain("covers every place");
    expect(said, "it says what moves it — D-180's every-answer-acts rule")
      .toContain("Change the outfit first");
    expect(said).toContain("work from a design instead");
    expect(said).toContain("Nothing was charged");
    /* And it does NOT ask where, because telling us where would not help. */
    expect(said).not.toContain("Tell me where");
    /* The gap this is here to prevent, pinned at the shape rather than the
       words: no dangling article and no empty list between the dash and the
       noun. */
    expect(said).not.toMatch(/—\s+tattoo/);
    expect(said).not.toMatch(/ {2}/);
  });

  /*
    ⚠ THE SENTENCE IS TRUE OF BOTH REASONS THE LIST CAN BE EMPTY FOR (#2601).

    `bareSurfaces` keeps only `bare`, so a surface drops out of the offered list
    when the outfit `covered` it OR when the coverage reader did not recognise
    the line and answered `unknown`. **Those are different facts and the copy
    cannot tell them apart** — it is handed a list, and an empty list is empty
    either way. The old sentence picked one (*"this outfit covers every place
    that works"*) and stated it, which is a claim about the customer's clothes
    made on a reading the product never had.

    So the arms below assert the SENTENCE and the REASONS, never the list: the
    list is identical in both and that is the whole point of the card.
  */
  it("⚠ the empty sentence claims no coverage, because the reason may be `unknown`", () => {
    /* THE REASON, read at the coverage door rather than inferred from the list:
       a jumper is on neither table, so all three answer `unknown`. */
    for (const key of INK_PLACEMENTS) {
      expect(wardrobeCoversSurface(UNREADABLE_OUTFIT, key), `${key} on an unreadable line`)
        .toBe("unknown");
    }
    /* A SECOND unreadable line, nothing like the first: the sentence must not
       depend on which outfit we could not read. */
    const alsoUnreadable: WardrobeResolution =
      { kind: "line", line: "full plate armour, helmet down, gorget buckled", source: "edited" };
    for (const key of INK_PLACEMENTS) {
      expect(wardrobeCoversSurface(alsoUnreadable, key)).toBe("unknown");
    }
    expect(saidFor(alsoUnreadable), "one sentence for every unreadable outfit")
      .toBe(saidFor(UNREADABLE_OUTFIT));

    /* ⚠ THE CLAIM ITSELF. The copy is reason-BLIND by construction — it is a
       function of the empty list — so the one sentence it says must be true
       whichever reason produced it. Held at the words rather than by argument:
       it says nothing about what the outfit covers. */
    const said = saidFor(UNREADABLE_OUTFIT);
    expect(said).toBe(inkNeedsDocumentMessage([]));
    expect(said, "it must not assert a coverage reading it is not holding")
      .not.toContain("covers every place");
    expect(said, "nor any other claim about what the clothes do").not.toContain("covers");
    /* And it still says what is true of both, and what moves it. */
    expect(said).toContain("nowhere showing");
    expect(said).toContain("Change the outfit first");
    expect(said).toContain("work from a design instead");
  });

  it("⚠ CONTROL — and `covered` alone cannot empty the list at all", () => {
    /*
      The stronger form of the defect, measured here rather than reasoned: the
      only `covered` answer in either table is the house chest, and the house
      table leaves the neck and the upper arm `bare`. So **every line the reader
      recognises leaves at least two surfaces showing**, and an empty list means
      *we could not read it* — every time, not sometimes. That is why (a) was
      the right repair and why no fixture below can be an all-`covered` cast:
      the product cannot express one.

      This arm is what tells a later reader that a missing `covered` fixture is
      an absence in the PRODUCT and not a hole in the suite.
    */
    const recognised: readonly string[] = [
      HOUSE_WARDROBE_LINE,
      basicsWardrobeLine("male"),
      basicsWardrobeLine(null),
      /* Retired, and it never leaves the list — two production rolls wear it. */
      "shirtless, in plain black fitted shorts, barefoot",
    ];
    for (const line of recognised) {
      for (const source of ["brief", "edited"] as const) {
        const resolution: WardrobeResolution = { kind: "line", line, source };
        const reasons = INK_PLACEMENTS.map((key) => wardrobeCoversSurface(resolution, key));
        expect(reasons, `a recognised line must never read as unreadable: ${source}`)
          .not.toContain("unknown");
        expect(
          servedAndBarePlacements(resolution).length,
          `a recognised line leaves somewhere showing: ${source} ${line.slice(0, 24)}`,
        ).toBeGreaterThan(0);
      }
    }
    /* Both controls, so the two claims above are real rather than vacuous. */
    expect(wardrobeCoversSurface(UNPATHED, "upperChest"), "the reader does say `covered`")
      .toBe("covered");
    expect(servedAndBarePlacements(UNREADABLE_OUTFIT), "and an empty list IS reachable")
      .toEqual([]);
  });
});

/**
 * ⚠ AND THE SAME CLAIM FOR THE THREE SENTENCES THAT ASKED NEITHER QUESTION
 * (#2580 — the law-7 siblings #2562's own sweep filed).
 *
 * `gate_ink_document` above at least DERIVED its list, from the road, and
 * missed only the outfit. These three — `unplacedInk`, `inkBeyondToday` and
 * `noInkToChange`'s unscoped branch — were frozen prose naming all three
 * surfaces, so they would have gone on saying *"her upper chest"* even if a
 * placement left the road entirely. The house crew tee covers the chest, which
 * makes the wrong sentence the one the DEFAULT cast reads.
 *
 * These arms compose the sentence the way the product does — derive against an
 * outfit, then say it — because `cannotSayCopy.test.ts` can only prove the copy
 * says what it is handed, and the claim that matters is that what it is handed
 * came from the OUTFIT.
 */
describe("⚠ the three frozen ink sentences read the outfit too (#2580)", () => {
  const INK_SENTENCES = ["unplacedInk", "inkBeyondToday", "noInkToChange"] as const;

  /** The sentence each of the three earns on this cast, through the real derivation. */
  const sentence = (reason: typeof INK_SENTENCES[number], wardrobe?: WardrobeResolution) =>
    cannotSaySentence(reason, {
      words: null,
      facet: "ink",
      scopeNoun: null,
      moneySafe: true,
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      /* THE PRODUCT'S OWN CALL, not a typed list — both `refineService` call
         sites pass exactly this expression against the same `wardrobeNow` the
         ink gate is asked with. */
      inkPlaces: servedAndBarePlacements(wardrobe),
    });

  it("one ask, three outfits, three sentences — on each of the three doors", () => {
    for (const reason of INK_SENTENCES) {
      const tee = sentence(reason, UNPATHED);
      expect(tee, `${reason}: the tee covers the chest, so it is not offered`)
        .not.toContain("upper chest");
      expect(tee, `${reason}: the two that work are still named`).toContain("neck");
      expect(tee, `${reason}: the two that work are still named`).toContain("upper arm");

      const bare = sentence(reason, BARE);
      expect(bare, `${reason}: a bare chest is a real place`).toContain("upper chest");

      /* ⚠ THE CONTROL: the reason and the pronouns are byte-identical across
         the pair, so the only thing that moved is the OUTFIT. Without it the
         two arms above are satisfied by a sentence that ignores its argument
         and has merely shrunk — census 4(c)'s own lesson. */
      expect(bare, `${reason}: the outfit moved nothing`).not.toBe(tee);

      const covered = sentence(reason, UNREADABLE_OUTFIT);
      expect(covered, `${reason}: a jumper leaves nowhere, and it says so`)
        .toContain("nowhere showing");
      expect(covered, `${reason}: and it names what moves it`).toContain("Change what she's wearing");
      for (const key of INK_PLACEMENTS) {
        expect(covered, `${reason}: offers ${key} under a roll-neck jumper`)
          .not.toContain(inkPlacementBareNoun(key));
      }
      /* The gap this is here to prevent, at the shape rather than the words: no
         dangling dash with nothing after it, and no doubled space where a list
         used to be. */
      expect(covered, `${reason}: a dangling list`).not.toMatch(/— {0,1}\.|— {0,1},/);
      expect(covered, `${reason}: a collapsed list`).not.toMatch(/ {2}/);
    }
  });

  it("⚠ and all three name the SAME set as the two doors #2562 and #2558 fixed", () => {
    /*
      Five doors a customer can meet one ask apart, on one cast. The claim is
      the SET, not "the chest is absent": `gate_ink_document`'s sentence and
      these three are reached by asks a few words apart, and before this they
      were kept in step by two different accidents — one derivation that forgot
      the outfit, and two copies of frozen prose.
    */
    for (const wardrobe of [UNPATHED, BARE]) {
      const fromTheGate = offered(ink("a rose tattoo on her thigh", wardrobe));
      expect(fromTheGate.length, "the premise of this arm").toBeGreaterThan(0);
      for (const reason of INK_SENTENCES) {
        const said = sentence(reason, wardrobe);
        const named = INK_PLACEMENTS
          .filter((key) => said.includes(inkPlacementBareNoun(key)))
          .map((key) => inkPlacementBareNoun(key));
        expect(named, `${reason} and the document gate disagree`).toEqual([...fromTheGate]);
      }
    }
  });

  it("⚠ CONTROL — the derivation's two shapes cannot disagree", () => {
    /*
      `servedAndBare` (the nouns the four refusals carry) and
      `servedAndBarePlacements` (the keys these three sentences carry) are one
      filter read two ways since #2580. If they ever became two filters, the
      document gate and these doors would drift again and every arm above would
      still pass — each reading its own half. So they are held equal here, on
      every outfit, through the only public road to the first one.
    */
    for (const wardrobe of [UNPATHED, BARE, UNREADABLE_OUTFIT]) {
      expect(
        servedAndBarePlacements(wardrobe).map((key) => inkPlacementBareNoun(key)),
        "the keys and the nouns are the same set",
      ).toEqual([...offered(ink("a rose tattoo on her thigh", wardrobe))]);
    }
  });
});

describe("the mark lane is untouched, and the face stays retired on the ink lane", () => {
  /* Carried from the dead suite. NOT the only cover — `refineDelta.test.ts`
     drives the same carve-out through the real `readDelta` entrance — and kept
     because this is the file that names the list a wrong widening would touch.
     The first version of the 2026-08-21 retirement generalised across both
     lanes and four arms went red on his own sentence. */
  it("a design-named mark still renders on a face", () => {
    expect(classifyInkPlacement("a lightning bolt scar on her forehead", "mark", BARE).kind)
      .toBe("in_frame");
  });

  it("and a tattoo on a face is still refused", () => {
    expect(classifyInkPlacement("a lightning bolt tattoo on her forehead", "ink", BARE).kind)
      .toBe("needs_document");
  });
});

describe("and it stays retired (#1577 slice D3)", () => {
  const RETIRED = "CASTING_INK_WORDS_SCOPE";
  /** Its parent, which is live and keeps everything it had. */
  const PARENT = "CASTING_V2_SCOPE";

  const SOURCES = serverAndSharedSources(repoRoot);
  const TEXTS = SOURCES.map((file) => ({ file, text: readFileSync(file, "utf8") }));
  const DECLARED = declaredEnvNames(SOURCES);

  it("shape 1 — no module DECLARES it as an env name any more", () => {
    expect(SOURCES.length, "the file walk found a real tree").toBeGreaterThan(100);
    expect(DECLARED, "the control: the reader finds a flag that is really there").toContain(PARENT);
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("shape 2 — nothing reads it bare off `process.env`", () => {
    /*
      ⚠ THE CONTROL MUST NOT BE A SIBLING SCOPE FLAG — slice D1's finding,
      inherited. Every `CASTING_*_SCOPE` is read through its own `*_ENV`
      constant, so `process.env.CASTING_…` appears nowhere for any of them and a
      sibling would "prove" the reader works by being just as absent as the
      retired name. `ENABLE_FINAL_MODEL_DELETE` is read bare in production
      source, which is what makes it a real positive control.
    */
    const BARE_LIVE = "ENABLE_FINAL_MODEL_DELETE";
    const bare = (name: string) => TEXTS
      .filter(({ text }) => text.includes(`process.env.${name}`)
        || text.includes(`process.env["${name}"]`))
      .map(({ file }) => path.relative(repoRoot, file));

    expect(bare(BARE_LIVE), "the control: a bare read of a live flag is findable")
      .toContain(path.join("server", "routes", "models.ts"));
    expect(bare(RETIRED)).toEqual([]);
  });

  it("shape 3 — it has no production position, and its parent keeps its own", () => {
    /* A row for a variable nothing declares can never disagree with anything,
       which is the quietest way for that table to rot. ⚠ And until the Railway
       variable comes off — which happens AFTER this code deploys, never before
       — `comparePositions` reports it as set on the service and absent from the
       table. That one mismatch is the intended window, not a fault. */
    expect(PRODUCTION_FLAG_POSITIONS[PARENT], "the control: the parent keeps its row")
      .toBeDefined();
    expect(PRODUCTION_FLAG_POSITIONS[RETIRED]).toBeUndefined();
  });

  it("and the law still NAMES it, retired, rather than quietly dropping it", () => {
    /*
      ⚠ THE INDEX AND THE CATALOGUE ARE READ SEPARATELY, THROUGH THEIR OWN
      MEMBERSHIP READERS — slice D2's finding, and it cost that slice a sabotage
      that SURVIVED. An arm reading `lawText(repoRoot)` is reading the two
      surfaces JOINED, so `toContain(RETIRED)` is satisfied by the catalogue
      entry the next assertion checks on its own, and deleting the CLAUDE.md row
      — the one thing such an arm exists to protect — changes nothing.

      The index surface is DERIVED from `LAW_SURFACES` minus the catalogue rather
      than spelled again, so a third surface, a rename or a moved file cannot
      leave this arm reading a file nobody maintains.
    */
    const indexSurfaces = LAW_SURFACES.filter((file) => file !== FLAG_CATALOGUE);
    expect(indexSurfaces, "one law surface is the index and the other is the catalogue")
      .toHaveLength(1);
    const CLAUDE_MD = readFileSync(path.join(repoRoot, indexSurfaces[0]!), "utf8");
    const CATALOGUE = flagCatalogue(repoRoot);

    expect(indexedFlags(CLAUDE_MD), "the control: the index lists live flags").toContain(PARENT);
    expect(cataloguedFlags(CATALOGUE), "the control: the catalogue lists live flags")
      .toContain(PARENT);

    expect(indexedFlags(CLAUDE_MD), "the index must still carry a row for it").toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "and the catalogue must still carry its entry")
      .toContain(RETIRED);

    /* Anchored on the BULLET rather than on the first mention of the name
       anywhere, so a neighbouring entry that merely cites this flag in its prose
       cannot move where this slice starts. */
    const bullet = CATALOGUE.indexOf(`- \`${RETIRED}\``);
    expect(bullet, "the catalogue's own top-level entry for it").toBeGreaterThan(-1);
    expect(CATALOGUE.slice(bullet, bullet + 6_000)).toMatch(/RETIRED/);
  });
});
