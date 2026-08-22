/**
 * WHAT A SLOT'S WORDS MAY SAY — the shape rules for a library row's stack.
 *
 * The library derives a slot's words from a read, and until this existed nothing
 * checked what that read had actually said. Eight production earring rows named
 * her GLASSES in the earring's own word stack, and four of them described BOTH
 * ears — filed identically under `earring@left` and `earring@right`. It was
 * harmless for two days because nothing read the library; the compositor swap's
 * caller is its first reader, and D-244 re-says a slot's whole stack on every
 * edit, so those sentences would have asked a paying render to put her glasses
 * back on.
 *
 * **The class** (working law 7): *a caption written about the FRAME, filed as
 * the state of a SLOT.* `statedAccessories` is one facet over every object a
 * face can wear, so its caption is wider than an accessory slot in two
 * directions at once — wider in KIND (it names glasses) and wider in INSTANCE
 * (it names both ears).
 *
 * `referenceMint` now reads each slot from its own cut, which makes the wide
 * caption structurally unreachable rather than merely avoided. This module is
 * the door that proves it: a guard nothing calls is not a guard, and a fix with
 * no door is one refactor away from coming back.
 *
 * # Refusals, not repairs
 *
 * Every rule here REFUSES. A door that quietly rewrote the words would hide the
 * regression it exists to catch, and the mint's own catch already keeps the
 * delivered picture — a refusal here costs the render its reference and costs
 * the user nothing.
 */
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { isBornInkSlot, isInkSlot, parseSlot } from "./referenceSlots";

/**
 * EVERY accessory kind this text names — not just the best one.
 *
 * `accessoryEntry` answers *which kind is this instruction about*, so it returns
 * one. The question here is the opposite: *does this sentence stray onto a kind
 * that is not this slot's own*, and that needs all of them.
 *
 * **Longest match wins per occurrence**, the same rule and for the same reason:
 * "a small nose stud" contains both "stud" (an earring word) and "nose stud",
 * and first-match over a word list once put a nose stud on her earlobe. A
 * contained match is dropped in favour of the longer one covering it, so a nose
 * stud's row is not refused for naming earrings.
 */
export function accessoryKindsNamedIn(described: string): string[] {
  const said = (described ?? "").toLowerCase();
  const matches: Array<{ start: number; end: number; region: string }> = [];
  for (const entry of LANDMARK_OF_ACCESSORY) {
    for (const word of entry.words) {
      for (let at = said.indexOf(word); at !== -1; at = said.indexOf(word, at + 1)) {
        matches.push({ start: at, end: at + word.length, region: entry.region });
      }
    }
  }
  const survives = matches.filter((match) => !matches.some((other) => (
    other !== match
    && other.end - other.start > match.end - match.start
    && other.start <= match.start
    && other.end >= match.end
  )));
  return Array.from(new Set(survives.map((match) => match.region)));
}

/** The accessory kind a slot key names, or null for anatomy. */
export function accessoryKindOfSlot(slot: string): string | null {
  const parsed = parseSlot(slot);
  if (parsed === null) return null;
  const entry = LANDMARK_OF_ACCESSORY.find((candidate) => (
    candidate.region.replace(/ /g, "-") === parsed.feature
  ));
  return entry?.region ?? null;
}

/**
 * PHRASES THAT CANNOT DESCRIBE A SINGLE SITE.
 *
 * A per-instance slot's words describe the object at THAT site. A sentence
 * claiming the pair matches is aimed straight at the founder's ruling that
 * **mismatched pairs are a feature** — and it was being filed identically under
 * both instances, so the claim was not even evidence of itself.
 *
 * **Deliberately narrow.** A blanket ban on "each" and "both" would refuse the
 * CLEAN production rows: *"a dangling gold cross charm hanging from each hoop"*
 * is the good wording, and "each hoop" is about one hoop's own charms. Only
 * phrases naming the OTHER instance are here, and each is anchored on a word
 * boundary so "each earring" is not read as "each ear".
 */
const PAIR_CLAIMS: readonly RegExp[] = [
  /\b(?:both|each) ears?\b/i,
  /\b(?:both|each) earlobes?\b/i,
  /\b(?:both|each) eyes?\b/i,
  /\bmatching pair\b/i,
  /\bone on each\b/i,
];

/** The pair claim this text makes, or null. */
export function pairClaimIn(described: string): string | null {
  for (const claim of PAIR_CLAIMS) {
    const found = claim.exec(described ?? "");
    if (found) return found[0];
    }
  return null;
}

/**
 * Terminal punctuation, stripped where the stack is BUILT.
 *
 * `words.join(", ")` over a stack whose entries end in full stops produced
 * `"…piled into a high bun., in a bun — gathered and…"` — in a paid prompt and,
 * tonight, on the founder's own face panel. The entries are clauses in a list;
 * a list item does not carry its own terminator.
 *
 * The producer tidies and the door REFUSES (see `wordCarriesTerminator`). Two
 * places with two jobs rather than one rule written twice: a producer that
 * forgets is caught loudly instead of quietly writing a comma nobody can see.
 */
