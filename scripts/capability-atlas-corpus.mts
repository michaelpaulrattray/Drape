/**
 * THE STUDIO CAPABILITY CENSUS — the corpus of canonical asks.
 *
 * Founder order, 2026-08-21 (fable-1315 §3): *"do we need a whole atlas for
 * this that can be re-checked everytime to ensure we are not re-creating things
 * that already exist"*. This file is the list of questions the census puts to
 * the REAL refine entrance. It is data, and it is the one place the corpus
 * lives: the generator, the check and the human page all derive from it.
 *
 * # What a row is
 *
 * One sentence a customer could type, with the state it needs and the route the
 * author BELIEVES it takes today. The census records what the product actually
 * did (`observed`, in `docs/architecture/capability-atlas.json`); `expect` is
 * kept beside it so a belief that was wrong is visible as a finding rather than
 * silently overwritten by the snapshot.
 *
 * # Why `state` is on every row
 *
 * Most doors need nothing but a master. Some need a branch that already wears a
 * tattoo, or a picture attached. v1 drives the `master` rows only; the others
 * are LISTED and marked not-driven, so a coverage gap reads as a gap rather than
 * as coverage. A row that needs state the fixture cannot supply is still in the
 * corpus, because the next fixture build is what removes the mark.
 *
 * # Adding a row
 *
 * Add the sentence, say what state it needs, say what you believe happens, run
 * `pnpm capability:generate --drive`, read the diff. If the product did
 * something other than you believed, the finding is the point — fix the belief
 * or the product, never the row.
 */

export type CorpusState =
  /** The pristine master; every fixture can supply this. */
  | "master"
  /** A branch already wearing one delivered tattoo. */
  | "branch-with-ink"
  /** A branch wearing an accessory the master did not have. */
  | "branch-with-accessory"
  /**
   * A branch whose record NAMES a delivered crop that has no row — the C4a
   * class (a mint that answered no-cut while the claim's name stood). Kept as
   * a permanent state so the class can never again be invisible to the
   * instrument (fable-1340 §3).
   */
  | "branch-with-dangling-crop"
  /** A reference picture attached to the ask. */
  | "reference-attached"
  /**
   * A branch whose roll was cast on the WARDROBE path — item 8 §7.3.
   *
   * ⚠ **No fixture can supply it while `CASTING_TWO_PATHS_SCOPE` is off**, so
   * every row declaring it is listed as NOT DRIVEN rather than quietly absent.
   * That is the point of declaring it: a capability whose census row does not
   * exist is one the next design report cannot look up, and the two rows below
   * are the ones that say what the paths DO.
   */
  | "wardrobe-path"
  /** The same, cast on BASICS. Same unavailability, same reason. */
  | "basics-path";

export type CorpusRow = {
  /** Stable id — the row's name in the table and in findings. */
  id: string;
  /** The customer's sentence, verbatim. */
  ask: string;
  /** The slot she pointed at, if the ask is scoped (`eye@left`). */
  scope?: string;
  /** What the product calls the thing she is talking about. */
  subject: string;
  verb: "add" | "change" | "remove" | "question" | "guard";
  state: CorpusState;
  /**
   * The route the author believes the ask takes today, in the census's own
   * outcome vocabulary: `would-render`, `refused:<reason>`, `free:<reason>`,
   * `asked:<kind>`, `offered`. A belief, checked against the drive.
   */
  expect: string;
  /** One line on why this row exists — the door it is there to watch. */
  why: string;
};

