/**
 * THE OUTFIT PLATE — one render that decides what she is wearing, so the two
 * full-length views stop deciding it separately.
 *
 * # The defect this exists for
 *
 * A Sign renders five views independently from a CHEST-UP anchor. The anchor
 * shows no hem, no footwear and no back, so each full-length view invents the
 * bottom half of the outfit on its own: his own four fronts came back mini /
 * pencil / midi with boots / flats / boots. His words on #1278, verbatim:
 * *"the hem and shoes differ every take"*. Nothing in the product was broken —
 * three independent readings of an open brief are three different outfits, and
 * that is what independence MEANS.
 *
 * # His design — path E, ruled 2026-09-29 (terminal), pasted verbatim on #1278
 *
 * > Close-ups / head-shoulder views start immediately in parallel on Nano
 * > Banana Pro 2K (master + brief). No plate wait.
 * > In parallel: one Sunburst high generation — a 2-panel ephemeral outfit
 * > plate (frontFull + backFull cameras in one image). Split in memory. Not
 * > stored as a looks/library card.
 * > When the plate lands: frontFull and backFull on NBP 2K at full Sign size,
 * > references = master + plate panel (+ brief), in parallel.
 * > Plate fails/times out → still run front/back on NBP master-only (Sign
 * > completes; softer consistency).
 * > Plate is Sign/retry scratch only. New wardrobe later → new plate, don't
 * > reuse an old one.
 *
 * **Both halves of that are load-bearing and neither is this module's idea.**
 * ONE render settles the hem and the shoes, and the two views then COPY a
 * picture instead of reading an open sentence — which is the whole mechanism.
 * And the plate is a REFERENCE, never a delivery: it is Sunburst's, because his
 * court found Sunburst invents the better outfit, while the picture a customer
 * keeps is Nano Banana Pro's, because his other court found it renders better.
 *
 * # Three rules that are his and are not this module's to trade
 *
 * 1. ⚠ **THE PANELS COPY THE PRODUCT'S OWN CAMERAS.** His rule, 2026-09-27,
 *    verbatim: *"the sheet should copy the exact angles and camera views the
 *    current views use not invent new ones"* — said after a court sheet drew
 *    full-length profiles where the product ships head-and-shoulders ones and
 *    he could not judge the result. So {@link composeOutfitPlatePrompt} takes
 *    `frontFull` and `backFull`'s own directives BY NAME. The only authored
 *    sentence here is about LAYOUT — that there are two panels and they share
 *    a scale — and it says nothing about where a camera stands.
 * 2. ⚠ **THE PLATE IS SCRATCH.** Not a wardrobe card, not a looks card, not a
 *    library row, not an R2 object, not customer-visible. It lives in this
 *    process for the length of one Sign or one Try again and is then gone.
 *    That is his engineer's advice and he took it: *"the discussion was
 *    whether or not to make a seperate wardrobe card … but my engineer advised
 *    against it"*. A new wardrobe means a new plate, and nothing reuses an old
 *    one — which holds by construction, because nothing keeps one.
 * 3. ⚠ **A PLATE FAILURE NEVER FAILS THE SIGN.** {@link renderOutfitPlate}
 *    returns `null` for every fault there is and throws for none but a
 *    cancellation. The customer paid 3,250 credits for five views, not for a
 *    reference photograph they will never see, and the road without a plate is
 *    exactly the road the product shipped yesterday — softer consistency,
 *    complete delivery, no refund.
 */
import sharp from "sharp";

import type { ReferenceImage } from "../providers/types";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import {
  VIEW_IDENTITY_SENTENCE,
  belowWaistFor,
  castPackageView,
  referenceRuleFor,
  viewDescriptionOf,
  wardrobeSpecFor,
} from "./castViewPackage";
import { HOUSE_PHOTOGRAPH_PARAGRAPHS } from "./houseBlock";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/outfitPlate");

/** Which half of the plate a view is handed. */
export type OutfitPlateSide = "front" | "back";

/**
 * WHERE A VIEW'S OUTFIT REFERENCE CAME FROM (#1474).
 *
 * `plate` — a panel cut from a wardrobe plate rendered for this very request.
 * `delivered` — the other full-length view, already rendered and already the
 * customer's. A retry takes the second whenever one exists, because the outfit
 * of record is the picture they are holding, not one invented again.
 */
