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
 *    cancellation. The customer paid 450 credits for five views, not for a
 *    reference photograph they will never see, and the road without a plate is
 *    exactly the road the product shipped yesterday — softer consistency,
 *    complete delivery, no refund.
 */
import sharp from "sharp";

import type { ReferenceImage } from "../providers/types";
import type { CastPronouns } from "./castPronouns";
import {
  belowWaistFor,
  castPackageView,
  viewDescriptionOf,
  wardrobeSpecFor,
} from "./castViewPackage";
import { HOUSE_PHOTOGRAPH_PARAGRAPHS } from "./houseBlock";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/outfitPlate");

/** Which half of the plate a view is handed. */
export type OutfitPlateSide = "front" | "back";

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
 * What a view is told the plate panel IS.
 *
 * ⚠ **The ordinal is passed in, never counted here.** A view's references are
 * the anchor, then her delivered ink crops, then this — so the plate's position
 * depends on how many tattoos she has, and a sentence that counted for itself
 * would name the wrong picture on any Cast with ink. Same discipline as
 * `inkViewCropClause`, for the same reason it has it.
 *
 * ⚠ **And it says the plate is NOT her.** The plate is a Sunburst render: a
 * plausible person in the right clothes, and emphatically not the customer's
 * cast. Reference 1 is the photograph of the actual signed face, and this
 * sentence has to hold the two jobs apart or the plate becomes a face swap on
 * a paid view.
 */
export function outfitPlateClause(input: {
  ordinal: number;
  side: OutfitPlateSide;
  pronouns: CastPronouns;
}): string {
  const { pronouns } = input;
  const half = input.side === "front" ? "from the front" : "from behind";
  return (
    `THE OUTFIT — reference ${input.ordinal} is a wardrobe plate showing the outfit for this shoot, `
    + `${half}. Copy the GARMENTS from it exactly: the cut, the length, the hem, the fastenings and `
    + `hardware, the layers, the wear and the damage, and the footwear. `
    + `It is NOT a photograph of ${pronouns.object} and the person in it is not `
    + `${pronouns.object}: take the face, the hair, the body and the skin from reference 1 alone, `
    + `and take only the clothes from reference ${input.ordinal}.`
  );
}

/**
 * THE PLATE'S PROMPT, composed from the product's own two directives.
 *
 * ⚠ **The identity sentence a view opens with is deliberately ABSENT.** A view
 * says *"keep this exact person unchanged … as the reference photograph"*; the
 * plate has no reference photograph and is not of a particular person, so that
 * sentence would deny its own inputs. What it gets instead is the brief — the
 * same words the master was rolled from (#1278 part 1) — and the house
 * paragraphs, so the plate is lit and framed the way every other picture this
 * product makes is.
 *
 * ⚠ **The wardrobe spec is composed for `frontFull` and sent once.** It is the
 * same sentence both full-length views would each have composed for themselves,
 * and composing it twice here would put two copies of one rule in one prompt —
 * which is the drift working law 4 is about, one prompt down.
 */
export function composeOutfitPlatePrompt(
  wardrobeLine: string | null = null,
  description: string | null = null,
): string {
  const brief = viewDescriptionOf(description);
  const front = castPackageView("frontFull");
  const back = castPackageView("backFull");
  return [
    PLATE_LAYOUT,
    ...(brief === null ? [] : [`DESCRIPTION: ${brief}`]),
    `LEFT PANEL — ${front.directive}${belowWaistFor("frontFull", wardrobeLine, brief)}`,
    `RIGHT PANEL — ${back.directive}${belowWaistFor("backFull", wardrobeLine, brief)}`,
    `WARDROBE: ${wardrobeSpecFor("frontFull", wardrobeLine, brief)}`,
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
  wardrobeLine: string | null;
  description: string | null;
  operationId?: number | string | null;
  signal?: AbortSignal;
}): Promise<OutfitPlate | null> {
  const started = Date.now();
  try {
    const image = await input.engine.editWithReferences({
      prompt: composeOutfitPlatePrompt(input.wardrobeLine, input.description),
      /*
        NO REFERENCES, AND IT IS A DECISION RATHER THAN AN OMISSION.

        The plate is of the OUTFIT, not of her. Handing it the anchor would have
        it draw her face into a picture whose only job is to settle a hem — and
        the view that then copies "the clothes" from it would be copying a
        second engine's opinion of her face along the edge of every garment.
        Her identity has exactly one source on this road and it is reference 1
        of the view itself.
      */
      references: [],
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
