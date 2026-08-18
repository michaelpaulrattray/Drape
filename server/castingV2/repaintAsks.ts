/**
 * WHAT THIS RENDER IS ASKING THE REPAINT FOR — one step's delta, in the
 * recipe's own vocabulary.
 *
 * The old compositor is instructed in IMPERATIVES composed per facet ("Change
 * the hair: cut into a mullet."). The recipe assembler is handed something
 * different in kind: a list of **slots** with **declarative state**, because
 * D-244 re-says a feature's whole stack on every edit and imperatives do not
 * accumulate — *"make it bigger"* twice says nothing a painter can paint.
 *
 * So this module is the translation, and it is deliberately the only one. It
 * takes the delta this step filed and produces the assembler's `Ask[]`:
 *
 *   - **the slots come from `slotsForFacet`** — the same function the mint
 *     files with, so the slot a render ASKS about and the slot the library
 *     later FILES cannot come from two tables (working law 4). A bilateral
 *     feature yields one ask per instance, which is what makes "her eyes"
 *     one sentence and two references.
 *   - **the words come from the delta and from `EDIT_PROSE`** — the same
 *     prose object the render prompt is composed with, passed in rather than
 *     imported, so there is no second copy of what "copper" means. Only the
 *     FRAMING differs (state rather than instruction), and that difference is
 *     the whole of what D-244 requires.
 *   - **nothing is invented.** A facet this step wrote and this module cannot
 *     say honestly REFUSES the render rather than quietly dropping it. A
 *     dropped ask is a paid picture whose instruction never reached the
 *     painter — which is precisely the defect the hairWorn gate was built for
 *     this week, and it would arrive here wearing a different coat.
 *
 * # What it refuses today, and every one of them is OWED rather than absent
 *
 * | | |
 * |---|---|
 * | `removal` | a step being taken back. Under D-244 removal STRIKES matching words from the stack, and the stack is the library's captions rather than the chain's steps — so the words to strike have to be matched against what the library actually holds. Not guessed here. **Chunk 3 opened the DEPARTURE half of removal, not this half** — see below. |
 * | `notASlot` | makeup and ink. The catalogue's reasons are decided ones (fable-168/201, D-133) and each is written there; what is missing is where a surface's words ride, not whether they should. **`expression` left this list on 2026-08-14** (fable-446): it has no slot for the same decided reason and it no longer needs one, because a presentation fact rides the change clause in words and files nowhere — see the presentation loop below. |
 * | `unnamedObject` | she is visibly wearing something the placement table cannot name. The honest answer, and the same one the mint gives. |
 *
 * Every refusal names its facet, so the log line says which ask the product
 * could not express rather than that "the repaint refused".
 *
 * # A DEPARTURE IS NOW AN ASK, and it is the half of removal that matters most
 *
 * `departure` used to be on that list, and its stated reason was true of the
 * recipe as it then was: *the negative fact has no declarative state phrase*.
 * The mistake was looking for a phrase about the FEATURE. There is none — but
 * there is one about the SITE, it lives in the placement table beside every
 * other fact about the object (`vacantPhrase`), and the slot simply stops
 * carrying. So `delta.absent` now produces a `vacate` ask.
 *
 * **Declared, because it is half of a thing:** this opens the BASE-WORN
 * departure (D-238's `absent` — her own glasses, in the master, no step to
 * prune). The chain-prune removal still arrives with no `editDelta` at all and
 * still meets `repaintCannotRemove` below. That path needs the pruned chain's
 * own arithmetic to say which slots went vacant, and it is the next slice
 * rather than a forgotten one.
 */
import type { EyeColour, EyeShape, HairTexture } from "../../shared/castingRealization";
import type { HairColour } from "../../shared/castingVocabularies";

import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import { itemsOf, facetsAnsweredBy, facetsWrittenBy, type RefineDelta } from "./refineDelta";
import {
  PRESENTATION_SUBJECTS, presentationNounOf, type FreeSubject,
} from "./refineSubjects";
import {
  FACET_SLOTS, facetsOfSlot, narrowToScope, slotDefinition, slotsForFacet,
} from "./referenceSlotCatalogue";
import { isOpenSlot, openKindCarriedByCrops, openSlotKey } from "./referenceSlots";
import { accessoryKindOf } from "./accessoryKinds";
import { markCanDepart, markKindOf } from "./markKinds";
import { vacantPhraseFor } from "./vacancyPhrases";
import type { Ask, FeatureSlot, PresentationClause } from "./recipeAssembler";

/**
 * The prose table the render prompt is composed with, passed rather than
 * imported: one definition of what a guaranteed value looks like, and no import
 * cycle back into the service that owns it.
 */
export type EditProse = {
  eyeColour: (value: EyeColour) => string;
  eyeShape: (value: EyeShape) => string;
  hairStyle: (value: string) => string;
  hairColour: (value: HairColour) => string;
  hairTexture: (value: HairTexture) => string;
};

