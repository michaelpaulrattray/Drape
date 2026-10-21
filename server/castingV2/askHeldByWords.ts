/**
 * A KEPT FEATURE MAY NOT ARGUE WITH WHAT THE CHAIN ASKS FOR IT (#2650).
 *
 * # The render this exists for
 *
 * Dev re-drive of #2649, verify-bot 823. Step 1 cut the hair into a short crop.
 * Step 3 slipped back to the bun, and its reader disputed it, so that crop was
 * kept for a person and never carried. Step 4 asked for freckles; the hair was
 * re-said in words, and the arrangement pin it was checked against had been
 * re-read off the MASTER — *"in a bun"*. The frame showed a bun, so the reader
 * truthfully said yes, and the library adopted a crop whose own words were
 * *"Dark brown hair pulled into a high top bun…"*. Step 5 then sent
 * *"Reference 2 is the exact hair they have"* and *"Keep their hair exactly: …
 * high top bun"* beside *"their hair styled in a short crop"*.
 *
 * Every reader in that chain was either right or honestly fooled. What was
 * wrong is that nothing set the crop's words beside the customer's ask.
 *
 * # Deliberately NOT a reader (founder, relayed for this card: *"remember also
 * # the checker hasnt be reliable in the past"*)
 *
 * The comparison is a fixed word test, so its verdict cannot be talked into a
 * pass. It errs one way only, on purpose: a crop whose words do not plainly
 * hold the ask is refused, even when the crop is fine. A wrong refusal costs a
 * crop — the feature is then said in the customer's own words, which is how it
 * was asked for anyway. A wrong acceptance costs a contradiction stated to the
 * painter as fact, in every later render. Those are not the same mistake.
 *
 * What it still depends on, stated rather than hidden: the WORDS it reads are a
 * reader's description of the crop. If that reader describes a bun as a short
 * crop, this test cannot know.
 *
 * # Which asks it reads, and the five it leaves alone
 *
 * The chain's composed delta (the customer's asks after every removal) is the
 * single source of what a slot is currently asked to be. Never the
 * verification's `asked`: that held the master's pin on the very render this
 * card is about. And of that delta, ONLY the free lane, the ask as it was put
 * in words. The test reads the customer's own words and nothing the house
 * supplied (#2666).
 *
 *   a per-side slot      ruling C (fable-444): the delta says "green eyes" and
 *                        the LIBRARY remembers only the right one is green. The
 *                        left eye's words cannot hold "green", and that is
 *                        correct, so a per-side slot is never judged here.
 *   the accessory family one facet over every kind the cast wears, so the ask
 *                        is not about one slot.
 *   a picture-taken ask  its value is a placeholder (*"the hair in the attached
 *                        picture"*); the crop is that ask's only carrier.
 *   a guaranteed axis    every `REFINABLE_AXES` value (`hairStyle`,
 *                        `hairColour`, `hairTexture`, `eyeColour`, `eyeShape`,
 *                        `makeup`). A cut is stored by its HOUSE name: "short
 *                        crop" files as `hairStyle: "standard crop"`
 *                        (hairStyles.ts), and a real caption, *"short dark
 *                        brown hair, closely cropped"*, never says "standard",
 *                        so every hair crop was refused after any haircut, for
 *                        good (#2666). The other axes hold catalogue labels the
 *                        same way. A crop tested against words nobody said is
 *                        not a test of the ask, so no axis is read here: the
 *                        slot is judged by its free-lane asks, or not at all.
 *   a comparative ask    "fuller brows", "longer hair", "more freckles". It is
 *                        measured against the BEFORE, and a caption describes
 *                        one picture: no crop's words say "fuller", so the test
 *                        refused every crop forever. Worse, stripped of its
 *                        comparative, "longer hair" is held by the OLD "long
 *                        hair" crop, which would ride again against the ask.
 *                        Neither answer reads the ask, so it is left out.
 *
 * What leaving an ask out means, stated: the slot is judged on its other asks,
 * or, with none left, not judged here at all, and its newest live crop rides as
 * it did before #2650. That is the road every slot the chain says nothing about
 * already takes. It invents no verdict and it does not close the slot, and the
 * reader that wrote the crop's words is trusted no further than it was then.
 */
