/**
 * WHERE ON A BODY A THING IS ANCHORED, AND WHICH FRAMINGS SHOW THAT PLACE —
 * P2, split into the half a model may answer and the half code derives
 * (`OPEN_KIND_PROPERTIES_DESIGN.md` §5 and §9, ruled fable-897 §3).
 *
 * # The finding this module exists because of
 *
 * P2 was designed as one boolean per kind — *"anchored outside the frame, does
 * it present inside it?"* — with `nails on a waist-up framing` as its control.
 * **Both of those sentences contain a framing, and the store holds one row per
 * kind.** The premise was checked before the prompt was written, and the product
 * has EIGHT framings, not one:
 *
 * ```
 * the refine road   waist-up, mid-torso up in a 2:3 portrait
 *                   (`cohortPhotorealHuman` FRAMING — and `castingFrame.ts`
 *                    leans on exactly this: one framing, one answer, no read)
 * a signed cast     closeUp      eyebrows-to-chin
 *                   frontClose / threeQuarter / sideClose   head-and-shoulders
 *                   frontFull / backFull / sideFull         head to feet
 * ```
 *
 * So *does a tail present in the frame* is **no** on the road that paints it and
 * **yes** on the full-length views a Cast is signed into. One boolean forces one
 * of those answers onto the other seven, and the place it would surface is the
 * founder's own obligation court — sign a cast holding an invisible fact and look
 * at the frames.
 *
 * # So the model answers the KIND and the code answers the FRAME
 *
 * The per-kind fact is *where is this thing anchored* — genuinely about the noun,
 * stable forever, and answerable WRONG in an obvious way, which is what a control
 * needs (`nails → hands`, not `nails → head`). The per-frame fact is derived from
 * a table here, with no model in the loop, and it can be re-derived for a framing
 * nobody has shipped yet.
 *
 * That is the same shape as `castingFrame.ts`'s `OUT_OF_FRAME`, generalized to a
 * kind that has no facet — and it is one fewer model opinion inside the product.
 *
 * # WHY IT LIVES IN `shared/`
 *
 * Two readers need the vocabulary and they sit on opposite sides of the schema:
 * `drizzle/schema.ts` derives the `anchorRegion` enum from it, and the casting
 * code reads it. A vocabulary imported by the schema cannot live under `server/`
 * without inverting the dependency every casting module already has. The copy
 * that one day tells a customer WHICH views their ask will show in is the third
 * reader, and it is client-side.
 *
 * # THE TABLE IS TOTAL, and that is the tripwire
 *
 * `castingFrame.ts` declares its own shortcut and pins it with a test against the
 * roll prompt. The equivalent here is stronger, because the risk is a NEW VIEW
 * rather than a new roll: {@link PRESENTS_IN} is a total `Record` over every
 * framing, so an angle added to `CAST_VIEW_ANGLES` **does not compile** until
 * somebody decides what it shows, and `bodyAnchorRegions.test.ts` asserts the
 * totality as well in case the type is ever widened.
 *
 * # WHICH WAY THE MARGINAL CALLS GO, and why
 *
 * A region that is *partly* in shot presents — the wings case, anchored at the
 * shoulder blades and reaching past every crop. Where it is genuinely marginal
 * the answer here is **no**, and the reason is a money one: the founder ruled
 * that nothing refuses on visibility (fable-869 §2) and that an invisible-now ask
 * is accepted FREE (fable-876 §1). So a wrong `true` charges 25 credits for a
 * render that returns the picture she already had; a wrong `false` gives away
 * something we could have sold. The first is worse, so marginal reads as absent.
 */
import { CAST_VIEW_ANGLES, type CastViewAngle } from "./boardTypes";

/**
 * The closed list of places a thing can be anchored.
 *
 * CLOSED and pinned (fable-897 §3a): the reader may not invent anatomy, so a
 * reply outside this list is refused rather than folded into the nearest member.
 * Eight entries, chosen so that each one is a different answer in at least one
 * framing — a distinction that never changes any framing's answer would be a
 * finer vocabulary with no consequence, which is a reader asked to be precise
 * about something nobody can check.
 */