export type RepaintAsksInput = {
  /**
   * THIS STEP's delta, not the composed recipe.
   *
   * D-244 line 2: an edit regenerates its feature from the anchor plus the FULL
   * word stack, and the stack lives in the library. What this render adds is the
   * delta, so handing the composed recipe here would re-ask every earlier step
   * on every later render — the recipe's own words competing with the library's
   * account of the same feature.
   */
  delta: RefineDelta;
  /** The same prose the prompt is composed with (`EDIT_PROSE`). */
  prose: EditProse;
  /**
   * What the instruction said the worn object IS, through the shared table's
   * longest-match rule (`accessoryKindOf`) — derived once by the caller and
   * passed, never re-derived, for `mintedSlots`' reason: three derivations of
   * one string is how they come to disagree about ears and eyes.
   */
  accessoryKind?: string | null;
  /**
   * WHAT THIS STEP TAKES BACK — a prune, named (V3(c), fable-536 §2).
   *
   * A prune deletes an earlier step and recomposes what is left, so it writes no
   * facet and adds nothing: its delta is empty by construction, and this door
   * refused it outright until now (`repaintCannotRemove`, whose own detail said
   * the missing piece was the library stack not being derived from the chain's
   * pruning — it is now, in `prunedCarries`).
   *
   * The slots come from the caller because only the service knows which steps
   * were struck; the WORDS are what was taken back, and they exist so the
   * verification has a question at the wire. A prune that arrived as an absence
   * of asks would ship unverified on precisely the fact it exists to change.
   *
   * Absent on every ordinary render, where this changes nothing.
   */
  restate?: readonly { slot: FeatureSlot; taken: string }[];
  /**
   * SLOTS WHOSE NEWEST VERSION HAS NO PIXELS, AND THE STATE TO RE-SAY THEM FROM
   * (fable-318 R2).
   *
   * A crop the mint refused leaves the branch holding two truths about one
   * feature: her words say dangly crosses, and the only reference the library
   * can send is the gold hoops it minted a version earlier. Sending that crop
   * hands the painter a picture of the thing she has already changed — *you do
   * not re-photograph yesterday's earrings when she has changed them* — and
   * dropping it without a word paints her ears bare, because an ITEM with no
   * crop says nothing at all in the recipe.
   *
   * So the slot is re-asked FROM WORDS, as an edit, on this render and every
   * render after it until the words land and the door files a crop again. An
   * edit rather than a standing sentence for a reason worth stating: the mint
   * files crops for the slots a render EDITED, so this is also how the library
   * heals itself.
   *
   * `state` is the branch's composed recipe, not this step's delta — the point
   * is to say what she is currently wearing, which this step said nothing about.
   */
  restore?: {
    state: RefineDelta;
    slots: readonly FeatureSlot[];
  };
  /**
   * ONE INSTANCE, BECAUSE SHE POINTED AT IT (fable-444, ruling C).
   *
   * *"How would i edit just the left or right eye?"* — the founder's own
   * question. A bilateral facet fans out to one ask per instance, which is what
   * makes "her eyes" one sentence and two references. When she clicks the
   * rectangle over one eye, this holds the slot she clicked and the fan-out
   * narrows to it: one ask, on `eye@left`, and `eye@right` is not mentioned at
   * all — which is precisely how the per-eye court bought its answer (31 of 32
   * exact, zero on the wrong eye, opus-342). Nothing about the WORDING changes;
   * the only difference is the slot list, so the measured behaviour and the
   * shipped behaviour are the same behaviour.
   *
   * Per-side is a property of the REFERENCE, never of the axis (fable-444): the
   * delta still says "green eyes" because that is what she typed, and the
   * library — which has always stored `eye@left` and `eye@right` as separate
   * rows with their own words, crops and versions — is what remembers that only
   * one of them is green.
   *
   * Undefined is the whole-face ask, unchanged and untouched.
   */
  scope?: FeatureSlot;
  /**
   * READ THE SIDE OUT OF HER SENTENCE, when she pointed at nothing
   * (fable-604 §3b — dark until its own mirrored court has run).
   *
   * Off, a sentence naming one side of a pair REFUSES rather than fanning out
   * (see `sideNamedWithoutScope`, and the contradiction it exists to stop). On,
   * the ask is narrowed to the side the words name, exactly as a tapped box
   * would narrow it — the same slot, through the same door, so there is one
   * definition of what "her right eye" means and not two.
   */
  inferSideFromWords?: boolean;
  /**
   * WHICH SLOTS THE LIBRARY CAN CARRY BY CROP THIS RENDER — the open lane's
   * carry/edit split (D-244, ruled fable-909 §1).
   *
   * Absent is *nothing carries*, which is exactly today's behaviour and the
   * road every cast without a reference library is on. See the split's own
   * note in the open loop below.
   *
   * Derived by the CALLER from the library it is about to hand the assembler,
   * and never re-derived here (working law 4): two answers to *can this feature
   * carry itself* drift, and the drift is invisible because both are plausible.
   */
  cropped?: ReadonlySet<FeatureSlot>;
};

export type RepaintAsksRefusal = {
  ok: false;
  reason:
    | "removal"
    | "departure"
    | "notASlot"
    | "unnamedObject"
    | "uncatalogued"
    | "noWords"
    /**
     * She pointed at ONE of a pair and asked for it to come off.
     *
     * The paint narrows (the per-eye court); the VACANCY sentence has never
     * been measured per-side, and the once it was watched it took both sides
     * (opus-275, located by opus-342). See the refusal in the departure loop.
     */
    | "perSideRemoval"
    /**
     * The ask names ONE side of a pair and points at nothing.
     *
     * Typed prose does not scope, so the ask fans out to both instances with
     * the side word still inside the value. See the refusal in the written
     * loop, and fable-604 §3 for why this is a refusal today and an inference
     * once its mirrored court has run.
     */
    | "sideNamedWithoutScope"
    /** The delta writes no facet at all. See the refusal at the foot of
     *  {@link repaintAsksFor} — an empty ask list is a charge for nothing. */
    | "nothingAsked";
  facet: Facet | null;
  detail: string;
};

