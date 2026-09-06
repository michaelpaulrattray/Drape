/**
 * RE-IMAGINE — the author as a VISIBLE writing assistant on the brief (#535;
 * the design is `docs/specs/REIMAGINE_DESIGN_2026-09-06.md` §3, built on his
 * "build it", Crew replies #145/#146, 2026-09-06).
 *
 * # What this road is, in his contract
 *
 * Wherever there is a brief box, one press sends the words in the box through
 * this module and writes the result back INTO the box — visible, editable,
 * with Undo. Casting then always uses whatever is in the box. It replaces the
 * imagination meter entirely: there is no hidden mode, so the #252 lie (a
 * sheet saying "Max" over words nobody authored) has nothing to fall out of.
 *
 * # The instruction's contract (his decisions 3–11 on #535, plus the
 * 2026-09-05 correction and his two rolled courts)
 *
 *   - **A new idea, not a polish** (decision 3): the customer's words are the
 *     spark, not the cage; the result is recognisably born from them but may
 *     be a different being.
 *   - **Sex, age and species are LOCKED when typed** (decision 4). Nothing
 *     else is. ⚠ The 2026-09-05 correction is the load-bearing half: an
 *     earlier comment on the card said every named feature and material
 *     survives verbatim, and the confirmed list SUPERSEDES it — his words when
 *     he caught the gap: *"are you re-imagining this like our new re-imagine
 *     design or like our old imagination design?"* His two rolled courts
 *     settle it at his eye (law 9): rolls 244 vs 245 (*"10x better"*) and 243
 *     vs 246 (*"much better"*) — the qualities paragraph beat the
 *     keep-every-piece paragraph both times, and **named colours and
 *     materials ARE pieces**.
 *   - **Read the register first, carry it as qualities** (decisions 5–6): a
 *     detailed brief has MORE register to keep, not less; identity nouns only
 *     for the two or three things that make the type the type.
 *   - **Never lighting, camera, framing, backdrop or scene** (decision 7) — a
 *     BAN in the instruction, because the house block's AUTHORITY line can be
 *     out-argued by an authored lighting clause.
 *   - **Starts with the person; no titles or names; short by design**
 *     (decisions 8–9).
 *   - **What is added never contradicts a LOCKED fact and never contradicts
 *     itself** (the reconciled #477/#539 clause, re-read for this road on
 *     #535: a material is a PIECE the author may reinvent, so the clause
 *     binds consistency, not the metal).
 *   - **Instructions fold into the brief, visibly** (decision 11 + his
 *     2026-09-06 read-only-sentence ruling): when the box holds an editing
 *     instruction ("make her young", "50s"), the SAME press applies it and
 *     returns the one clean brief — never appended to the end of the
 *     sentence, never handled on the way to the engine.
 *
 * # What is deliberately NOT here (the design's §3 deletion list)
 *
 *   - `droppedFactIn` — RETIRED for this road. Its contract (every stated
 *     fact survives) IS the pieces road his courts rejected; the result lands
 *     editable in the customer's own box, and their reading it is the new
 *     fidelity control.
 *   - The FINISHED-seed "HEAT ONLY … more severe" mode, "lighting taste",
 *     and FACTS-STAY-in-full — all shapes of the retired MAX instruction.
 *
 * # What is kept, and why (the design's own table)
 *
 * Every guard that protects the ROLL rather than the reader: `NEVER_WRITTEN`
 * (pipeline notes, set words, "sternum"), the house-sentence check, the skin
 * contradictions, the piece nouns (qualities-never-pieces is now the whole
 * instruction; the noun list is its backstop), the one-paragraph and
 * allowance shapes — and the fact checks NARROWED TO THE LOCKED TRIO, with a
 * NEW species floor (decision 4 names species; until this module nothing in
 * the product checked it).
 *
 * # The honest failure
 *
 * A draft is refused and re-asked once with the reason; a second refusal (or
 * the call itself failing) returns `nothing` — the surface says *"Nothing to
 * offer this time — your words stand."* in place and the box is untouched.
 * Never an error the customer must interpret, never a changed box.
 */
import type { TextEngine } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import { createModuleLogger } from "../logging/logger";
import { containsHouseSentence } from "./houseBlock";
import {
  countWords,
  isStacked,
  neverWrittenIn,
  pieceNounIn,
  skinContradictionIn,
} from "./promptAuthor";
import { SEXES, type AgeBand, type Sex } from "../../shared/castingVocabularies";
import {
  ageClaimSpans,
  ageClaimsIn,
  ageContradictionIn,
  saysSex,
  YOUTH_WORDS,
} from "./seedFidelity";

