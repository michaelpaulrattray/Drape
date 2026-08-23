/**
 * DOES THIS CAST'S WARDROBE COVER THIS SURFACE — the one owner (item 7a,
 * `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §5.2, countersigned fable-1368).
 *
 * # The question this replaces, and why it had three answers
 *
 * Whether a tattoo can go somewhere has always been part *is the surface in the
 * picture* and part *is there a garment over it*. The second half was never
 * asked: it was ANSWERED IN ADVANCE, three times, by three frozen constants
 * that all encoded the same fact about the same outfit —
 *
 * ```
 * RIDES_PACKAGE_VIEWS   neck true · upperArm true · upperChest false
 * WORDS_ROAD_PLACEMENTS neck (upperArm behind its flag) — upperChest excluded
 *                       because the mint cannot crop a chest under a crew tee
 * INK_PLACEMENTS.skin   neck bare · upperArm bare · upperChest dependsOnGarment
 * ```
 *
 * — and every one of those readings was taken on **sixteen production masters
 * that were all wearing the same crew-neck tee** (`V3B_PLACEMENT_VOCABULARY_
 * READING.md`). While the house line was the only outfit in the product that
 * was a fair summary. The Two Paths ruling ends it: a cast can be born
 * shirtless, or in a one-shoulder hide the picker invented for *"a caveman"*,
 * and then `neck: true` is a promise about a neck under a roll-neck jumper.
 *
 * **The over-promising direction is the dangerous one.** `upperChest: false`
 * refuses a real capability, which is a customer who does not get something.
 * `neck: bare` SELLS one: the ask renders, the design rides all six package
 * views, and the wardrobe axis fails them — six refunded slices for a tattoo
 * painted onto wool.
 *
 * # THE MEASUREMENT LIVES HERE NOW (condition (i), fable-1368 ruling 3)
 *
 * `INK_PLACEMENTS.skin` is deleted rather than re-pointed — an inert copy of a
 * fact two live constants also hold is exactly what a future reader reaches for
 * when wiring a derivation, because it has the right SHAPE and the wrong
 * SOURCE. Its measurement outlives it, and this is where it lives:
 *
 * ```
 * neck        4/4 found, bare in every frame — the one placement with no
 *             condition ON THE HOUSE TEE, whose neckline sits below it
 * upperArm    4/4 found, and PARTIAL: what is in shot is the sliver BELOW THE
 *             SLEEVE at the bottom corners of the frame. A fact about a SHORT
 *             SLEEVE, which is what the house line has
 * upperChest  found 2.69% on the bare scoop frame and correctly nothing on the
 *             covered crew frame. The roll prompt asks for a crew neck, so the
 *             ordinary case is covered — "a covered chest is a different
 *             garment away", which is now literally true
 * ```
 *
 * # It is PURE, like `currentWardrobeLine`, and for the same reason
 *
 * No database, no flag, no reader. It takes a line — or a resolution, for the
 * callers that hold one — and answers. That is what lets the gate ask it before
 * any money moves and the Sign ask it about a snapshot, and get the same answer.
 *
 * # ⚠ `unknown` IS A THIRD STATE AND IT FALLS CLOSED (fable-1368 ruling 1)
 *
 * A line nobody has read the coverage of answers `unknown`, and every consumer
 * treats `unknown` as *do not sell it* — the same side `readOpenKindProperties`
 * chose, for the same reason: a gate that treats unknown as available files one
 * wing under the name of two.
 *
 * **But it may never be REPORTED as `covered`.** The refusal a customer sees
 * has to say *this outfit's coverage has not been read yet* and never *the
 * chest is covered*, because a fail-closed gate that lies about why it closed
 * is how somebody learns to distrust every refusal this product writes. Each
 * consumer therefore carries its own name for this state, next to its name for
 * a real covering.
 *
 * # What makes `unknown` rare, and when
 *
 * Today it is unreachable: `CASTING_TWO_PATHS_SCOPE` is absent, so every roll
 * in production is `unpathed` and answers the house table byte for byte. It
 * becomes reachable the day that flag widens, and at that moment EVERY
 * Wardrobe-path cast with a picked or customer-named outfit meets an ink
 * refusal on every placement.
 *
 * **That coupling is an enumerated precondition of the flip and not a note
 * here** (fable-1368 ruling 2): the reader that answers coverage for an
 * arbitrary line is 7a-bis, and the Two Paths flag's own paragraph carries it —
 * or an explicit founder acceptance of the refuse-until-read state — before it
 * widens. A road named in a ruling is written where the next person acts or it
 * does not exist.
 */
