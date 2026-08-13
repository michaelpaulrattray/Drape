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
import {
  assertEveryDescribedFeatureHasAnAsk,
  DESCRIBED_ASKS,
  describedFeatures,
  type FaceDescriptions,
} from "./faceDescribe";
import { createModuleLogger } from "../logging/logger";
import type { Mask } from "./maskedComposite";
import { belowHeadMask, MaskError } from "./maskGeometry";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";
import {
  catalogueSlots,
  isAskable,
  isDerivedRegion,
  DERIVED_REGION_ASKS,
  type SlotDefinition,
} from "./referenceSlotCatalogue";
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
  /**
   * WHAT THE FRAME CAN ONLY BE DESCRIBED AS — the two rows a segmenter is
   * forbidden to picture (fable-388 §1, fable-389 §1).
   *
   * A slot with no question has no box and no mask, so on a face nobody has
   * edited its row has nothing at all and does not draw. These are words, from
   * one read of the same frame, and they are DISPLAY: they are not library rows,
   * so nothing carries them into a recipe or checks them in a render.
   */
  descriptions: ReadonlyMap<FeatureSlot, string>;
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
    /*
      A SLOT MAY BE DRAWN FROM A REGION IT MAY NEVER BE CUT FROM (fable-428 §3).

      The founder's rule is that every panel row carries a bounding box on the
      photograph. `skin` is the row where the two regions come apart: her skin is
      all of her visible skin, so a face crop FILED as her skin would be a
      partial wearing the name of the whole — while the same face-skin cutout is
      the right picture for a row that is a name and a click affordance.

      Asked here and nowhere else. The catalogue keeps `question` null for such a
      slot, so this is the only route the region has, and the mint's own door
      (`slotSpecFor`) does not carry the field at all.
    */
    const question = isAskable(definition) ? definition.question : definition.display;
    /* Not scannable: no question, no display region, or a COMPOSED region whose
       key is not a question anyone may send to a reader (her build, below). */
    if (question === null || question === undefined) continue;
    if (definition.group === "accessories" && !armed.has(question)) continue;
    const held = byFeature.get(definition.feature);
    if (held) held.slots.push(definition);
    else byFeature.set(definition.feature, {
      feature: definition.feature,
      question,
      slots: [definition],
    });
  }
  return Array.from(byFeature.values());
}

/**
 * THE SLOTS WHOSE REGION IS COMPOSED RATHER THAN ASKED.
 *
 * Held apart from {@link scanPlan} because they cost a different thing: no
 * question is sent for these at all. Her build is the whole-subject matte below
 * the bottom of the `face` box (`belowHeadMask`) — arithmetic on two answers the
 * reader already gives, which is the only shape D-213 permits for a region no
 * vocabulary word names.
 *
 * It is the SAME region the mint cuts her build's carrier from, and that is the
 * point: the box she clicks and the crop the paid render carries are one answer
 * with two uses, not two answers that drift (working law 4). It is why fable-428
 * §1 retired the torso probe — evidence for a road already ruled out.
 */
export function composedPlan(): SlotDefinition[] {
  return catalogueSlots().filter((definition) => isDerivedRegion(definition.question));
}

/**
 * The slots that can only ever hold words, with the ask that fills them.
 *
 * Derived from the catalogue the same way `scanPlan` is, and checked: a row
 * that draws itself, has no question, and has no description ask either would
 * be permanently empty — the founder's own complaint, arriving again in a new
 * row. It refuses rather than shipping that.
 */