const log = createModuleLogger("reimagine");

/**
 * Short by design (decision 9: *"every extra noun costs spread"*). The floor
 * above the seed's own length exists for the FOLD: applying "50s" to a
 * 300-word brief must be able to return roughly 300 words, and an allowance
 * that ordered the fold to cut the customer's brief would be the one
 * instruction this road forbids.
 */
export const REIMAGINE_WORD_BUDGET = 220;
export const REIMAGINE_ALLOWANCE_FLOOR = 40;
/**
 * How much a TAPPED CHIP may add (#535 decision 12) — the brief's own length
 * plus this, rather than the press's 220.
 *
 * A steer is the small act: his own words, one direction woven in. Driven
 * before it was set — with the press's allowance, one tap on an eight-word
 * brief came back with eighty-five words of new prose, which is the glyph's
 * job and not a chip's.
 */
export const REIMAGINE_DIRECTION_MARGIN = 40;
/**
 * The sentence that turns a tapped chip into the editing instruction the fold
 * road already handles — OURS, not the customer's, which is why it is a
 * constant with two readers: the composer and the refusal that keeps it out
 * of a draft (review of PR #601, finding 2).
 */
export const DIRECTION_MARKER = "Apply this direction to the brief above:";
/** A draft may exceed its allowance by this fraction before it is re-asked — the author road's own tolerance. */
export const REIMAGINE_OVERRUN_TOLERANCE = 0.1;
/** The author's output budget — the interpreter's figure, for its reason (reasoning tokens count). */
export const REIMAGINE_MAX_OUTPUT_TOKENS = 5000;

export function reimagineAllowance(briefText: string): number {
  return Math.max(REIMAGINE_WORD_BUDGET, countWords(briefText) + REIMAGINE_ALLOWANCE_FLOOR);
}

/**
 * THE SPECIES FLOOR (decision 4) — closed groups with surface forms, the
 * `saysSex` shape: when the box names exactly one group, the draft must still
 * say something from that group.
 *
 * ⚠ **A FLOOR, NOT COVERAGE, and that is a declared judgement** — species is
 * an open set ("a moth-winged seraph") and an open-set check is the typo-gate
 * class this repo has been bitten by five times. The groups below are the
 * kinds briefs actually name, each word chosen because it has no common
 * second sense in a casting sentence (no bare "cat" — "cat-eye makeup" would
 * lock a species onto a human brief). A species outside the vocabulary is
 * carried by the instruction and judged at the court (#535 §7) and his eye.
 *
 * Groups rather than words so a legitimate synonym survives: his own second
 * court's brief said *sphinx* and its passing draft said *feline humanoid* —
 * a presence check on the exact noun would have refused the draft his eye
 * called "much better".
 */
export const SPECIES_GROUPS: ReadonlyArray<{ group: string; words: readonly string[] }> = [
  { group: "feline", words: ["sphinx", "feline", "lioness", "leonine"] },
  { group: "canine", words: ["canine", "wolflike", "wolf-like", "lupine"] },
  { group: "machine", words: ["android", "robot", "robotic", "automaton", "synthetic being", "machine person"] },
  { group: "cyborg", words: ["cyborg", "cybernetic"] },
  { group: "vampire", words: ["vampire", "vampiric"] },
  { group: "elf", words: ["elf", "elven", "elvish"] },
  { group: "ogre", words: ["ogre", "ogress"] },
  { group: "orc", words: ["orc", "orcish"] },
  { group: "troll", words: ["troll"] },
  { group: "goblin", words: ["goblin"] },
  { group: "dwarf", words: ["dwarf", "dwarven"] },
  { group: "giant", words: ["giant", "giantess"] },
  { group: "demon", words: ["demon", "demonic", "demoness"] },
  { group: "angel", words: ["angel", "angelic", "seraph", "seraphic"] },
  { group: "alien", words: ["alien", "extraterrestrial"] },
  { group: "mermaid", words: ["mermaid", "merman", "merfolk"] },
  { group: "dragon", words: ["dragon", "draconic", "dragonkin"] },
  { group: "reptilian", words: ["reptilian", "lizardfolk", "serpentine"] },
  { group: "insectile", words: ["insectile", "insectoid"] },
  { group: "ghost", words: ["ghost", "ghostly", "spectral", "wraith"] },
  { group: "zombie", words: ["zombie", "undead"] },
  { group: "faun", words: ["faun", "satyr"] },
  { group: "centaur", words: ["centaur"] },
  { group: "minotaur", words: ["minotaur"] },
];

