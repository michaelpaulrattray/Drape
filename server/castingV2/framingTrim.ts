/**
 * THE FRAMING TRIM — the arithmetic, and the only copy of it.
 * (Designed `docs/specs/CASTING_FRAMING_TRIM_BUILD.md`, countersigned
 * fable-1576, ordered fable-1574 on the founder's own eye.)
 *
 * A roll renders larger than it delivers, and every frame is trimmed to a COMMON
 * HEAD SIZE before it is stored. That is the whole of what makes two casts read
 * as framed alike — measured, across the founder's own two populations: the gap
 * between two sheets' median head share went **6.2pt → 0.9pt** under the clause,
 * against a 1.2pt run-to-run floor, and within-sheet wobble went 6.6–7.4pt →
 * 3.5/3.6pt.
 *
 * # `R` IS PER FRAME, AND THAT IS THE LOAD-BEARING DECISION
 *
 * A crop needs a headroom `R` — how much air sits above the face box, in
 * face-heights. A COMMON `R` has to clear every head (`R >= gap`) and fit inside
 * every frame (`R <= headroom`), so its feasible set is `[max gap, min headroom]`
 * — and across the court's own clause cells that interval is **EMPTY**: a
 * tall-curled woman needs `R >= 0.508` while the tightest-framed man can give at
 * most `0.352`. Dropping the single worst frame does not rescue it (0.359 against
 * 0.352). **No wording collapses it either** — arm V2 measured that, and the
 * engine is already obeying: not one delivered frame is clipped as rendered.
 *
 * **So `R` floats per frame and the question dissolves.** The condition becomes
 * per-frame — *can this frame hold its own hair* — which held on **31 of 31**
 * frames the court measured, with 0.088 face-heights of slack on the tightest.
 *
 * And it is the founder's own ontology rather than a workaround, verbatim:
 * *"frames do not need to be identical 100% just within a good boundary because
 * obviously different hair styles body types will always change the output
 * releative to the frame."* Head size consistent; headroom natural per person.
 *
 * # EVERY BRANCH ENDS IN A DELIVERED FRAME
 *
 * The trim is a courtesy on top of a frame the customer has already paid for and
 * received. A read that fails is OUR problem, not hers: she gets her frame
 * untrimmed, and nothing here can fail a candidate or create a refund path. Each
 * refusal names itself so the dark rolls can count it — the untrimmable rate is
 * what moves `T`, and it moves it on STRIPS, never on this arithmetic.
 *
 * **Never guess a gap.** No head read, no trim — an assumed clearance is how a
 * crown gets sliced, and the whole reason `R` is per frame is that hair height
 * is not predictable from anything else in the frame.
 *
 * # NO DELIVERED PIXEL IS EVER INVENTED
 *
 * A crop shorter than the delivered height would have to be upscaled. It cannot
 * happen at these sizes and it is refused anyway, because "cannot happen" is a
 * comment and `wouldUpscale` is a branch.
 */

/** A box as the region reader gives it. */
export type TrimBox = { left: number; top: number; width: number; height: number };

export type TrimTarget = {
  /** The common head share: face-box height ÷ frame height. */
  headShare: number;
  /** The house headroom floor, in face-heights. A frame may take MORE. */
  houseHeadroom: number;
  /**
   * Air above the topmost hair, in face-heights — the smallest that reads as
   * deliberate rather than as a near miss. A build constant: arbitrary within a
   * range, and the range is wide (0.088 of slack on the tightest frame measured).
   */
  clearance: number;
};

export type TrimInput = {
  frame: { width: number; height: number };
  /** The delivered frame. The crop is downscaled to this and never up. */
  deliver: { width: number; height: number };
  face: TrimBox | null;
  head: TrimBox | null;
  target: TrimTarget;
};

/** Why a frame is delivered as rendered rather than trimmed. Each is counted. */
export type UntrimmedReason =
  | "no-face"
  | "no-head"
  | "share-above-target"
  | "cannot-clear-hair"
  | "would-upscale";

export type TrimPlan =
  | {
    trim: true;
    crop: TrimBox;
    /** The headroom this frame actually gets — house floor, or its hair's need. */
    headroom: number;
    /** True when this frame needed more air than the house floor gives. */
    ownHeadroom: boolean;
  }
  | { trim: false; why: UntrimmedReason };