export type OutfitReferenceKind = "plate" | "delivered";

/**
 * THE ONE PICTURE THAT SETTLES WHAT A FULL-LENGTH VIEW IS WEARING, and the two
 * facts a prompt needs about it.
 *
 * ⚠ **It is one object because the three were three fields that had to agree**
 * (#1474). The orchestrator carried `outfitPlatePanel` and `outfitPlateSide`
 * separately, both optional, with the clause defaulting the side to `"front"`
 * when it was missing — safe only for as long as every outfit reference was a
 * front panel handed to a front view. A retry's reference is the OPPOSITE view,
 * so the default became a coin-flip instruction to copy garments from a side the
 * picture does not show. Nothing can be half-set now.
 */
export type OutfitReference = {
  readonly image: ReferenceImage;
  /** Which way THIS PICTURE faces — not the view receiving it. */
  readonly side: OutfitPlateSide;
  readonly kind: OutfitReferenceKind;
};

/** A split plate, held in memory and written nowhere. */
export type OutfitPlate = {
  readonly front: ReferenceImage;
  readonly back: ReferenceImage;
  /** What the door actually returned, for the receipt — never what was asked. */
  readonly source: { width: number; height: number };
};

/**
 * The two angles the plate settles, in panel order.
 *
 * `packageOrchestrator` reads THIS to decide which views wait for the plate,
 * so the list and the prompt cannot come to disagree about which views the
 * plate is even for. A third entry would not be a plate.
 */
export const PLATE_ANGLES = ["frontFull", "backFull"] as const;

/**
 * WHAT SHAPE A PLATE-WEARING VIEW COMES BACK AS — pinned, because the plate
 * MOVES IT, and that was found by driving rather than by reading.
 *
 * ⚠ **MEASURED ON THE REAL DOOR (#1278 path E court, 2026-09-29):**
 *
 *     frontFull, master only        1696x2528   (0.671 — today's product)
 *     frontFull, master + plate     1792x2400   (0.747 — path E, unpinned)
 *     frontFull, master + plate, pinned 2:3     1696x2528   ✅
 *
 * Nano Banana Pro reads its output shape off its REFERENCES, so a 3:4 plate
 * panel standing beside a chest-up anchor drags the delivered picture toward
 * the panel. Unpinned, path E would ship a five-view package with two views a
 * different shape from the other three — a thing no design asked for, that no
 * test would have failed, and that a customer would see immediately as two odd
 * frames in a strip of five.
 *
 * ⚠ **IT IS SET ONLY WHERE THE PLATE IS, AND THAT IS DELIBERATE.** The other
 * three views are not touched: they compose the same request they always did,
 * and pinning an axis they have never declared would be a behaviour change
 * folded into somebody else's card. That the axis is unowned on those three —
 * their shape is whatever their references imply — is a real question and it is
 * NAMED rather than quietly fixed here.
 *
 * ⚠ **STILL TRUE WITH THE PLATE EDITED FROM THE MASTER (#1471, 2026-09-29).**
 * The plate changed doors and provenance, not SHAPE — its panels are 3:4 either
 * way (1752x2336, read at the bytes) — so the drag this pins is the same drag,
 * and the pin still answers it: `frontFull` came back **1696x2528** on both
 * court fixtures, matching the three views that carry no plate. Re-measured
 * rather than assumed, because the reference beside the anchor is now a
 * different picture than the one these three readings were taken with.
 *
 * ⚠ **`aspectRatio` had never been set by any caller on any road before this**
 * (`falQueue.ts` has passed it through to `aspect_ratio` the whole time), so
 * the vocabulary was unverified in this repository. `2:3` is the value the door
 * was asked and the size above is the answer it gave — read at the returned
 * bytes, not from a table.
 */
export const PLATE_VIEW_ASPECT_RATIO = "2:3";

/** Which panel a plate-waiting angle is handed. */
export function plateSideFor(angle: (typeof PLATE_ANGLES)[number]): OutfitPlateSide {
  return angle === "frontFull" ? "front" : "back";
}