/** Whole-word/phrase presence, the fidelity module's own boundary shape. */
function saysPhrase(lower: string, phrase: string): boolean {
  const escaped = phrase.replace(/[-]/g, "\\-");
  return new RegExp(`(^|[^a-z])${escaped}(?![a-z'’])`).test(lower);
}

/** Every species group `text` names, in list order. */
export function speciesGroupsIn(text: string): string[] {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  return SPECIES_GROUPS.filter(({ words }) => words.some((word) => saysPhrase(lower, word))).map(
    ({ group }) => group,
  );
}

/**
 * THE LOCKED TRIO, read from the box's own text — sex, age and species, each
 * locked only when TYPED, unambiguously, in a shape this module can read
 * (decision 4: *"when not typed, the author leaves them open too"*).
 *
 * Text-only by design: this road runs before any roll, so there is no
 * reader record to anchor on — and `seedFidelity.ts`'s own reasoning holds
 * harder here, since demanding a fact the customer never typed would refuse
 * good ideas and cost them the press.
 *
 *   - SEX locks when exactly ONE sex's surface words appear. A box saying
 *     both ("a man and his wife") locks neither — declared, the fidelity
 *     module's own sex-flip clause. Nonbinary locks only on its explicit
 *     words, never on they/them/their, which ordinary prose is full of.
 *   - AGE locks on the box's own readable claims (`ageClaimsIn`), and the
 *     check is that the draft claims no band the box did not — so a FOLD
 *     ("…in her 30s… make her young") passes on the customer's own word
 *     while an author-invented "20s" on a 30s brief is refused.
 *   - SPECIES locks when exactly ONE group is named; several named groups
 *     lock none (the sex rule's shape — a fold changing species says both).
 */
export type LockedTrio = {
  sex: Sex | null;
  /** Every band the box claims — the draft may claim these and no others. Empty when unstated OR steered. */
  ageBands: readonly AgeBand[];
  species: string | null;
};

const NONBINARY_EXPLICIT = ["nonbinary", "non-binary", "agender", "androgynous", "gender-neutral"] as const;
/**
 * Words that can STEER the age without claiming a band — the fold's
 * vocabulary ("make her young", "…close-cropped hair. make them older").
 * When the box is steering, the customer is moving the age themselves, so
 * the age is not locked: the draft may land on a band the box never claimed,
 * and the customer reads the result in their own editable box (the design's
 * fidelity control). Driven before it was written: without this, his own §11
 * example — an ageing instruction typed after a brief that states an age —
 * was refused twice by the very guard meant to protect it, and the press
 * answered "nothing to offer".
 *
 * ⚠ **A steer word is DESCRIPTION until an imperative or a trailing
 * instruction fragment says otherwise** (review of PR #598, findings 1 of
 * both rounds — each round found a descriptive shape the previous rule read
 * as steering): *"a young woman in her 20s"* and *"a woman in her 40s,
 * middle-aged and weary"* both type an age and describe it, and emptying the
 * lock there turns off the one mechanical age guard on some of the most
 * natural briefs in the product. So a word from this list steers only when
 * the box carries an imperative ("make her…", "turn them…", "age him…"), or
 * when the word sits in a fragment AFTER a sentence boundary that follows
 * the last readable age claim — the fold's natural shape, an instruction
 * typed at the end ("…close-cropped hair. older"). Bare "age"/"aged" left
 * the list entirely: in a brief box they are overwhelmingly description
 * ("middle-aged", "looks her age"), and the imperative shape carries "age
 * her up". The vocabulary derives from `seedFidelity.ts`'s own
 * `YOUTH_WORDS` (working law 4) plus the direction words that list has no
 * reason to hold.
 *
 * ⚠ Declared limits, pinned in the suite: a bare number ("make them 45")
 * steers without a word this list can see; an instruction with no imperative
 * and no sentence boundary ("…in her 30s older please") reads as
 * description; and a descriptive fragment after a full stop ("…in her 40s.
 * Young at heart.") reads as steering. Each falls the safe way — to "your
 * words stand" or to an unlocked press whose result lands editable in the
 * box — and the court's fold fixtures (#535 §7) measure how often the
 * shapes occur.
 */