/**
 * Plan the trim for one delivered frame. Pure: no I/O, no clock, no randomness,
 * and it never throws — a frame it cannot plan is a frame it declines to plan.
 */
export function planFramingTrim(input: TrimInput): TrimPlan {
  const { frame, deliver, face, head, target } = input;

  if (face === null || face.height <= 0 || frame.height <= 0) return { trim: false, why: "no-face" };

  /*
    A crop only ever crops IN, so a frame whose head is ALREADY bigger than the
    target cannot reach it. It is delivered as rendered and counted: that rate is
    the first thing the dark rolls measure, and it is what moves `T`.
  */
  const share = face.height / frame.height;
  if (share > target.headShare) return { trim: false, why: "share-above-target" };

  /* NEVER GUESS A GAP. */
  if (head === null) return { trim: false, why: "no-head" };

  const faceHeight = face.height;
  const gap = (face.top - head.top) / faceHeight;
  const headroomAvailable = face.top / faceHeight;
  const needed = Math.max(target.houseHeadroom, gap + target.clearance);

  /*
    The frame cannot hold its own hair at the air we ask for: the crop line would
    start above the frame's own top edge. Delivered as rendered rather than with
    a sliced crown — the founder's condition, in his words: "just need to make
    sure the hair is fully in the image."
  */
  if (needed > headroomAvailable) return { trim: false, why: "cannot-clear-hair" };

  const cropHeight = Math.round(faceHeight / target.headShare);
  /* No delivered pixel is ever invented. */
  if (cropHeight < deliver.height) return { trim: false, why: "would-upscale" };
  const cropWidth = Math.round((cropHeight * deliver.width) / deliver.height);
  if (cropWidth > frame.width || cropHeight > frame.height) return { trim: false, why: "would-upscale" };

  /*
    ⚠ THE BOTTOM CLAMP IS SAFE AND THE FIRST VERSION OF THIS REFUSED IT.

    `top = faceTop − needed × faceHeight` can push the crop past the frame's
    bottom edge — most sharply on the BINDING frame, the one whose head share
    already equals the target, whose crop is the whole frame height and which
    therefore has to start at y=0. That version asserted instead of clamping, on
    the reasoning that a clamp "would silently deliver a different R than the one
    that cleared the hair". **That reasoning is wrong in one direction and the
    direction is the whole point:** fitting the bottom means moving `top` UP,
    which delivers MORE air above the hair, never less. A crown cannot be sliced
    by being given extra headroom.

    So it clamps downward and REPORTS the headroom actually delivered, rather
    than the one that was asked for. Found by driving the arithmetic on the
    court's own binding frame, which the assert-only version refused outright.
  */
  const wanted = Math.round(face.top - needed * faceHeight);
  const top = Math.max(0, Math.min(wanted, frame.height - cropHeight));
  /* Only an UPWARD move would cut into the hair, and it cannot happen here —
     asserted rather than assumed, because this is the branch a crown depends on. */
  if (top > wanted) return { trim: false, why: "cannot-clear-hair" };
  const headroomDelivered = (face.top - top) / faceHeight;

  /*
    THE HORIZONTAL IS CENTRED ON THE FACE, NOT ON THE FRAME. Measured on real
    frames the face centre sits up to ~42 px off the frame's middle on a
    1024-wide frame — 4% of the width, and plainly visible once the crop is
    narrower than the frame. Clamped, because a horizontal clamp costs a little
    off-centring and never a sliced head.
  */
  const faceCentre = face.left + face.width / 2;
  const left = Math.max(0, Math.min(Math.round(faceCentre - cropWidth / 2), frame.width - cropWidth));

  return {
    trim: true,
    crop: { left, top, width: cropWidth, height: cropHeight },
    /* What the frame ACTUALLY got, measured off the integer crop — so a caller
       logging it is logging pixels rather than an intention. */
    headroom: headroomDelivered,
    /* Whether this frame NEEDED more than the house floor. A question about the
       requirement, not about the rounding: `headroomDelivered` sits a fraction
       of a pixel either side of `needed`, and asking it here would make
       `ownHeadroom` flicker on frames that took the house floor exactly. */
    ownHeadroom: needed > target.houseHeadroom,
  };
}
