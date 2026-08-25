/**
 * THE OUTFIT, AS THINGS SHE CAN POINT AT — the panel's wardrobe section
 * (design `CASTING_V2_TWO_PATHS_DESIGN.md` §8.1, from fable-1312; the split
 * rule and the path condition ruled fable-1459 ASK 1 and ASK 3).
 *
 * A Cast on the Wardrobe path is wearing one stored SENTENCE. The panel speaks
 * in things a stylist can tap — *her jacket*, *her boots* — so the sentence has
 * to become a list, and this is the whole of how.
 *
 * # THE SPLIT IS THE JOIN, READ BACKWARDS — and nothing else
 *
 * `editedWardrobeLine` composes a line by joining items with `", "`. So the
 * inverse of that join is the decomposition, and the two cannot disagree: a
 * line that arrived as a LIST round-trips to its own items, and one that
 * arrived as a sentence decomposes the same way. There is no rule here about
 * garments at all.
 *
 * ⚠ **AND THERE MUST NOT BE ONE.** The tempting version of this file decides
 * which pieces are tops and which are bottoms, or which phrases are "real"
 * garments. Both are a counts-as-a-garment taxonomy, and this program has
 * already paid for inventing one of those: the price reader's repair was that
 * the question is DISSOLVED rather than answered — every value emitted with its
 * provenance so the reader judges, and nothing dropped for failing a definition
 * nobody wrote down. The same applies here, and the cases that make it obvious
 * are the ones this path exists for: is *"bare legs"* a garment, which half of
 * *"surgical scrubs and plain white clogs"* is below the waist, where does a
 * dress sit.
 *
 * So **`bare chested` and `barefoot` are cards** (ruled fable-1459 ASK 1, whose
 * own example was `shirtless` — the word the male Basics line carried until
 * 2026-08-25, when the founder's wording test swapped it for the provider's
 * prompt checker; the RULING is untouched by that and only its example moved).
 * They are not garments; they are what this person is wearing there, which is
 * nothing, and that is a true and useful thing for a panel to say.
 *
 * # ⚠ IT IS A DISPLAY DECOMPOSITION AND IT REACHES NO PROMPT, EVER
 *
 * The LINE is the one owner (§3.3): the roll prompt, the refine recipe, the six
 * signed views, the wardrobe judge and the sheet all read it whole. This list is
 * what a person sees on a panel and nothing more — an edit to a card rewrites
 * the whole line (§7.1's rewrite rule, which is why the wardrobe card is
 * `plural: false`), so no piece is ever stored, sent or judged.
 *
 * # ⚠ AND THERE IS NO CROP, WHICH IS A MEASUREMENT AND NOT A GAP
 *
 * §8.1 asks for *"a crop where the scan finds one"*. **Nothing can reliably
 * find one**, and that was bought rather than assumed (the garment-crop court,
 * ordered fable-1459 ASK 2, run on the round-2 frames of both paths; 28
 * segmenter reads, house money):
 *
 * ```
 * BASICS, an ordinary outfit — a black sports top and black fitted shorts
 *   "top"       2/2 found, 9.4% and 12.0% of frame, and the mask is the
 *               GARMENT exactly: straps, scoop and hem, none of her
 *   "shorts"    1/2 — nothing on one frame, 14.2% on the other
 *   "shirt"     0/2 — the SPECIFICITY control passes: it does not answer a
 *               garment word for something she is not wearing
 * CAVEMAN, an irregular picked outfit — a hide wrap and a hide loincloth
 *   "hide"      0/2 — a customer's own noun cannot be asked. D-213 said so;
 *               this is the measurement behind it
 *   "top"       0/2 — a garment-TYPE word does not generalise to an
 *               irregular garment
 *   "clothing"  2/2 found — and ONE PIECE each, a DIFFERENT one each time:
 *               the wrap on one frame (27.7%, a precise cut round the whole
 *               diagonal), the loincloth on the other (3.8%, missing the wrap
 *               entirely)
 *   "trousers"  0/2   "shoes" 0/2 — negative controls pass
 * ```
 *
 * **A segmenter cuts a garment beautifully when it finds one, and WHICH one it
 * finds is not controllable.** That is the same shape as `tattooed skin`
 * answering one patch of a thirty-piece body. A panel piece is a POSITION in a
 * line — piece 0, piece 1, piece 2 — and there is no reliable mapping from a
 * position to a mask: the piece's own noun answers nothing, a garment-type word
 * answers nothing on anything unusual, and the generic word answers an
 * arbitrary one of them.
 *
 * So a crop keyed to a card would put the loincloth's picture on the wrap's row
 * about half the time — a rectangle over the wrong pixels, which is the exact
 * promise `facePanel`'s own header refuses to make.
 *
 * ⚠ **It also refutes the crop's headline justification.** fable-1312 proposed
 * these crops as *"the intended fix for irregular-garment drift across the six
 * views — the caveman's hide"*. The caveman is the one case measured here that
 * cannot be served: `hide` and `top` find nothing, and `clothing` finds a
 * different piece on each frame. **The crop cannot serve the case it was
 * proposed for**, and any later attempt needs a different reader rather than a
 * different word.
 *
 * That is not a fatal finding for §8.1 — the cards work, and this file is what
 * they are — it is a finding about the SECOND half, and it is recorded here
 * because this is where somebody would come to add one.
 *
 * That the pieces are display-only is not a promise, and it is asserted twice
 * because the two claims are
 * different. At the WIRE — `refineService.test.ts`, *"what the panel takes
 * apart, the engine is never handed in parts"* — a real repaint's outgoing
 * prompt has the whole LINE subtracted from it and no piece may survive in the
 * remainder. STRUCTURALLY — `wardrobeCardsAreDisplayOnly.test.ts` — the import
 * graph says nothing that ships reaches this module but the panel. The first
 * proves the road it drove; the second is about the caller nobody has written
 * yet.
 */