export function tidyStackWord(word: string): string {
  return word.trim().replace(/[.,;]+$/, "").trim();
}

/** True when this word still carries a terminator the join would double. */
export function wordCarriesTerminator(word: string): boolean {
  return word !== tidyStackWord(word);
}

/**
 * WORDS THAT DESCRIBE THE PICTURE INSTEAD OF THE PERSON.
 *
 * Found by the dev supersession's own receipt: two earring cutouts came back as
 * *"Cutout too dark to distinguish any earring details"* and *"appears as a
 * solid black silhouette with no visible features"*. Filed as a slot's words,
 * those are the class this module exists to end — a caption written about one
 * thing, filed as the state of another — arriving through the fix's own door.
 *
 * The real repair is at the read (`captionSlot` can now answer *I cannot see
 * it*). This is the backstop, because a reader that stops honouring its
 * contract must not be able to refile the class silently.
 *
 * **Narrow on purpose.** Only words that can ONLY be about the artifact are
 * here. "Silhouette" is not: a jaw or a nose is legitimately described by its
 * silhouette, and refusing that would cost a true sentence to catch a false one.
 */
const ARTIFACT_WORDS: readonly RegExp[] = [
  /\bcut ?out\b/i,
  /\bthe crop\b/i,
  /\bthis (?:image|picture|photo|photograph)\b/i,
  /\bno visible (?:features|details|jewelry|jewellery)\b/i,
  /\btoo (?:dark|small|blurry|indistinct) to\b/i,
];

/** The artifact phrase this text uses, or null. */
export function artifactPhraseIn(described: string): string | null {
  for (const word of ARTIFACT_WORDS) {
    const found = word.exec(described ?? "");
    if (found) return found[0];
  }
  return null;
}

/**
 * INK IS NEVER A SLOT'S WORDS — the vocabulary, and the sentence that asks a
 * reader not to say it.
 *
 * A tattoo is its own slot family (`ink:*`), it is carried into every later
 * render as a CROP of the design, and the library never holds one — the write
 * door refuses an ink slot outright. So a tattoo named inside ANY library row's
 * prose is a second author of a fact that already has one, and the second author
 * has no geometry: the crop says the same design, in the same place, at the same
 * size, while the words say only "tattooed chest" and float.
 *
 * The class is the module's own (`wordsNameAnotherKind`) arriving on a slot the
 * door could not reach: its accessory check returns early for anatomy, and skin
 * and build are anatomy. It is not hypothetical for `build` in particular — that
 * slot is re-cut from a below-head crop on EVERY render, and an inked chest is
 * inside that crop.
 *
 * # Why this is not `looksLikeTattooInstruction`
 *
 * `shared/inkInstructionRoute.ts` owns a wider list for ROUTING — bare "ink",
 * "full sleeve", "half sleeve". Routing may over-match cheaply; a door may not.
 * `\bink\b` matches "ink-black", which is a legitimate thing to say about hair,
 * and "half sleeves" is a garment. This module's standing rule is *only words
 * that can ONLY be about the thing* (see {@link ARTIFACT_WORDS}), so the door
 * gets its own narrow list and says here why the two differ rather than drifting
 * from it silently.
 */
const INK_WORDS: readonly RegExp[] = [
  /\btattoos?\b/i,
  /\btattooed\b/i,
  /\btattooing\b/i,
  /\binked\b/i,
  /\bbody art\b/i,
];

/** The ink word this text uses, or null. */
export function inkWordIn(described: string): string | null {
  for (const word of INK_WORDS) {
    const found = word.exec(described ?? "");
    if (found) return found[0];
  }
  return null;
}

/**
 * THE SAME RULE SAID TO THE READER, so the source and the door cannot drift.
 *
 * One owner, two callers — `SKIN_ASK` in `faceDescribe` (the words he reads
 * under his own picture) and `askAboutSlot` in `realizationCaption` (the words a
 * paid render carries). The precedent is inside `SKIN_ASK` already: *"Her skin,
 * not her makeup and not the lighting."* This is the same shape for the one
 * thing that now has a slot of its own.
 *
 * Said to EVERY slot's caption rather than to skin's alone (working law 7): a
 * tattoo is not the subject of ANY library slot, because ink never enters the
 * library at all. Skin is where it was found; build is where it would have been
 * found next.
 */
export const INK_IS_NOT_THIS_SLOT = [
  "Never mention a tattoo here, whatever you can see. A tattoo is not part of",
  "any of this — it is kept as a picture of the design itself, and describing",
  "one in words here would ask a later render to paint a second one.",
].join("\n");

export type SlotWordsRefusal =
  | { reason: "wordsNameAnotherKind"; detail: string }
  | { reason: "wordsClaimThePair"; detail: string }
  | { reason: "wordsDescribeTheArtifact"; detail: string }
  | { reason: "wordCarriesTerminator"; detail: string };

