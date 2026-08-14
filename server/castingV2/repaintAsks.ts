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
import { accessoryKindOf } from "./accessoryKinds";
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
        const says = vacantPhraseFor(definition.guardKind);
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
    const definitions = narrowToScope(
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

  if (order.length === 0 && presentation.length === 0 && restated.length === 0) {
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
  for (const slot of input.restore?.slots ?? []) {
    if (wordsBySlot.has(slot) || vacateBySlot.has(slot)) continue;
    const definition = slotDefinition(slot);
    if (definition === null) continue;
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