const AGE_STEER_WORDS = [...YOUTH_WORDS, "older", "elderly"] as const;
const IMPERATIVE_SHAPE = /(^|[^a-z])(make|turn) (her|him|them|it|the)\b/;
/** "age her up" — the verb IS the steering act, no separate direction word needed. */
const AGE_IMPERATIVE_SHAPE = /(^|[^a-z])age (her|him|them|it|the)\b/;

export function lockedTrioOf(briefText: string): LockedTrio {
  const lower = briefText.toLowerCase().replace(/\s+/g, " ");
  const saidSexes = SEXES.filter((sex) =>
    sex === "nonbinary"
      ? NONBINARY_EXPLICIT.some((word) => saysPhrase(lower, word))
      : saysSex(briefText, sex),
  );
  const groups = speciesGroupsIn(briefText);
  /*
    "aged NN" is a CLAIM, not steering — the spans are `ageClaimsIn`'s own
    (`ageClaimSpans`, same shapes, same era filter), blanked to equal-length
    spaces so positions hold. A steering word inside a claim shape never
    steers; one before the last claim steers only under an imperative.
  */
  const claims = ageClaimsIn(briefText);
  const spans = ageClaimSpans(briefText);
  let blanked = lower;
  for (const { start, end } of spans) {
    blanked = blanked.slice(0, start) + " ".repeat(end - start) + blanked.slice(end);
  }
  const lastClaimEnd = spans.reduce((max, span) => Math.max(max, span.end), 0);
  const imperative = IMPERATIVE_SHAPE.test(blanked);
  const steered = AGE_IMPERATIVE_SHAPE.test(blanked) || AGE_STEER_WORDS.some((word) => {
    const escaped = word.replace(/[-]/g, "\\-");
    /* EVERY occurrence, not the first: "a young woman … make her young again" steers on the second. */
    const occurrences = Array.from(blanked.matchAll(new RegExp(`(^|[^a-z])${escaped}(?![a-z'’])`, "g")));
    return occurrences.some((match) => {
      if (imperative) return true;
      const at = (match.index ?? 0) + match[1].length;
      /*
        After the claim AND across a sentence boundary — "…in her 40s,
        middle-aged and weary" is one sentence describing one woman;
        "…close-cropped hair. older" is a brief and then an instruction.
        Blanking preserved offsets, so the punctuation between them is real.
      */
      if (at <= lastClaimEnd) return false;
      return /[.;!?]/.test(blanked.slice(lastClaimEnd, at));
    });
  });
  return {
    sex: saidSexes.length === 1 ? saidSexes[0] : null,
    ageBands: steered ? [] : claims,
    species: groups.length === 1 ? groups[0] : null,
  };
}

/**
 * Why a draft is refused, or null when it may stand. The re-ask quotes this
 * sentence to the author.
 *
 * ⚠ **THE REASONS LIVE IN LOGS ONLY TODAY — A DECLARED LOSS** (review of PR
 * #598, round 2 finding 2; the first draft of this docblock said "the row
 * records it", which invited the next reader to go looking for a record
 * that does not exist). A press persists nothing: `refusals`/`attempts`
 * reach `log.warn` and the route's projection deliberately drops them
 * (invariant 8). The old road's `register.refusals` (#529) — the measured
 * channel the founder's loosen-a-guard bar reads — has no successor on the
 * road that now runs these guards; the refusal-loop patrol (#129) is where
 * a queryable channel gets designed if the logs prove too thin, and the
 * court (#535 §7) reads its rates from its own driven arms, not from here.
 *
 * Order matters the way `draftRefusal`'s did: the shape checks first, then
 * the words this studio never sends, then the locked trio — a draft that says
 * the WRONG thing gets the precise sentence about what it moved.
 */
