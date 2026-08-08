/**
 * HOW THE HAIR IS WORN, AS A CLOSED LIST OF THE STYLIST'S OWN WORDS (D-238).
 *
 * # A delivery rate destroyed by two words nobody constrained
 *
 * Run-13 scored `hairWorn` at 25% and the hair never changed — byte for byte
 * the same crop in all four frames. What moved was the WORD. The pin read
 * *"worn natural, loose"*, captured as free text from the base, and the reader
 * answered the picture honestly three times:
 *
 *     "hair styled in short tight natural curls, NOT loose"
 *     "hair is short, tightly curled, and cropped close to the head, not loose"
 *     "hair is short and tightly curled, not loose"
 *
 * and then, on the fourth frame, *"short natural curly hair worn loose, no
 * updo"* — verified. Same pixels, same pin, opposite verdict. That is not an
 * unstable reader. **"Loose" means _not gathered_ to this product and _not
 * tightly curled_ to anyone looking at curls**, and on a tight crop the two
 * senses contradict each other. Run-12's pixie died the same way.
 *
 * `capturePresentation` asked *"how is the hair WORN … never about the cut or
 * the colour"* and stored whatever came back. The question implied a small
 * closed vocabulary; the answer was unconstrained free text; and every later
 * render was then scored against it. The list below is that implied vocabulary,
 * written down.
 *
 * # One value, one wording, three consumers
 *
 * Each entry carries exactly ONE sentence, and that sentence is what the
 * painter is told is already true, what is stored on the recipe, and what the
 * reader is asked to confirm. Not three paraphrases of one fact — one string.
 * The removal fix earned this rule (fable-048: *one fact, one wording*) and
 * this is its third consumer.
 *
 * Every wording names the arrangement AND its contrast — *gathered*, *tied*,
 * *pinned* — because the whole defect was an adjective that could be read
 * against the cut instead. **The word "loose" does not appear anywhere in this
 * file, and a test keeps it out.**
 *
 * # "Worn as cut" is a real answer, not a fallback
 *
 * Both broken pins were reaching for it. A pixie and a tight crop are not worn
 * *down* and not worn *up* — they are worn exactly as they were cut, and there
 * is no arrangement to reproduce. Without that value the reader is forced to
 * argue about hair nobody arranged, which is precisely what it did, twice, on
 * two different faces.
 */

/**
 * The arrangements, each with the one sentence every consumer speaks.
 *
 * Adding a value is adding a fact the product can pin, so it comes with its
 * wording in the same edit — `Record<HairArrangement, string>` below makes that
 * the compiler's business rather than a reviewer's.
 */
