/**
 * THE AUTO-SCAN — reading a face the product has never been told anything about.
 *
 * # The complaint this answers
 *
 * The founder, with a screenshot of fourteen empty boxes (fable-352): *"you
 * never mentioned original image analyzing to prefill the library at the moment
 * it still shows blank slots completely unrelated."* He is right: the panel's
 * rows come from the catalogue and their content comes from the LIBRARY, and
 * the library only holds what an EDIT minted — so a face nobody has edited has
 * a panel of empty slots, which is every face at the moment it is selected.
 *
 * This reads her once and says WHERE each feature is on this frame.
 *
 * # IT MINTS NOTHING, and that boundary is the first thing to check a diff
 * # against
 *
 * fable-360 ruling 5 is the founder's own: *"we dont need to reference anything
 * if it hasnt been changed from the original."* The reference library stays
 * edit-minted, full-resolution, purged with its candidate. This produces
 * **geometry only** — boxes in the frame's own pixels — and writes nothing
 * anywhere: no rows, no objects, no manifest, and therefore no purge path and
 * none of the born-held race the mint writers needed. The panel already has the
 * frame decoded on screen; a box is all a thumbnail or a click target needs, and
 * a scan result that IS its frame cannot drift from it (fable-373 ruling 4a).
 *
 * # What it asks is DERIVED, never a second list
 *
 * Every question comes from `SLOT_CATALOGUE` through `catalogueSlots()`. A slot
 * whose `question` is null is words-only BY THE CATALOGUE'S OWN ACCOUNT — chin,
 * jaw, cheekbones, skin under the founder's third shape — and is not asked, so
 * the eight regions that can be pictured fall out of the vocabulary rather than
 * being typed here. Accessories are asked only when their class is ARMED
 * (`armedBornWornClasses`), because a detector without its three-class court is
 * a guess about a customer's face: glasses today, earring and nose stud when
 * their courts pass, and this file will not need editing when they do.
 *
 * A bilateral feature is ONE question read two-sidedly, so each side gets its
 * own box — which is what per-instance boxes and pair-row-lights-both need
 * downstream (fable-270/278).
 *
 * # AN ABSENCE IS NOT A FINDING HERE
 *
 * `absentIsAnswer` is true for every question: a face genuinely without facial
 * hair, or with an ear behind her hair, must not throw. And nothing is filed
 * for it — **an ear nobody can see is not an ear wearing nothing** (fable-352).
 * The row simply has no box, exactly as it does today, and the picture stays
 * honest about what was measured. A failed READING is treated the same way, for
 * the same reason: a scan is house money on a read the user never asked to pay
 * for, so it degrades to today's panel rather than to an error.
 */
import { armedBornWornClasses } from "./bornWornDetector";
import { createModuleLogger } from "../logging/logger";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";
import { catalogueSlots, type SlotDefinition } from "./referenceSlotCatalogue";
import { boundsOf } from "./segmentCuts";

const log = createModuleLogger("castingV2/faceScan");

export type ScanBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The frame it was measured on travels with it — a box without its frame is
   *  a rectangle in an unknown space. */
  frame: { width: number; height: number };
};

export type FaceScan = {
  /** Where each feature is, for the slots this frame could answer. */
  boxes: ReadonlyMap<FeatureSlot, ScanBox>;
  /**
   * THE SHAPE, not just the rectangle — kept because the founder chose the
   * masked-cutout look (fable-374: *"masked cutouts."*).
   *
   * The panel renders a cutout client-side from the frame it already has plus
   * this mask, so every row speaks one visual language whether it was born of a
   * scan or minted by an edit. It is the SHAPE only: no cut pixels, no new image
   * objects, 4a's architecture untouched.
   *
   * Held here rather than re-read later because it is already in hand — the box
   * below is derived FROM it, and asking the segmenter the same question twice
   * would pay twice for one answer and invite two different ones.
   */
  masks: ReadonlyMap<FeatureSlot, Mask>;
  /** What was asked and what came back, so a thin scan is legible rather than
   *  mysterious — the founder's panel showing three rows is either a face or a
   *  broken reader, and only this tells them apart. */
  asked: number;
  found: number;
  /** Regions that were asked and answered nothing, by question. */
  empty: readonly string[];
  /** Regions whose READING failed, by question, with the reason. */
  failed: readonly { question: string; why: string }[];
};

/** The armed accessory questions, by the catalogue's own account of arming. */
function armedQuestions(): ReadonlySet<string> {
  return new Set(armedBornWornClasses().map((entry) => entry.region));
}