import { INK_PLACEMENTS, type InkPlacement } from "../../shared/inkPlacementVocabulary";

import {
  HOUSE_WARDROBE_LINE,
  basicsWardrobeLine,
  type WardrobeResolution,
} from "./wardrobeLine";

/**
 * `bare` — this outfit leaves the surface showing, so ink there can be
 * rendered, cropped and carried into a view.
 * `covered` — a garment is over it. Measured or spec'd, never assumed.
 * `unknown` — nobody has read this outfit's coverage. Fails closed, and says
 * so in its own words rather than borrowing `covered`'s.
 */
export type SurfaceCoverage = "bare" | "covered" | "unknown";

/**
 * The house line's coverage — the measurement quoted in the header, as a table.
 *
 * TOTAL over the vocabulary, like the tables it replaces and for the same
 * reason: a default would decide a new surface's visibility by whichever value
 * was listed first and nothing would say so.
 */
const HOUSE_COVERAGE: Readonly<Record<InkPlacement, SurfaceCoverage>> = Object.freeze({
  neck: "bare",
  upperArm: "bare",
  upperChest: "covered",
});

/**
 * The Basics line's coverage, read off the spec's own words rather than
 * measured — because there is nothing to measure yet and saying so is the
 * honest form.
 *
 * Both forms of `basicsWardrobeLine` leave all three surfaces showing, and
 * neither does it by accident: the male form is *shirtless*, and the covered
 * form is *"a plain black sports top scooped low at the chest"*, whose scoop
 * exists in the spec precisely so a chest piece shows. Shorts are below the
 * frame either way, so no surface in this vocabulary is under them.
 *
 * ⚠ **This is a claim about a SENTENCE we wrote, not about a photograph**, and
 * it is the one entry here that has not been through a frame. It is admissible
 * because the sentence is ours and it is prescriptive — we ask the engine for
 * it — where a customer's line is descriptive and could say anything. The day
 * a Basics cast is rolled, the honest next step is to read one and confirm.
 *
 * ⚠⚠ **A BASICS CAST HAS NOW BEEN ROLLED AND THE READING DOES NOT CONFIRM THE
 * CHEST** (the Two Paths court, arm 2 — opus-1111, dev, eight candidates).
 * `upper chest` — the mint's own measured word, the one that decides whether a
 * chest piece can be cropped and carried — returned **0 px on 4 of 4 Basics
 * candidates**, and `chest skin` and `chest` returned 0 px too. The overlays
 * are `output/two-paths-court/READ-BASICS-chest*.jpg`.
 *
 * **The skin is visibly there and the reader will not name it**, which is a
 * third thing this file's three words do not cover: not `bare` as it means it
 * here (*"so ink there can be rendered, cropped and carried into a view"*), and
 * not `covered` either, because telling a woman in a scooped sports top that
 * her chest is covered is the lie ruling 1 forbids.
 *
 * **`upperChest: "bare"` was therefore OVER-PROMISING on this path** — the
 * direction this file's own header calls the dangerous one: the ask renders,
 * the mint writes nothing, and the tattoo is gone on her next edit. **It is
 * `unknown` as of 2026-08-23** (ruled fable-1453 ASK 2), and the ruling's reason
 * is worth keeping over the value: *a table entry a court has proven false is a
 * lie in a load-bearing file even while the path is dark* — which is the
 * documented-believed-working pattern CLAUDE.md's whole middle section exists to
 * prevent. The entry itself carries what flips it, either way.
 *
 * ⚠ And the WARDROBE path's first picked garment reads the other way: on a
 * hide wrap that leaves one side of the chest bare, `upper chest` answered
 * **66,046 and 64,942 px** on two candidates — clean masks on his skin. So
 * `unknown` fails closed on a surface that reads perfectly, which is the same
 * table being wrong in the opposite direction on the other path.
 */