export const HAIR_ARRANGEMENTS = {
  /*
    THE BOUNDARY WITH "WORN AS CUT" IS CASE LAW, NOT A CLAUSE (D-238 ruling).

    Three jaw-length bobs read `worn as cut` unanimously where the eye had
    declared `down` — both wordings are literally true of a bob, which is D-142's
    annihilation class one level down. So the line was redrawn as a physical test
    ("long enough to gather" against "too short to gather into a tie") and put
    back to the same 57 masters: **it measured WORSE** — 42/52 against 43/52,
    splits 1 to 2, destabilising a row that had been clean. The bobs did not move
    at all.

    The ruling: in a salon the question is genuinely ambiguous — "down" and "just
    as it's cut" are interchangeable about an unarranged bob — so law 8 does not
    pick a winner, it demands ONE convention, stably applied, true of the
    picture. The instrument already has one. **A bob is `worn as cut`,** and it
    is pinned in `HAIR_ARRANGEMENT_PRECEDENTS` below rather than written into
    this sentence, because a sentence is the thing that can be re-read two ways
    and an exemplar is not.
  */
  down: "worn down — hanging, not gathered, tied or pinned up",
  up: "worn up — gathered off the neck and fastened up on the head",
  /*
    THE WISPS, NAMED — because they were deciding the verdict (run-14).

    This shipped as *"…fastened behind, the length still hanging"* and produced
    noise on four frames of ONE arrangement that never moved: her master 3/5, one
    render 0/5, another 5/5, the third 0/5. The `saw`s said why every time —
    *"loose strands framing the face"* — the reader was answering about a few
    temple wisps, and **"hanging" is also the salient verb in `down`'s wording**,
    so the question was one association away from the wrong one.

    Measured rather than argued, after the last wording tweak measured worse:
    four candidates, six frames, five readings each, WITH negative controls (two
    masters whose hair really is down, where every candidate must refuse), and
    **two separate sittings** — because the first sitting alone would have made
    the wrong call. Positives, both sittings, out of 40:

        shipped                      19/40      negatives 20/20
        no "hanging"                 29/40      negatives 20/20
        "apart from loose strands"   32/40      negatives 20/20
        this one, "stray strands"    15/20 (one sitting; level with the above)

    Every repaired wording beats the shipped one decisively; between them the gap
    is inside the noise, and the same wording scored 8/20 and 11/20 on two
    sittings — so "best" here means "clearly not the shipped one", not a ranking.
    This one wins the tie because it also obeys this file's own law: **it does
    not contain the word "loose".** That test failed on the top scorer and it was
    right to; a rule dropped because the winner broke it is not a rule.

    Residual, declared: frame 05 — the REMOVAL composite — reads as down 0 of 5
    under every repaired wording, on a band where the shoulders are visibly bare
    in every frame. Whether the removal's compositing alters the hair silhouette
    is a separate question with its own frames, not a wording to keep tuning.

    # And it is NOT SHIPPED, because the precedents refused it

    Replayed against all 19 pinned faces, the repaired wording raised overall
    agreement 43/52 → 44/52 **and broke two rulings**: cand-1547 (ruled `up`)
    went to `tied back` 3/3, and cand-1557 (ruled `tied back`) split to
    `ponytail`. Naming the temple wisps as forgivable widens `tied back` until it
    swallows its neighbour — a wording that helps one face by eating another.

    That is precisely what the precedent set exists to catch, and the rule is
    Fable's: **a broken precedent is a ruling needing a new hearing with its
    frame, not a wording to adjust.** So the shipped wording stands, run-14's two
    misses stay on the record as advisory (they cost no money — non-binding, so
    D-235's asymmetry holds), and the real question goes up: does a PIN need to
    tell `up` from `tied back` at all? Its job is to stop drift, and the drift it
    guards against is gathered → down. Nobody has yet argued it needs the finer
    cut, and the reader plainly cannot hold it.
  */
  "tied back": "tied back — drawn away from the face and fastened behind, the length still hanging",
  ponytail: "in a ponytail — gathered at one point and hanging as a single tail",
  bun: "in a bun — gathered and coiled or knotted against the head",
  braided: "braided — plaited into one or more braids",
  "half-up": "half up — the top section drawn back and fastened, the rest hanging",
  "slicked back": "slicked back — combed flat to the head and away from the face",
  "tucked behind ears":
    "tucked behind the ears — hanging, with the front lengths pushed back behind the ears",
  /*
    THE VALUE BOTH BROKEN PINS WERE REACHING FOR.

    Run-12's pixie and run-13's tight crop are this. It is an arrangement in the
    same sense that "no accessories" is a state a person can be in: the honest
    answer to "how is it worn" when nobody arranged it. Its wording says so
    plainly, so the reader is confirming a fact about the picture rather than
    adjudicating whether a crop counts as "down".
  */
  "worn as cut": "worn exactly as cut — short enough that it is not gathered, tied or pinned at all",
} as const;

export type HairArrangement = keyof typeof HAIR_ARRANGEMENTS;

/**
 * Compile-closed: a value without a wording is a build failure, not a pin that
 * reaches a paid prompt as `undefined`.
 */
const _wordingsAreTotal: Record<HairArrangement, string> = HAIR_ARRANGEMENTS;
void _wordingsAreTotal;

export const HAIR_ARRANGEMENT_IDS = Object.keys(HAIR_ARRANGEMENTS) as HairArrangement[];

const WORDINGS: ReadonlySet<string> = new Set(Object.values(HAIR_ARRANGEMENTS));

/**
 * The id the vision pass chose, or null.
 *
 * **Null is the safe answer and it is taken often on purpose.** An absent pin
 * cannot argue with the picture; a wrong pin argues with it in every render
 * from here on, for free, forever. That is D-235's asymmetry applied to pins:
 * wrong does not beat missing.
 */
export function arrangementIdOf(value: string): HairArrangement | null {
  const cleaned = value.trim().toLowerCase();
  return (HAIR_ARRANGEMENT_IDS as string[]).includes(cleaned)
    ? (cleaned as HairArrangement)
    : null;
}

/** The one sentence for a chosen arrangement. */
export function arrangementWording(id: HairArrangement): string {
  return HAIR_ARRANGEMENTS[id];
}

/**
 * Is this stored pin one this build can stand behind?
 *
 * Every pin written before the vocabulary existed is free text — *"worn
 * natural, loose"*, *"pulled back low"* — and it is retired rather than
 * translated. A text mapping from old wording to new would be D-173's swamp
 * with a thesaurus attached: the picture decides what her pin should have said,
 * so a retired pin is simply re-read from the master.
 */
export function isConstrainedArrangement(value: string): boolean {
  return WORDINGS.has(value.trim());
}