/**
 * The slots worth asking about on a frame nobody has edited, grouped so that a
 * bilateral feature is one question rather than two.
 *
 * Accessory slots are dropped unless armed. Words-only slots are dropped by
 * having no question at all, which is the catalogue speaking rather than this
 * function deciding.
 */
export function scanPlan(): { feature: string; question: string; slots: SlotDefinition[] }[] {
  const armed = armedQuestions();
  const byFeature = new Map<string, { feature: string; question: string; slots: SlotDefinition[] }>();
  for (const definition of catalogueSlots()) {
    if (definition.question === null) continue;
    if (definition.group === "accessories" && !armed.has(definition.question)) continue;
    const held = byFeature.get(definition.feature);
    if (held) held.slots.push(definition);
    else byFeature.set(definition.feature, {
      feature: definition.feature,
      question: definition.question,
      slots: [definition],
    });
  }
  return Array.from(byFeature.values());
}

function boxIn(mask: Mask, frame: { width: number; height: number }): ScanBox | null {
  const bounds = boundsOf(mask);
  if (bounds === null) return null;
  return { ...bounds, frame };
}

/**
 * Read one frame and say where everything on it is.
 *
 * `imageUrl` is passed through to the reader as a transport hint — the same
 * bytes at an address, so twelve questions about one photograph stop carrying
 * twelve copies of it. The reader proves the address holds these bytes before
 * it uses it; this function does not, and must not, guarantee that.
 */
export async function scanFace(input: {
  frame: { bytes: Buffer; width: number; height: number; url?: string | null };
  reader: RegionReader;
}): Promise<FaceScan> {
  const frame = { width: input.frame.width, height: input.frame.height };
  const boxes = new Map<FeatureSlot, ScanBox>();
  const masks = new Map<FeatureSlot, Mask>();
  const empty: string[] = [];
  const failed: { question: string; why: string }[] = [];
  const plan = scanPlan();

  /*
    IN PARALLEL, because they are independent questions about one picture and
    the model answers each in a couple of seconds. Serially this is the
    difference between a panel that fills while she looks at the face and one
    that arrives after she has stopped waiting for it.
  */
  await Promise.all(plan.map(async (region) => {
    const bilateral = region.slots.some((slot) => slot.instance !== null);
    try {
      if (bilateral && input.reader.regionSides) {
        const sides = await input.reader.regionSides({
          image: input.frame.bytes,
          name: region.question,
          absentIsAnswer: true,
          ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
        });
        /*
          `null` is the reader saying this name has no sides for it — a
          capability answer, not a reading. Falling back to the whole-frame
          question would file ONE box for a pair and light both instances off
          it, which is the wrong-boundary class with a rectangle on it. So the
          pair goes unanswered instead, honestly.
        */
        if (sides === null) {
          empty.push(region.question);
          return;
        }
        for (const slot of region.slots) {
          const mask = slot.instance === "left" ? sides.left : sides.right;
          const box = boxIn(mask, frame);
          /* Box and mask are set together, always: a slot with a rectangle and
             no shape would render as a hard-edged crop beside its cutout
             neighbours, and one with a shape and no rectangle has nowhere to
             put it. They are one answer. */
          if (box) {
            boxes.set(slot.slot, box);
            masks.set(slot.slot, mask);
          }
        }
        if (region.slots.every((slot) => !boxes.has(slot.slot))) empty.push(region.question);
        return;
      }

      const mask = await input.reader.region({
        image: input.frame.bytes,
        name: region.question,
        absentIsAnswer: true,
        ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
      });
      const box = boxIn(mask, frame);
      if (box) {
        for (const slot of region.slots) {
          boxes.set(slot.slot, box);
          masks.set(slot.slot, mask);
        }
      } else {
        empty.push(region.question);
      }
    } catch (error) {
      /*
        A scan is a courtesy the user did not ask to pay for, so a failed
        reading costs them nothing and changes nothing: this region has no box
        and the panel is exactly what it was before the scan existed. Recorded
        rather than swallowed, because a silent catch is how thirty faces were
        once declared bare.
      */
      failed.push({ question: region.question, why: error instanceof Error ? error.message : String(error) });
    }
  }));

  log.info(
    { asked: plan.length, found: boxes.size, empty: empty.length, failed: failed.length },
    "[faceScan] read a face",
  );
  return { boxes, masks, asked: plan.length, found: boxes.size, empty, failed };
}