const BASICS_COVERAGE: Readonly<Record<InkPlacement, SurfaceCoverage>> = Object.freeze({
  neck: "bare",
  upperArm: "bare",
  /*
    ⚠ `bare` UNTIL A COURT READ IT AND FOUND NOTHING — ruled fable-1453 ASK 2.

    Not `covered`, which would be the lie ruling 1 forbids (her chest is plainly
    visible), and not `bare`, which SELLS a chest piece the mint cannot crop.
    `unknown` is the state this type has that fails closed and says, in each
    consumer's own words, that nobody can answer for this outfit yet — which is
    true in the only sense that decides whether her tattoo survives.

    ⚠ **IT IS COUPLED TO A FOUNDER CARD AND FLIPS EITHER WAY WITH HIS ANSWER**
    (founder-queue FQ-b, 2026-08-23). If he lowers the spec's scoop and a
    re-court reads the chest, this becomes `bare` **with that court as its
    provenance** rather than with the spec's sentence. If he accepts that Basics
    does not serve chest ink, the honest end state is a fourth state — visible
    and unreadable, carrying its own copy — and that gets carded then. One word
    today, honest both ways tomorrow.
  */
  upperChest: "unknown",
});

/**
 * The two Basics forms, derived from the writer rather than restated.
 *
 * `sheetBasicsSex` resolves a whole sheet to `"male"` or `null`, so those are
 * the only two arguments `bornWardrobeLine` ever gives it and these are the
 * only two strings it can have written.
 */
const BASICS_LINES: readonly string[] = [basicsWardrobeLine("male"), basicsWardrobeLine(null)];

/** Compared the way a stored line is stored: trimmed, and nothing else. */
function same(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/**
 * WHAT THIS OUTFIT LEAVES SHOWING — the door for a caller holding a LINE.
 *
 * `null` is *no line recorded*, which is every roll cast before the paths and
 * every Cast signed before them, and it answers the house table exactly. That
 * is not a default: the house tee is what those casts are wearing, and
 * reproducing today's picture for them is the whole compatibility contract.
 *
 * ⚠ **ABSENT AND NULL MEAN THE SAME THING, and the type says so on purpose** —
 * `WardrobeBranch.rollPath`'s own rule, one file over. A caller assembling this
 * from a partial row, a projection written before the columns existed or a test
 * double hands `undefined`, and this reader must not treat that as a different
 * question. It is silence, and silence is *no line recorded*.
 *
 * A line we did not write is `unknown` — see the header. There is deliberately
 * no prose matching here, no *"does it contain the word 'crew'"*: a guess about
 * what a customer's outfit covers is a guess about her body, and this product
 * refuses those (law 7b). The reader that can answer honestly is 7a-bis.
 */
export function coverageOfWardrobeLine(
  line: string | null | undefined,
  placement: InkPlacement,
): SurfaceCoverage {
  if (line === null || line === undefined) return HOUSE_COVERAGE[placement];
  if (same(line, HOUSE_WARDROBE_LINE)) return HOUSE_COVERAGE[placement];
  if (BASICS_LINES.some((known) => same(line, known))) return BASICS_COVERAGE[placement];
  return "unknown";
}

/**
 * The same question for a caller holding a {@link WardrobeResolution} — the ink
 * GATE, which reads the branch before any money moves.
 *
 * `unpathed` (and absent, which is the same silence) is the house table: the
 * roll predates the paths and wears what every roll has always worn.
 *
 * ⚠ **`incoherent` is `unknown`, and this is the whole reason the gate takes a
 * RESOLUTION rather than a line.** A roll that claims a path and cannot say what
 * it is wearing has told us nothing about its chest; flattened to a string it
 * would arrive here as `null` and read as the crew tee, which would put a crew
 * neck's answers on a cast that might be Basics. Reporting it as a COVERING
 * would be the lie ruling 1 forbids; reading it as the house tee is the quieter
 * version of the same lie.
 */
export function wardrobeCoversSurface(
  resolution: WardrobeResolution | undefined,
  placement: InkPlacement,
): SurfaceCoverage {
  if (resolution === undefined) return HOUSE_COVERAGE[placement];
  if (resolution.kind === "unpathed") return HOUSE_COVERAGE[placement];
  if (resolution.kind === "incoherent") return "unknown";
  return coverageOfWardrobeLine(resolution.line, placement);
}

/**
 * The surfaces this outfit leaves showing, in vocabulary order.
 *
 * For the refusal sentences, which have to name what DOES work for THIS cast
 * rather than what worked for the crew tee — the drift census finding 4(c)
 * caught in `inkNeedsDocumentMessage` and did not catch one file over.
 */
export function bareSurfaces(
  resolution: WardrobeResolution | undefined,
): readonly InkPlacement[] {
  return INK_PLACEMENTS.filter((key) => wardrobeCoversSurface(resolution, key) === "bare");
}