/**
 * THE OTHER FULL-LENGTH VIEW — the one that already knows what she is wearing.
 *
 * ⚠ **This is the whole of #1474 in one function.** A Try again on `backFull`
 * used to mint a FRESH plate, and a fresh plate is a fresh invention: the
 * retried back could come back in a mini beside a delivered front in a midi —
 * his own hem-and-shoes complaint, re-run on the one slot a customer has
 * already said they dislike. The outfit of record exists at retry time and it
 * is a picture the customer is holding: the delivered sibling.
 *
 * Derived from {@link PLATE_ANGLES} rather than written out, so a third
 * full-length angle could never leave this pairing behind — there are exactly
 * two, and each one's sibling is the other.
 */
export function siblingPlateAngleFor(
  angle: (typeof PLATE_ANGLES)[number],
): (typeof PLATE_ANGLES)[number] {
  return angle === "frontFull" ? "backFull" : "frontFull";
}

/**
 * THE LAYOUT SENTENCE — the only authored prose in this module, and it is
 * deliberately silent about cameras.
 *
 * Rule 1 above is why. Everything about where the camera stands comes from the
 * two view directives; this says only that there are two panels, that they hold
 * one person in one outfit, and that they share a scale — which is the property
 * the plate exists to create and the one thing neither directive can state,
 * because neither of them knows the other exists.
 */
const PLATE_LAYOUT =
  "WARDROBE PLATE — ONE IMAGE, TWO PANELS SIDE BY SIDE, exactly half the frame each, with no gutter, "
  + "border, caption, label, arrow or number anywhere in the frame. Both panels show the same person "
  + "in the same outfit, photographed in one session at the SAME distance and the same scale: the "
  + "figure is the same height in both, standing on the same ground line, under the same light on the "
  + "same backdrop. The LEFT panel and the RIGHT panel are described below and each fills its own "
  + "half of the frame completely.";

/**
 * What a view is told its outfit reference IS.
 *
 * ⚠ **IT DESCRIBES TWO DIFFERENT PICTURES NOW — #1474.** A Sign's two
 * full-length views are dressed by a plate panel; a **Try again** on either of
 * them is dressed by its delivered SIBLING, because the outfit of record at
 * retry time is a picture the customer is already holding. The shared body of
 * the clause is written once and the two sentences that differ are chosen from
 * `kind`, so the two roads cannot drift into saying different things about what
 * to copy.
 *
 * ⚠ **The ordinal is passed in, never counted here.** A view's references are
 * the anchor, then her delivered ink crops, then this — so the plate's position
 * depends on how many tattoos she has, and a sentence that counted for itself
 * would name the wrong picture on any Cast with ink. Same discipline as
 * `inkViewCropClause`, for the same reason it has it.
 *
 * ⚠ **IT SAID THE PLATE WAS NOT HER UNTIL #1471, AND HIS RULING MADE THAT
 * FALSE.** While the plate was drawn from words it really was a stranger in the
 * right clothes, so the clause had to hold two people apart — *"the person in
 * it is not her"* — a mitigation in words over a real identity fight. The plate
 * edits from the master now, so **the person in it IS her**, and leaving that
 * sentence standing would have a paid view told something false about its own
 * reference: at best wasted words, at worst an instruction to make the two
 * pictures differ.
 *
 * ⚠ **What survives the correction is the part that was always load-bearing:
 * ONE source for identity.** Reference 1 is the signed master and it is the
 * record for the face, the hair and the build; the plate is here to settle the
 * clothes and the half of the body the master's crop cannot show. The relay's
 * reading on his ruling, on the card: *"keep the clause; it is right either
 * way"* — so the instruction is kept and only the false assertion under it is
 * replaced.
 *
 * ⚠ **AND IT NO LONGER SAYS "GARMENTS" AND STOP — his second point on the card
 * (2026-09-29).** There is no no-wardrobe gate on this road and there should
 * not be: a creature, a cast in a loincloth, a cast in bare skin gets a plate
 * too, and for those the plate IS the lower-body continuation — the hide, the
 * fur, the scales, the feet — invented once so the two full-length views agree
 * on it. A clause that named only garments would have a creature's plate
 * contribute nothing to the views it was rendered for.
 */