import type { CastingPath } from "../../shared/castingPaths";
import { subjectServedOnPath } from "./refineSubjects";
import type { WardrobeResolution } from "./wardrobeLine";

/**
 * ONE THING SHE IS WEARING, as the panel needs it.
 *
 * `phrase` is the customer-facing text and it is HER LINE'S OWN WORDS, never a
 * normalised or re-cased version: the line was either written by us or resolved
 * from her brief, and re-wording it on the way to a panel is the product
 * asserting a form of her sentence she never used.
 */
export type WardrobePiece = {
  /** The piece's own words, exactly as the line carries them. */
  phrase: string;
  /**
   * Its position in the line, 0-based — the panel's row order and the only
   * identity a piece has.
   *
   * There is deliberately no key derived from the WORDS. A piece is not a slot:
   * it has no library row, no crop of its own and no persistence, and a key
   * spelled from a customer's phrase would look exactly like one that did.
   */
  index: number;
};

/**
 * A leading conjunction on the last item, which the house line has and a
 * customer's line may not.
 *
 * `HOUSE_WARDROBE_LINE` ends *"…, and plain unbranded low shoes"*, so the naive
 * inverse of the join yields *"and plain unbranded low shoes"* — the product
 * putting a conjunction on a label. Stripped only at the START and only when it
 * is a whole word, so *"black and white striped shirt"* is untouched.
 */
function withoutLeadingConjunction(phrase: string): string {
  return phrase.replace(/^(?:and|&)\s+/i, "");
}

/**
 * THE THINGS THIS LINE NAMES — the inverse of the join, and nothing else.
 *
 * An empty or blank line answers an empty list rather than a list holding one
 * blank piece: a row with nothing in it is a promise of a picture that does not
 * exist, which is the panel's own oldest rule.
 */
export function wardrobePieces(line: string | null | undefined): readonly WardrobePiece[] {
  if (typeof line !== "string") return [];
  return line
    .split(",")
    .map((part) => withoutLeadingConjunction(part.trim()).trim())
    .filter((phrase) => phrase.length > 0)
    .map((phrase, index) => ({ phrase, index }));
}

/**
 * MAY THIS BRANCH BE ASKED ABOUT ITS WARDROBE AT ALL — the predicate both the
 * prompt and the panel read (ruled fable-1459 ASK 3).
 *
 * ⚠ **THIS IS A THIRD QUESTION AND IT IS WRITTEN OUT BECAUSE THE SECOND ONE
 * ALREADY WENT WRONG.** `subjectsServedOnPath` answers *what may be shown to
 * the model*; item 8 reused it for *what a chosen path refuses a customer* and
 * that was a real defect — `unpathed` must be WITHHELD from the first and must
 * not REFUSE on the second, because a path nobody chose is not a path that
 * refuses. One list, one value, two opposite correct answers.
 *
 * So the third question is stated rather than assumed: **does this cast get a
 * wardrobe SECTION on its panel.**
 *
 * ```
 * wardrobe   YES — she chose the path, the subject is in front of the model,
 *            and tapping a card reaches a real edit
 * basics     NO  — §7.2 refuses an outfit ask in its own words, so a card she
 *            can tap whose every road ends at `wall_basics_wardrobe` is D-180's
 *            dead end wearing a tap target
 * unpathed   NO  — and here the answer AGREES with the prompt question while
 *            DISAGREEING with the refusal one, which is exactly why all three
 *            values are checked out loud. Every roll in both worlds is
 *            unpathed; drawing a section for them would be live behaviour on a
 *            feature whose flag exists to keep it dark
 * ```
 *
 * It derives from the card's own `bornPathsServing` rather than naming the path
 * twice, so a future subject that becomes path-sensitive cannot land silently.
 */
export function wardrobeSectionServed(path: CastingPath | null | undefined): boolean {
  return subjectServedOnPath("wardrobe", path);
}

/**
 * THE PIECES A PANEL SHOULD DRAW FOR THIS BRANCH, or none.
 *
 * One function so a caller cannot get the path right and the line wrong, or
 * take the pieces from a resolution the section rule would have refused.
 *
 * `incoherent` draws nothing, and that is the same answer for the same reason it
 * gets everywhere else: a roll claiming a path and unable to say what it is
 * wearing has told us nothing, and a section built from that would be the
 * product describing an outfit it does not know.
 */
export function wardrobePanelPieces(
  wardrobe: WardrobeResolution | null | undefined,
): readonly WardrobePiece[] {
  if (!wardrobe || wardrobe.kind !== "line") return [];
  return wardrobeSectionServed(wardrobe.path) ? wardrobePieces(wardrobe.line) : [];
}
