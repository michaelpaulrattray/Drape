/**
 * WHAT IS LEFT OF THE MASKED-EDITING MODULE — the segmenter contract, the
 * scope flag, and two small answers other roads still ask.
 *
 * This file was named for its harvest: the paid refine took the engine's whole
 * frame, kept only the pixels inside the region it had asked about, and pasted
 * them into an untouched master. #1577 slice 4b retired that paste road on the
 * founder's word (*"yes approve the plan and switch off the six settings"*), so
 * every refine repaints now. The harvest — with the fringe table, the territory
 * rule, the edge table and the reveal machinery that only it read — was then
 * deleted under #2859 on his word *"delete dead code"*. It is in git at the
 * parent of that commit; `refineService.ts` keeps the retirement record.
 *
 * Each thing that stays has a reader of its own today:
 *
 *   - `MASKED_EDITING_SCOPE` and `maskedEditingEnabledFor` — two reading
 *     branches in `refineService.ts`;
 *   - `RegionReader`, `SideRegions` and `PointerBox` — the segmenter contract
 *     every scan, mint and cutter is written against;
 *   - `refusingRegionReader` — the fallback when there is no `FAL_KEY`;
 *   - `regionNameOf` — which segmentation question a facet asks;
 *   - `additionDestination` — where an addition's site is;
 *   - `HarvestEvidence` — typed against by `inheritedVerdict.ts` alone, which
 *     is itself unreached (#2884).
 */
import { MaskError, unionMasks } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import type { Facet } from "./refineFacets";
import { FACET_CARD_ENTRIES } from "./facetCards";

/**
 * THE FLAG. **LIVE FOR THE FOUNDER'S ACCOUNT ONLY** (founder decision,
 * 2026-08-06, after the face wall passed).
 *
 * `users:1` — the sole admin, and the only account this path touches. Widening
 * to `all` is a separate founder decision after the walk, never a rider on this
 * one; that separation is the entire reason this is a scope rather than a
 * boolean.
 *
 * **The rollback is this line: set it back to `"off"`.** Nothing else has to
 * change, and every other user is already on that path.
 */
export const MASKED_EDITING_SCOPE = "users:1";

/** Is the masked path live for this user? Off means off for everyone. */
export function maskedEditingEnabledFor(userId: number | undefined): boolean {
  const scope = parseCastingV2Scope(MASKED_EDITING_SCOPE);
  if (scope.kind === "off") return false;
  if (scope.kind === "all") return true;
  return userId !== undefined && castingV2EnabledForUser(scope, userId);
}

/**
 * ONE BILATERAL REGION, AS TWO — each side a WHOLE-FRAME mask, so a caller that
 * holds one of them is holding it in the same coordinates as everything else it
 * owns and never has to know where the cut was made.
 *
 * The keys are the subject's own: `left` is HER left. Every instance key in the
 * library means the same thing (`referenceSlots`), the panel says "her left
 * earring", and the tilt reader has read the smaller x as her right eye since
 * long before this existed.
 */
export type SideRegions = { left: Mask; right: Mask };

/**
 * A RECTANGLE A POINTER PUT ROUND SOMETHING, in the asked picture's own pixels.
 *
 * Pixels and not fractions, for the reason every other geometry in this family
 * is in pixels: a mask comes back in the caller's pixel space, so a prompt in a
 * different space is one conversion away from the wrong-frame class. The reader
 * converts the detector's own normalised answer once, where the frame's size is
 * in hand, and never hands a fraction out.
 */