export function wordsPlan(): { feature: string; slots: SlotDefinition[] }[] {
  assertEveryDescribedFeatureHasAnAsk();
  /* Only the features that actually have an ask: `describedFeatures()` is the
     whole derived set, and a declared exception (NOT_DESCRIBED) would otherwise
     be counted as describable in the log and read as a reader that failed. */
  const features = new Set(describedFeatures().filter((feature) => feature in DESCRIBED_ASKS));
  const byFeature = new Map<string, { feature: string; slots: SlotDefinition[] }>();
  for (const definition of catalogueSlots()) {
    if (!features.has(definition.feature)) continue;
    const held = byFeature.get(definition.feature);
    if (held) held.slots.push(definition);
    else byFeature.set(definition.feature, { feature: definition.feature, slots: [definition] });
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
  /**
   * The words reader — REQUIRED, and `null` is a real answer.
   *
   * Not defaulted to the live one on purpose. A default here made every unit
   * suite that scans a frame reach the paid transport the moment a key was in
   * the environment: `vitest.setup.ts` strips `DATABASE_URL` and nothing else,
   * so the guard that keeps tests off the database does not keep them off this.
   * A caller that wants no descriptions says so.
   */
  describe: ((input: { bytes: Buffer; contentType: string }) => Promise<FaceDescriptions>) | null;
  contentType?: string;
}): Promise<FaceScan> {
  const frame = { width: input.frame.width, height: input.frame.height };
  const boxes = new Map<FeatureSlot, ScanBox>();
  const masks = new Map<FeatureSlot, Mask>();
  const empty: string[] = [];
  const failed: { question: string; why: string }[] = [];
  const descriptions = new Map<FeatureSlot, string>();
  const plan = scanPlan();

  /*
    THE WORDS READ RIDES ALONGSIDE, not after: it is one more independent
    question about the same photograph, and serially it would add its own
    seconds to a panel somebody is watching fill.
  */
  const describer = input.describe;
  const words = describer === null
    ? Promise.resolve<FaceDescriptions>({ build: null, skin: null })
    : describer({ bytes: input.frame.bytes, contentType: input.contentType ?? "image/png" })
      .catch((error) => {
        /* Same rule as a failed region: a courtesy read that fails costs the
           user nothing and leaves the row exactly as it is today. */
        failed.push({ question: "descriptions", why: error instanceof Error ? error.message : String(error) });
        return { build: null, skin: null } as FaceDescriptions;
      });

  /*
    AND HER BUILD, COMPOSED RATHER THAN ASKED — started here so its two reads
    ride beside every other question about this photograph rather than after
    them (fable-428 §1).

    Two reads, and the `face` one is NOT shared with the plan's: no catalogue
    slot asks `face` (they ask `face skin`, `eyes`, `hair`), so there is nothing
    to reuse. The cost is stated rather than implied — the scan's line goes from
    ~14 reads to ~16 on a first look.

    Every failure here is the same failure every other region has: this row gets
    no box and the panel is exactly what it was before. A scan is a courtesy the
    user did not ask to pay for.
  */
  const composed = composedPlan();
  const composing = composed.length === 0
    ? Promise.resolve<Array<{ definition: SlotDefinition; mask: Mask }>>([])
    : (async () => {
      const [head, subject] = await Promise.all([
        input.reader.region({
          image: input.frame.bytes,
          name: DERIVED_REGION_ASKS.belowHead.head,
          absentIsAnswer: true,
          ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
        }),
        input.reader.subject({ image: input.frame.bytes }),
      ]);
      return composed.flatMap((definition) => {
        try {
          const { mask } = belowHeadMask({ subject, head });
          return [{ definition, mask }];
        } catch (error) {
          failed.push({
            question: definition.question ?? definition.slot,
            why: error instanceof MaskError
              ? error.message
              : `her build could not be composed: ${error instanceof Error ? error.message : String(error)}`,
          });
          return [];
        }
      });
    })().catch((error) => {
      failed.push({
        question: "derived",
        why: error instanceof Error ? error.message : String(error),
      });
      return [] as Array<{ definition: SlotDefinition; mask: Mask }>;
    });

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

  /* The composed rows join the same two maps by the same rule as every asked
     one: box and mask together, always. A slot with a rectangle and no shape
     renders as a hard-edged crop beside its cutout neighbours. */
  for (const { definition, mask } of await composing) {
    const box = boxIn(mask, frame);
    if (!box) { empty.push(definition.question ?? definition.slot); continue; }
    boxes.set(definition.slot, box);
    masks.set(definition.slot, mask);
  }

  const described = await words;
  for (const entry of wordsPlan()) {
    const line = described[entry.feature as keyof FaceDescriptions];
    if (!line) continue;
    /* Every slot of the feature, so a folded pair would inherit it — there are
       none today and the loop is the same shape the boxes take. */
    for (const definition of entry.slots) descriptions.set(definition.slot, line);
  }

  log.info(
    {
      asked: plan.length,
      found: boxes.size,
      empty: empty.length,
      failed: failed.length,
      /* The words are counted separately: a scan with every box and no
         description is a different failure from a scan with neither. */
      described: descriptions.size,
      describable: wordsPlan().length,
    },
    "[faceScan] read a face",
  );
  return { boxes, masks, descriptions, asked: plan.length, found: boxes.size, empty, failed };
}