import { itemsOf, type RefineDelta } from "./refineDelta";
import { facetOfSubject, type Facet } from "./refineFacets";
import type { FeatureSlot } from "./recipeAssembler";
import { FACET_SLOTS, catalogueSlots } from "./referenceSlotCatalogue";
import type { FreeSubject } from "./subjectCards";
import { liveReferences, type StoredReference } from "./referenceLibrary";
import { REFUSAL_THAT_IS_EVIDENCE_ONLY } from "./referenceCompleteness";

/**
 * Words that carry no claim about a feature. An ask of "freckles across the
 * nose and cheeks" is held by a caption that says "freckles scattered over the
 * nose and both cheeks"; it should not fail on "the".
 */
const NO_CLAIM = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "at", "into", "with", "her", "his",
  "their", "them", "they", "it", "its", "is", "are", "be", "more", "bit", "little",
  "very", "slightly", "some", "make", "made", "across", "over", "both", "each", "one",
]);

/**
 * One word reduced to its root: the common endings dropped, then a doubled
 * final consonant undone, so crop / cropped / cropping and freckle / freckles
 * are one word. The suffix rule is `stemmedContainment`'s (refineDelta.ts);
 * the undoubling is what this question needs and that one does not.
 */
function rootOf(word: string): string {
  const stemmed = word.replace(/(ing|ed|es|s)$/i, "").replace(/e$/i, "");
  return stemmed.replace(/([b-df-hj-np-tv-z])\1$/i, "$1");
}

function rootsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(rootOf);
}

/**
 * Do these words plainly hold every ask? Every claim-bearing word of every ask
 * must appear, as a root, somewhere in the words. No asks is trivially held;
 * no words with an ask is NOT — a crop with nothing said about it has not
 * shown that it agrees.
 *
 * The slot's own noun is not a claim: "hair down" asked of the hair is held by
 * "tight curls worn down", which never needs to say "hair".
 */
export function wordsHoldAsks(
  words: readonly string[],
  asks: readonly string[],
  noun = "",
): boolean {
  if (asks.length === 0) return true;
  const held = new Set([...rootsOf(words.join(" ")), ...rootsOf(noun)]);
  if (rootsOf(words.join(" ")).length === 0) return false;
  return asks.every((ask) => {
    const claims = ask.toLowerCase().split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !NO_CLAIM.has(word))
      .map(rootOf);
    return claims.every((claim) => held.has(claim));
  });
}

/**
 * Comparative words: an ask carrying one is about a CHANGE from the before, and
 * a caption of one picture cannot hold it (see the header). An explicit list on
 * purpose. A word it misses stays in the ask, where the caption will not say it
 * and the crop is refused, which is this test's safe direction; a looser rule
 * ("ends in -er") would also catch "silver", "copper" and "layer" and leave
 * ordinary asks unjudged.
 */
const COMPARATIVE = new Set([
  "more", "less", "fewer", "still", "even",
  "longer", "shorter", "fuller", "thicker", "thinner", "bigger", "smaller",
  "larger", "wider", "narrower", "higher", "lower", "deeper", "shallower",
  "darker", "lighter", "brighter", "paler", "duller", "warmer", "cooler",
  "softer", "harder", "sharper", "stronger", "weaker", "bolder", "fainter",
  "heavier", "rounder", "flatter", "straighter", "curlier", "wavier",
  "tighter", "looser", "neater", "messier", "older", "younger", "redder",
  "pinker", "greener", "bluer", "browner", "greyer", "grayer", "blonder",
  "whiter", "blacker", "richer", "subtler", "glossier", "shinier",
  "sleeker", "denser", "sparser", "closer", "further", "farther", "taller",
]);

/** Is this ask a comparative, about the change rather than the state? */
export function isComparativeAsk(ask: string): boolean {
  return ask.toLowerCase().split(/[^a-z]+/).some((word) => COMPARATIVE.has(word));
}

/**
 * What the chain currently asks of each whole (sideless) catalogue slot, in the
 * customer's words: the free lane only, never a guaranteed axis's house value,
 * and never a comparative (#2666; the header names all five exclusions). Slots
 * the chain says nothing testable about are absent.
 */