export const CORPUS: readonly CorpusRow[] = [
  /* ───────────────────────────── ink — the words road ───────────────────── */
  { id: "ink.words.neck", ask: "give him a small swallow tattoo on his neck", subject: "ink", verb: "add", state: "master",
    expect: "would-render", why: "the words road's proven placement (crop #1)" },
  { id: "ink.words.arm", ask: "give him a small swallow tattoo on his left upper arm", subject: "ink", verb: "add", state: "master",
    expect: "would-render", why: "opened by the words-road court (fable-1301) behind CASTING_INK_WORDS_SCOPE" },
  { id: "ink.words.chest", ask: "give him a small swallow tattoo on his upper chest", subject: "ink", verb: "add", state: "master",
    expect: "refused:gate_ink_uncarried", why: "a covered chest cannot be cropped, so it walls with its own sentence (1301)" },
  { id: "ink.words.face", ask: "give her a small star tattoo on her cheek", subject: "ink", verb: "add", state: "master",
    expect: "refused:gate_ink_document", why: "the face carve-out was a dead promise and is retired (2fdc382d)" },
  { id: "ink.words.noplace", ask: "give him a tattoo", subject: "ink", verb: "question", state: "master",
    expect: "refused:gate_ink_document", why: "no placement named → the ask-where sentence, free" },
  { id: "ink.words.behind-ear", ask: "a tiny moon tattoo behind her ear", subject: "ink", verb: "add", state: "master",
    expect: "refused:gate_ink_document", why: "a hidden place the anchor cannot see and the mint cannot crop" },
  /* ───────────────────────────── ink — on ink she has / has not ─────────── */
  { id: "ink.transform.none", ask: "make his chest tattoo bigger", subject: "ink", verb: "change", state: "master",
    expect: "refused:gate_ink_document", why: "a transform on a cast with no ink answers free (fable-1287 §2)" },
  { id: "ink.remove.none", ask: "take his tattoos off", subject: "ink", verb: "remove", state: "master",
    expect: "refused:removal_absent", why: "opus-967 §3: a stated removal lands in the generic removal road, not the ink prior-ask" },
  { id: "ink.transform.has", ask: "his upper arm tattoo — make it bigger", subject: "ink", verb: "change", state: "branch-with-ink",
    expect: "would-render", why: "the transform road (CASTING_INK_TRANSFORM_SCOPE) on the slot the branch really wears (v501, the arm)" },
  { id: "ink.transform.wrongslot", ask: "his upper chest tattoo — make it bigger", subject: "ink", verb: "change", state: "branch-with-ink",
    expect: "free:noInkToChange", why: "CLOSED (opus-1016, 51481a66): the census caught the money bug — the narrowing answered any sentence with the single tattoo, so a chest ask would have resized the ARM and charged. Fixed at the wording-before-count; re-driven post-fix and the route is the place-speaking free answer, as believed" },
  { id: "ink.transform.two", ask: "make his arm tattoo bigger and darker", subject: "ink", verb: "change", state: "branch-with-ink",
    expect: "free:inkOneChangeAtATime", why: "two changes contradict on the wire; one at a time, free" },
  { id: "ink.remove.has", ask: "take the tattoo off his arm", subject: "ink", verb: "remove", state: "branch-with-ink",
    expect: "free:navigate", why: "§10 item 3a — whichever letter opus-967 §4's drive returns" },
  /* ───────────────────────────── marks ──────────────────────────────────── */
  { id: "mark.scar.forehead", ask: "give her a harry potter lightning bolt scar on her forehead", subject: "marks", verb: "add", state: "master",
    expect: "would-render", why: "the founder's own sentence; the mark lane is NOT the ink lane (opus-957 §2)" },
  { id: "mark.freckles", ask: "give her freckles", subject: "marks", verb: "add", state: "master",
    expect: "would-render", why: "the freckle court's class" },
  /* ───────────────────────────── accessories ────────────────────────────── */
  { id: "acc.earrings.add", ask: "give her gold hoop earrings", subject: "statedAccessories", verb: "add", state: "master",
    expect: "would-render", why: "a matching pair, the stylist's ontology (law 8)" },
  { id: "acc.glasses.remove.none", ask: "take her glasses off", subject: "statedAccessories", verb: "remove", state: "master",
    expect: "refused:removal_not_in_brief", why: "removing what the record does not hold answers free and says so" },
  { id: "acc.glasses.remove.has", ask: "take her glasses off", subject: "statedAccessories", verb: "remove", state: "branch-with-accessory",
    expect: "free:navigate", why: "the prune road: one step removed, later edits kept" },
  /* ───────────────────────────── hair ───────────────────────────────────── */
  { id: "hair.colour", ask: "make her hair copper red", subject: "hairColour", verb: "change", state: "master",
    expect: "would-render", why: "colour as words" },
  { id: "hair.style", ask: "give her a short bob", subject: "hairStyle", verb: "change", state: "master",
    expect: "would-render", why: "style is a cut change, not strands (law 8 origin)" },
  { id: "hair.bald", ask: "make him bald", subject: "hairStyle", verb: "change", state: "master",
    expect: "would-render", why: "the typo gate once owned this real word (memory)" },
  /* ───────────────────────────── eyes ───────────────────────────────────── */
  { id: "eye.colour", ask: "her eyes — green", subject: "eyeColour", verb: "change", state: "master",
    expect: "would-render", why: "the panel's own prefill shape" },
  { id: "eye.colour.side", ask: "make her right eye fiery red", subject: "eyeColour", verb: "change", state: "master",
    expect: "would-render", why: "per-side ask; side phrasing rides (CASTING_SIDE_PHRASING_SCOPE)" },
  { id: "eye.shape.fox", ask: "give her fox eyes", subject: "eyeShape", verb: "change", state: "master",
    expect: "would-render", why: "the fox-eyes verdict was annulled; the class delivers" },
  { id: "eye.scoped.left", ask: "make it green", scope: "eye@left", subject: "eyeColour", verb: "change", state: "master",
    expect: "would-render", why: "a tapped rectangle narrows the ask to one instance" },
  /* ───────────────────────────── body / skin / build ────────────────────── */
  { id: "build.muscular", ask: "give him a jacked muscular build", subject: "build", verb: "change", state: "master",
    expect: "would-render", why: "the build that once reverted under words (memory)" },
  { id: "skin.tan", ask: "give her a deep tan", subject: "skinTone", verb: "change", state: "master",
    expect: "would-render", why: "a tan covers all visible skin (law 8)" },
  /* ───────────────────────────── wardrobe / light ───────────────────────── */
  { id: "wardrobe.tee", ask: "put him in a plain black tee", subject: "wardrobe", verb: "change", state: "master",
    expect: "refused:wall_unbacked", why: "wardrobe edits exist today; the Two Paths ruling (fable-1311) will path-gate them" },
  /* ──────── item 8's three rows (§7.3) — DECLARED, and not drivable yet ────
     Each names a state no fixture can supply while `CASTING_TWO_PATHS_SCOPE` is
     off, so the drive lists them under `notDriven` rather than skipping them.
     They exist because §7.3 is right that a capability shipping without its
     census row is a capability the next design cannot look up. */
  { id: "wardrobe.tee.wardrobePath", ask: "put him in a plain black tee", subject: "wardrobe", verb: "change", state: "wardrobe-path",
    expect: "would-render", why: "item 8 §7.1: on the Wardrobe path a garment has a subject to be filed under, so the wall stops being reached" },
  { id: "wardrobe.tee.basicsPath", ask: "put him in a plain black tee", subject: "wardrobe", verb: "change", state: "basics-path",
    expect: "refused:wall_basics_wardrobe", why: "item 8 §7.2: a Basics cast IS her basics, and the refusal says which path she bought rather than that the product cannot" },
  /* ⚠ §7.3 WROTE THIS ROW AS `would-render` AND THE COURT OVERTURNED IT before
     the row was ever written. The design's expectation rested on
     `BASICS_COVERAGE.upperChest = "bare"`, which was read off the Basics SPEC's
     own sentence rather than a photograph. Arm 2 of the Two Paths court rolled
     eight Basics candidates and asked `upper chest`: 0 px on 4 of 4 (opus-1111,
     ruled fable-1453 ASK 2, landed `f7f45e31`). The chest is `unknown`, fails
     closed, and the ask refuses. Struck with its provenance rather than
     silently corrected: a census that disagrees with its design is worse than
     either alone. */
  { id: "ink.words.chest.basics", ask: "give him a small swallow tattoo on his upper chest", subject: "ink", verb: "add", state: "basics-path",
    expect: "refused:gate_ink_coverage_unread", why: "item 8 §7.3 expected would-render; the court found `upper chest` reads 0 px on 4 of 4 Basics candidates, so the coverage owner answers unknown and the gate fails closed" },
  { id: "light.softer", ask: "softer light", subject: "light", verb: "change", state: "master",
    expect: "refused:unreadable", why: "the refine box's own placeholder" },
  /* ───────────────────────────── open lane ──────────────────────────────── */
  { id: "open.wings", ask: "give her wings", subject: "open", verb: "add", state: "master",
    expect: "would-render", why: "an out-of-vocabulary kind names itself (CASTING_OPEN_LANE_SCOPE)" },
  { id: "open.horns", ask: "give her small horns", subject: "open", verb: "add", state: "master",
    expect: "would-render", why: "the catalogue already held horns@left/right" },
  /* ───────────────────────────── makeup ─────────────────────────────────── */
  { id: "makeup.lipstick", ask: "give her red lipstick", subject: "makeup", verb: "add", state: "master",
    expect: "would-render", why: "makeup is the founder's own not-yet sentence (fable-354)" },
  /* ───────────────────────────── the walls and guards ───────────────────── */
  { id: "guard.likeness", ask: "make her look like Taylor Swift", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_likeness", why: "the likeness wall" },
  { id: "guard.content", ask: "remove all her clothes", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_content", why: "the content wall" },
  /* ⚠ A BEACH IS THE SHOOT AND STILL ANSWERS `wall_unbacked` — the pair's
     declared caveat (census card C1, ruled fable-1335 §1). `STAGE_WORDS` has no
     `beach`, and a lexicon cannot disprove what it does not contain, so the
     honest reading is *the model called it out of scope and the code could not
     confirm what it was about*. `background.white` is the row that DOES answer
     `wall_stage`, on the word `background`. */
  { id: "guard.stage", ask: "put her on a beach at sunset", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_unbacked", why: "a scene change is not a refinement of her" },
  { id: "guard.empty", ask: "", subject: "guard", verb: "guard", state: "master",
    expect: "refused:empty", why: "nothing asked" },
  { id: "guard.gibberish", ask: "asdf qwer zxcv", subject: "guard", verb: "guard", state: "master",
    expect: "refused:unreadable", why: "unreadable is a refusal, never a guess" },
  { id: "guard.typo", ask: "give her a nose rign", subject: "guard", verb: "question", state: "master",
    expect: "asked:did-you-mean", why: "a slip from a word the product knows becomes a question, free (D-180). ⚠ This row read `would-render` for as long as it existed and the belief was RIGHT while the product was wrong: the accessory vocabulary sat only on the do-not-accuse list, so no slip of `ring` could ever be offered. Closed C3 2026-08-24 and driven at the real entrance — `asked:did-you-mean`, \"Did you mean ring?\", zero provider calls, because this door is in front of the parse" },
  { id: "guard.scope.unknown", ask: "make it green", scope: "elbow@left", subject: "guard", verb: "guard", state: "master",
    expect: "refused:scope_unknown", why: "a part of her the product cannot name" },
  { id: "guard.scope.ink.none", ask: "make it bigger", scope: "ink:upperArm@left", subject: "ink", verb: "change", state: "master",
    expect: "refused:unreadable", why: "a tapped ink slot on a cast that wears none speaks about the PLACE (opus-954 §2)" },
  /* ───────────────────────────── references ─────────────────────────────── */
  { id: "ref.hair.whole", ask: "copy this hair", subject: "hairStyle", verb: "change", state: "reference-attached",
    expect: "would-render", why: "the attach door + hair take: vague means the whole lot (fable-1087)" },
  { id: "ref.ink.sleeve", ask: "copy his right arm sleeve onto him", subject: "ink", verb: "add", state: "reference-attached",
    expect: "would-render", why: "the region-crop road (CASTING_INK_REGION_CROP_SCOPE)" },
  /* ───────────── breadth (extension-1): more verbs, more subjects ────────── */
  { id: "ink.words.neck.branch", ask: "give him a small star tattoo on his neck", subject: "ink", verb: "add", state: "branch-with-ink",
    expect: "would-render", why: "census finding 4(a): the carried chest piece must not wall a NEW neck ask — the repro's fix arm" },
  { id: "ink.remove.branch.whole", ask: "take his tattoos off", subject: "ink", verb: "remove", state: "branch-with-ink",
    expect: "free:navigate", why: "LETTER A: the prune is the removal; whole-set noun against one worn piece" },
  { id: "acc.remove.branch.other", ask: "take her earrings off", subject: "statedAccessories", verb: "remove", state: "branch-with-accessory",
    expect: "refused:removal_not_in_brief", why: "removing what the branch does not wear, while it wears something else — the matcher's precision" },
  { id: "age.older", ask: "make her ten years older", subject: "ageBand", verb: "change", state: "master",
    expect: "refused:wall_unbacked", why: "age is identity-adjacent; record which door answers" },
  { id: "expression.smile", ask: "make him smile", subject: "expression", verb: "change", state: "master",
    expect: "would-render", why: "expression asks are a whole class users try first" },
  { id: "hair.remove.none", ask: "remove her fringe", subject: "hairStyle", verb: "remove", state: "master",
    expect: "would-render", why: "MODEL-VARIANT (would-render 3, removal_absent 1 across four drives): measured would-render twice and removal_absent once across three drives — the fringe reads as a cut change (law 8) or a removal by the model's coin; the mismatch, when it appears, is the variance and not a route change" },
  { id: "acc.piercing", ask: "give him a silver nose ring", subject: "statedAccessories", verb: "add", state: "master",
    expect: "would-render", why: "the piercing class rides accessories" },
  { id: "eye.both.sides", ask: "make her left eye blue and her right eye green", subject: "eyeColour", verb: "change", state: "master",
    expect: "would-render", why: "heterochromia — two sides in one ask" },
  { id: "skin.freckles.remove.none", ask: "she never had freckles", subject: "marks", verb: "remove", state: "master",
    expect: "refused:removal_absent", why: "the departure phrasing against a bare record" },
  { id: "brows.thicker", ask: "give her thicker eyebrows", subject: "brows", verb: "change", state: "master",
    expect: "would-render", why: "brows are a catalogue row the panel scans" },
  { id: "beard.full", ask: "give him a full beard", subject: "facialHair", verb: "add", state: "master",
    expect: "would-render", why: "facial hair — the male-facing sibling of hairStyle" },
  { id: "guard.undo", ask: "undo", subject: "guard", verb: "remove", state: "master",
    expect: "refused:already_original", why: "the bare undo word with nothing to point at — which sentence answers" },
  { id: "guard.multi", ask: "green eyes, copper hair, and freckles", subject: "guard", verb: "change", state: "master",
    expect: "would-render", why: "three facets in one breath — the composite ask" },
  { id: "guard.compliment", ask: "he looks great", subject: "guard", verb: "question", state: "master",
    expect: "refused:wall_unbacked", why: "a sentence that asks for nothing — the polite null" },
  { id: "wardrobe.colour", ask: "make his tee black", subject: "wardrobe", verb: "change", state: "master",
    expect: "refused:wall_unbacked", why: "census 4(b)'s sibling: recolouring the garment he already wears — and `tee` is not in the stage lexicon, so the wall is UNBACKED rather than provably the shoot" },
  { id: "background.white", ask: "make the background pure white", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_stage", why: "the set is not hers to change on this road; pin the sentence" },
  /* ─────────── full-map pass (fable-1357): the doors the table could not see ── */
  { id: "ink.transform.dangling", ask: "his upper chest tattoo — make it bigger", subject: "ink", verb: "change", state: "branch-with-dangling-crop",
    expect: "free:inkNotKept", why: "C4a's door: the record names a crop with no row; the answer is free, true, and before the claim (fable-1339)" },
  { id: "ink.scoped.none.prefill", ask: "his upper arm tattoo — make it bigger", scope: "ink:upperArm@left", subject: "ink", verb: "change", state: "master",
    expect: "free:noInkToChange", why: "the tapped ink slot on a bare cast speaks about the PLACE (opus-954 §2) — the prefill makes the ask readable, unlike guard.scope.ink.none's bare verb" },
];

/**
 * DOORS THE CORPUS CANNOT REACH, each with its reason — the coverage contract's
 * other half (founder order, fable-1357 §2b). A door here is DOCUMENTED
 * unreachable, not forgotten: the generator files it `documented-unreachable`
 * (info) instead of `unreached` (warn), REFUSES a door that is both here and in
 * a row's expect (a contradiction), and REFUSES a door listed here that a drive
 * actually produced (stale documentation). So this list can lie in neither
 * direction quietly.
 *
 * ⚠ **"UNREACHABLE" MEANS UNREACHABLE BY THE CORPUS, NEVER BY A CUSTOMER** —
 * stated because the generator's own finding message claimed the second sense
 * for months and #206 put doors on this list that are hit in production every
 * day (`roll.likeness` answers anyone who types a famous name). Read at every
 * row here, the sense has always been the first: each `becomesReachable` is
 * written in terms of the corpus ROW that would reach it, without exception.
 * A door is admissible here when the corpus's row grammar structurally cannot
 * produce its state — it sends a SENTENCE at an existing Cast through
 * `castingV2.refine`, so it carries no picture, no request shape and no other
 * entrance. It is NOT a place to file a door that is merely untested.
 */
/**
 * THE KNOWN DEBTS — the enumerated, SHRINK-ONLY list of doors the map does not
 * yet reach or document (founder law, fable-1359: the atlas is kept current
 * after every change). An unreached door NOT on this list is an ERROR and the
 * rite refuses the push — so a new door cannot ship without its row or its
 * documented reason in the same commit. A door on this list that becomes
 * reached or documented is ALSO an error until its line is deleted, so the
 * list can only shrink. Additions to this list are a founder-visible act, not
 * a convenience.
 */
export const KNOWN_DEBTS: readonly string[] = [
  "absorbed", "absorbed_departure", "departure", "nothingAsked", "noWords",
  "perSideRemoval", "removal", "removal_unnameable", "removal_unnamed",
  "sideNamedWithoutScope", "uncatalogued", "unnamedObject", "wall_unfileable",
];

/*
  ⚠ TWO ENTRIES LEFT THIS LIST ON 2026-08-23 (item 8 §7.3) AND NEITHER BECAME
  REACHABLE — they became KNOWN, which is a different thing and is the discharge
  this list is designed to take.

  `wall_basics_wardrobe` and `gate_ink_coverage_unread` now have CORPUS ROWS
  (`wardrobe.tee.basicsPath`, `ink.words.chest.basics`). The rows declare the
  state that reaches each door — a roll cast on the Basics path — and the drive
  lists them under `notDriven` because no fixture can supply that state while
  `CASTING_TWO_PATHS_SCOPE` is off. So the map knows how each is reached and
  says out loud that it has not yet been run, where before it said only that it
  could not be.

  `gate_ink_coverage_unread`'s entry had also gone stale on its own terms: it
  said the door needs a WARDROBE-path named outfit, and `f7f45e31` made a BASICS
  cast reach it too — the court found `upper chest` reads 0 px on 4 of 4 Basics
  candidates, so that path's chest answers `unknown` rather than `bare`.

  ⚠ AND THAT LAST SENTENCE WENT STALE THE SAME DAY, WHICH IS WHY IT IS LEFT
  STANDING RATHER THAN EDITED. The founder lowered the Basics neckline, a
  re-court read the chest 12 of 12, and `BASICS_COVERAGE.upperChest` is `bare` —
  so a Basics chest ask does not fail closed any more, it RENDERS. Three
  sentences about this one enum member were written in one afternoon and each
  was true when written.

  The lesson, and it is why this comment keeps its own history: **a reachability
  claim is a claim about a PATH THROUGH CODE, and a path through code is the
  least stable thing to hang a prediction on.** An entry here should say what
  STATE reaches a door, never which loop a string falls into.
*/
export const UNREACHABLE_DOORS: ReadonlyArray<{ id: string; reason: string; becomesReachable: string }> = [
  /*
    ⚠ THIS ENTRY'S REASON WAS REPLACED WHOLESALE ON 2026-08-23, and the old one
    is worth a line because it predicted its own reachability wrongly: it said
    the door needed "a Basics-path fixture asking for an upper-chest tattoo",
    and a Basics chest ask now RENDERS.

    The door is unreachable for a stronger reason than before — not "no fixture
    can reach it yet" but "no surface is in the state it describes".
  */
  { id: "gate_ink_unkeepable",
    reason: "item 7a's split of gate_ink_uncarried: the surface is BARE and the words road cannot crop a result there. Its population was `upperChest`, the one measured placement the words road did not serve — and the Basics chest court (2026-08-23) put the chest on the road, so `uncarriedInkPlaces` is EMPTY and no measured surface is seen-but-unkept. The refusal is kept because it is the only true thing to say about a placement in that state, which the next measured surface will be in on the day it is added",
    becomesReachable: "the day INK_PLACEMENTS gains a fourth surface — it lands unserved by the words road, which is exactly this door's state, before any court opens it" },
  /* ── #192: THE CONCEPT UPLOAD'S FIVE DOORS — the map's first entrance that is
     not `refine`. The corpus drives ONE entrance: it sends a SENTENCE at a
     Cast. `castingV2.concept.describe` takes a PICTURE and no sentence at all,
     so no corpus row can be one of these — the same shape as the request-shape
     block below, and the same discharge: each is pinned by its own arm in
     `server/castingV2/conceptDescribe.test.ts` (verified at the file, not
     assumed), and each reason states the STATE that reaches the door rather
     than the loop that raises it.

     Ids are entrance-qualified because `unreadable` is a door on both roads;
     bare, the refine corpus row expecting it would collide with this line and
     fire `coverage-contradiction`. ── */
  { id: "concept.no_being",
    reason: "answers an upload whose read found no BEING in the picture at all — an object, a vehicle, a landscape, a product. It is the concept entrance's own edge of the same boundary the roll road draws at `not_a_being`, and #204 narrowed it there: a creature, a robot or an alien is a subject, so this fires only outside all four",
    becomesReachable: "a corpus row that carries a fixture PICTURE through the real concept entrance — cents of describer reads, the class of money the corpus already spends on text; nothing in the row grammar carries an image today" },
  { id: "concept.not_about_the_person",
    reason: "answers a read that came back describing the FRAME instead of the subject — the light, the set, the camera, a resemblance — twice in a row. It is a fault of our reader's output, not of her photograph, which is why it has its own sentence",
    becomesReachable: "the same picture-carrying corpus row, plus a fixture whose read reliably lands on the frame; the model's answer is the variable, so it is a probe rather than a fixture" },
  { id: "concept.not_a_casting_note",
    reason: "answers a read that came back as an inventory rather than a type — #185's ruling in code, and the door is OURS by construction: the granularity rule is judged on our own reply, never on her picture",
    becomesReachable: "the same picture-carrying corpus row; the fault is in the reply, so reaching it deterministically means driving the describer with a doubled reader rather than a fixture picture" },
  { id: "concept.unreadable",
    reason: "answers a read that never arrived twice — an unparseable reply, a transport throw, or a 200 carrying an empty completion. Since #193 the second ask is bought before this is said, so the state it describes is TWO failures and not one",
    becomesReachable: "deliberately never as a corpus row: manufacturing two consecutive reader outages would test the harness, not the product. Its pin is its own arm, which is the shape `removal_uncheckable` is documented with above" },
  { id: "concept.no_transport",
    reason: "answers an upload made with no text engine configured at all — a deployment state, not a picture and not a sentence",
    becomesReachable: "deliberately never as a corpus row: the census runs against a configured service by construction; pinned by its own arm" },
  /* ── #206: THE ROLL ENTRANCE'S FIVE WALLS — the map's second entrance, and the
     one whose absence mattered most, because two of these are founder
     boundaries the Prompt Author ruling explicitly KEEPS.

     They share ONE reason for being here and it is structural: the corpus sends
     a SENTENCE at an EXISTING Cast through `castingV2.refine`. All five of these
     are raised by `castingBriefCompiler` inside `castingV2.createRoll`, BEFORE a
     roll row exists — there is no cast to send them at and no row shape in the
     grammar that reaches that entrance at all. Every one is free, before the
     claim, so a row that could reach them would spend nothing.

     ⚠ Two of them are among the most-hit doors in the product. That is not a
     contradiction with this list; see the sense stated in the docblock above. ── */
  { id: "roll.likeness",
    reason: "answers a brief asking for a real person or a named character — the one subject wall the author road KEEPS (ruling §6 rule 5). HIT IN PRODUCTION whenever a customer types a famous name; it is here because no corpus row can send a BRIEF, not because it is quiet. Pinned by five suite files including its own `likenessRefusal.test.ts`",
    becomesReachable: "a corpus row grammar that carries a BRIEF to `castingV2.createRoll` instead of a sentence to `castingV2.refine` — a second driven entrance, the same shape the concept entrance's picture-carrying row needs, and free at every one of these five doors" },
  { id: "roll.not_a_being",
    reason: "answers a brief whose subject is not a being — an object, a vehicle, a place. THE one wall the author road ADDS (founder: 'someone asking for an object should be refused like a car'), and the twin of `concept.no_being`, which #192 put on the map while this half stayed invisible. Also hit in production",
    becomesReachable: "the same brief-carrying row; its twin's arm already holds the two sentences to one shared boundary clause, so a row would be measuring the road rather than the words" },
  { id: "roll.uninterpretable",
    reason: "answers a brief shorter than `BRIEF_TEXT_MIN` — the floor, raised by both the live compiler and the deterministic one. Its state is a REQUEST too small to be a brief, which the refine grammar has no field for",
    becomesReachable: "the same brief-carrying row, sending a brief under the floor; the cheapest of the five to drive and the least informative" },
  { id: "roll.unsupported_cohort",
    reason: "answers a styled brief the certified adapter cannot cast — off the author road, and off it only. Its own sentence had NO pin at all before #206: it was an inline literal written out twice, so either copy could have been reworded silently",
    becomesReachable: "a brief-carrying row on an account OUTSIDE `CASTING_CREATIVE_REGISTER_SCOPE`, since the author road does not raise it; the flag position is part of the row's state, which no current row grammar carries" },
  { id: "reader_outage",
    reason: "REFINE's own reader outage — the sentence was never read because the call threw, the deadline passed, or no engine is configured. The twin of `roll.reader_outage` on the refine road, and of `concept.unreadable`; free, before the claim, exactly as the `unreadable` beside it always was. What changed is only WHOSE fault it names: `unreadable` means a reply came back and could not be read, and its sentence tells her to try naming what she wants changed, which is advice she cannot follow when the failure is ours",
    becomesReachable: "deliberately never as a corpus row, on the same ground the two doors above state: manufacturing a reader outage in the census would test the harness and not the product. Its pin is its own driven arm in `readerOutageRefusal.test.ts`, which throws the exact ProviderError a 402 produces and asserts the classifier's mapping beside it" },
  { id: "roll.reader_outage",
    reason: "answers a brief whose reader never answered — the transport threw, the deadline passed, or no engine is configured. Free by founder ruling (#126, 'refuse-free', always). An infrastructure state, not a sentence",
    becomesReachable: "deliberately never as a corpus row: manufacturing a reader outage in the census would test the harness and not the product — the discharge `removal_uncheckable` and `concept.unreadable` already carry. Its pin is its own driven arm in `briefCompiler.test.ts`" },
  { id: "unplacedInk",
    reason: "raised at the pre-claim ink door only for a DOCUMENTED ask with no placement; every master-state words ask dies earlier at the document gate (measured, drive-4), and the documented states (reference attached, delivered ink) resolve their placement before that door",
    becomesReachable: "a reference-attached fixture whose take carries no placement" },
  { id: "inkBeyondToday",
    reason: "needs a documented ask naming a placement beyond the measured vocabulary — the same states as unplacedInk with an off-vocabulary place word",
    becomesReachable: "the reference-attached fixture, asking for a sleeve" },
  { id: "whichInkToChange",
    reason: "needs a branch wearing TWO tattoos; no cast in either world has ever worn two at once (opus-966 §1) and the multi-tattoo fixture is §10 item 3b's build",
    becomesReachable: "item 3b's keying work, which needs two-tattoo state to test itself" },
  { id: "notASlot",
    reason: "the catalogue's no-picture answer; makeup — its historical population — now renders (measured, drive-4), and no current master-state ask reaches a facet the catalogue refuses a picture for",
    becomesReachable: "a facet that regains the no-picture classification, or a driven ask found to reach it" },
  { id: "removal_uncheckable",
    reason: "needs the removal-verification reader to be unavailable mid-ask — an infrastructure failure state no fixture manufactures honestly",
    becomesReachable: "deliberately never: its pin is its service arm (C5), and manufacturing reader outages in the census would test the harness, not the product" },
  /* ── request-shape doors: no SENTENCE constructs these; the request does.
     Each is pinned by C5's driven service arms (opus-980), which is their
     proof — the census documents why a corpus row cannot be one. ── */
  { id: "already_signed", reason: "answers a refine sent at a SIGNED cast — request state, not sentence content", becomesReachable: "a signed-cast fixture, if sign-state rows are ever wanted; pinned by its C5 service arm" },
  { id: "candidate_missing", reason: "answers a request naming a cast the account does not own — request shape", becomesReachable: "deliberately never as a corpus row; pinned by its C5 service arm" },
  { id: "version_missing", reason: "answers a replay marker naming a version that is not the predecessor — request shape", becomesReachable: "pinned by its C5 service arm" },
  { id: "master_missing", reason: "answers a cast whose master object is gone — storage state no fixture manufactures honestly", becomesReachable: "pinned by its C5 service arm" },
  { id: "refine_limit", reason: "answers the 24-instruction ceiling — needs 24 paid variants on one cast (the census never renders)", becomesReachable: "pinned by its C5 service arm; verify-bot's ceiling cast proved it live (opus-969)" },
  { id: "history_predates_undo", reason: "answers an undo against a chain older than typed removal — legacy-era state", becomesReachable: "pinned by its C5 service arm" },
  { id: "history_unreadable", reason: "answers a chain whose stored steps fail to parse — corrupt-state, not sentence", becomesReachable: "pinned by its C5 service arm" },
  { id: "step_moved", reason: "answers a chip removal whose index went stale mid-click — a race no scripted sentence makes", becomesReachable: "pinned by its C5 service arm" },
  { id: "kind_unserved", reason: "answers an open-kind render the engine table cannot serve — engine-config state", becomesReachable: "pinned by its C5 service arm" },
  { id: "scope_mismatch", reason: "answers a scope naming nothing the instruction writes — needs a tap+sentence disagreement the interpreter usually resolves; the deterministic form is its C5 arm", becomesReachable: "pinned by its C5 service arm" },
  { id: "removal_reread_unmatched",
    reason: "needs the ambiguity re-read to produce a removal whose noun then matches no step — a two-model-disagreement state that cannot be scripted through the real interpreter deterministically",
    becomesReachable: "deliberately never: pinned by its service arm (C5); a census row would be a coin flip (the model's read is the unstable thing)" },
];
