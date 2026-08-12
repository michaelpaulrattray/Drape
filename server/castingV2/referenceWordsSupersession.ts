/**
 * SUPERSEDE A ROW'S WORDS AND CARRY ITS CARRIER ACROSS UNCHANGED.
 *
 * # Why this exists rather than "just run the mint again"
 *
 * A words fix repairs the WRITER; it does not repair what was already written.
 * Eight production earring rows hold a sentence naming her glasses, and the
 * obvious repair — re-run the real mint against each row's stored delivered
 * frame — was the one chosen, on the sound instinct that one implementation
 * beats two (working law 4).
 *
 * It cannot work, and the reason is structural rather than unlucky. A
 * supersession has no render: there is no paint map, so the mint is handed
 * `applied: null` and no master regions, the completeness guard has no ground to
 * score a crop against, it reads a trivial 100% and correctly declines to earn a
 * number from it (`noSpecimen`) — and every row it writes is therefore
 * **words-only**. Filed at a higher version over a crop-bearing row, that stops
 * the slot carrying: `liveReferences` takes the newest per (slot, role), and the
 * newest now has no crop. Three rows of a live production commit did exactly
 * this before it was stopped; two of them landed with empty words as well, so
 * for ten minutes a face's earrings had neither a sentence nor a picture.
 *
 * So the mint stays the only writer of NEW rows, and a supersession writes a
 * corrected COPY of an existing one: **only the words change.** Nothing is
 * re-guarded, because nothing about the pixels changed — the crop was judged
 * once, at its own render, with the evidence that render had, and that reading
 * travels with it.
 *
 * # What "byte-identical" means here and why it is asserted
 *
 * The carrier is a storage key plus the digest of the bytes at it. Copying the
 * key without the digest, or re-deriving either, would let the library's account
 * of a picture drift from the picture — which is the one thing `repaintRender`
 * refuses on (`referenceBytesChanged`). The test drives every field across.
 */
import type {
  ReferenceRowToRecord,
  ReferenceImageToRecord,
  ReferenceRefusalToRecord,
} from "../db/castingV2ReferenceLibrary";
import type { StoredReference } from "./referenceLibrary";
import { slotWordsRefusal, tidyStackWord } from "./slotWordShape";

/**
 * The row to write so that `existing`'s slot says `words` and carries exactly
 * what it carried before.
 *
 * A row is a delivered crop or a refused one, never both — the same rule the
 * write door enforces — so this reads the source's own shape rather than
 * deciding one.
 */
export function supersedingWordsRow(
  existing: StoredReference,
  words: readonly string[],
): ReferenceRowToRecord {
  const row: ReferenceRowToRecord = {
    role: existing.role,
    slot: existing.slot,
    tier: existing.tier,
    noun: existing.noun,
    words,
  };

  if (existing.storageKey !== null && existing.digest !== null) {
    const image: ReferenceImageToRecord = {
      storageKey: existing.storageKey,
      digest: existing.digest,
    };
    if (existing.maskKey !== null) image.maskKey = existing.maskKey;
    if (existing.geometry !== null) image.geometry = existing.geometry;
    if (existing.guard !== null) image.guard = existing.guard;
    row.image = image;
    return row;
  }

  if (existing.refusal !== null) {
    const refusal: ReferenceRefusalToRecord = {
      reason: existing.refusal.reason as ReferenceRefusalToRecord["reason"],
      kind: existing.refusal.kind,
    };
    if (existing.refusal.coverage !== null) refusal.coverage = existing.refusal.coverage;
    /*
      Both keys and the geometry, or none of them. The write door enforces that
      pairing and this must not be the caller that discovers it: a kept crop
      whose mask went missing cannot be cut out, and one whose box went missing
      cannot be put back on the face it came from.
    */
    if (existing.refusal.contentKey !== null
      && existing.refusal.maskKey !== null
      && existing.refusal.geometry !== null) {
      refusal.crop = {
        contentKey: existing.refusal.contentKey,
        maskKey: existing.refusal.maskKey,
        geometry: existing.refusal.geometry,
      };
    }
    row.refusal = refusal;
  }

  return row;
}

/**
 * Is this row's existing sentence UNTRUE, rather than merely untidy?
 *
 * The rule for a slot whose re-read says nothing: blank a sentence that is
 * wrong, keep a sentence that is right. The write door refuses four shapes and
 * only three of them are wrongness — a trailing full stop
 * (`wordCarriesTerminator`) is a grammar defect on a sentence that may be
 * perfectly true, and blanking a true sentence to fix its punctuation deletes a
 * fact for nothing.
 *
 * Production row #2 is the specimen and the reason this is not inlined as
 * `refusal !== null`: its words name her glasses AND end in a period, and the
 * door reports the punctuation first, so the cheap test would have got the right
 * answer there for the wrong reason and the wrong answer on the next row.
 */
export function wordsAreUntrue(slot: string, words: readonly string[]): boolean {
  /*
    THE TERMINATOR IS STRIPPED BEFORE THE QUESTION IS ASKED, and this is the
    whole reason the function exists rather than a comparison at the call site.

    `slotWordsRefusal` returns the FIRST refusal it finds and the terminator
    check runs first, so a sentence that both names her glasses and ends in a
    period reports as `wordCarriesTerminator` — and a caller testing the reason
    would read "merely untidy" about words that are flatly wrong. Production row
    #2 is exactly that sentence, and it was LEFT ALONE by the first version of
    this rule. Asking the door about the tidied words puts the real answer
    first.
  */
  const refusal = slotWordsRefusal(slot, words.map(tidyStackWord));
  if (refusal === null) return false;
  return refusal.reason === "wordsNameAnotherKind"
    || refusal.reason === "wordsClaimThePair"
    || refusal.reason === "wordsDescribeTheArtifact";
}
