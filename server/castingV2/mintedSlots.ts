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
 * # And one list beside it: what this render wrote and its own reader DISPUTED
 *
 * Those slots come out marked (`disputed`), and the mint treats a marked slot
 * completely differently — never stored, never filed as words, kept only as
 * pixels a human can look at to decide whether the painter or the reader was
 * wrong (fable-220 §3, `referenceMint`). This module's only job in that is to
 * name the slots and to settle the collision: **a slot reached by both lists is
 * earned.**
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
import {
  FACET_SLOTS,
  facetsOfSlot,
  slotsForFacet,
  slotSpecFor,
  slotsRemintedEveryRender,
  type SlotDefinition,
} from "./referenceSlotCatalogue";
import { captionWording, type RealizationCaptions } from "./realizationCaption";
import type { SlotSpec } from "./referenceMint";
import type { Facet } from "./refineFacets";

export type MintedSlotsInput = {
  /** The facets this render wrote, verified and did not carry. */
  earned: readonly Facet[];
  /**
   * The facets this render WROTE and its own reader then DISPUTED (fable-220 §3).
   *
   * `read && !verified && written && !carried` — the reader looked at the
   * delivered frame and said the change is not there. The render was delivered
   * and charged (D-187/D-246, untouched); what these slots come here for is
   * their PIXELS, because whether the painter failed or the reader did is a
   * question no instrument in this system can answer and a crop settles at a
   * glance.
   *
   * They are marked, never merged: the mint stores none of them and files words
   * for none of them. A slot that is both earned and disputed — `hair.cut`
   * verified, `hair.colour` disputed, one `hair` slot — is EARNED, because the
   * render did deliver something into it and the crop is certifiable.
   */
  disputed?: readonly Facet[];
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
/*
  `openKind` — DECLARED SCAFFOLDING, and it lands before anything can produce it.

  Nothing returns it today. The open lane's acceptance path and its slotless
  `Ask` are separate builds (OPEN_LANE_DESIGN_NOTE §8 steps 4–5) and are not
  started. The label is reserved here, with its reason, because of what it costs
  to add late.

  An open kind is a FOURTH situation and it must not wear `notASlot`'s label.
  `notASlot` means "this rides somewhere else, and here is where" — three decided
  absences, each with a written reason. An open kind means "nobody has catalogued
  this yet, and it may get its own slot when it promotes". Filed under the first,
  the second is invisible at exactly the place it exists to be seen: **the count
  of asks with nowhere to go is the promotion signal**, and it cannot be read out
  of a bucket that also holds three permanent residents.

  `openLaneKind.test.ts` holds the negative control that today's producer cannot
  emit it. The day the assembler files an open ask, reaching for `notASlot` is a
  visibly wrong choice rather than the only one available.
*/
export type UnfiledReason =
  | "notASlot"
  | "unnamedObject"
  | "uncataloguedFeature"
  | "noWords"
  | "openKind";

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

  /**
   * The slot's stack as this render leaves it, or null when nothing has ever
   * been said about it. Null is the honest state and it is not an error: it is
   * a slot whose feature the master alone still accounts for.
   */
  const stackOf = (definition: SlotDefinition): readonly string[] | null => {
    const members = facetsOfSlot(definition.slot) ?? [];
    const words = members
      .map((member) => captionWording(input.captions[member]).trim())
      .filter((caption) => caption !== "");
    return words.length === 0 ? null : words;
  };

  const file = (definition: SlotDefinition, words: readonly string[], disputed: boolean) => {
    const spec = slotSpecFor(definition.slot, words);
    if (spec === null) return;
    seen.add(definition.slot);
    slots.push(disputed ? { ...spec, disputed: true } : spec);
  };

  const collect = (facets: readonly Facet[], disputed: boolean) => {
    for (const facet of facets) {
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
        const words = stackOf(definition);
        if (words === null) {
          unfiled.push({ facet, reason: "noWords" });
          continue;
        }
        file(definition, words, disputed);
      }
    }
  };

  /*
    EARNED FIRST, AND `seen` IS WHAT MAKES THAT A RULE RATHER THAN AN ORDERING.

    Two facets of one slot can come back with different verdicts — the ask wrote
    both, the reader saw one land and not the other. The slot is then EARNED: a
    crop of it is a picture of a feature the render did change and the guard can
    certify, and marking it disputed would throw away a good reference over a
    disagreement about a neighbouring facet. Running `earned` to completion
    before `disputed` is looked at is the whole of that rule.
  */
  collect(input.earned, false);
  collect(input.disputed ?? [], true);

  /*
    AND THE SLOTS THAT ARE RE-CUT EVERY RENDER, whatever this one earned.

    `build`'s crop is a photograph of her torso IN WHATEVER SHE IS WEARING, so a
    crop kept across somebody else's clothing edit is a picture of last week's
    top labelled "the exact build she has, unchanged" (fable-424 §4). Re-cutting
    from the frame in hand is law 4 — a crop re-cut cannot be stale, where a
    persisted one is a copy drifting from its source.

    LAST, and `seen` is what makes that a rule rather than an ordering: a render
    that DID earn this slot has already filed it above, with its own verdict, and
    a disputed build must stay disputed. This pass only reaches a slot no facet
    of this render mentioned.

    A slot with no stack is skipped in SILENCE rather than reported unfiled: this
    is not a facet that earned something and had nowhere to go, it is a feature
    nobody has ever asked about — and the pristine master every render anchors on
    already carries it. There is nothing to preserve and nothing to report.
  */
  for (const definition of slotsRemintedEveryRender()) {
    if (seen.has(definition.slot)) continue;
    const words = stackOf(definition);
    if (words === null) continue;
    file(definition, words, false);
  }

  return { slots, unfiled };
}