export type RepaintAsksResult =
  | {
    ok: true;
    asks: Ask[];
    /** Facts with no slot to file under, said in the recipe's own sentence and
     *  filed nowhere — see the presentation loop in {@link repaintAsksFor}. */
    presentation?: readonly PresentationClause[];
    /**
     * RESTORE SLOTS THE CATALOGUE COULD NOT NAME, and therefore did not restore.
     *
     * The restore loop skips a slot `slotDefinition` cannot resolve, because it
     * has no noun to say it with. That skip is correct and it is SILENT, which
     * is the half that is wrong: on today's vocabulary it is unreachable (every
     * restorable slot is catalogued), and the day it is reachable — an open
     * kind carried under a synthesized key, `OPEN_LANE_CARRY_DESIGN.md` §4
     * finding 2 — a restore would put back everything EXCEPT that feature and
     * say nothing about it. A paid feature disappearing under a later
     * operation, quietly, is the build-lost class.
     *
     * Reported rather than logged here because this module is pure: it decides,
     * the caller records. Present only when there is something to report, so an
     * ordinary render carries no new field.
     */
    unnameableRestores?: readonly FeatureSlot[];
  }
  | RepaintAsksRefusal;

/**
 * THE ROAD COULD NOT SAY IT — the refusal above, thrown, so the settlement can
 * tell the customer WHY instead of handing them the generic line.
 *
 * Deliberately NOT a {@link ProviderError}. That taxonomy answers *"did the
 * provider fail"*, and every member of it is a verdict about a call we actually
 * made; this answers *"can our road state this ask declaratively"*, which is
 * decided before any provider is contacted. Borrowing its `capability` class
 * would blame an engine that was never asked (fable-355 §1).
 *
 * **Non-retryable by construction**, and by two independent mechanisms rather
 * than by a flag anyone has to remember:
 *
 *  - the free re-render in `refineService` branches on a RETURNED verdict
 *    (`!verification.ok`), never on a throw, so this escapes past it — there is
 *    no `catch` between the throw site and that branch; and
 *  - the provider queue retries only `isRetryable` classes of `ProviderError`,
 *    which this is not; an unrecognised error there classes as `unknown`, which
 *    that taxonomy makes terminal on purpose so unknowns fail closed.
 *
 * Both matter: retrying a door that refuses on identical inputs would charge a
 * customer latency to arrive at the identical answer.
 *
 * Built from the refusal itself rather than from a second copy of its fields —
 * the reason and facet the log line prints are the ones the sentence reads.
 */
export class RepaintCannotSayError extends Error {
  readonly reason: RepaintAsksRefusal["reason"];
  readonly facet: Facet | null;
  /**
   * The ask's own words, when the door has a sentence that quotes them.
   * `null` everywhere else, which is the generic line's cue.
   */
  readonly words: string | null;
  /**
   * HOW THE PRODUCT SPEAKS ABOUT THE PART SHE POINTED AT — "her left ear".
   *
   * Null unless the ask carried a scope. It is the difference between "that
   * didn't come through" and "I read that as a change to something other than
   * her left ear" (fable-471 §1), which is the founder's own specimen.
   */
  readonly scopeNoun: string | null;

  constructor(
    refusal: RepaintAsksRefusal,
    options: { words?: string | null; scopeNoun?: string | null } = {},
  ) {
    super(`the repaint cannot express this ask: ${refusal.detail}`);
    this.name = "RepaintCannotSayError";
    this.reason = refusal.reason;
    this.facet = refusal.facet;
    this.words = options.words ?? null;
    this.scopeNoun = options.scopeNoun ?? null;
  }
}

/**
 * A written facet's state phrase — the delta's own value, said as a state.
 *
 * Returns `null` for a facet this delta does not write, which is not a refusal:
 * `facetsWrittenBy` is the caller's list of what changed and this is asked only
 * about members of it.
 */
/**
 * WHICH SIDE A SENTENCE NAMES, or null when it names none or both.
 *
 * Deliberately crude and deliberately narrow. It answers one question — did
 * this ask single out one half of a pair — and it is only ever asked of a
 * BILATERAL feature's own value, so "parted on the left" (hair has one
 * instance) never reaches it.
 *
 * Both words means neither: *"her left and right earrings gold"* is a genuine
 * statement about the pair and must go through untouched. A word inside another
 * word must not count, which is what the boundaries are for — "bright" is not
 * "right", and that near-miss is exactly the shape that would refuse a render
 * nobody asked to refuse.
 */
export function sideNamedIn(phrase: string): "left" | "right" | null {
  /* Split into words rather than matched with word boundaries, so "bright"
     can never read as "right" — the near-miss that would refuse a render
     nobody asked to refuse. */
  const words = phrase.toLowerCase().split(/[^a-z]+/);
  const left = words.includes("left");
  const right = words.includes("right");
  if (left === right) return null;
  return left ? "left" : "right";
}

function statePhrase(
  facet: Facet,
  delta: RefineDelta,
  prose: EditProse,
): string | null {
  if (delta.eyeColour != null && facet === facetOfAxis("eyeColour")) {
    return `${delta.eyeColour} — ${prose.eyeColour(delta.eyeColour)}`;
  }
  if (delta.eyeShape != null && facet === facetOfAxis("eyeShape")) {
    return `${delta.eyeShape} — ${prose.eyeShape(delta.eyeShape)}`;
  }
  if (delta.hairStyle != null && facet === facetOfAxis("hairStyle")) {
    return `cut into ${prose.hairStyle(delta.hairStyle)}`;
  }
  if (delta.hairColour != null && facet === facetOfAxis("hairColour")) {
    return `coloured ${prose.hairColour(delta.hairColour)}`;
  }
  if (delta.hairTexture != null && facet === facetOfAxis("hairTexture")) {
    return `with ${prose.hairTexture(delta.hairTexture)}`;
  }
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    if (facet !== facetOfSubject(subject as FreeSubject)) continue;
    /* Her own words, joined the way the free lane already joins them. A plural
       subject's value is the COMPLETE current answer rather than an increment
       (`PLURAL_SUBJECTS`), so the whole list is the state. */
    const words = itemsOf(value).join(", ").trim();
    return words === "" ? null : words;
  }
  return null;
}