export function outfitReferenceClause(input: {
  ordinal: number;
  /**
   * WHICH WAY THE REFERENCE PICTURE FACES — never which way this view faces.
   *
   * ⚠ **The two were the same thing until #1474 and they are opposites on the
   * new road.** A plate panel is cut for the view that receives it, so
   * `backFull` got the back panel and the sentence was true either way. A
   * DELIVERED sibling is the other view: `backFull` is dressed by the front,
   * and a clause reading this as the view's own side would tell a paid render
   * to copy garments from a side its reference does not show.
   */
  side: OutfitPlateSide;
  kind: OutfitReferenceKind;
  pronouns: CastPronouns;
}): string {
  const { pronouns } = input;
  const half = input.side === "front" ? "from the front" : "from behind";
  const what = input.kind === "plate"
    ? "is a wardrobe plate"
    : "is a photograph already delivered for this shoot";
  /*
    THE ONE SENTENCE THE PLATE ROAD NEVER NEEDS.

    A plate panel faces the same way as the view holding it, so "copy the
    garments exactly" is unambiguous. A delivered sibling faces the OTHER way,
    and there "exactly" could be read as "reproduce this picture" — a front view
    answered with a back.

    ⚠ **It states the REFERENCE'S LIMIT and never the output's camera.** Where
    the camera stands is already declared by the view's own directive, three
    lines up in the same prompt (`FULL BODY FROM BEHIND, walking away from
    camera`), and saying it twice is the shape his own measured law warns about
    — context is not additive. So this says what reference N can and cannot
    show, and what to do about the part it cannot.
  */
  const around = input.kind === "plate"
    ? ""
    : ` Reference ${input.ordinal} shows that outfit ${half} only: where this photograph shows `
      + `what reference ${input.ordinal} does not, continue the same garments around the body `
      + `rather than inventing different ones.`;
  return (
    /* ⚠ *"in the outfit for this shoot"* was vague to an engine — #1480 finding
       D. A shoot is a word about our process; what the sentence means is that
       this is the one outfit every picture of this person shows. */
    `THE OUTFIT — reference ${input.ordinal} ${what}: the same person as reference 1, `
    + `head to feet, in the outfit this person wears in every picture of them, seen ${half}. `
    + `Copy the GARMENTS from it exactly: `
    + `the cut, the length, the hem, the fastenings and hardware, the layers, the wear and the `
    + `damage, and the footwear. Where there are no garments, copy in the same way what stands in `
    + `for them — the skin, hide, fur, scales, markings and feet it shows below the crop of `
    + `reference 1.${around} Reference 1 is the record for ${pronouns.possessive} face, hair and `
    + `build: where the two pictures differ on ${pronouns.possessive} likeness, reference 1 wins, `
    + `and reference ${input.ordinal} settles only the clothes and the body below that crop.`
  );
}

/**
 * THE PLATE'S PROMPT, composed from the product's own two directives.
 *
 * ⚠ **THE IDENTITY SENTENCE IS PRESENT NOW, AND ITS ABSENCE WAS THE DEFECT
 * #1471 WAS FILED ABOUT.** While the plate was drawn from words this docblock
 * said the sentence was *"deliberately ABSENT"* because *"the plate has no
 * reference photograph"* — sound reasoning about a request that carried none,
 * and dead the moment his ruling gave the plate the master:
 *
 * > *"no the plate must reference the master image otherwise it wouldnt be able
 * > to invent the outfit correctly"* — 2026-09-29, terminal
 *
 * So the plate opens the way every other request carrying her photograph opens,
 * with {@link VIEW_IDENTITY_SENTENCE} and {@link referenceRuleFor} — **read by
 * name from `castViewPackage`, never retyped**, because two prompts that must
 * say one thing about who the person is are exactly what working law 4 is for.
 *
 * ⚠ **AND THE WARDROBE PARAGRAPH IS TRUE OF THIS REQUEST AT LAST.** It says
 * *"the SAME outfit the reference photograph shows … Inside the frame of the
 * reference, the reference is the record"* — a sentence that was addressed to
 * nothing for one day. Its other half, *"below its frame the description
 * governs"*, is the plate's actual job in one line: the master fixes the top,
 * the brief steers the rest, and the plate settles it ONCE for both views.
 *
 * ⚠ **The wardrobe spec is composed for `frontFull` and sent once.** It is the
 * same sentence both full-length views would each have composed for themselves,
 * and composing it twice here would put two copies of one rule in one prompt —
 * which is the drift working law 4 is about, one prompt down.
 */
