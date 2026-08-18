/**
 * WHERE A TATTOO MAY GO ON THIS PRODUCT'S PHOTOGRAPH — the placement
 * vocabulary, V3(b) step 2, with its frame gate (step 1a) derived rather than
 * mirrored.
 *
 * # It is three entries because the photograph is small, not because we are shy
 *
 * `V3B_PLACEMENT_VOCABULARY_READING.md` opened sixteen production masters at
 * full resolution before buying a single model call, and the inventory of bare
 * skin below the jaw in a casting frame is:
 *
 * ```
 * neck                  every frame
 * upper arm             a sliver below the sleeve, at the bottom corners
 * upper chest           on a SCOOP neckline only — covered on a crew neck
 * ```
 *
 * Sixteen of sixteen masters are cropped ABOVE THE ELBOW and sixteen of sixteen
 * wear the roll prompt's own uniform (`cohortPhotorealHuman.ts`: *"a simple
 * crew-neck tee or plain shirt"*). Forearm, wrist, hand, ribs, upper back and
 * shoulder blade are either below the crop line or under the tee.
 *
 * # THE WORD IS THE THING — surfaces, never bones
 *
 * Twelve reads on a bare (scoop) frame with a covered (crew) frame as the
 * negative control: `collarbone`, `collarbones`, `clavicle` and `decolletage`
 * read NOTHING on skin that was bare, unoccluded and plainly visible.
 * `upper chest` found it exactly, and correctly refused on the covered frame.
 * SAM 3 segments visible surfaces, not landmarks — so {@link readerWord} is a
 * measured value, not a label somebody liked.
 *
 * # TWO GATES, TWO JOBS, AND ONLY ONE OF THEM CAN FIRE TODAY
 *
 * This module holds both, and the difference is the whole design:
 *
 *   the VOCABULARY gate    fires constantly — a placement outside the closed
 *                          list is refused, whatever a reader would say about
 *                          it
 *   the FRAMING gate       DERIVED from `shared/bodyAnchorRegions.ts`, total
 *                          over every framing the product can produce — and it
 *                          **refuses nothing today**, because all three
 *                          measured placements sit in regions the master frame
 *                          shows
 *
 * That second sentence is declared rather than discovered, because a gate that
 * cannot fail on today's data is how a control quietly stops being one. It
 * exists so the vocabulary cannot LATER grow an entry the framing table says is
 * absent, and its negative control is driven directly on
 * {@link anchorAvailability} — `belowWaist` refused on `master`, admitted on
 * `frontFull` — where a refusal is reachable.
 *
 * **And the derivation is NECESSARY, NOT SUFFICIENT.** The region vocabulary
 * has eight members, which is coarser than the failure it would have to catch:
 * `forearm` lives in `arms`, and `arms` presents on the master framing. A pure
 * derivation therefore ADMITS the exact word that returned upper-arm skin from
 * the opposite side of the body, confidently labelled forearm, on three frames
 * of four. What refuses `forearm` is the closed list. Anyone who deletes the
 * list because "the derivation covers it" has re-opened the measured failure.
 *
 * # WHAT THIS IS NOT
 *
 * It is **not** `server/castingV2/inkPlacement.ts`. That module reads a
 * customer's SENTENCE on the refine road and decides whether stated ink can be
 * rendered from words alone (D-133(a): face and neck, today). This one is a
 * closed vocabulary of BODY sites that a reference-guided tattoo can be
 * attached to — chosen, never parsed. The two roads are untouched by each other
 * on purpose: retiring the words-rendered road removes a paid capability and is
 * a founder-adjacent decision, not a side effect of this file existing.
 *
 * # WHY IT LIVES IN `shared/`
 *
 * Same reason as `bodyAnchorRegions.ts`, which it is derived from: the schema
 * needs the vocabulary to type the column an upload records its placement in,
 * and a vocabulary imported by the schema cannot live under `server/`. The
 * picker that shows a customer the three names is the third reader, and it is
 * client-side — {@link InkPlacementEntry.noun} is COPY, not an identifier.
 */
import {
  anchorPresentsIn,
  type AnchorFraming,
  type BodyAnchorRegion,
} from "./bodyAnchorRegions";

/**
 * The closed list, in the order a customer reads them — top of the body down.
 *
 * CLOSED, and the closure is the load-bearing part. Adding a member is a claim
 * that the photograph contains it, and that claim is made the way this list was
 * made: frames opened first, then a reader asked, then the word checked against
 * a covered control. A segmenter read alone is not that proof — it is the thing
 * the reading was written to disqualify.
 */
export const INK_PLACEMENTS = ["neck", "upperArm", "upperChest"] as const;

export type InkPlacement = (typeof INK_PLACEMENTS)[number];

