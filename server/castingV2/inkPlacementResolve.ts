/**
 * WHERE SHE SAID IT GOES — resolving a placement out of a customer's own words
 * (founder ruling relayed fable-1078 §1, designed opus-821 §1, ratified
 * fable-1114 §2).
 *
 * > *"no any tattoo request from a reference image must be respected regardless
 * > if u can see it or not, if the sleeve cuts off and you cant see the full
 * > finished product in the image refinement it should carry into the
 * > sign/angles as it will still have the reference + description"*
 *
 * Read as: **a reference-tattoo ask is never refused on placement.** Her words
 * name where it goes, whatever words those are.
 *
 * # CLOSED FIRST, OPEN AS THE LAST RESORT — the open lane's own shape
 *
 * `shared/inkPlacementVocabulary.ts` still answers *is this surface in the
 * photograph*, measured on sixteen masters. It stopped being the DATABASE's
 * fence at migration 0046; it did not stop being the vocabulary. So a word is
 * offered to it first, and only a word it does not know becomes an open phrase.
 *
 * # THE TRAP THAT SHAPED THIS FILE, AND IT IS NOT HYPOTHETICAL
 *
 * The vocabulary's keys are camelCase. A normaliser that lowercases before
 * asking turns `upperArm` into `upperarm` — not a key, not in `INK_PLACEMENTS`
 * — and files **his oldest measured placement as an open phantom**. Five of the
 * seven design rows in the dev database are `upperArm`.
 *
 * The mirror of it is just as real: `upper arm`, typed with a space, is the
 * same surface and would file open if only the key were matched. So the match
 * runs against all three spellings the entry ALREADY carries — `key`,
 * `readerWord` and `noun` — derived from the entry rather than listed here
 * (working law 4). A fourth measured placement joins this resolver by existing.
 *
 * # WHAT THE NORMALISER DOES, AND THE LINE IT WILL NOT CROSS
 *
 *     trim · collapse internal whitespace · lowercase     ← transport noise
 *     merge "full sleeve" into "sleeve"                   ← MEANING. Never.
 *     strip "the" / "my" / "her"                          ← inference. Never.
 *
 * A full sleeve and a half sleeve are different pieces of work. A door that
 * silently merged them would hand the founder a demand number that had already
 * had a judgement applied to it by a machine. **The synonym judgement belongs
 * to the human reading the tally**, who can see both rows — the open lane's
 * founding sentence, governing here (fable-1114 §2).
 *
 * # IT NEVER REFUSES. IT ASKS.
 *
 * Two of the four answers are questions rather than doors: a placement nobody
 * stated, and a phrase too long to be a place name. Both route to the
 * `answering` mechanism at the caller, because his ruling forbids a refusal on
 * placement and D-180 forbids a question that dead-ends. Neither is a refusal
 * and this module cannot produce one.
 */
