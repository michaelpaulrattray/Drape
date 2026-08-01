import { ARCHETYPES, LOOKS, type CastingIntent } from "./castingIntent";

/**
 * At what resolution the STYLING axes are authored.
 *
 * Founder ruling, 2026-08-01, after a Fable review: **styling realization is
 * subordinate to creative context; biology realization is unconditional.**
 *
 * The six realized axes split in two.
 *
 *   **Biology** — eye colour, brow character, skin character — authors
 *   everywhere, unchanged. No creative direction implies them, so a named cast
 *   direction and a realized eye colour never disagree.
 *
 *   **Styling** — hair cut, hair texture, facial hair — changes MODE. When the
 *   brief carries creative context, a prescribed cut competes with the category
 *   the user asked for: "a 30 year old heavy metal bogan" plus "HAIR: a brown
 *   straight french crop" is a sheet arguing with itself, and the prescription
 *   wins because it is the more specific instruction. So under context the
 *   styling axes degrade from PRESCRIPTION to BIAS — silhouette and length,
 *   phrased subordinate to the casting — which still applies pressure for
 *   distinctness but composes with the category instead of contradicting it.
 *
 * Precedence, explicitly: **stated > category > styling-bias > prior.**
 *
 * Hair COLOUR is deliberately not in the styling tier. It is closer to biology
 * than to grooming, and it is the twin-breaker's second axis for a sheet of
 * women — degrading it would take the only separator those sheets have.
 */

/**
 * The composed-direction kill switch — one line, beside the other taste
 * toggles, so a rollback is sixty seconds and does not grow the flag registry
 * (founder ruling, no env flag).
 *
 * Flip to `false` and the field is still parsed, capped and guarded; it simply
 * never reaches a prompt. That is the safe direction: behaviour returns to
 * exactly what shipped before, with no other path changing.
 */
/*
  ON, on measured evidence rather than on a three-sample impression.

  It sat OFF first, because at three samples per brief Margiela captured 2/3
  and the founder's anti-regression condition is "Margiela must still capture".
  That instrument was then found to be broken twice over — it omitted the token
  ceiling, so 50% of Margiela's samples were TRUNCATED replies counted as
  landed, and the "before" figure it was compared against was a single sample.

  Re-measured properly: ten samples per brief per side, live interpreter,
  truncation tallied apart from parse failure, and zero of either.

    Margiela (anti-regression)  OLD  9/10 → NEW 10/10   (composed 9, look 1)
    miu miu                     OLD  0/10 → NEW 10/10
    Wes Anderson (non-fashion)  OLD  4/9  → NEW 10/10

  Margiela does not merely still capture; nothing regressed on any brief. And
  the goldens are green live at three runs each with the flag on.
*/
export const COMPOSED_DIRECTION_ENABLED = true;

/**
 * PARTIAL DEFERENCE — D-79's re-ship, off until the founder turns it on.
 *
 * A one-line constant beside the other taste toggles, the shape the founder
 * ruled for the brand-translation kill switch: a rollback is sixty seconds and
 * does not grow the flag registry.
 *
 * OFF is exactly today's behaviour — any hair word silences the whole hair
 * axis. ON narrows that from the axis to the PART, so "silver at the temples"
 * states a colour and still gets eight different authored cuts.
 *
 * It stays off until D-79's condition 4 is met — all five founder briefs
 * verified live — and until the founder rules on the conditions amendment
 * recorded in D-89. The feature being built is not the feature being on.
 */
export const PARTIAL_DEFERENCE_ENABLED = false;

export type StylingResolution =
  /** The brief named the styling itself; nothing is authored (deference). */
  | "stated"
  /** No creative context: the full named-cut vocabulary. */
  | "prescribe"
  /** Creative context present: silhouette and length, subordinate to it. */
  | "bias";

/**
 * Words that mean a direction has opinions about grooming.
 *
 * Derived from the shelves' own prose rather than curated, for the same reason
 * heritage neighbourhoods are computed: a hand-kept list of "flavoured"
 * directions rots the moment somebody edits an entry, and it states a judgment
 * about the shelf that the shelf itself should carry.
 */
const STYLING_WORDS = ["hair", "haired", "groomed", "grooming", "styled", "styling", "coiffed", "barber"];

/**
 * Only the POSITIVE description counts — never `avoid`.
 *
 * That field is a prohibition, and a prohibition mentioning styling is not a
 * claim on it. "Everyday real" says *do not render as a model with dressed-down
 * styling*, which is the shelf refusing a styling idea rather than owning one;
 * scanning it whole put "everyday real" in the flavoured set, which is wrong.
 */
function claimsStyling(entry: Record<string, string>): boolean {
  const positive = Object.entries(entry)
    .filter(([key]) => key !== "avoid")
    .map(([, value]) => value)
    .join(" ")
    .toLowerCase();
  const words = new Set(positive.split(/[^a-z]+/));
  return STYLING_WORDS.some((word) => words.has(word));
}

/**
 * The flavoured directions, computed at module load.
 *
 * On the current shelves this is `street cast` ("idiosyncratic hair") and
 * `quiet luxury` ("groomed but not styled"). Everything else is neutral, so a
 * brief naming only a neutral direction keeps full named-cut realization.
 */
export const FLAVOURED_ARCHETYPES: ReadonlySet<string> = new Set(
  Object.entries(ARCHETYPES)
    .filter(([, entry]) => claimsStyling(entry as unknown as Record<string, string>))
    .map(([key]) => key),
);

export const FLAVOURED_LOOKS: ReadonlySet<string> = new Set(
  Object.entries(LOOKS)
    .filter(([, entry]) => claimsStyling(entry as unknown as Record<string, string>))
    .map(([key]) => key),
);