export type PointerBox = { x: number; y: number; width: number; height: number };

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /**
   * Everything the named region covers in this image.
   *
   * `absentIsAnswer` is the difference between *the model could not answer* and
   * *the answer is nowhere*, and conflating them is what made a removal
   * impossible. Asked of the MASTER for a region the record says is there, an
   * empty reply is a failed question and must refuse — composing on it would
   * deliver "nothing changed" at full price. Asked of the PAINTED frame after
   * *"take her glasses off"*, an empty reply is **the painter doing the job**,
   * and refusing it charges her for the picture she already had.
   *
   * The caller knows which of the two it is asking, so the caller says. Same
   * asymmetry D-235 drew for the reader's affirmatives: silence resolves in
   * whichever direction does not take the user's money, and which direction that
   * is depends on the question.
   */
  /*
    `imageUrl` — WHERE THESE EXACT BYTES ALSO LIVE, when they live anywhere.

    Optional, and it changes nothing about the answer: the mask still comes back
    in `image`'s pixel space, because that is the only space the caller has. It
    is a transport hint, so a reader that can send an address instead of a
    2.3 MB upload may do so — twelve questions about one photograph currently
    carry twelve copies of it (fable-358 §3).

    **A reader may only use it once it has proven the address holds these
    bytes.** Passing a URL that is nearly the frame — a thumbnail, a re-encode,
    last version's master — is the wrong-frame class, and the caller cannot be
    the one who guarantees it, because the caller is exactly who gets it wrong.
  */
  /*
    `axisKey` — WHOSE FACE THESE FRAMES ARE, when the caller knows.

    Optional, and it changes no answer: it names the CANDIDATE whose frames
    these are, so her vertical axis — the face read a bilateral question needs
    before it can cut the picture in half — is read once for that face instead
    of once per frame.

    Measured before it was allowed: across a candidate's whole chain her midline
    moves **0.3px in 1024** (0.031% of the width), and 0.1px on the founder's own
    cast, against a face read that costs 13.7 seconds of the ~23 a bilateral
    region takes. The cut it decides is a half-frame split, and no feature is a
    third of a pixel wide.

    It is an APPROXIMATION and is declared as one: a cached axis is a claim
    about a frame it was not read from. Omit it and every frame reads its own,
    which is what this did before.
  */
  /*
    `signal` — GIVE THE SLOT BACK WHEN THE CALLER HAS STOPPED WAITING (#1781).

    A caller with a deadline of its own — the view judge's framing measurement
    is the one that has one — abandons the promise when the bound passes, and
    without this the call keeps running and keeps one of the reader's five
    `FAL_CONCURRENCY` slots until the transport gives up at ~300 s. Every region
    read in the product queues behind the same pool, so a hung read on one view
    is a scan on another view waiting for it.

    Optional on purpose: a caller with no deadline has nothing to cancel, and
    the readers that take one say so in their own code rather than passing
    `undefined` to look diligent.

    ⚠ **A READER MAY DECLINE TO FORWARD IT ON A SHARED READ, AND THE PRODUCTION
    ONE DOES.** `falRegionReader` memoises the face-axis read and the
    frame-address check across callers; cancelling one of those on one caller's
    deadline would abort a read somebody else is waiting on, which is worse than
    the slot it frees. The rule it applies, stated there: a read made FOR ONE
    CALLER takes that caller's signal, a read SHARED between callers keeps the
    reader's own.
  */
  region(input: {
    image: Buffer;
    name: string;
    absentIsAnswer?: boolean;
    imageUrl?: string;
    axisKey?: string;
    signal?: AbortSignal;
  }): Promise<Mask>;
  /**
   * THE SAME REGION WITH ITS TWO SIDES STILL APART — optional, and the option
   * is the point.
   *
   * A bilateral region is read one side to a picture already; `region` unions
   * the two before anyone else sees them, and that union is why nothing per-side
   * can be cut. A crop of both her earrings filed as `earring@left` scores 100%
   * against the union it was cut from — the wrong-boundary class, wearing a
   * number.
   *
   * It is a SECOND METHOD rather than an option on `region` because an option
   * that changes the return shape makes every caller carry both types forever
   * (fable-211). Being optional is what keeps the honest fallback honest: a
   * reader without this capability produces a REFUSAL with the true reason, and
   * never a guessed split.
   *
   * `null` means *this name has no sides for me* — asked of a nose, or of a
   * frame too narrow to cut — and costs nothing. It is not "there is none here";
   * that answer is two empty masks, and only when `absentIsAnswer` says so.
   *
   * The keys are ANATOMICAL: `left` is her left, which in a frame she faces the
   * camera in is the image's right half.
   *
   * ⚠ **ONE SIDE IS ONE ANSWER ON THE CROP ROAD, AND A SIDE CAN WEAR TWO
   * THINGS — MEASURED, #2811, 2026-10-30.** The crop road asks each half for a
   * single instance, so where a side wears two of something the mask holds one
   * of them. Driven on a cast with several earrings in one ear, through the
   * product's own midline: asked the way this road asks, the image-left half
   * answered **one** earring (1,500px at 1024, 513px at 598); asked for several
   * on the same half it answered **two and three** — the same first mask plus a
   * 334px piece at 1024, plus 109px and 85px pieces at 598 — and the other half
   * gained a 144px piece sitting higher up the ear. A second cast with one hoop
   * a side answered one both ways, which is the control.
   *
   * ✅ **THAT MEASUREMENT RAN AND THIS ROAD NOW ASKS FOR EVERY INSTANCE — #2818,
   * 2026-10-30. The clause that stood here read *"Nothing is changed here on
   * that reading"*, and its reasoning is exactly why the repair is not the
   * one-line setting the card proposed.** A refine PAINTS on the mask it gets
   * back, so the question was whether a second instance on an `eyes` or
   * `eyebrows` half is a real second thing. Measured over **36 cells** — two
   * humans and a creature, `eyes` / `eyebrows` / `ear` / `horns`, one half at a
   * time at two sizes — **there is no second instance on any anatomy pair.**
   * The four extra masks that came back were the same feature outlined again,
   * and two of them LOOSER: unioned in, one eye would have gone from 1,042px to
   * 1,995px, which is the delivered picture this clause was protecting.
   *
   * **So the extras are judged at the pixels rather than by noun**: an extra is
   * kept only where it touches nothing already in hand. Every extra earring
   * shares ZERO pixels with the first (4 of 4); every anatomy extra is one
   * shape wholly inside the other (4 of 4). The rule lives in `askRegion`
   * (`falRegionReader.ts`), it reads the answer rather than a list, and it
   * costs no request — the instances arrive from the same call.
   */
  regionSides?(input: {
    image: Buffer;
    name: string;
    absentIsAnswer?: boolean;
    /** The same transport hint `region` takes, under the same proof. */
    imageUrl?: string;
    /** The same face hint `region` takes — and this is the road that pays for
     *  it, since a side read is what buys the axis in the first place. */
    axisKey?: string;
    /**
     * READ THIS NAME TWO-SIDEDLY THOUGH IT IS NOT IN THE CLOSED LIST — the open
     * lane's distributed kinds (the D1 wire, fable-1001).
     *
     * `null` for an unknown name is this method's honest default and stays the
     * default: a guessed split of a nose is exactly what it prevents. What this
     * says is that an INSTRUMENT — the locality classifier, prompt kp-2, three
     * disagreeing controls — has already answered the two-sidedness question for
     * a kind the reader's own vocabulary has never heard of. A reader without
     * the capability still answers `null`, and the caller still refuses rather
     * than guessing.
     */
    declaredTwoSided?: true;
    /**
     * THIS PAIR IS WORN ON THE EARS, so a piece of the answer that sits nearer
     * the middle of the face than its side is something else (#2781).
     *
     * The segmenter asked `earring` answered a SEPTUM RING too, on the
     * founder's own cast, and a ring on the midline is cut in half and handed
     * to both sides — so each side's rectangle ran from the ear to the nose. An
     * ear is at the side of the face, and that is a fact about what is being
     * read, so the CALLER says it and the reader keeps only the pieces that are
     * where an ear is. The face read that finds the midline already gives the
     * face's two sides, so it costs no request.
     *
     * Optional and off by default, on `pairInOneRead`'s own reasoning: the face
     * scan asks for it, and a masked refine — which PAINTS on what it gets back
     * — is left exactly as it was until it is measured on its own card.
     */
    onTheEars?: true;
  }): Promise<SideRegions | null>;
  /** A soft whole-subject matte, for edge ramps. `signal` as on `region`. */
  subject(input: { image: Buffer; signal?: AbortSignal }): Promise<Mask>;
  /**
   * WHERE A THING THE VOCABULARY HAS NEVER HEARD OF SITS — optional, and the
   * two halves of it are two methods for the reason `regionSides` is its own
   * method: a reader without the capability answers honestly rather than
   * guessing, and nothing downstream has to carry two return shapes.
   *
   * `pointer` asks an open-vocabulary DETECTOR for rectangles round a bare
   * noun. It is a third capability beside `region` and `landmark`, not a better
   * one, and #2532 measured exactly what it buys: `region` asked `jaw hardware`
   * returns nothing at all, `landmark` returns a point that grows into ONE of
   * the two tubes, and a rectangle carries the EXTENT that cuts both. Seven of
   * ten cells whole against the text road's three.
   *
   * ⚠ **AN EMPTY LIST IS THE ABSENCE ANSWER, AND IT IS THE ONE THE POINTER ROAD
   * RESTS ON.** On all three of that bench's negative controls — goggles,
   * horns, glasses, each verified absent by eye at the frame first — the
   * detector returned nothing and the segmenter was never called. That matters
   * because `region`'s own absence reading is unsafe for a word with a lookalike
   * in frame (the departure-gate substitution: `eyebrows` on a browless ridge
   * came back with two perfect brow shapes, outscoring both present arms). The
   * detector answering nothing is a different instrument answering, not the same
   * one asked more politely. Three cells is a floor, not a guarantee.
   *
   * It THROWS on a transport failure, the way `region` does, and returns an
   * empty list for *nothing there*. The two are not the same answer and a
   * caller that cannot tell them apart would file a missing row as an absence.
   */
  pointer?(input: {
    image: Buffer;
    name: string;
    imageUrl?: string;
    signal?: AbortSignal;
  }): Promise<readonly PointerBox[]>;
  /**
   * THE REGION INSIDE ONE RECTANGLE — the pointer road's second half.
   *
   * ⚠ **ONE BOX PER CALL, AND THAT IS A MEASUREMENT RATHER THAN AN INTERFACE
   * CHOICE.** The obvious shape is a `boxes` array, because the detector
   * returns a list and the segmenter's own schema takes one. #2532 drove it:
   * sending several boxes does not COMBINE them, it switches which object comes
   * back — two boxes on the jaw moved the cut from the right tube to the left,
   * and on a three-eyed cast the detector's three boxes made the segmenter cut
   * a NORMAL eye, turning a right answer wrong. The segmenter reads several
   * prompts as hints toward ONE object. So the array cannot be offered: a caller
   * that wants two instances makes two calls, and the type says so.
   *
   * `name` is carried for the log and the census alone — the rectangle is the
   * question. `null` is *the segmenter returned no mask for that rectangle*,
   * which is a real outcome and never an exception.
   */
  regionInBox?(input: {
    image: Buffer;
    name: string;
    box: PointerBox;
    imageUrl?: string;
    signal?: AbortSignal;
  }): Promise<Mask | null>;
  /**
   * ONE SIDE OF AN EAR-WORN PAIR, LOOKED FOR WITH THE DETECTOR (#2800).
   *
   * For a pair whose segmenter answer held one side and not the other: the
   * detector is asked for the noun, only a rectangle where THIS side's ear is
   * is cut, and the cut is judged exactly as the pointer road judges one —
   * refused for having no pixels or for missing the rectangle that asked, with
   * **how much of that rectangle it filled measured and logged and never
   * refused on** (#2831; a thin hoop is the shape a fill bar refuses). The
   * face scan asks it, after its own second look has also come back
   * one-sided, and only of a pair worn on the ears — a refine never does.
   *
   * `side` is anatomical, as `regionSides`' keys are. `null` is *nothing to
   * keep there*, and a transport failure THROWS, as `pointer` does.
   */
  sideByDetector?(input: {
    image: Buffer;
    name: string;
    side: "left" | "right";
    imageUrl?: string;
  }): Promise<Mask | null>;
  /**
   * ONE SIDE OF A PAIR, READ FROM A PICTURE CONTAINING ONLY THAT SIDE (#2802).
   *
   * The second look a half-answered pair gets is only worth its read if it is a
   * DIFFERENT question from the one that came back blind. Asked of the whole
   * picture — which is how production reads a pair now — it is not: measured on
   * the founder's own cast, the pair road answered nothing on either side on 10
   * of 10 draws, while the same frame cut in half answered both ears on 10 of
   * 10. So the caller that is healing a blind side asks for that side's own
   * half-picture instead of asking the whole frame again.
   *
   * It is the SAME price as the re-ask it replaces — one segmenter read — and
   * on a reader already reading a side at a time it is the same question that
   * reader's second look asks today, at half the calls.
   *
   * `side` is anatomical, as `regionSides`' keys are. `null` is *nothing to
   * keep on that side*, and a name the reader does not read two-sidedly answers
   * `null` before any call is spent — a caller that cannot have this must fall
   * back to its own road rather than treating `null` as an absence.
   */
  sideByCrop?(input: {
    image: Buffer;
    name: string;
    side: "left" | "right";
    imageUrl?: string;
    /** The same face hint `regionSides` takes, under the same proof. */
    axisKey?: string;
    /** The same ear rule `regionSides` takes (#2781), so the heal judges the
     *  answer the panel will draw. */
    onTheEars?: true;
  }): Promise<Mask | null>;
  /**
   * WHERE A THING WOULD BE, even when nothing can see it.
   *
   * A different capability from segmentation, not a worse one. A segmenter
   * answers *where is this in the picture* and returns nothing at all when hair
   * covers the ear; a landmark model answers *where is the ear on this face* and
   * still answers. That distinction is D-213's sibling, and it is the whole
   * reason an addition can be placed at all.
   */
  landmark(input: { image: Buffer; name: string }): Promise<{ x: number; y: number }[]>;
};