export function reimagineRefusal(draft: string, allowance: number, seedText: string): string | null {
  if (draft.length === 0) return "Your previous reply was empty.";
  /*
    OUR OWN SCAFFOLDING, NEVER IN A DRAFT (review of PR #601, finding 2). The
    seed no longer exempts the marker's words, so this is belt as well as
    braces — but a draft that parrots the instruction line is a specific,
    recognisable failure and it deserves the specific sentence rather than
    whichever generic guard happens to catch a fragment of it.
  */
  if (draft.toLowerCase().includes(DIRECTION_MARKER.toLowerCase())) {
    return "Your previous draft repeated the instruction line back. Write the brief itself — never the instruction you were given.";
  }
  if (isStacked(draft)) {
    return "Your previous draft was more than one paragraph. Write ONE paragraph, with no blank line, no heading and no list.";
  }
  if (countWords(draft) > allowance * (1 + REIMAGINE_OVERRUN_TOLERANCE)) {
    return `Your previous draft was ${countWords(draft)} words; the allowance is ${allowance}. Rewrite it within ${allowance} words — shorter is better on this road.`;
  }
  const forbidden = neverWrittenIn(draft, seedText);
  if (forbidden) {
    return `Your previous draft used the word "${forbidden}", which this studio never sends. Rewrite it without that word — and without any note about the series or the process.`;
  }
  if (containsHouseSentence(draft)) {
    return "Your previous draft contained camera/studio language. The studio appends its own locked block at the roll; write only the casting paragraph for the person.";
  }
  const skin = skinContradictionIn(draft, seedText);
  if (skin) {
    return `Your previous draft said "${skin}", which fights the studio's own locked realism rules and makes the engine refuse the picture. Rewrite it with real skin — texture, pores, life.`;
  }
  const piece = pieceNounIn(draft, seedText);
  if (piece) {
    return `Your previous draft named "${piece}", a specific piece the request never named. Write qualities, never parts — say what it is made of and what it feels like, and leave the pieces to the engine.`;
  }

  const locked = lockedTrioOf(seedText);
  const draftBands = ageClaimsIn(draft);
  const lockedSet = Array.from(new Set(locked.ageBands));
  if (lockedSet.length === 1) {
    /*
      One typed band: the check IS `seedFidelity.ts`'s own contradiction
      reader — stray claims and added youth words against the stated band,
      one owner (review of PR #598, finding 2: this module briefly
      re-implemented it, and the dispositions table claimed a wiring that
      did not exist). A youth word the BOX itself contains never reaches
      here descriptively refused: beside a claim it is description and the
      draft repeating it repeats her word — `ageContradictionIn` refuses
      youth words only against a 30s+ band, which such a box has pinned.
    */
    const moved = ageContradictionIn(draft, { band: lockedSet[0], phase: null });
    /* Her own word is never the author's move — a "young" the box says (descriptively, beside its claim) is exempt, the seed-exemption every word guard here carries. */
    const lowerSeed = seedText.toLowerCase().replace(/\s+/g, " ");
    if (moved && !saysPhrase(lowerSeed, moved.toLowerCase())) {
      return `Your previous draft said "${moved}", which moves the stated age (${lockedSet[0]}). Sex, age and species are locked when typed — keep the request's own age words exactly.`;
    }
  } else if (lockedSet.length > 1) {
    /* Several typed bands ("late twenties to thirties"): the draft may claim those and no others. */
    const stray = draftBands.find((band) => !lockedSet.includes(band));
    if (stray !== undefined) {
      return `Your previous draft claimed an age (${stray}) the request did not state. Sex, age and species are locked when typed — keep the request's own age words exactly.`;
    }
  }
  if (locked.ageBands.length > 0 && draftBands.length === 0) {
    /*
      Presence as well as contradiction, the checked half of "locked when
      typed": a typed age the idea silently drops is the author moving a
      locked fact by omission.
    */
    return `Your previous draft dropped the stated age (${locked.ageBands[0]}). Sex, age and species are locked when typed — the idea must keep it.`;
  }
  /* SEX — presence. An ordinary flip drops the box's own sex words and reddens here (the fidelity module's declared shape). */
  if (locked.sex && !saysSex(draft, locked.sex)) {
    return `Your previous draft dropped the subject's sex (${locked.sex}). Sex, age and species are locked when typed — the idea must keep it.`;
  }
  /* SPECIES — presence within the group, so his own sphinx→"feline humanoid" passes and a species swap does not. */
  if (locked.species) {
    const draftGroups = speciesGroupsIn(draft);
    if (!draftGroups.includes(locked.species)) {
      return `Your previous draft dropped what the subject IS (${locked.species}). Sex, age and species are locked when typed — the idea must stay that kind of being.`;
    }
  }
  return null;
}