export function composeOutfitPlatePrompt(
  wardrobeLine: string | null = null,
  description: string | null = null,
  /* ⚠ The plate carries the master, so every sentence about the person is about
     a real person and takes their pronouns — #1480 finding A, which fixed the
     reference paragraph this prompt reads BY NAME. Without this the plate would
     be the one request still calling a male cast "her". */
  pronouns: CastPronouns = pronounsForSex(null),
): string {
  const brief = viewDescriptionOf(description);
  const front = castPackageView("frontFull");
  const back = castPackageView("backFull");
  return [
    /*
      The identity pair FIRST and the layout second, which is the order every
      view sends and is load-bearing here for one extra reason: the layout
      sentence opens by calling the frame a WARDROBE PLATE, and a request that
      announced itself as a wardrobe diagram before it said whose body it is
      invites exactly the floating-garment picture his ruling declined.
    */
    VIEW_IDENTITY_SENTENCE,
    /* No outfit reference here BY CONSTRUCTION: this request is what invents the
       outfit, so the description IS the record for the hem and the footwear.
       It is the one prompt where #1480's yield must NOT happen. */
    referenceRuleFor(brief, pronouns, null),
    PLATE_LAYOUT,
    ...(brief === null ? [] : [`DESCRIPTION: ${brief}`]),
    `LEFT PANEL — ${front.directive}${belowWaistFor("frontFull", wardrobeLine, brief, null)}`,
    `RIGHT PANEL — ${back.directive}${belowWaistFor("backFull", wardrobeLine, brief, null)}`,
    `WARDROBE: ${wardrobeSpecFor("frontFull", wardrobeLine, brief, pronouns, null)}`,
    ...HOUSE_PHOTOGRAPH_PARAGRAPHS,
  ].join("\n");
}

/**
 * CUT THE PLATE IN HALF — on the bytes that arrived, never on the size asked
 * for.
 *
 * ⚠ **This door is MEASURED to clamp an ask** (`OUTFIT_PLATE_SIZE`'s docblock:
 * #1394's sheet arm asked 4688x1760 and was answered 3840x1440 every time,
 * aspect preserved to three decimal places, long side capped). A split computed
 * from the constant would therefore cut a scaled plate down the wrong column
 * and hand each view a sliver of the other panel — and it would do it
 * SILENTLY, because a plausible picture comes back either way and nothing
 * downstream has an opinion about what a reference looks like.
 *
 * An ODD width rounds the left panel UP and takes the right panel from the far
 * edge, so between them they cover the whole frame: one duplicated pixel column
 * is invisible to a generator and a dropped one is a seam.
 */
export async function splitOutfitPlate(
  bytes: Buffer,
  _contentType: string,
): Promise<OutfitPlate> {
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 2 || height < 1) {
    /* Not a refusal any customer can meet: every caller turns a throw from here
       into "no plate", and the Sign then renders master-only. */
    throw new Error(`the outfit plate is not a splittable image (${width}x${height})`);
  }
  const half = Math.ceil(width / 2);
  const [front, back] = await Promise.all([
    sharp(bytes).extract({ left: 0, top: 0, width: half, height }).png().toBuffer(),
    sharp(bytes).extract({ left: width - half, top: 0, width: half, height }).png().toBuffer(),
  ]);
  return {
    front: { bytes: front, contentType: "image/png" },
    back: { bytes: back, contentType: "image/png" },
    source: { width, height },
  };
}

