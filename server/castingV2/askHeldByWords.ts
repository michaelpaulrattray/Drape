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
 * # Which asks it reads, and the three it leaves alone
 *
 * The chain's composed delta — the customer's asks after every removal — is the
 * single source of what a slot is currently asked to be. Never the
 * verification's `asked`: that held the master's pin on the very render this
 * card is about.
 *
 *   a per-side slot      ruling C (fable-444): the delta says "green eyes" and
 *                        the LIBRARY remembers only the right one is green. The
 *                        left eye's words cannot hold "green", and that is
 *                        correct, so a per-side slot is never judged here.
 *   the accessory family one facet over every kind she wears, so the ask is not
 *                        about one slot.
 *   a picture-taken ask  its value is a placeholder (*"the hair in the attached
 *                        picture"*); the crop is that ask's only carrier.
 */
import { REFINABLE_AXES, itemsOf, type RefineDelta } from "./refineDelta";
import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import type { FeatureSlot } from "./recipeAssembler";
import { FACET_SLOTS, catalogueSlots } from "./referenceSlotCatalogue";
import type { FreeSubject } from "./subjectCards";
import { liveReferences, type StoredReference } from "./referenceLibrary";

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
 * What the chain currently asks of each whole (sideless) catalogue slot, in the
 * customer's words. Slots the chain says nothing about are absent.
 */
export function chainAsksBySlot(composed: RefineDelta): Map<FeatureSlot, string[]> {
  const byFacet = new Map<Facet, string[]>();
  const add = (facet: Facet, value: string) => {
    const held = byFacet.get(facet) ?? [];
    held.push(value);
    byFacet.set(facet, held);
  };
  for (const axis of REFINABLE_AXES) {
    const value = composed[axis];
    if (typeof value === "string" && value.trim()) add(facetOfAxis(axis), value);
  }
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
 * THE SEND-SIDE HALF: the carried rows whose words do not hold the chain's
 * current ask stop riding — no crop, no keep-line — and their slots are said
 * in words from the chain instead (the caller adds them to the restore list).
 *
 * This is the backstop that holds whatever any reader said and whenever the
 * row was filed, including rows adopted before #2650 existed. It reads the
 * row's own words, so it also catches a crop cut before the slot was asked to
 * change: those words describe the old state and cannot hold the new ask.
 */
export function carriesHoldingTheirAsks(input: {
  rows: readonly StoredReference[];
  composed: RefineDelta;
}): { rows: StoredReference[]; contradicted: StoredReference[] } {
  const asks = chainAsksBySlot(input.composed);
  /*
    JUDGED ON THE ROW THAT WOULD RIDE, AND THE WHOLE SLOT GOES WITH IT.

    Only the slot's live row (`liveReferences`: newest, never a disputed one)
    is what the assembler would send, so it is the one judged. A disputed row
    is never sent and is not judged. And when the live row fails, every row of
    that slot stays home — dropping only the newest would hand the slot to an
    OLDER crop, which is the state before the ask moved.
  */
  const failed = new Set<string>();
  const contradicted: StoredReference[] = [];
  for (const row of liveReferences(input.rows)) {
    const asked = asks.get(row.slot);
    if (row.role !== "carry" || asked === undefined) continue;
    if (wordsHoldAsks(row.words, asked, row.noun)) continue;
    failed.add(row.slot);
    contradicted.push(row);
  }
  const rows = input.rows.filter((row) => !(row.role === "carry" && failed.has(row.slot)));
  return { rows, contradicted };
}