/**
 * WHAT A COMPOSITE CAN PROVE ABOUT ITSELF — one shape, one name, one place.
 *
 * ⚠ **ITS PRODUCER IS GONE.** The masked-edit harvest that built this shape was
 * deleted under #2859. It stays only because `inheritedVerdict.ts` still types
 * against it, and that module is itself unreached — filed as #2884 rather than
 * taken here. The prose below describes the road as it ran.
 *
 * It has a name because it is PASSED THROUGH three layers and rebuilt in one of
 * them, and a rebuild that re-lists its own fields is the copy that drifts
 * (working law 4). `assembleWithCarriedSegments` re-listed two of three, so
 * `deliveredRegions` was dropped on exactly the renders that carried a segment
 * — the delivered-anchored cut silently inert on the second edit of any face,
 * while every test and every type still read green.
 */
export type HarvestEvidence = {
  /** Where the composite was allowed to differ from the master. */
  applied: Mask;
  /**
   * The geography of this render, by the question that produced it.
   *
   * Two kinds of answer live in one map, and the difference is stated here
   * rather than left to be inferred:
   *
   * - **Segmented** — a region the reader drew on the MASTER. The great
   *   majority, and what the name has always meant.
   * - **PLACED** — an addition's destination corridor, which no reader could
   *   have drawn because the thing was not there yet (D-213). Filed under the
   *   accessory's kind id, which is the same string the segmenter would be
   *   asked if the thing already existed (`LANDMARK_OF_ACCESSORY.region`).
   *
   * The second kind is why accessories could never be kept. The corridor was
   * built, unioned into the zone and then dropped on the floor, so the segment
   * cutter — which looks a facet's ground up in this map by NAME — found
   * nothing for `statedAccessories` and filed nothing, on every face, on every
   * render this campaign has paid for.
   */
  masterRegions: ReadonlyMap<string, Mask>;
  /**
   * WHERE THE THING IS NOW — the same questions, asked of the DELIVERED frame.
   *
   * The silhouette half of `own(facet) = applied ∩ (region(delivered) ∪
   * region(master))`. A master-anchored segment can only ever keep the ground
   * the thing used to occupy, and the things a customer buys live where the
   * master has nothing: hair worn down lives on her shoulders, and her
   * master's hair region is a bun. Measured on the founder's own v#163 — the
   * store kept 100% of what it was given and **10% of what she bought**.
   *
   * # It costs no vision call, and that is not luck
   *
   * The harvest already asks this exact question for its own content gate
   * (`regionOf("painted", …)`, one call per question, memoised). Until this
   * map existed the answer was computed, used once and dropped for every
   * ordinary region. This is the same read, kept.
   *
   * # Why it is a SECOND map rather than a wider `masterRegions`
   *
   * `masterRegions` has another consumer: `detailForVerification` cuts the
   * reader's magnified crop from it. Folding the delivered extent in would
   * move the box a stochastic reader is shown on a paid render, as a side
   * effect of a change to the STORAGE path. Two questions, two meanings, two
   * maps; the segment cutter is the only thing that unions them.
   *
   * Absent, or missing a name, means the delivered read did not settle — and
   * a claim is never built on a reading that did not happen (design rule 2).
   */
  deliveredRegions?: ReadonlyMap<string, Mask>;
  /**
   * THE BILATERAL NAMES WITH THEIR TWO SIDES STILL APART, on each frame.
   *
   * The same reads as the two maps above, kept instead of merged: the union in
   * `masterRegions` is what the composite works on, and the split is what a
   * per-instance library slot has to be cut from. Both come out of one set of
   * calls, so this costs no vision call — it is `deliveredRegions`' own bargain
   * one question over.
   *
   * A name appears here only when the reader can answer two-sidedly; anything
   * else is simply absent, which is what the mint reads as *no side to cut* and
   * files as words. There is no entry meaning "we guessed".
   */
  masterSideRegions?: ReadonlyMap<string, SideRegions>;
  deliveredSideRegions?: ReadonlyMap<string, SideRegions>;
};