/**
 * What is wrong with this slot's stack, or null.
 *
 * Returned rather than thrown so the door owns the throwing and this stays
 * drivable directly — these are exactly the refusals a test would otherwise
 * "prove" by never triggering them (working law 2).
 */
export function slotWordsRefusal(slot: string, words: readonly string[]): SlotWordsRefusal | null {
  for (const word of words) {
    if (wordCarriesTerminator(word)) {
      return {
        reason: "wordCarriesTerminator",
        detail: `${slot}'s stack entry "${word}" ends in punctuation, and the stack is joined with ", " — it would reach the painter and the panel as "…${tidyStackWord(word).slice(-8)}., "`,
      };
    }
  }

  /*
    APPLIED TO EVERY SLOT, not only the accessories. A note about the cutout is
    just as wrong filed as her jaw as it is filed as her earring, and the read
    that produces it is the same read.
  */
  for (const word of words) {
    const artifact = artifactPhraseIn(word);
    if (artifact !== null) {
      return {
        reason: "wordsDescribeTheArtifact",
        detail: `${slot}'s words say "${artifact}" — that describes the PICTURE, and filed here it becomes a fact about a person's face handed to a painter on every later render`,
      };
    }
  }

  /*
    AND NO SLOT'S WORDS NAME HER INK — applied to every slot, ABOVE the accessory
    early return, which is the line that made this reachable in the first place.

    `accessoryKindOfSlot` answers null for anatomy and the function returned, so
    skin and build were never asked what their prose said. An ink slot itself is
    excluded because the library never holds one (the write door refuses it by
    name) — the check is written against that fact rather than trusting it, so a
    day when ink DOES have a row is not a day this refuses it.

    ⚠ **THAT DAY ARRIVED 2026-08-22, THROUGH A NAMESPACE THAT DID NOT EXIST WHEN
    THE SENTENCE ABOVE WAS WRITTEN** (7b(a), ruled fable-1413 §1). A `bornInk:`
    row records tattoos THE BRIEF ITSELF DESCRIBED — the cast is born with them,
    the brief is the document (D-137, fable-1381) — so its whole subject is ink
    and refusing it would be this fence refusing its own population. The two
    alternatives are both worse: scrubbing her words is a paraphrase read back
    as her own sentence (D-172), and storing none is a claim about her body with
    nothing she said under it.

    # ⚠ AND THE EXEMPTION IS NOT THE SAME EXEMPTION, which is why it is paid for

    `isInkSlot`'s safety is that an ink slot's words ride BESIDE A CROP: the
    picture is the authority and the words caption it. **A born-ink row has no
    crop at all** — it is precisely the geometry-free author this fence
    describes. What makes it harmless is downstream: `selectCarriedFeatureWords`
    declines it `markingDiscloses`, `recipeAssembler` never asks for it, and the
    panel has no definition for it. Three consumers behaving, which is exactly
    the kind of guarantee that decays.

    So the widening is paid for by two arms rather than by this comment:

      viewFeatureWords.test.ts   the born row declines `markingDiscloses`
                                 BEFORE the region lookup, so a future resolver
                                 that learns the namespace cannot let ink ride
      recipeAssembler.test.ts    THE WIRE: a branch holding a born-ink row
                                 composes a recipe and her ink words appear
                                 NOWHERE in the sentences sent. A consumer-side
                                 arm dies the day a fourth consumer is born; a
                                 wire-side negative survives any number of them,
                                 because it asserts where the harm model lives

    If you are here because you want born-ink words to reach a render, the
    second arm is the one that will stop you, and it is the one to argue with.
  */
  if (!isInkSlot(slot) && !isBornInkSlot(slot)) {
    for (const word of words) {
      const ink = inkWordIn(word);
      if (ink !== null) {
        return {
          reason: "wordsNameAnotherKind",
          detail: `${slot}'s words say "${ink}" — her ink is its own slot and rides as a CROP of the design, so a second, geometry-free author here would ask a paid render to put a tattoo on top of the one it is already carrying`,
        };
      }
    }
  }

  const kind = accessoryKindOfSlot(slot);
  if (kind === null) return null;

  for (const word of words) {
    const strayed = accessoryKindsNamedIn(word).filter((named) => named !== kind);
    if (strayed.length > 0) {
      return {
        reason: "wordsNameAnotherKind",
        detail: `${slot} is a ${kind} slot and its words name ${strayed.join(", ")} — a caption written about the FRAME, filed as the state of a SLOT; D-244 re-says this stack on every edit, so it would ask a paid render to put them back on`,
      };
    }
    const claim = pairClaimIn(word);
    if (claim !== null) {
      return {
        reason: "wordsClaimThePair",
        detail: `${slot} describes one instance and its words say "${claim}" — mismatched pairs are a ruled feature, and this claim was being filed identically under both sides`,
      };
    }
  }
  return null;
}
