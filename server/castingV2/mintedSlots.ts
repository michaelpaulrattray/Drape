/**
 * WHICH SLOTS THIS RENDER FILES, AND WHAT IT SAYS ABOUT THEM.
 *
 * The mint takes a list of slots with their words (`referenceMint.ts`); the
 * catalogue says what each slot IS (`referenceSlotCatalogue.ts`). This is the
 * step between them: it turns *what this render earned* into *what the library
 * is being told*, and it is a pure function of the render's own record so the
 * rules below can be driven without a database, a frame, or a vision call.
 *
 * # Only what this render EARNED, and it is the same list the segments use
 *
 * The caller hands in the facets that were written by this ask, verified on
 * their own reading, and not carried — `earned` in `refineService`, already
 * derived once for segment permanence. Reusing that list rather than deriving a
 * second one is working law 4: two answers to *what did this render deliver*
 * drift, and the drift is invisible because both are plausible.
 *
 * A slot whose words did not change this render is not filed at all. Its newest
 * live row along this branch's ancestry already holds them, and writing an
 * identical row every render would turn a version history into a heartbeat.
 *
 * # The words are the CAPTIONS, and a slot's stack is its facets' captions
 *
 * `capturedCaptions` is the read-back of the render that actually landed, keyed
 * by facet, carried forward from the ancestry for everything this ask did not
 * touch. So the stack for `hair` is what this face's hair currently IS across
 * all five hair facets, not just the one the user typed about — which is what
 * makes it a declarative stack rather than an edit log.
 *
 * A facet with no caption contributes nothing. That is honest: a read-back that
 * failed soft leaves no sentence, and inventing one from the recipe's own ask
 * would file what we asked for as though it were what we got.
 *
 * # A slot with no words at all is not filed
 *
 * The row would say nothing and carry nothing — a version bump asserting that a
 * feature exists, which the catalogue already says for free. The refusal matters
 * because it is the difference between a library that grows when a face changes
 * and one that grows when a request happens.
 */
import { FACET_SLOTS, facetsOfSlot, slotsForFacet, slotSpecFor } from "./referenceSlotCatalogue";
import { captionWording, type RealizationCaptions } from "./realizationCaption";
import type { SlotSpec } from "./referenceMint";
import type { Facet } from "./refineFacets";

export type MintedSlotsInput = {
  /** The facets this render wrote, verified and did not carry. */
  earned: readonly Facet[];
  /**
   * The landed render's read-back, by facet — carried facets included.
   *
   * A caption is prose read off the frame OR a pin chosen from a vocabulary, and
   * `captionWording` is the one function that turns either into its sentence.
   * Reading `.wording` here would be a second answer to *what does this caption
   * say*, and the pinned kind would arrive in the library as `[object Object]`.
   */
  captions: RealizationCaptions;
  /**
   * What the instruction said the worn object IS, through the shared table's
   * longest-match rule (`accessoryKindOf`).
   *
   * Derived once by the caller and passed, never re-derived here: the harvest,
   * the segment cutter and this all have to name the same kind of object, and
   * three derivations of one string is how they come to disagree about whether
   * an ask was about ears or eyes.
   */
  accessoryKind?: string | null;
};

export type MintedSlotsResult = {
  slots: SlotSpec[];
  /**
   * Facets that earned something and had nowhere to put it, with the reason.
   *
   * Returned rather than swallowed: a facet the library cannot file is a feature
   * the panel will never show, and an unowned axis falls silently to the loudest
   * prior on every tile at once. The caller logs these.
   */
  unfiled: Array<{ facet: Facet; reason: UnfiledReason }>;
};

/**
 * Why a facet that earned something filed nothing.
 *
 * `notASlot` is a DECIDED absence — makeup rides the anatomy it is worn on, an
 * expression is presentation rather than identity. `unnamedObject` is a thing
 * she is visibly wearing that the placement table cannot name, and it is the
 * only one of these that is owed work. `uncataloguedFeature` should be
 * unreachable (the totality test pins every facet's feature to an entry) and
 * exists so that a catalogue edit which breaks it is diagnosable rather than
 * quietly wearing another reason's label. `noWords` is a read-back that failed
 * soft, which costs later precision and nothing today.
 */
export type UnfiledReason = "notASlot" | "unnamedObject" | "uncataloguedFeature" | "noWords";

function unfiledReasonFor(facet: Facet): UnfiledReason {
  const assignment = FACET_SLOTS[facet];
  if ("notASlot" in assignment) return "notASlot";
  if ("family" in assignment) return "unnamedObject";
  return "uncataloguedFeature";
}

/**
 * The mint's slot list for one landed render.
 *
 * Slots come out in first-earned order and never twice: `hair.cut` and
 * `hair.colour` both land in `hair`, and the slot's stack already holds both
 * their captions, so a second entry would be the same words filed twice under
 * one key — two rows holding one fact at the door the mint checks digests at.
 */
export function mintedSlotsForRender(input: MintedSlotsInput): MintedSlotsResult {
  const slots: SlotSpec[] = [];
  const unfiled: MintedSlotsResult["unfiled"] = [];
  const seen = new Set<string>();

  for (const facet of input.earned) {
    const definitions = slotsForFacet(facet, { accessoryKind: input.accessoryKind });
    if (definitions.length === 0) {
      /* The reason comes from the ASSIGNMENT rather than from what the caller
         happened to pass, so a decided absence and an unnamed object never wear
         each other's label. */
      unfiled.push({ facet, reason: unfiledReasonFor(facet) });
      continue;
    }
    for (const definition of definitions) {
      if (seen.has(definition.slot)) continue;
      const facets = facetsOfSlot(definition.slot) ?? [];
      const words = facets
        .map((member) => captionWording(input.captions[member]).trim())
        .filter((caption) => caption !== "");
      if (words.length === 0) {
        unfiled.push({ facet, reason: "noWords" });
        continue;
      }
      const spec = slotSpecFor(definition.slot, words);
      if (spec === null) continue;
      seen.add(definition.slot);
      slots.push(spec);
    }
  }

  return { slots, unfiled };
}