/**
 * WHICH SEGMENTATION QUESTION A FACET ASKS.
 *
 * Deliberately small and explicit rather than derived from the facet id: the
 * words here are sent to a segmentation model, and D-213 is that a segmenter is
 * never asked an open question. A facet with no entry has no masked path and
 * says so, rather than having a prompt invented for it.
 */
const REGION_OF_FACET: Partial<Record<Facet, string>> = Object.fromEntries(
  FACET_CARD_ENTRIES
    .filter(([, card]) => card.region !== null)
    .map(([facet, card]) => [facet, card.region as string]),
);

export function regionNameOf(facet: Facet): string | null {
  return REGION_OF_FACET[facet] ?? null;
}

/** A filled disc at a normalised point — the unit an addition is built from. */
function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/**
 * THE DESTINATION FOR AN ADDITION — a corridor per landmark, conservative on
 * purpose.
 *
 * The extent comes from the described object, and this deliberately does not try
 * to be clever about it: a stud is a disc at the lobe, a drop hangs below it.
 * The smaller guess was safe because the masked-edit harvest grew it by
 * boundary-contact auto-expand whenever paint pressed against the edge. That
 * harvest is deleted (#2859), and the one caller left — `invisibleRemoval.ts` —
 * asks only where the SITE is, with no drop and no paint to grow toward.
 *
 * **Scale comes from the face, never from a number somebody liked.** The distance
 * between the two landmarks is the head's width at that feature, so a stud is a
 * fraction of it on any face at any framing.
 */