/**
 * The instruction. Base register is #477's verbatim-discipline lesson — tight
 * clauses, never re-describing what it keeps — with his #535 contract on top,
 * and his own worked cases shown and labelled (the shape `conceptDescribe.ts`
 * and the MAX instruction both used for his rulings, because an instruction
 * that names the rule and shows the miss is the one models follow).
 */
export function reimagineSystemPrompt(allowance: number, direction?: string | null): string {
  const chosen = direction?.trim() ?? "";
  return [
    "You are the writing assistant of a casting studio. The request below is the words in a customer's own brief box. What you return REPLACES those words in the box — the customer reads it, edits it, and can undo it, so write the brief itself and nothing else.",
    "",
    /*
      ⚠ A TAPPED CHIP IS THE SMALL ACT, AND THIS PARAGRAPH IS WHY (#535
      decision 12, found by driving it — law 6). Without it the generic fold
      below turned his eight-word brief into eighty-five words of new prose
      on one tap: a full re-imagining, which is what the GLYPH is for. A
      customer who taps a suggestion is steering, not starting again, and a
      control whose effect you cannot anticipate is one you learn by trial —
      which is the disappearing-technology law failing.
    */
    ...(chosen.length > 0
      ? [
          "THIS REQUEST CARRIES A CHOSEN DIRECTION, and that is a STEER, not a re-imagining. Keep the customer's brief as it is — their words, their order, their length — and write the direction INTO it where it belongs, changing only what the direction touches. Add nothing else of your own. A short brief stays short.",
          "",
        ]
      : []),
    /*
      Decision 11 + his 2026-09-06 ruling, and the fold comes FIRST because it
      changes what every later rule means: on a fold the "request" is a brief
      plus the customer's own editing instruction, and the instruction wins —
      including over the locked trio, because the customer asked. His named
      defect is the appended shape: "…hulking and monstrous presence. Slim
      build." is what this paragraph forbids.
    */
    "FIRST decide what the box holds. If it contains an EDITING INSTRUCTION mixed into or appended to a description (\"make her young\", \"50s\", \"give him a beard\"), do not re-imagine: APPLY the instruction and return the one clean brief with the change rewritten into it — never tacked onto the end, never echoed as an instruction. The customer's instruction may change anything, including sex, age or species. If the box holds only a description, re-imagine it as below.",
    "",
    /*
      His one-line rule, verbatim from the card's correction: it is the whole
      design in a sentence and the model gets it before the details.
    */
    "KEEP WHO THEY ASKED FOR; REINVENT WHAT THEY ARE MADE OF. The request is the spark, not the cage: return a NEW IDEA recognisably born from it, not a polish of it. Only three things are locked, and only when the request types them: SEX, AGE and SPECIES. Every other typed detail — features, hardware, garments, colours, materials — is raw material you may reinvent. Named colours and materials are pieces too.",
    "",
    /*
      Decisions 5 and 6. The register clause carries his correction's measured
      direction: more detail means more register to carry, never more pieces
      to keep.
    */
    /* "every face … its own way" rather than his "eight faces answer it eight
       ways": "eight" is a NEVER_WRITTEN word (dev roll 95 — counting the casts
       painted them all in one frame), and an instruction must never teach a
       word its own guards refuse (#477's lesson, the class arm below). */
    "READ THE REGISTER FIRST. Before reinterpreting anything, name for yourself the world and energy the request lives in — military, punk, ceremonial, sea-worn — and carry that through as QUALITIES. A detailed request has MORE register to keep, not less: a rewrite that loses the vibe is the failure. Use identity nouns only for the two or three things that make the type the type; write everything else so every face can answer it its own way. No colours, positions, cuts, items or sounds of your own.",
    "",
    /*
      The #477/#539 clause re-read for this road (his reconciliation on #535):
      the metal may change; the paragraph may not argue with itself or with a
      locked fact.
    */
    "NEVER CONTRADICT A LOCKED FACT, AND NEVER CONTRADICT YOURSELF. You may change a material the request named — consistently. A paragraph that calls one surface two things hands the engine a coin flip; say what it IS, once.",
    "",
    /*
      Decision 7 — a BAN, not a preference: the studio's locked block owns the
      camera, and an authored lighting clause can out-argue it (measured on
      the MAX road, #327).
    */
    "NEVER write lighting, camera, lens, framing, crop, backdrop, background, scene, environment, props or story-setting language, and never restate the studio's own realism rules or negatives. The studio appends its own locked camera and studio block after your text on every roll. Faint glows and lights that are part of the BEING itself are features, not lighting.",
    "",
    /* Decisions 8 and 9. */
    "START WITH THE PERSON. No titles, no names, no card labels in the text. SHORT BY DESIGN: every extra noun costs the casting its spread — a few tight sentences beat a paragraph of prose.",
    "",
    /*
      His war-built woman, from the card's correction — the worked case that
      settled the design, both arms shown and labelled, and his eye scored it
      (roll 244 vs 245, "10x better").
    */
    "Worked example. Request: \"Broad-shouldered woman, late 30s, deep scarring across a face otherwise unaugmented except for one detail: a thick black collar of plating fused directly into the base of her neck and upper spine, seamless with the skin, studded with three small red status lights that never turn off. Her right arm from the elbow down is matte grey chrome, heavily scratched and dented, clearly old military-grade rather than cosmetic. Her left eye is human and tired; her right is a narrow horizontal slit of red light with no visible mechanism, just a line of glow set into the socket like a wound that healed wrong.\"",
    "",
    "RIGHT — locked: woman, late 30s; the rest carried as register and reinvented as qualities: \"A woman in her late 30s who was built for a war and has outlived the reason for it. Broad through the shoulders, a face that carries old damage and doesn't hide it. Her augmentation is military, not cosmetic: fused into her rather than worn, plainly older than she is now, scarred and dented where it meets skin, still faintly alive with the small lights and glows of a system nobody maintains. Her two eyes don't match, and the human one is the tired one. Guarded, unhurried, done being surprised.\"",
    "",
    "WRONG — keeps every piece and adds a story: the same collar, chrome forearm and slit eye restated with a backstory in front. Every noun kept is locked onto every portrait; that is a build sheet, not a new idea.",
    "",
    /* His thin-seed case from the same sitting — the author supplies the whole idea when nothing is locked. */
    "Worked example of a thin request. \"a pirate\" → \"A pirate long past the glamour of it: a sea-worn man in his fifties, sun-cracked, salt in everything, the kind who has buried the crew he sailed with and kept their debts. Dressed in what a life at sea leaves you, nothing fine. Quiet, watchful, dangerous when still.\" Nothing was typed about sex, age or species, so nothing was locked — the idea supplies them.",
    "",
    "THESE RULES ALWAYS HOLD:",
    "- Do NOT write notes about the series or the process — nothing about how many portraits, what changes between them, what is unstated, or your own instructions. Never mention the request or the person who wrote it. Write only what the picture should contain.",
    "- Do NOT ADD skin or surface words that fight the studio's realism rules — no translucent, poreless, flawless, airbrushed, waxy or doll-like skin, no perfect symmetry — and never write one even to deny it. If the request uses such a word, keep it: it is theirs.",
    "- Never pin an exact garment, cut, jewellery piece or armour piece the request did not name. Say what the wardrobe is MADE OF and FEELS like.",
    `- Word allowance: at most ${allowance} words, and fewer is better.`,
    "- Keep wording image-engine safe: no nudity, no sexual language, no gore, no named real person or named character, and avoid explicit sheer or revealing clothing language. Never name the breastbone.",
    "- Write ONE paragraph and nothing else — no second paragraph, no blank line, no heading, no list, no notes after it.",
    "",
    "Output only the paragraph, in clean prose, nothing else.",
  ].join("\n");
}