export function chainAsksBySlot(composed: RefineDelta): Map<FeatureSlot, string[]> {
  const byFacet = new Map<Facet, string[]>();
  const add = (facet: Facet, value: string) => {
    if (isComparativeAsk(value)) return;
    const held = byFacet.get(facet) ?? [];
    held.push(value);
    byFacet.set(facet, held);
  };
  /* No `REFINABLE_AXES` loop, on purpose (#2666): an axis value is the house's
     word for the ask, never the customer's. */
  const fromPicture = new Set<string>(composed.fromPicture ?? []);
  for (const [subject, value] of Object.entries(composed.free ?? {})) {
    if (fromPicture.has(subject)) continue;
    for (const item of itemsOf(value)) add(facetOfSubject(subject as FreeSubject), item);
  }
  const slots = catalogueSlots().filter((slot) => !slot.slot.includes("@"));
  const asks = new Map<FeatureSlot, string[]>();
  for (const [facet, values] of Array.from(byFacet.entries())) {
    const assignment = FACET_SLOTS[facet];
    if (assignment === undefined || !("feature" in assignment)) continue;
    for (const slot of slots) {
      if (slot.feature !== assignment.feature) continue;
      asks.set(slot.slot, [...(asks.get(slot.slot) ?? []), ...values]);
    }
  }
  return asks;
}

/**
 * THE SEND-SIDE HALF: for every slot the chain asks about, the row that rides
 * is the NEWEST row whose own words hold the ask — never one that argues with
 * it (#2650, repaired on the relay's HELD finding on PR #2653).
 *
 *   newest live row holds          nothing changes
 *   an OLDER row holds             the rows that do not hold stay home, the
 *                                  holding row rides with its keep-line; when
 *                                  it has a crop the slot is `reinstated`, and
 *                                  the caller takes it off the words-only list
 *   no row holds                   every row of the slot stays home; the slot
 *                                  is `contradicted` and said in words
 *
 * Why an older crop may come back: the short crop delivered at step 1 is the
 * one picture that matches the ask after the bun slipped back at step 3.
 * Words alone lose to the master's bun on every render (the relay's eye on
 * the #2653 strip). A crop whose words do not hold the ask never rides.
 *
 * A disputed row never rides and is never chosen; dropping it from the list
 * changes nothing the assembler sees.
 */
export function carriesHoldingTheirAsks(input: {
  rows: readonly StoredReference[];
  composed: RefineDelta;
}): {
  rows: StoredReference[];
  /** Rows set aside because their words do not hold the ask. */
  contradicted: StoredReference[];
  /** Slots with no holding row at all — said in words. */
  contradictedSlots: FeatureSlot[];
  /** Slots whose holding row carries a crop — must NOT be said in words. */
  reinstated: FeatureSlot[];
} {
  const asks = chainAsksBySlot(input.composed);
  const contradicted: StoredReference[] = [];
  const contradictedSlots: FeatureSlot[] = [];
  const reinstated: FeatureSlot[] = [];
  const setAside = new Set<StoredReference>();
  const bySlot = new Map<FeatureSlot, StoredReference[]>();
  for (const row of input.rows) {
    if (row.role !== "carry" || row.retiredAt !== null || !asks.has(row.slot)) continue;
    bySlot.set(row.slot, [...(bySlot.get(row.slot) ?? []), row]);
  }
  for (const [slot, rows] of Array.from(bySlot.entries())) {
    const asked = asks.get(slot)!;
    const live = liveReferences(rows)[0];
    const holding = rows
      .filter((row) => row.refusal?.reason !== REFUSAL_THAT_IS_EVIDENCE_ONLY)
      .filter((row) => wordsHoldAsks(row.words, asked, row.noun))
      .sort((a, b) => b.version - a.version)[0];
    const newest = rows.slice().sort((a, b) => b.version - a.version)[0]!;
    /* The ordinary case: what would ride already holds, and nothing newer
       took the slot to words. Untouched. */
    if (live !== undefined && holding === live && newest === live) continue;
    if (holding === undefined) {
      for (const row of rows) setAside.add(row);
      if (live !== undefined) contradicted.push(live);
      contradictedSlots.push(slot);
      continue;
    }
    for (const row of rows) {
      if (row === holding) continue;
      setAside.add(row);
      if (row === live) contradicted.push(row);
    }
    if (holding.storageKey !== null) reinstated.push(slot);
  }
  const rows = input.rows.filter((row) => !setAside.has(row));
  return { rows, contradicted, contradictedSlots, reinstated };
}