export function additionDestination(input: {
  landmarks: { x: number; y: number }[];
  width: number;
  height: number;
  /** How far the object hangs below its anchor, in multiples of its own radius. */
  dropSteps?: number;
}): Mask {
  if (input.landmarks.length === 0) {
    throw new MaskError("an addition needs a landmark to be placed against — none was returned");
  }
  const { width, height, landmarks } = input;
  const span = landmarks.length > 1
    ? Math.hypot((landmarks[0].x - landmarks[1].x) * width, (landmarks[0].y - landmarks[1].y) * height)
    : Math.min(width, height) * 0.25;
  const radius = Math.max(4, span * 0.035);
  const steps = input.dropSteps ?? 0;
  const parts: Mask[] = [];
  for (const landmark of landmarks) {
    for (let step = 0; step <= steps; step += 1) {
      parts.push(discAt(
        { x: landmark.x, y: landmark.y + (step * radius * 1.4) / height },
        radius, width, height,
      ));
    }
  }
  return parts.length === 1 ? parts[0] : unionMasks(...parts);
}

/**
 * The reader a caller gets when there is no segmenter to give it.
 *
 * It refuses rather than returning an empty mask, because an empty mask reads
 * as "nothing is there" and the caller would act on an answer nobody gave.
 * Every caller reaches it the same way — as the fallback when `FAL_KEY` is
 * unset (`refineService.ts`, `inkDeliveryMint.ts`, `inkUploadService.ts`) — so
 * a keyless deployment refuses instead of building on silence.
 *
 * This docblock used to say that nothing reached it while the masked flag was
 * dark, because the masked-edit harvest returned before consulting a reader.
 * That harvest is deleted (#2859); the fallback above is the whole of its road.
 */
export const refusingRegionReader: RegionReader = {
  region: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  subject: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  landmark: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
};
