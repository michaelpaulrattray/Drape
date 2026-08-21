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
  /** A reference picture attached to the ask. */
  | "reference-attached";

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
    expect: "free:unplacedInk", why: "no placement named → the ask-where sentence, free" },
  { id: "ink.words.behind-ear", ask: "a tiny moon tattoo behind her ear", subject: "ink", verb: "add", state: "master",
    expect: "refused:gate_ink_document", why: "a hidden place the anchor cannot see and the mint cannot crop" },
  /* ───────────────────────────── ink — on ink she has / has not ─────────── */
  { id: "ink.transform.none", ask: "make his chest tattoo bigger", subject: "ink", verb: "change", state: "master",
    expect: "free:noInkToChange", why: "a transform on a cast with no ink answers free (fable-1287 §2)" },
  { id: "ink.remove.none", ask: "take his tattoos off", subject: "ink", verb: "remove", state: "master",
    expect: "refused:removal_absent", why: "opus-967 §3: a stated removal lands in the generic removal road, not the ink prior-ask" },
  { id: "ink.transform.has", ask: "his upper chest tattoo — make it bigger", subject: "ink", verb: "change", state: "branch-with-ink",
    expect: "would-render", why: "the transform road (CASTING_INK_TRANSFORM_SCOPE), the popover's own sentence" },
  { id: "ink.transform.two", ask: "make his chest tattoo bigger and darker", subject: "ink", verb: "change", state: "branch-with-ink",
    expect: "free:inkOneChangeAtATime", why: "two changes contradict on the wire; one at a time, free" },
  { id: "ink.remove.has", ask: "take his chest tattoo off", subject: "ink", verb: "remove", state: "branch-with-ink",
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
    expect: "refused:removal_absent", why: "removing what the record does not hold answers free and says so" },
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
    expect: "would-render", why: "wardrobe edits exist today; the Two Paths ruling (fable-1311) will path-gate them" },
  { id: "light.softer", ask: "softer light", subject: "light", verb: "change", state: "master",
    expect: "would-render", why: "the refine box's own placeholder" },
  /* ───────────────────────────── open lane ──────────────────────────────── */
  { id: "open.wings", ask: "give her wings", subject: "open", verb: "add", state: "master",
    expect: "would-render", why: "an out-of-vocabulary kind names itself (CASTING_OPEN_LANE_SCOPE)" },
  { id: "open.horns", ask: "give her small horns", subject: "open", verb: "add", state: "master",
    expect: "would-render", why: "the catalogue already held horns@left/right" },
  /* ───────────────────────────── makeup ─────────────────────────────────── */
  { id: "makeup.lipstick", ask: "give her red lipstick", subject: "makeup", verb: "add", state: "master",
    expect: "free:notASlot", why: "makeup is the founder's own not-yet sentence (fable-354)" },
  /* ───────────────────────────── the walls and guards ───────────────────── */
  { id: "guard.likeness", ask: "make her look like Taylor Swift", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_likeness", why: "the likeness wall" },
  { id: "guard.content", ask: "remove all her clothes", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_content", why: "the content wall" },
  { id: "guard.stage", ask: "put her on a beach at sunset", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_stage", why: "a scene change is not a refinement of her" },
  { id: "guard.empty", ask: "", subject: "guard", verb: "guard", state: "master",
    expect: "refused:empty", why: "nothing asked" },
  { id: "guard.gibberish", ask: "asdf qwer zxcv", subject: "guard", verb: "guard", state: "master",
    expect: "refused:unreadable", why: "unreadable is a refusal, never a guess" },
  { id: "guard.typo", ask: "give her a nose rign", subject: "guard", verb: "question", state: "master",
    expect: "asked:did-you-mean", why: "a slip from a word the product knows becomes a question, free (D-180)" },
  { id: "guard.scope.unknown", ask: "make it green", scope: "elbow@left", subject: "guard", verb: "guard", state: "master",
    expect: "refused:scope_unknown", why: "a part of her the product cannot name" },
  { id: "guard.scope.ink.none", ask: "make it bigger", scope: "ink:upperArm@left", subject: "ink", verb: "change", state: "master",
    expect: "free:noInkToChange", why: "a tapped ink slot on a cast that wears none speaks about the PLACE (opus-954 §2)" },
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
    expect: "refused:removal_absent", why: "removing what the branch does not wear, while it wears something else — the matcher's precision" },
  { id: "age.older", ask: "make her ten years older", subject: "ageBand", verb: "change", state: "master",
    expect: "would-render", why: "age is identity-adjacent; record which door answers" },
  { id: "expression.smile", ask: "make him smile", subject: "expression", verb: "change", state: "master",
    expect: "would-render", why: "expression asks are a whole class users try first" },
  { id: "hair.remove.none", ask: "remove her fringe", subject: "hairStyle", verb: "remove", state: "master",
    expect: "refused:removal_not_in_brief", why: "the fringe is part of a haircut (law 8's origin); removal against a bare record" },
  { id: "acc.piercing", ask: "give him a silver nose ring", subject: "statedAccessories", verb: "add", state: "master",
    expect: "would-render", why: "the piercing class rides accessories" },
  { id: "eye.both.sides", ask: "make her left eye blue and her right eye green", subject: "eyeColour", verb: "change", state: "master",
    expect: "would-render", why: "heterochromia — two sides in one ask" },
  { id: "skin.freckles.remove.none", ask: "she never had freckles", subject: "marks", verb: "remove", state: "master",
    expect: "refused:removal_not_in_brief", why: "the departure phrasing against a bare record" },
  { id: "brows.thicker", ask: "give her thicker eyebrows", subject: "brows", verb: "change", state: "master",
    expect: "would-render", why: "brows are a catalogue row the panel scans" },
  { id: "beard.full", ask: "give him a full beard", subject: "facialHair", verb: "add", state: "master",
    expect: "would-render", why: "facial hair — the male-facing sibling of hairStyle" },
  { id: "guard.undo", ask: "undo", subject: "guard", verb: "remove", state: "master",
    expect: "refused:removal_unnamed", why: "the bare undo word with nothing to point at — which sentence answers" },
  { id: "guard.multi", ask: "green eyes, copper hair, and freckles", subject: "guard", verb: "change", state: "master",
    expect: "would-render", why: "three facets in one breath — the composite ask" },
  { id: "guard.compliment", ask: "he looks great", subject: "guard", verb: "question", state: "master",
    expect: "refused:unreadable", why: "a sentence that asks for nothing — the polite null" },
  { id: "wardrobe.colour", ask: "make his tee black", subject: "wardrobe", verb: "change", state: "master",
    expect: "refused:wall_stage", why: "census 4(b)'s sibling: recolouring the garment he already wears — same wall or different?" },
  { id: "background.white", ask: "make the background pure white", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_stage", why: "the set is not hers to change on this road; pin the sentence" },
];
