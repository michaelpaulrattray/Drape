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
 * | `notASlot` | makeup, ink and expression. The catalogue's reasons are decided ones (fable-168/201, D-133/D-136) and each is written there; what is missing is where a surface's words ride, not whether they should. |
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
import { itemsOf, facetsWrittenBy, type RefineDelta } from "./refineDelta";
import type { FreeSubject } from "./refineSubjects";
import { FACET_SLOTS, facetsOfSlot, slotDefinition, slotsForFacet } from "./referenceSlotCatalogue";
import { accessoryKindOf, vacantPhraseFor } from "./accessoryKinds";
import type { Ask, FeatureSlot } from "./recipeAssembler";

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
    /** The delta writes no facet at all. See the refusal at the foot of
     *  {@link repaintAsksFor} — an empty ask list is a charge for nothing. */
    | "nothingAsked";
  facet: Facet | null;
  detail: string;
};

export type RepaintAsksResult =
  | { ok: true; asks: Ask[] }
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

  constructor(refusal: RepaintAsksRefusal, options: { words?: string | null } = {}) {
    super(`the repaint cannot express this ask: ${refusal.detail}`);
    this.name = "RepaintCannotSayError";
    this.reason = refusal.reason;
    this.facet = refusal.facet;
    this.words = options.words ?? null;
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

  for (const facet of Array.from(facetsWrittenBy(input.delta))) {
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
    const definitions = slotsForFacet(facet, { accessoryKind: input.accessoryKind });
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

  if (order.length === 0) {
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
    }),
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