/**
 * The assembler's asks for one step, or the reason the repaint cannot say it.
 *
 * Slots come out in the order the facets were written, and never twice: two
 * facets of one slot — a cut and a colour in one breath — are ONE ask whose
 * words hold both, because the assembler gives one slot one reference per
 * render (fable-174) and two asks for one slot would be two instructions about
 * one feature.
 */
/**
 * IS EVERY FACET THIS ASK WRITES OUTSIDE THE PART SHE POINTED AT?
 *
 * # The charge this deletes
 *
 * The founder tapped the panel's EARS row and asked for a cauliflower ear. The
 * reading filed it as a MARK; marks have no slot inside an ear; and
 * {@link repaintAsksFor} refused with `notASlot` — correctly, and AFTER the
 * claim, so he was charged 25 credits and refunded them in the same second and
 * told nothing useful (fable-471, fable-489 §3).
 *
 * The service's own comment said this could not be judged earlier "because
 * nothing has been interpreted at this point". That premise expired: the parse
 * now happens well before the claim, so the same fact is knowable while the
 * refusal is still free.
 *
 * # It is deliberately NARROWER than the door it pre-empts
 *
 * `repaintAsksFor` refuses on the FIRST facet with no slot in scope. This
 * refuses only when EVERY answered facet is outside — so a scoped ask with one
 * facet inside proceeds exactly as it does today and meets the late door
 * unchanged. And a facet whose slots depend on an accessory kind this caller
 * cannot supply is not judged at all: cannot-tell must not become a refusal.
 *
 * The late door STAYS. This one is an early exit for the money, not a
 * replacement for the guard (law 3: the backstop keeps its own drive).
 */
export function scopedAskIsUnsayable(input: {
  delta: RefineDelta;
  scope: FeatureSlot;
  accessoryKind?: string | null;
}): { unsayable: true; facets: Facet[] } | { unsayable: false } {
  const answered: Facet[] = Array.from(facetsAnsweredBy(input.delta));
  if (answered.length === 0) return { unsayable: false };
  const outside: Facet[] = [];
  for (const facet of answered) {
    const slots = slotsForFacet(facet, { accessoryKind: input.accessoryKind ?? null });
    /* No slots at all without the kind: this caller cannot judge it, and a
       cannot-tell may not spend the customer's refusal. */
    if (slots.length === 0) return { unsayable: false };
    if (narrowToScope(slots, input.scope).length > 0) return { unsayable: false };
    outside.push(facet);
  }
  return { unsayable: true, facets: outside };
}

