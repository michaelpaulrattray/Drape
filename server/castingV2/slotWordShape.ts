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
import { parseSlot } from "./referenceSlots";

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

export type SlotWordsRefusal =
  | { reason: "wordsNameAnotherKind"; detail: string }
  | { reason: "wordsClaimThePair"; detail: string }
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
