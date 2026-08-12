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
 * | `removal` | a step being taken back. Under D-244 removal STRIKES matching words from the stack, and the stack is the library's captions rather than the chain's steps — so the words to strike have to be matched against what the library actually holds. Not guessed here. |
 * | `departure` | the same thing from the other side (D-238's `absent`): the negative fact has no declarative state phrase, and `no glasses` is a sentence about the picture rather than about a feature. |
 * | `notASlot` | makeup, ink and expression. The catalogue's reasons are decided ones (fable-168/201, D-133/D-136) and each is written there; what is missing is where a surface's words ride, not whether they should. |
 * | `unnamedObject` | she is visibly wearing something the placement table cannot name. The honest answer, and the same one the mint gives. |
 *
 * Every refusal names its facet, so the log line says which ask the product
 * could not express rather than that "the repaint refused".
 */
import type { EyeColour, EyeShape, HairTexture } from "../../shared/castingRealization";
import type { HairColour } from "../../shared/castingVocabularies";

import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import { itemsOf, facetsWrittenBy, type RefineDelta } from "./refineDelta";
import type { FreeSubject } from "./refineSubjects";
import { FACET_SLOTS, slotDefinition, slotsForFacet } from "./referenceSlotCatalogue";
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
  const departed = Object.values(input.delta.absent ?? {}).flatMap((items) => items ?? []);
  if (departed.length > 0) {
    return {
      ok: false, reason: "departure", facet: null,
      detail: `this render says ${departed.join(", ")} has left her, and a departure has no declarative state phrase to regenerate a feature from`,
    };
  }

  const order: FeatureSlot[] = [];
  const wordsBySlot = new Map<FeatureSlot, string[]>();
  const nounBySlot = new Map<FeatureSlot, string>();

  for (const facet of Array.from(facetsWrittenBy(input.delta))) {
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

  return {
    ok: true,
    asks: order.map((slot) => ({
      slot,
      /* Supplied always. The assembler prefers the library entry's noun when
         it has one, and this is what makes a slot the library has never held
         sayable at all — the degenerate case's whole condition. */
      noun: nounBySlot.get(slot)!,
      words: wordsBySlot.get(slot)!.join(", "),
    })),
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