export function repaintAsksFor(input: RepaintAsksInput): RepaintAsksResult {
  const order: FeatureSlot[] = [];
  const wordsBySlot = new Map<FeatureSlot, string[]>();
  const nounBySlot = new Map<FeatureSlot, string>();
  const vacateBySlot = new Map<FeatureSlot, string>();
  /** Which facets the departure loop below spoke for — read once, by the
   *  written loop, so one fact is not asked twice. */
  const vacatedFacets = new Set<Facet>();

  /*
    A DEPARTURE IS A SLOT GOING VACANT (chunk 3, `LIBRARY_REMOVAL_DESIGN.md`).

    This used to refuse outright, with a reason that was true of the recipe as
    it then was: a departure has no declarative state phrase to regenerate a
    feature FROM. The answer was never a phrase about the feature — it is a
    phrase about the SITE, said by the slot catalogue, and the slot carrying
    nothing at all.

    `delta.absent` is the base-worn departure D-238 authors in the service: the
    thing is in the master, no step put it there, and no subtraction can remove
    it. It is exactly the case that must SAY the absence out loud, because the
    master is reference 1 and silence about her glasses is an instruction to
    paint them back on.

    The kind is derived HERE from the departed noun rather than taken from
    `input.accessoryKind`. That is not a second copy of the caller's
    derivation — it is a different question about a different string: the
    caller's kind describes what the edit ADDS, and a removal has no such
    words. Same function, same table, one definition of what an earring is.
  */
  for (const [subject, items] of Object.entries(input.delta.absent ?? {})) {
    const facet = facetOfSubject(subject as FreeSubject);
    for (const noun of items ?? []) {
      const definitions = slotsForFacet(facet, { accessoryKind: accessoryKindOf(noun) });
      if (definitions.length === 0) {
        return {
          ok: false, reason: "unnamedObject", facet,
          detail: `this render says ${noun} has left her and the placement table cannot name what that is, so the recipe has no slot to vacate`,
        };
      }
      /*
        A SCOPED REMOVAL OF ONE OF A PAIR REFUSES, and the reason is a
        measurement rather than caution.

        The narrowing above is granted for PAINTING because the per-eye court
        bought the answer — 31 of 32 single-side paints landed on exactly the
        asked eye, zero on the wrong one, zero on both (opus-342). A departure
        is a different sentence to a different part of the recipe: the slot goes
        VACANT and the frame is told the site carries nothing. The one
        measurement this program has of that sentence per-side says it takes
        BOTH — opus-275's *"honours 'her left' 6/6 and takes BOTH on 'her right'
        5/6"*, which opus-342 re-read and located precisely: *"whatever went
        wrong there was about the earring VACANCY sentence, not about the word
        'right'"*.

        So narrowing here would ship, silently, the one shape a court has
        already seen fail — she asks for one hoop off, both come off, and she is
        charged for a picture of a different question. It refuses instead, free
        of a picture and whole of her money, and the door opens the day a
        removal court exists (the fidelity law's declared shortcut, named rather
        than taken).

        Narrow on purpose: a departure whose feature has ONE slot cannot be
        narrowed by a scope at all, so it is not asked about here — only a
        genuinely bilateral vacancy refuses.
      */
      if (input.scope !== undefined && definitions.length > 1) {
        return {
          ok: false, reason: "perSideRemoval", facet,
          detail: `this render takes ${noun} off one side only, and the one court of a per-side vacancy sentence saw it take both (opus-275) — the recipe would say a thing about her the render is not measured to deliver`,
        };
      }
      for (const definition of definitions) {
        /*
          THE KIND, WHICH IS NOT ALWAYS THE SLOT'S GUARD KIND (V3(b), marks).

          A slot's guard kind names what a segmenter is asked for, and `skin` has
          none — its region is display-only. So a freckle removal looked its
          sentence up under `null` and could never find one, which is a missing
          KEY rather than a missing capability. The kind of a mark is what the
          sentence names it as ("freckles"), read from the departing words by
          the same longest-match rule the accessory table uses.

          One kind ships (`MARK_KINDS`); the others are named there with no
          phrase and refuse exactly as they did. **Declared: this is
          scaffolding, and the per-kind mark vocabulary is the real source.**
        */
        const markKind = markKindOf(noun);
        /*
          AND `canDepart` IS THE DOOR, not a comment. Freckles' sentence is
          written and its court came back SHORT — they vanish on their own (1 of
          3 survived an unrelated edit nobody asked to change them) and the skin
          comes back airbrushed where they were. A kind whose court has not
          passed refuses here, with the phrase sitting ready for the run that
          earns it.
        */
        const says = markKind !== null
          ? (markCanDepart(markKind) ? vacantPhraseFor(markKind) : null)
          : vacantPhraseFor(definition.guardKind);
        if (says === null) {
          /*
            An absence sentence is never improvised at the call site — a
            sentence authored beside an ask is the free-floating parallel prose
            fable-195 ruled against, and the cost of getting this one wrong is
            a paid render that says something untrue about her face. A kind with
            no phrase refuses, and opens with its own vocabulary later
            (roadmap §5) rather than by loosening this door.
          */
          return {
            ok: false, reason: "uncatalogued", facet,
            detail: `${definition.slot} has no vacant phrase in the placement table, so the recipe could not say that ${noun} is gone`,
          };
        }
        order.push(definition.slot);
        vacateBySlot.set(definition.slot, says);
        vacatedFacets.add(facet);
        nounBySlot.set(definition.slot, definition.noun);
      }
    }
  }

  /*
    A PRESENTATION FACT IS SAID IN WORDS AND FILED NOWHERE (fable-446).

    `expression` is the first specimen of an ask the road could not state: no
    slot by decision (D-136 — a follow must never inherit a smile), no zone to
    cut, nothing to carry. It used to meet `notASlot` below and refuse into the
    refund, which was honest and was still a customer typing *make her smile*
    and being told the product could not. Now it rides the change clause.

    # It is read from the COMPOSED state, and that is not the D-244 exception
    # this module's `delta` warning is about

    That warning says: do not re-ask a SLOT from the composed recipe, because
    the library already holds that feature's stack and the recipe would compete
    with it. A presentation fact has no library row anywhere — the composed
    state is the ONLY place it is written down. Every render anchors on the
    pristine master, so a recipe that goes quiet about her smile is a recipe
    that paints the master's face back: the smile would last exactly one frame,
    which is the class this campaign has already paid for twice (the born-worn
    removal, and a build lost under words).

    So it is re-said on every render of the branch until something supersedes
    it, which is the same rule `restore` above lives by, for the same reason.
  */
  const presentation: PresentationClause[] = [];
  /** The facets the clauses above spoke for — accumulated as they are pushed,
   *  never re-derived from the subject list, which would be the same drift the
   *  vacate loop keeps `vacatedFacets` to avoid. */
  const spokenAsPresentation = new Set<Facet>();
  const presentationState = input.restore?.state ?? input.delta;
  for (const subject of PRESENTATION_SUBJECTS) {
    const noun = presentationNounOf(subject);
    if (noun === null) continue;
    const facet = facetOfSubject(subject);
    const words = statePhrase(facet, presentationState, input.prose);
    if (words === null || words.trim() === "") continue;
    presentation.push({ noun, words });
    spokenAsPresentation.add(facet);
  }

  /*
    A KIND NOBODY HAS CATALOGUED — the open lane's own loop
    (`OPEN_LANE_DESIGN_NOTE.md` §8 step 4, §9.7's scout, shape (a) ruled in
    fable-760 §2).

    # Why it is a loop of its own rather than a case inside the one below

    The written loop is driven by `facetsWrittenBy` and every gate inside it
    keys on the closed union in turn — `facetOfSubject` → `FACET_SLOTS` →
    `slotsForFacet` → `slotDefinition` → `statePhrase`. An open kind has no
    facet and is in no delta field those read, so it cannot enter through that
    loop at all. That is the boundary doing its job rather than a gap: the
    scout's finding was that the work is at the ENTRY, and the entry is `Facet`.

    # It reads the COMPOSED state, and that is the same decision presentation
    # made, for the same reason one line up

    An open kind has no library row — the mint is driven by `earned: Facet[]`
    and an open kind has no facet, so nothing files one and nothing carries one.
    The composed recipe is therefore the ONLY place it is written down, exactly
    as with a smile, and every render anchors on the pristine master: a recipe
    that goes quiet about her horns paints the master's face back and the horns
    last one frame. So they are re-said on every render of the branch.

    **Declared, and it is the honest limit of this chunk**: words alone are not
    what fable-566 asks for. A crop is minted by step 3's door, which is not
    built, and until it is an open kind is a feature carried in WORDS — which
    re-rolls its shape between renders. The lane does not ship on this.

    # The NOUN is read from the record and never from the key

    `open:cat-ears` is a single token because `parseSlot` has no space in its
    grammar, and the spelling is lossy: `cat ears` and `cat-ears` both key the
    same way, so the noun cannot be recovered from the key. The catalogue's own
    branch says so at the field. This is the one place a customer's sentence is
    composed from it, so a kind whose stored noun is missing REFUSES rather than
    falling back to the token — a refusal costs a render, and `Change only her
    cat-ears: …` is a paid one.
  */
  const openState = input.restore?.state ?? input.delta;
  /** The kinds THIS STEP asked for, struck off as the composed state accounts
   *  for each — so anything left over is an ask that went missing. */
  const openAskedNow = new Set(Object.keys(input.delta.open ?? {}));
  /** Whether this step asked for an open kind AT ALL — the emptiness check's
   *  half of the fact, read before the set above is spent. */
  const askedAnOpenKind = openAskedNow.size > 0;
  for (const [kind, said] of Object.entries(openState.open ?? {})) {
    const slot = openSlotKey(kind);
    const definition = slotDefinition(slot);
    if (definition === null) {
      /*
        A KEY THE CATALOGUE WILL NOT RESOLVE, and the loud answer is the right
        one. `readOpenKinds` drops a malformed key on the way in, so reaching
        here means a delta was built past that door with a key the library will
        also refuse — after the render is paid for. Refusing free is strictly
        better than painting a feature that can never be filed.
      */
      return {
        ok: false, reason: "uncatalogued", facet: null,
        detail: `${slot} is not a key the open lane could have minted, so nothing knows what to ask for or what to call it`,
      };
    }
    const noun = said.noun.trim();
    const words = said.words.trim();
    if (noun === "" || words === "") {
      return {
        ok: false, reason: "noWords", facet: null,
        detail: `the open kind "${kind}" carries ${noun === "" ? "no noun to say it with" : "no words to say about it"}, `
          + "so the recipe would tell the painter to change something into nothing",
      };
    }
    /*
      THE CARRY/EDIT SPLIT — D-244's two directions, ruled in fable-909 §1.

      Checked AFTER the two refusals above and not before them: they validate
      the composed record itself, and a malformed row is a defect on either
      road. A kind carried by crop still has to be a kind the library could
      file, and finding out at mint time instead is how a paid feature goes
      missing quietly.

      **The condition is THIS STEP'S DELTA, never the crop alone.** A split
      keyed on "does a crop exist" would take the edit away from the kinds that
      have one: she types *make the cat ears black*, the recipe carries a
      photograph of the grey ones, and the ask says nothing. That is the
      misaimed-guard class, which this program has paid for twice, and its
      control is driven beside the positive arm.

      - **asked this step** → an EDIT. It falls through and is re-said, and its
        own crop is refused by the assembler (D-244 line 2). Correct: the
        customer is changing the thing, and an edit regenerates from the anchor
        plus the full word stack.
      - **carried, with a crop** → the LIBRARY carries it, and this loop says
        nothing. An open slot is `anatomy` in the catalogue, so the crop rides
        AND its read-back words stand — the configuration measured at 5 of 5,
        against 0 of 5 for a crop with no words beside it.
      - **carried, no crop** → falls through to the words carrier below,
        unchanged. The fallback that stops a cropless kind vanishing, and the
        road every open kind travels until the mint files one.

      Saying it as well as carrying it is what would break the carry: an open
      kind that is re-said is an EDIT, and an edit's own crop never rides. So
      the sentence that was preserving the feature before crops existed is
      exactly the thing that now drops the crop paid for to preserve it.
    */
    const askedThisStep = openAskedNow.has(kind);
    openAskedNow.delete(kind);
    /*
      THE CARRY TEST IS ABOUT THE KIND, NEVER ABOUT ONE SPELLING OF IT
      (the D1 wire, fable-1001 §3).

      A distributed kind is carried by TWO rows, `open:wings@left` and
      `open:wings@right`, and a membership test written for the sideless key
      answers no on a kind that is fully crop-carried. The cost is not a missing
      crop; it is the opposite and worse — the kind is re-said, a re-said kind is
      an EDIT, and an edit's own crops are refused by the assembler. Both
      pictures bought to preserve her wings would be dropped by the sentence
      written to preserve them.

      `openKindCarriedByCrops` is that question asked once, beside the grammar:
      the sideless row carries a single or co-located kind, and a distributed one
      is carried only when BOTH sides are in hand. One wing is the half-picture
      the counting gate refuses, and the words must still ride.
    */
    if (!askedThisStep && input.cropped !== undefined && openKindCarriedByCrops(kind, input.cropped)) continue;
    order.push(slot);
    wordsBySlot.set(slot, [words]);
    /* The STORED noun, spaces intact — never `definition.noun`, which is the
       token. The catalogue's branch carries the token deliberately and requires
       every copy path to read the record instead. */
    nounBySlot.set(slot, noun);
  }
  /*
    AND A KIND THIS STEP ASKED FOR THAT THE COMPOSED STATE DOES NOT HOLD.

    The caller's contract is that the state it passes is this step composed onto
    the branch, so anything left in the set is a composition that dropped an ask
    on the way — which is a paid picture whose instruction never reached the
    painter, the exact defect this whole module exists to close. It refuses
    rather than painting the render that is missing it.
  */
  if (openAskedNow.size > 0) {
    return {
      ok: false, reason: "uncatalogued", facet: null,
      detail: `this step asks for ${Array.from(openAskedNow).join(", ")} and the composed state it was `
        + "given does not carry it, so the recipe would paint a render that never mentions what was asked for",
    };
  }

  for (const facet of Array.from(facetsWrittenBy(input.delta))) {
    /* Already said above, in the one place it can be said — and said from the
       composed state, so this step's own words are in it. */
    if (spokenAsPresentation.has(facet)) continue;
    /*
      A FACET THE DEPARTURE ALREADY SPOKE FOR, LEFT EMPTY, SAYS NOTHING NEW.

      A removal that clears the last item on a subject arrives as both halves of
      one fact: `absent: {statedAccessories: ["glasses"]}` and the survivors,
      `free: {statedAccessories: []}`. The vacate above is that fact; the empty
      value is the same fact with nothing left to say, and running it through
      `statePhrase` would refuse the render with `noWords` for having correctly
      removed the only thing there was.

      Narrow on purpose — only when this facet actually produced a vacate, and
      only when the value is empty. A facet with survivors still goes through
      below and states them, and a genuinely wordless facet nobody vacated still
      refuses, which is the case that door was built for.
    */
    if (vacatedFacets.has(facet) && statePhrase(facet, input.delta, input.prose) === null) continue;
    let definitions = narrowToScope(
      slotsForFacet(facet, { accessoryKind: input.accessoryKind }),
      input.scope,
    );
    if (definitions.length === 0) {
      /* The reason comes from the catalogue's own ASSIGNMENT rather than from
         what the caller happened to pass, so a decided absence and an unnamed
         object never wear each other's label — the same split
         `mintedSlots.unfiledReasonFor` makes, read here on the way in rather
         than on the way out. */
      const unnamed = "family" in FACET_SLOTS[facet];
      return {
        ok: false, reason: unnamed ? "unnamedObject" : "notASlot", facet,
        detail: unnamed
          ? `this render writes ${facet} and the placement table cannot name what she is wearing, so the recipe has no slot to ask about`
          : `${facet} has no library slot, so a repaint would paint a recipe that never mentions what was asked for`,
      };
    }
    const phrase = statePhrase(facet, input.delta, input.prose);
    if (phrase === null) {
      return {
        ok: false, reason: "noWords", facet,
        detail: `${facet} is written by this step and has no value to say about it, so the slot would regenerate with nothing said`,
      };
    }
    /*
      A SENTENCE THAT NAMES ONE SIDE AND SCOPES NOTHING (fable-604 §3a).

      Typed prose does not scope: only the box she taps does. So *"her right eye
      — fiery red"* with no scope fans the ask out to BOTH eyes and carries the
      side word inside the value, and the recipe dispatched — verbatim from a
      dev row —

        Change only his LEFT eye: her right eye fiery red; his RIGHT eye: her
        right eye fiery red.

      The left eye is instructed to become "her right eye fiery red". That is
      not a whole-pair edit, it is a contradiction sent to the engine at full
      price, and the render's own read-back caught it afterwards — *"both irises
      are vivid fiery red… not isolated to the right"* — on a frame that
      delivered and charged.

      So it refuses, free, and hands back the thing she can do. Only when
      exactly ONE side is named: a sentence naming both ("her left and right
      earrings") is a genuine statement about the pair and goes through, and a
      feature with one instance cannot be narrowed by a side word at all.

      The inference — reading the side out of the words and scoping the ask to
      it — is the fix this door makes room for, and it lands behind its own
      mirrored court (fable-604 §3b). Until then a refusal is the honest answer:
      the founder's own per-side edits go through the panel and are untouched by
      this.
    */
    if (input.scope === undefined && definitions.length > 1) {
      const named = sideNamedIn(phrase);
      if (named !== null && input.inferSideFromWords === true) {
        /*
          THE INFERENCE. It narrows to the side the words name and nothing else
          changes: the same slot a tapped box produces, so the paint, the
          verification's narrowing and the library's per-instance memory all go
          on holding one definition of "her right eye".
        */
        const narrowed = definitions.filter((definition) => definition.instance === named);
        /* Only when it lands on exactly one instance. A kind whose sides are
           not spelled `left`/`right` narrows to nothing or to several, and
           either way the honest answer is the one below. */
        if (narrowed.length === 1) definitions = narrowed;
      } else if (named !== null) {
        return {
          ok: false, reason: "sideNamedWithoutScope", facet,
          detail: `the ask names her ${named} side and scopes nothing, so the recipe would tell BOTH `
            + `instances of ${facet} to become "${phrase}" — a contradiction dispatched at full price`,
        };
      }
    }
    for (const definition of definitions) {
      if (slotDefinition(definition.slot) === null) {
        return {
          ok: false, reason: "uncatalogued", facet,
          detail: `${definition.slot} is not in the slot catalogue, so nothing knows what tier or noun it has`,
        };
      }
      const held = wordsBySlot.get(definition.slot);
      if (held) {
        /* One slot, one ask. A second phrase joins the first rather than
           opening a second ask: cut and colour are one visible thing, and the
           assembler would refuse two references for one slot anyway. */
        if (!held.includes(phrase)) held.push(phrase);
        continue;
      }
      order.push(definition.slot);
      wordsBySlot.set(definition.slot, [phrase]);
      nounBySlot.set(definition.slot, definition.noun);
    }
  }

  /*
    A PRUNE'S OWN ASKS — named rather than arriving as an absence.

    Built before the emptiness check below, because a prune legitimately writes
    no facet: taking a step back IS the ask, and `nothingAsked` keeps meaning
    exactly what it says (this step writes no facet AND takes nothing back).
  */
  const restated = (input.restate ?? []).filter((one) => one.taken.trim() !== "");

  /*
    AND THE TWO CHANNELS THAT ARE RE-SAID EVERY RENDER DO NOT COUNT AS ASKS.

    Presentation and the open lane are both read from the COMPOSED state,
    because neither has a library row and the composition is the only place
    either is written down. That makes each of them non-empty on every later
    render of a branch that ever carried one — so counting them below would let
    a smile asked three steps ago satisfy the guard against *a charge for
    nothing*, forever.

    So the question put to each is the one the check is actually asking: did
    THIS step ask for it. Presentation is read through `facetsWrittenBy` on this
    step's own delta, which is the same derivation the written loop uses to skip
    them — not a second answer to what this step wrote (working law 4).

    Found while adding the second of the two (opus-569 §3); the presentation
    half was already live, which is why it is fixed here rather than only
    guarded against.

    **OPEN, and said here rather than left to be assumed** (fable-777 §2b):
    whether the service can reach this door with an `editDelta` that writes
    nothing has NOT been answered — the interpreter has walls in front of it and
    none of them was traced. So this is a door-level fix with an unexamined
    upstream. It is the right fix either way, because a guard that can be
    satisfied by a fact from three steps ago is not a guard; but nobody should
    read it as evidence that a customer was being charged for nothing.
  */
  const saidAPresentationFact = Array.from(facetsWrittenBy(input.delta))
    .some((facet) => spokenAsPresentation.has(facet));
  /* Every slot in `order` but an open one was put there by this step's own
     delta — the vacate loop reads `delta.absent` and the written loop reads
     `facetsWrittenBy(delta)`. Only the open slots are carried. */
  const askedThisStep = order.some((slot) => !isOpenSlot(slot))
    || askedAnOpenKind
    || saidAPresentationFact
    || restated.length > 0;

  if (!askedThisStep) {
    /*
      AN EMPTY ASK LIST IS NOT AN EMPTY RENDER — it is a charge for nothing.

      `assembleRecipe` accepts one happily: no asks means no edited slots, which
      is a legitimate PURE CARRY recipe, and it would paint, land, and bill. The
      assembler is right to allow it (a carry-only render is a real thing) and
      this caller is the only place that knows a person typed a sentence and
      paid for it. Same shape as the ask that reaches no painter, one door over.
    */
    return {
      ok: false, reason: "nothingAsked", facet: null,
      detail: "this step writes no facet, so the recipe would carry everything, change nothing, and charge for it",
    };
  }

  /*
    AND THE SLOTS WHOSE ONLY REFERENCE CONTRADICTS HER (fable-318 R2).

    After the emptiness check on purpose: a superseded slot is not something a
    person asked for this step, so it may ride along with a real ask and must
    never be the whole reason a render is charged for.

    Each one is said from the branch's CURRENT state — what she is wearing now,
    per the composed recipe — and only where a slot the catalogue knows can be
    given a phrase. A slot that cannot be said keeps its silence rather than
    being handed the stale crop anyway: refusing to send a contradiction is the
    half of this rule that always holds, and the words are the half that heals
    it.
  */
  const unnameableRestores: FeatureSlot[] = [];
  for (const slot of input.restore?.slots ?? []) {
    if (wordsBySlot.has(slot) || vacateBySlot.has(slot)) continue;
    const definition = slotDefinition(slot);
    if (definition === null) {
      /* Skipped, and SAID — see `unnameableRestores`. The skip is right (there
         is no noun to restore it with) and its silence was not. */
      unnameableRestores.push(slot);
      continue;
    }
    const phrase = (facetsOfSlot(slot) ?? [])
      .map((facet) => statePhrase(facet, input.restore!.state, input.prose))
      .find((said): said is string => said !== null && said.trim() !== "");
    if (phrase === undefined) continue;
    order.push(slot);
    wordsBySlot.set(slot, [phrase]);
    nounBySlot.set(slot, definition.noun);
  }

  return {
    ok: true,
    /* Present only when there is one, so the assembler's own default (no
       clauses) is what every render that never asked for one receives. */
    ...(presentation.length > 0 ? { presentation } : {}),
    ...(unnameableRestores.length > 0 ? { unnameableRestores } : {}),
    asks: order.map((slot) => {
      const says = vacateBySlot.get(slot);
      return {
        slot,
        /* Supplied always. The assembler prefers the library entry's noun when
           it has one, and this is what makes a slot the library has never held
           sayable at all — the degenerate case's whole condition. */
        noun: nounBySlot.get(slot)!,
        /* A vacate carries its sentence and NO words. The assembler refuses a
           slot given both (`vacateAlsoAsks`), which is the right answer to a
           delta that says a thing both left and changed. */
        ...(says === undefined
          ? { words: wordsBySlot.get(slot)!.join(", ") }
          : { vacate: { says } }),
      };
    }).concat(restated.map((one) => ({
      slot: one.slot,
      /* No noun and no words: the recipe says nothing about a taken-back slot,
         and the assembler refuses one given anything else to do. */
      restate: { taken: one.taken },
    })) as never),
  };
}

/**
 * A removal step, named where the caller can act on it.
 *
 * `refineService` derives its written facets from the removal's own arithmetic
 * when there is no edit delta, and the repaint has no way to express that yet
 * (see the table above). Kept here rather than at the call site so the reason
 * travels with the module that owes the work.
 */
export function repaintCannotRemove(): RepaintAsksRefusal {
  return {
    ok: false, reason: "removal", facet: null,
    detail: "this step takes an earlier one back, and under D-244 a removal strikes matching words from the library's stack — which is not yet derived from the chain's own pruning",
  };
}