/** The one method of the engine this module uses — narrow on purpose, so a test double is three lines. */
export type OutfitPlateEngine = {
  editWithReferences(request: {
    prompt: string;
    references: ReferenceImage[];
    resolution: "1K" | "2K" | "4K";
    signal?: AbortSignal;
  }): Promise<{
    bytes: Buffer;
    contentType: string;
    latencyMs?: number;
    estimatedCostUsd?: number | null;
  }>;
};

/**
 * RENDER THE PLATE, AND NEVER LET IT COST THE SIGN ANYTHING.
 *
 * ⚠ **It returns `null` for every fault and throws for none but one**, which is
 * his rule 3 in one line. A refusal, a timeout, a dropped connection, a plate
 * that comes back unsplittable, a credential nobody set — each ends the same
 * way: no plate, the two full-length views render master-only exactly as they
 * did before this change, and all five of the customer's views still arrive.
 *
 * ⚠ **THE ONE THING IT MUST NOT SWALLOW IS A CANCELLATION.** An abort is the
 * Sign itself being torn down, not the plate failing to arrive, and turning it
 * into `null` would have the two full-length views cheerfully start rendering
 * against a dead operation. So an aborted signal re-throws, and the arm that
 * proves it is the one worth keeping.
 */
export async function renderOutfitPlate(input: {
  engine: OutfitPlateEngine;
  /**
   * HER SIGNED MASTER — the plate's one reference, and required since #1471.
   *
   * ⚠ **It is not optional and there is no master-less branch**, which is the
   * shape his ruling asks for. A plate with nothing to edit is the request the
   * door answers `422` to, so an absent master must not become a quietly
   * words-only plate — that is the exact road he closed. Both call sites
   * already hold the anchor before they reach here: the Sign has fetched it to
   * render five views from, and a retry has fetched it before it claims.
   */
  anchor: ReferenceImage;
  wardrobeLine: string | null;
  description: string | null;
  /** Whose face this is — the plate's own prompt says it four times (#1480 finding A). */
  pronouns?: CastPronouns;
  operationId?: number | string | null;
  signal?: AbortSignal;
}): Promise<OutfitPlate | null> {
  const started = Date.now();
  try {
    const image = await input.engine.editWithReferences({
      prompt: composeOutfitPlatePrompt(input.wardrobeLine, input.description, input.pronouns),
      /*
        THE MASTER, AND IT IS HIS RULING RATHER THAN THIS MODULE'S READING.

        ⚠ **This list was `[]` for one day and the comment here argued for it**
        — that the plate is *of the OUTFIT, not of her*, and that handing it the
        anchor would put a second engine's opinion of her face along the edge of
        every garment. **His word, 2026-09-29, verbatim and entire:** *"no the
        plate must reference the master image otherwise it wouldnt be able to
        invent the outfit correctly"*.

        He is describing a failure the old reading could not see. A plate drawn
        from words cannot see the top she was SIGNED in, so it invents one — and
        the view is then told to take the clothes from the plate, which is the
        product contradicting a picture the customer has already accepted, above
        the waist, by design.

        And the face worry it traded against is answered by the same change
        rather than accepted: the plate is now HER, so the two references a view
        carries agree on identity instead of competing, and `outfitReferenceClause`
        still names reference 1 as the record for the likeness.

        ONE reference, deliberately. Her delivered ink crops are NOT sent: they
        are named by POSITION in the view's own clause, and a plate is not a
        view — the tattoos ride the view, where they are judged.
      */
      references: [input.anchor],
      resolution: "2K",
      ...(input.signal ? { signal: input.signal } : {}),
    });
    const plate = await splitOutfitPlate(image.bytes, image.contentType);
    log.info(
      {
        operationId: input.operationId ?? null,
        returned: plate.source,
        panelBytes: { front: plate.front.bytes.length, back: plate.back.bytes.length },
        latencyMs: image.latencyMs ?? Date.now() - started,
        estimatedCostUsd: image.estimatedCostUsd ?? null,
      },
      "[outfitPlate] the wardrobe plate landed and was cut in two",
    );
    return plate;
  } catch (error) {
    if (input.signal?.aborted) throw error;
    log.warn(
      {
        operationId: input.operationId ?? null,
        err: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - started,
      },
      "[outfitPlate] no wardrobe plate — the full-length views render from the master alone",
    );
    return null;
  }
}