/** Whether a placement comes in a matching pair, or is one thing. */
export type InkPlacementSides = "one" | "perSide";

/**
 * Whether bare skin is there in every frame, or only when the garment allows.
 *
 * `dependsOnGarment` is not a hedge — it is the reading's §6.4 finding, that
 * the same placement is available on a scoop neck and absent on a crew neck in
 * the same product at the same moment. The reader answers that per frame, for
 * free, because it is already looking at the garment.
 */
export type InkPlacementSkin = "bare" | "dependsOnGarment";

export interface InkPlacementEntry {
  readonly key: InkPlacement;
  /** The customer's own words. Copy, shown in a picker and written into asks. */
  readonly noun: string;
  /** The word a segmenter is asked, measured to cut this surface. Never a bone. */
  readonly readerWord: string;
  /** Which of the eight anchor regions this surface belongs to. */
  readonly anchor: BodyAnchorRegion;
  readonly sides: InkPlacementSides;
  readonly skin: InkPlacementSkin;
}

const ENTRIES: Readonly<Record<InkPlacement, InkPlacementEntry>> = Object.freeze({
  /* 4/4 found, bare in every frame — the one placement with no condition. */
  neck: Object.freeze({
    key: "neck",
    noun: "her neck",
    readerWord: "neck",
    anchor: "neck",
    sides: "one",
    skin: "bare",
  }),
  /*
    4/4 found, and PARTIAL: what is in shot is the sliver below the sleeve at
    the bottom corners of the frame. It is per-side, and the side is the failure
    this road has already had — the legacy ink road refunded 300 credits twice
    for "wrong anatomical side" (DECISION_LOG R7-7G) and V2 measured the same
    thing independently three weeks later.
  */
  upperArm: Object.freeze({
    key: "upperArm",
    noun: "her upper arm",
    readerWord: "upper arm",
    anchor: "arms",
    sides: "perSide",
    skin: "bare",
  }),
  /*
    FOUND 2.69% on the bare scoop frame, and correctly nothing on the covered
    crew frame. The roll prompt asks for a crew neck, so the ordinary case is
    covered — which is why this one goes to the occlusion door rather than being
    dropped from the vocabulary. A covered chest is a different garment away.
  */
  upperChest: Object.freeze({
    key: "upperChest",
    noun: "her upper chest",
    readerWord: "upper chest",
    anchor: "torso",
    sides: "one",
    skin: "dependsOnGarment",
  }),
});

/** Whether a string is one of the three. The upload path's own door. */
export function isInkPlacement(value: string): value is InkPlacement {
  return (INK_PLACEMENTS as readonly string[]).includes(value);
}

export function inkPlacementEntry(key: InkPlacement): InkPlacementEntry {
  return ENTRIES[key];
}

/**
 * Whether an ask about this surface can be served on this framing at all.
 *
 * Three answers rather than two, because the two ways a surface can be missing
 * are not the same sentence to a customer and are not the same door in the
 * code:
 *
 *   available     the frame shows this region
 *   outOfFrame    the camera did not take it — only a different photograph
 *                 answers this (the fifth refuse-before-dispatch door)
 *   mayBeCovered  the frame shows the region and a garment may be over it —
 *                 D-226's door, answered per frame by a read, and answerable
 *                 by a different top rather than a different shoot
 */
export type InkPlacementAvailability =
  | { kind: "available" }
  | { kind: "outOfFrame"; what: string }
  | { kind: "mayBeCovered"; what: string };

/**
 * The derivation, on the region rather than the placement.
 *
 * Exported because it is the only place the framing gate can be proven to
 * REFUSE: every member of the vocabulary above is in frame on the master, so
 * driven through {@link inkPlacementAvailability} this branch is unreachable
 * today. Given a region and a framing it is total, and it agrees with
 * `anchorPresentsIn` by construction rather than by a second table.
 */
export function anchorAvailability(
  anchor: BodyAnchorRegion,
  framing: AnchorFraming,
  what: string,
): InkPlacementAvailability {
  return anchorPresentsIn(anchor, framing)
    ? { kind: "available" }
    : { kind: "outOfFrame", what };
}

export function inkPlacementAvailability(
  key: InkPlacement,
  framing: AnchorFraming,
): InkPlacementAvailability {
  const entry = ENTRIES[key];
  const framed = anchorAvailability(entry.anchor, framing, entry.noun);
  if (framed.kind !== "available") return framed;
  /*
    Order matters and this is the reason: a region that is not in the picture
    cannot be occluded in it. The frame question is answered first, and only a
    surface the camera took is asked what is over it.
  */
  return entry.skin === "dependsOnGarment"
    ? { kind: "mayBeCovered", what: entry.noun }
    : { kind: "available" };
}