export const BODY_ANCHOR_REGIONS = [
  /** On or in the head and face — horns, fangs, cat ears, a halo. */
  "head",
  /** The neck and throat — gills. */
  "neck",
  /** Shoulders to waist, front or back — wings anchor at the shoulder blades. */
  "torso",
  /** The upper limbs to the wrists. */
  "arms",
  /** Hands and fingers — where nails are, and where a waist-up frame ends. */
  "hands",
  /** Hips, legs and everything below the waist — a tail. */
  "belowWaist",
  /** Feet and toes. */
  "feet",
  /** Spans the body rather than sitting anywhere — scales, fur, a tan. */
  "wholeBody",
] as const;

export type BodyAnchorRegion = (typeof BODY_ANCHOR_REGIONS)[number];

/** Whether a string is one of the eight — the reader's own door. */
export function isBodyAnchorRegion(value: string): value is BodyAnchorRegion {
  return (BODY_ANCHOR_REGIONS as readonly string[]).includes(value);
}

/**
 * Every framing this product can produce.
 *
 * `master` is the refine road's own — `cohortPhotorealHuman`'s *"waist-up, from
 * mid-torso up in a 2:3 portrait"*, which is the frame every paid edit is
 * painted into. The rest are the Cast package's views, taken from
 * `CAST_VIEW_ANGLES` rather than retyped, so a view added there arrives here as
 * a compile error instead of a silent default.
 */
export type AnchorFraming = "master" | CastViewAngle;

/** The framings, in the order a reader wants to see them. */
export const ANCHOR_FRAMINGS: readonly AnchorFraming[] = ["master", ...CAST_VIEW_ANGLES];

/**
 * WHICH REGIONS EACH FRAMING SHOWS.
 *
 * A total record on purpose — see the header's tripwire note. Each entry's
 * comment quotes the framing it is derived from, so the day a view's spec is
 * rewritten the row beside it is checkable rather than folklore.
 */
const PRESENTS_IN: Record<AnchorFraming, readonly BodyAnchorRegion[]> = {
  /* "waist-up … from mid-torso up in a 2:3 portrait" — arms are in shot to about
     the elbow; the hands are where this crop ends, which is the `nails` case the
     design note used as its control. */
  master: ["head", "neck", "torso", "arms", "wholeBody"],
  /* "no tighter than eyebrows-to-chin, no looser than forehead-to-chin … a
     margin of skin visible BELOW the chin". The neck is that margin at most, so
     it reads as absent by the marginal rule. */
  closeUp: ["head", "wholeBody"],
  /* "a head-and-shoulders portrait … the whole hair silhouette inside the frame".
     The shoulder blades are in shot, so `torso` presents; the arms are the
     marginal call and go the safe way. */
  frontClose: ["head", "neck", "torso", "wholeBody"],
  /* "a head-and-shoulders portrait with the head turned about 45 degrees". */
  threeQuarter: ["head", "neck", "torso", "wholeBody"],
  /* "a head-and-shoulders TRUE side profile — the face turned a full 90 degrees". */
  sideClose: ["head", "neck", "torso", "wholeBody"],
  /* "the whole body from the top of the hair to the feet". */
  frontFull: [...BODY_ANCHOR_REGIONS],
  /* "the whole body in a walking stride, seen from the side — head to feet". */
  sideFull: [...BODY_ANCHOR_REGIONS],
  /* "the whole body seen from directly behind, head to feet inside the frame". */
  backFull: [...BODY_ANCHOR_REGIONS],
};

/**
 * Does a thing anchored HERE present in THIS framing?
 *
 * The whole of P2, derived — no model call, no vision read, and re-derivable for
 * any framing that ships later. What it does NOT answer is whether the thing is
 * VISIBLE in a delivered photograph: that is D2, it is a fact about a picture,
 * and this program's rule is that such facts are READ rather than inferred from
 * geometry (`OPEN_KIND_PROPERTIES_DESIGN.md` §2). This answers the prospective
 * question only — may this ask be served on this framing at all.
 */
export function anchorPresentsIn(region: BodyAnchorRegion, framing: AnchorFraming): boolean {
  return PRESENTS_IN[framing].includes(region);
}

/**
 * The framings a thing anchored here does NOT present in.
 *
 * Returned as the list rather than a count, so the copy that tells a customer
 * *where* their ask will show can name the views instead of hedging.
 */
export function framingsWithout(region: BodyAnchorRegion): AnchorFraming[] {
  return ANCHOR_FRAMINGS.filter((framing) => !anchorPresentsIn(region, framing));
}