/**
 * THE BOUNDARIES LIVE HERE, AS PINNED PICTURES (D-238 ruling).
 *
 * Where two values are both defensible in words — a bob is "down" and it is
 * "just as it's cut"; a low knot is "up" and it is "a bun" — no wording settles
 * it, because a wording is exactly the thing that can be read two ways. That is
 * the defect this whole vocabulary exists to end, and writing a longer sentence
 * to fix it is the defect proposing its own cure.
 *
 * So a boundary is settled by a FACE, and the face is kept. Each entry is a
 * master this campaign has already paid for, with the value ruled for it and one
 * line of why. `scripts/calibration/hair-arrangement-court.mts --precedents`
 * replays them against the live capture; the test below pins the SET, so a
 * precedent cannot be quietly dropped or re-valued in a refactor.
 *
 * **A future face that breaks the set goes to a ruling WITH ITS FRAME**, the way
 * the bob did — not to an edit of the sentence above.
 */
export const HAIR_ARRANGEMENT_PRECEDENTS: ReadonlyArray<{
  candidateId: number;
  candidate: string;
  value: HairArrangement;
  why: string;
}> = [
  /* THE BOB RULING itself — three faces, unanimous three-of-three each, and the
     reason this table exists at all. */
  { candidateId: 1567, candidate: "", value: "worn as cut", why: "chin-length wavy bob, hanging — the ruled case" },
  { candidateId: 1565, candidate: "", value: "worn as cut", why: "jaw-length bob, side part, hanging — the ruled case" },
  { candidateId: 1561, candidate: "", value: "worn as cut", why: "choppy jaw-length bob, hanging — the ruled case" },
  /* And the crop the value was written for, so "worn as cut" cannot drift into
     meaning only 'bob' now that bobs are in it. */
  { candidateId: 1564, candidate: "72fa6229-6adf-453a-bff0-0dc9065c8b92", value: "worn as cut", why: "run-13's tight curly crop — the face the value was added for" },
  { candidateId: 1536, candidate: "", value: "worn as cut", why: "short natural twists, close to the head" },
  /* `down` keeps its own exemplars, or the bob ruling quietly swallows it. */
  { candidateId: 1546, candidate: "", value: "down", why: "long hair past the shoulders, hanging free" },
  { candidateId: 1584, candidate: "", value: "down", why: "mid-length hair hanging, nothing fastened" },
  /* The gathered family, whose neighbours are the other place words fail. */
  { candidateId: 1553, candidate: "", value: "up", why: "gathered at the crown, NOTHING hanging — the rule 'tied back' states and my own eye missed" },
  { candidateId: 1547, candidate: "", value: "up", why: "same shape as 1553, and the second half of that rule" },
  { candidateId: 1557, candidate: "", value: "tied back", why: "drawn back and fastened, length still hanging" },
  { candidateId: 1543, candidate: "", value: "tied back", why: "fastened behind with wisps, length still there" },
  { candidateId: 1556, candidate: "", value: "ponytail", why: "one smooth tail, gathered at a single point" },
  { candidateId: 1538, candidate: "", value: "ponytail", why: "tail hanging over the shoulder" },
  { candidateId: 1554, candidate: "", value: "bun", why: "coiled knot against the head, nothing hanging" },
  { candidateId: 1560, candidate: "", value: "braided", why: "a single plait over the shoulder" },
  { candidateId: 1482, candidate: "8154ac6d-64ee-45ad-834b-fcbabca0f3ef", value: "half-up", why: "run-12's own face — long curly hair with a top knot, and NOT the pixie two reports called it" },
  { candidateId: 1592, candidate: "", value: "half-up", why: "top section knotted, the length hanging" },
  { candidateId: 1582, candidate: "", value: "slicked back", why: "combed flat and wet, away from the face" },
  { candidateId: 1550, candidate: "", value: "slicked back", why: "flat to the skull, no separate fastened bulk" },
  /*
    `tucked behind ears` HAS NO PRECEDENT, and that is stated rather than
    quietly true: it was chosen zero times on 57 faces. The value stays because
    it is a real arrangement a user can ask for and a stylist can name — but
    nothing has yet proven the reader can SEE it, so no verdict about it should
    be trusted until a face for it exists.
  */
];

/** The values a real face has settled. Anything else is untested, not wrong. */
export function arrangementsWithPrecedent(): HairArrangement[] {
  return Array.from(new Set(HAIR_ARRANGEMENT_PRECEDENTS.map((entry) => entry.value)));
}

/**
 * The list as the vision pass is shown it.
 *
 * Built from the same constant the parser validates against, so the offered
 * list and the accepted list cannot drift — the `freeSubjectGuidance` pattern,
 * which exists because a model dutifully using a value the code has never heard
 * of is a silent failure rather than a loud one.
 */
export function arrangementGuidance(): string {
  return HAIR_ARRANGEMENT_IDS.map((id) => `- ${id}: ${HAIR_ARRANGEMENTS[id]}`).join("\n");
}