import {
  INK_PLACEMENTS,
  inkPlacementEntry,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";

/**
 * The longest a stored placement may be.
 *
 * It is the width of `casting_ink_designs.placement` (migration 0046) and it is
 * that number for a mechanical reason rather than a matching one: this database
 * runs `STRICT_TRANS_TABLES`, so a 65th character is an ERROR at the INSERT,
 * not a truncation. A door that admitted one would turn a customer's upload
 * into a 500.
 *
 * `inkPlacementCoupling.test.ts` holds this against the column's live width, so
 * the two are one decision (fable-1113 §1's pattern).
 */
export const INK_PLACEMENT_MAX_LENGTH = 64;

/**
 * The longest phrase the unattributed DEMAND tally will keep — DERIVED, at
 * twice the longest thing this vocabulary has ever needed to say.
 *
 * The number is not a feel and it is not the same number as the one above,
 * because the two columns are not the same kind of place:
 *
 *   casting_ink_designs        HER row — owned, scoped, purged with her Cast.
 *                              Her own words about her own Cast belong in it.
 *   casting_ink_form_demand    NOBODY'S row. Migration 0041's entire argument
 *                              for being a separate table is that its columns
 *                              cannot be traced to a person — "absent from the
 *                              row rather than omitted from a projection".
 *
 * A body-part name cannot identify anybody. A free-text phrase can: *"my right
 * arm where my son's name is"*. So the tally keeps phrases the size of a place
 * name and nothing longer, and the bound is derived from the vocabulary so it
 * cannot drift into a feel later.
 */
export const INK_PLACEMENT_TALLY_MAX_LENGTH = 2 * INK_PLACEMENTS.reduce((longest, key) => {
  const entry = inkPlacementEntry(key);
  return Math.max(longest, key.length, entry.readerWord.length, entry.noun.length);
}, 0);

/**
 * What the tally records when the phrase is too long to keep.
 *
 * **Uppercase on purpose, and it is load-bearing**: the normaliser lowercases,
 * so no customer phrase can ever produce this string. A sentinel a customer
 * could type is a sentinel that eventually means two things — anchor on a
 * character the encoding cannot produce.
 *
 * It is a sentinel rather than a truncation because **a truncation is a phrase
 * somebody could still read**, and the row it would sit in is the one built so
 * there is nobody to attribute it to (ruled fable-1115 §4).
 */
export const INK_PLACEMENT_TALLY_UNKEPT = "OPEN";

export type ResolvedPlacement =
  /** One of the measured surfaces, however she spelled it. */
  | { readonly kind: "measured"; readonly placement: InkPlacement }
  /** Her own word for somewhere the vocabulary has never measured. */
  | { readonly kind: "open"; readonly phrase: string }
  /** She named no place at all. A question, never a refusal. */
  | { readonly kind: "absent" }
  /** Longer than a place name. Also a question — see the header. */
  | { readonly kind: "tooLong"; readonly length: number };

/** Transport noise removed, and nothing else. */
function normalise(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The measured surface this phrase names, or `null`.
 *
 * All three spellings come off the entry, so the day a fourth placement is
 * measured it is matchable the moment it is added — there is no list here to
 * remember to update.
 */
function measuredFor(normalised: string): InkPlacement | null {
  for (const key of INK_PLACEMENTS) {
    const entry = inkPlacementEntry(key);
    const spellings = [key, entry.readerWord, entry.noun].map((value) => value.toLowerCase());
    if (spellings.includes(normalised)) return key;
  }
  return null;
}

/**
 * HER SIDE WORD, TAKEN OUT OF THE PLACE NAME IT IS SITTING INSIDE — decomposition
 * (ruled fable-1163 §3, found by driving the surface 2026-08-20).
 *
 * *"use this tattoo design on her left upper arm"* is the most natural phrasing
 * there is, and it read back as the OPEN phrase `left upper arm` with the side
 * `left` — so the ask was refused as an unmeasured surface, in a sentence that
 * said **"her left left upper arm is more than I can place yet"**. Both halves
 * were wrong: `upperArm` is one of the three measured surfaces, and the prose
 * repeated her word.
 *
 * # WHY THIS IS NOT THE INFERENCE 1115 §3 OUTLAWED
 *
 * That ruling forbade deriving a side FROM a placement word — *sleeve implies
 * arm implies pick one* — because the side would be the machine's guess about a
 * thing whose cost is a refund and an apology. Nothing is guessed here. The
 * side is one SHE TYPED, already captured and already checked against her own
 * sentence by source containment; all this does is stop counting it twice.
 *
 * # THE THREE CONDITIONS, and each rules something out
 *
 *   the token must be the side ALREADY CAPTURED — never any side word, so a
 *   sentence naming one side cannot have another one stripped out of a phrase;
 *   it comes off as a WHOLE WORD at either end — "leftover" keeps its letters;
 *   and the remainder must match the closed vocabulary — "left sleeve" strips
 *   to "sleeve", which is unmeasured, so it stays OPEN with her whole phrase
 *   intact. An open phrase is the tally's evidence and is never edited.
 */
function withoutStatedSide(normalised: string, statedSide: InkSide | null): string | null {
  if (statedSide !== "left" && statedSide !== "right") return null;
  /* `\\s` rather than `\s`: a template literal resolves `\s` to a bare "s", so
     the pattern would read `^lefts+` and quietly never match — a whole-word
     strip that fires on nothing. */
  const stripped = normalised
    .replace(new RegExp(`^${statedSide}\\s+`), "")
    .replace(new RegExp(`\\s+${statedSide}$`), "");
  return stripped === normalised || stripped === "" ? null : stripped;
}

export function resolveInkPlacement(
  raw: string,
  /**
   * The side she stated, when one was captured out of her own sentence — the
   * only token this resolver may consume. `null` on every other road, which is
   * every road that has not read one.
   */
  statedSide: InkSide | null = null,
): ResolvedPlacement {
  const normalised = normalise(raw);
  if (normalised === "") return { kind: "absent" };

  /*
    THE MEASURED QUESTION IS ASKED BEFORE THE LENGTH ONE, and the order is not
    cosmetic: a measured spelling is short by construction, so it can never be
    refused by a bound written for open prose. Asking length first would make
    the cap a gate on the vocabulary as well, which is a different rule than the
    one anybody agreed to.
  */
  const measured = measuredFor(normalised);
  if (measured !== null) return { kind: "measured", placement: measured };

  /* Her own side word, out of the way, and only then asked again. See above for
     why this is not an inference. */
  const withoutSide = withoutStatedSide(normalised, statedSide);
  if (withoutSide !== null) {
    const decomposed = measuredFor(withoutSide);
    if (decomposed !== null) return { kind: "measured", placement: decomposed };
  }

  if (normalised.length > INK_PLACEMENT_MAX_LENGTH) {
    return { kind: "tooLong", length: normalised.length };
  }
  return { kind: "open", phrase: normalised };
}

/**
 * What the DESIGN row stores — her word, or the vocabulary's key for it.
 *
 * `null` for the two answers that are questions: there is nothing to file about
 * a place nobody named, and nothing safe to file about a sentence.
 */
export function inkPlacementColumnValue(resolved: ResolvedPlacement): string | null {
  switch (resolved.kind) {
    case "measured": return resolved.placement;
    case "open": return resolved.phrase;
    case "absent":
    case "tooLong": return null;
    default: {
      const unhandled: never = resolved;
      throw new Error(`unhandled placement resolution: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * What the unattributed DEMAND row stores.
 *
 * The same value as the design row for anything place-name sized, and the
 * sentinel above for an open phrase longer than that — see
 * {@link INK_PLACEMENT_TALLY_UNKEPT} for why it is not a truncation.
 *
 * `null` carries the same meaning it does above: there is no ask here to count
 * yet, only a question waiting for an answer.
 */
export function inkPlacementTallyValue(resolved: ResolvedPlacement): string | null {
  const value = inkPlacementColumnValue(resolved);
  if (value === null) return null;
  if (resolved.kind === "open" && value.length > INK_PLACEMENT_TALLY_MAX_LENGTH) {
    return INK_PLACEMENT_TALLY_UNKEPT;
  }
  return value;
}