/**
 * Does this brief carry creative context?
 *
 * **Stated intent only.** `resolveArchetype` always returns a direction, so
 * reading the RESOLVED archetype would put every context-free brief into bias
 * mode whenever the roll happened to draw a flavoured one. The restraint
 * doctrine gives the right signal for free: a non-null intent field means the
 * brief said it.
 */
export function hasCreativeContext(intent: CastingIntent): boolean {
  if (intent.role) return true;
  if (intent.archetype && FLAVOURED_ARCHETYPES.has(intent.archetype)) return true;
  if (intent.look && FLAVOURED_LOOKS.has(intent.look)) return true;
  return false;
}

/**
 * The one answer both the composer and the taste pass read.
 *
 * One function rather than two — "what is open" and "at what resolution" are
 * the same question asked twice, and this codebase has already paid for that
 * split once tonight.
 */
export function stylingResolutionFor(input: {
  intent: CastingIntent;
  briefStatesHair: boolean;
  /** True when this candidate's styling came from a followed candidate. */
  anchored?: boolean;
}): StylingResolution {
  // Stated outranks everything: the brief's own words govern and nothing is
  // authored beside them.
  if (input.briefStatesHair) return "stated";
  /*
    FOLLOW-ANCHORED OUTRANKS CATEGORY-BIAS.

    A follow means "more faces like this one", and the anchor carries a
    specific cut and a specific beard from a candidate the user actually
    looked at and chose. Bias mode never consulted the anchor, so every follow
    under a role brief rendered that inherited cut as generic silhouette prose
    — the sheet promising cousins while describing strangers. Worse in the
    other direction: a later context-free follow would re-prescribe a NAMED cut
    that no image in the lineage ever wore.

    Anchored styling therefore renders at full fidelity, category or not. The
    category still owns everything else; it does not get to blur a choice the
    user already made.
  */
  if (input.anchored) return "prescribe";
  return hasCreativeContext(input.intent) ? "bias" : "prescribe";
}

/**
 * The bias lines — a CONCRETE silhouette, with its character owned by the
 * casting.
 *
 * Founder ruling, second pass, after the first bogan sheet came back as eight
 * ordinary people: **prescription was not the enemy; category-blind
 * prescription was.** The first version of these lines deferred so hard they
 * said nothing renderable — "worn toward the longer end of how this casting
 * genuinely wears it" is a deferral, and a model given a deferral renders its
 * own default. The named cut it replaced had at least been carrying the
 * subcultural signal.
 *
 * So the synthesis: code still picks the silhouette family — that is the
 * distinctness engine, and it is what the taste rules count — but names it in
 * words a camera can act on. What is deferred is the CHARACTER: whether it
 * reads sharp or grown out, groomed or neglected, which is the part a category
 * genuinely owns and a prescribed cut was overriding.
 *
 * Absolute, never comparative. The image model renders one candidate and never
 * sees the other seven, so "longer than the others" is a claim the prompt
 * cannot keep — the same reasoning the framing block already documents.
 *
 * ---
 *
 * **THIS TIER IS AN INTERIM ANSWER. Do not let it accrete cleverness.**
 *
 * Subcultural legibility is not really a hair problem. A sheet reads as heavy
 * metal when something knows what a metalhead *wears* — the denim, the patches,
 * the boots — and the cohort constant deliberately forbids all of it, because
 * the plain grey tee is what makes eight candidates comparable at all. That
 * framing law is not up for negotiation to win a subculture.
 *
 * The real fix is **Path B**: an authored treatment stage that understands the
 * category and dresses the casting accordingly, inside its own conformance
 * rules. When that lands, this tier's job shrinks to what it should always have
 * been — silhouette variety — and every subcultural nuance anybody is tempted
 * to encode here belongs there instead. Adding it here buys a little legibility
 * and builds something Path B will have to unpick.
 */
const DEFERRED = "as this casting wears it";

export const HAIR_BIAS_PROSE: Record<string, string> = {
  shaved: `HAIR: shaved down to the scalp or a few millimetres of stubble, the shape of the skull visible — how close and how recent, ${DEFERRED}.`,
  cropped: `HAIR: cut short and tight at the back and sides with little length left on top — sharp or grown out, ${DEFERRED}.`,
  short: `HAIR: short, with just enough length on top to fall or push out of place — kept neat or left alone, ${DEFERRED}.`,
  "mid-length": `HAIR: grown to around the jaw, sitting on the ears and touching the collar rather than above them — how it is worn off the face, ${DEFERRED}.`,
  long: `HAIR: worn long and unstyled, well past the shoulders, grown out rather than shaped — its condition and how it is parted, ${DEFERRED}.`,
  coiled: `HAIR: worn out at full natural volume, unflattened and unbound — how it is shaped and kept, ${DEFERRED}.`,
};

/**
 * Facial hair at bias resolution: whether there is a beard, not which one.
 *
 * Same shape — the state is concrete, the grooming is the casting's.
 */
export const BEARD_BIAS_PROSE: Record<string, string> = {
  /*
    "A real beard" and not "a full beard". The bias tier collapses five enum
    values into two buckets, so naming a length here would UPGRADE a candidate
    whose realized value was a short beard — deferring a fact is not licence to
    invent a bigger one. The state is concrete; the length belongs to the
    casting along with everything else about how it is worn.
  */
  bearded: `FACIAL HAIR: a real beard, grown in across the jaw rather than barbered to an outline — its length and neatness, ${DEFERRED}.`,
  bare: `FACIAL HAIR: no beard — shaved, or a day or two of stubble at most, never a smooth blank jaw.`,
};

/** The clause every bias line ends on. Exported so tests pin the contract. */
export const BIAS_DEFERRAL_CLAUSE = DEFERRED;