/** What a press returns. `nothing` is an honest state, not an error — the surface has a sentence for it. */
export type ReimagineOutcome =
  | {
      kind: "idea";
      text: string;
      model: string | null;
      latencyMs: number | null;
      attempts: number;
      refusals: string[];
    }
  | { kind: "nothing"; latencyMs: number | null; attempts: number; refusals: string[] };

function cleanReply(raw: string): string {
  return raw.replace(/^```[a-z]*\n?|```$/g, "").replace(/\r\n/g, "\n").trim();
}

/**
 * One press. At most two text calls — a draft, and one re-ask naming the
 * refusal — then `nothing`. Never throws: the caller is a free procedure and
 * an author outage must read as "nothing to offer", never as a broken box.
 */
export async function reimagineBrief(input: {
  engine: TextEngine;
  briefText: string;
  /**
   * A GENERATED CHIP the customer tapped (#535 decision 12), or nothing for a
   * plain press.
   *
   * A tap is a FOLD, not a re-imagine, and it reuses decision 11's road
   * rather than growing a second one: the direction is composed onto the
   * brief as the editing instruction it is, and the instruction's own first
   * paragraph — *"APPLY the instruction and return the one clean brief with
   * the change rewritten into it — never tacked onto the end"* — is already
   * exactly his ruling for this case (Crew reply #144: *"the edit gets tacked
   * onto the end of the prompt instead of rewritten into it"*). One road,
   * already driven, already guarded, already courted at his eye.
   *
   * ⚠ **The composition lives HERE and not on the client** so the sentence
   * has one owner: a client that wrote its own join would be a second author
   * of the prompt, and the two would drift (working law 4).
   */
  direction?: string | null;
  signal?: AbortSignal;
}): Promise<ReimagineOutcome> {
  const direction = input.direction?.trim() ?? "";
  const briefText =
    direction.length > 0
      ? `${input.briefText.trim()}\n\n${DIRECTION_MARKER} ${direction}`
      : input.briefText.trim();
  /*
    ⚠ THE GUARDS' SEED IS THE CUSTOMER'S WORDS, NEVER OUR SCAFFOLDING
    (review of PR #601, finding 2). Every word guard on this road is
    seed-exempt — his own *"unless the user typed them"* — so passing the
    COMPOSED text as the seed would exempt the marker sentence's own
    vocabulary, and a draft echoing it would land in the customer's box
    having passed every check. The customer's words are their brief plus the
    direction they chose; the marker is ours, and it is exempted from
    nothing.
  */
  const seedForGuards =
    direction.length > 0 ? `${input.briefText.trim()}\n${direction}` : briefText;
  /*
    A STEER GETS THE BRIEF'S OWN LENGTH PLUS A LITTLE, not the press's 220.
    The paragraph above states the rule; this is the same rule as a number,
    so the overrun check can actually enforce it — the instruction alone
    produced an 85-word answer to an 8-word brief when it was driven.
  */
  const allowance =
    direction.length > 0
      ? Math.max(REIMAGINE_ALLOWANCE_FLOOR, countWords(input.briefText) + REIMAGINE_DIRECTION_MARGIN)
      : reimagineAllowance(briefText);
  const system = reimagineSystemPrompt(allowance, direction.length > 0 ? direction : null);
  let attempts = 0;
  const refusals: string[] = [];
  let spentMs: number | null = null;

  const ask = (systemText: string, temperature: number) => {
    attempts += 1;
    /* `about: "author"` — this IS the author road, moved to its own visible
       door (#535); a census pricing authored prose should count these presses
       with it. The purpose union's own docblock names this reader. */
    return input.engine.complete({
      about: "author",
      system: systemText,
      user: briefText,
      temperature,
      maxOutputTokens: REIMAGINE_MAX_OUTPUT_TOKENS,
      signal: input.signal,
      timeoutMs: INTERPRET_TIMEOUT_MS,
      /* No transport retries: this function re-asks once itself. */
      retries: 0,
    });
  };

  try {
    /*
      0.9 on the first ask, deliberately above the MAX author's 0.8: "press
      again for another idea" is the contract, so consecutive presses on the
      same words should genuinely differ. The re-ask drops to 0.4 because it
      is a correction, not a second idea.
    */
    const first = await ask(system, 0.9);
    let text = cleanReply(first.text);
    let model = first.provenance.model;
    let latencyMs = first.latencyMs;
    spentMs = latencyMs;
    const why = reimagineRefusal(text, allowance, seedForGuards);
    if (why) {
      refusals.push(why);
      log.warn({ allowance, why }, "[reimagine] re-asking once");
      const second = await ask(`${system}\n\n${why}\n\nPREVIOUS DRAFT:\n${text}`, 0.4);
      text = cleanReply(second.text);
      model = second.provenance.model;
      latencyMs += second.latencyMs;
      const stillWhy = reimagineRefusal(text, allowance, seedForGuards);
      if (stillWhy) {
        refusals.push(stillWhy);
        log.warn({ why: stillWhy }, "[reimagine] second draft refused too — nothing to offer, the words stand");
        return { kind: "nothing", latencyMs, attempts, refusals };
      }
    }
    return { kind: "idea", text, model, latencyMs, attempts, refusals };
  } catch (error) {
    log.warn({ error: String(error), attempts }, "[reimagine] the call failed — nothing to offer, the words stand");
    return { kind: "nothing", latencyMs: spentMs, attempts, refusals };
  }
}
