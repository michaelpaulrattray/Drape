/**
 * WHERE A CARRIED FEATURE ACTUALLY IS ON THE FRAME YOU ARE LOOKING AT
 * (the stale-geometry defect: his 1436 §2, option (iii) ruled fable-1443,
 * store and flag ruled fable-1445 §2).
 *
 * The founder's own screenshot is the specimen: a rectangle labelled *"Right
 * horn"*, minted on v215, drawn over v219 — where the horns had been
 * regenerated and had moved. The box was a promise about the wrong pixels.
 *
 * # WHY IT IS EVERY BOX AND NOT A SNAPSHOT
 *
 * A library crop is minted ONCE and then carried, so its geometry describes
 * exactly one of a candidate's N versions — the render that cut it — and every
 * later edit moves the customer off that frame for good. Measured on
 * production before this was built (opus-1102 §1):
 *
 *     library rows carrying a box                9
 *     …drawn on the frame they were minted from  0
 *     versions of drift                          min 2 · median 4 · max 5
 *
 * The minimum is TWO because a mint is always followed by the next render. So
 * the option that only drew a box on its own frame — the cheap, honest-looking
 * one — would have hidden nine boxes of nine. It was not a stopgap; it was the
 * panel switched off.
 *
 * # WHAT THIS BUYS, AND WHERE THE WAIT LANDS
 *
 * One region read per carried feature, on the delivered frame, at the render.
 * The same reads could have been bought when the panel is OPENED, and the cost
 * would converge — the difference is who waits. A read at the render folds into
 * a wait the customer is already a median 121 seconds inside; a read at the
 * panel puts three to six segmenter calls in front of a surface somebody is
 * looking at right now, with the stale box on screen until they return.
 *
 * So the geometry is correct **at the moment the frame exists**, and there is
 * never a frame on screen carrying a box that does not belong to it. That is
 * the panel's own no-invented-boxes law extended to time.
 *
 * # GEOMETRY ONLY — the crop is not re-cut
 *
 * The PIXELS were never the problem. A minted crop is still the right picture
 * of that feature and is still what rides into the next prompt; only the
 * rectangle drifted. Re-cutting would pay the expensive half (a cut, a guard's
 * independent second read, two objects and a manifest) to fix the cheap one.
 *
 * # NOTHING HERE MAY COST A PICTURE
 *
 * It runs after the render has been paid for and before the landing, and every
 * failure — a reader that will not answer, a database that will not write, an
 * absent table — is caught, counted and dropped. The customer's frame stands
 * up either way. A box is a convenience; the photograph is the purchase.
 */
import { createModuleLogger } from "../logging/logger";
import { keepCarriedGeometry, type StoredCarriedSlot } from "../db/castingV2FaceScans";
import { randomUUID } from "node:crypto";
import { askWordsForSlot, openKindAsk } from "./openKindQuestion";
import { liveReferences, type StoredReference } from "./referenceLibrary";
import { slotSpecFor } from "./referenceSlotCatalogue";
import { inkPlacementOfSlot, openKindOfSlot, parseSlot, type Instance } from "./referenceSlots";
import {
  inkPlacementEntry,
  isInkPlacement,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { boundsOf } from "./segmentCuts";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";

const log = createModuleLogger("castingV2/carriedGeometry");

/**
 * THE COST TRIPWIRE, BESIDE THE CONSTANT THAT PRICES IT (fable-1443 condition
 * 4).
 *
 * A read is **$0.005** — the face scan's own measured rate, twenty segmenter
 * calls for $0.100, counted through `scanFace` with a recording reader rather
 * than derived. So this road costs $0.015–$0.030 on the three- and
 * six-carried-feature faces production actually holds, against a refine that
 * charges 25 credits and spends a repaint. That is noise.
 *
 * It is noise *at today's sizes*. It scales linearly with carried features and
 * nothing else bounds it, so a face carrying twenty would be $0.100 a render —
 * and at that point the decision between reading at the render and reading at
 * the panel deserves to be taken again with the new number in hand.
 *
 * TEN is the line, and crossing it is said out loud rather than left to a
 * bill. It is not a refusal: turning a customer's panel off to save half a cent
 * would be the wrong side of every ruling this program has.
 */
export const CARRIED_GEOMETRY_COST_NOTE_ABOVE = 10;

/** One carried feature to re-read, with the question that names it. */
export type CarriedSlotToReRead = {
  slot: FeatureSlot;
  /** The segmentation question — a catalogue slot's own, or an open kind's
   *  joined words (`openKindAsk`), which is the string the mint asks. */
  question: string;
  /** Her side, when the slot is one of a pair. Null for a whole-frame slot. */
  side: Instance | null;
};

/**
 * WHICH FEATURES THIS RENDER CARRIED RATHER THAN WROTE — pure, so the rules can
 * be driven without a frame, a reader or a database.
 *
 * Four conditions, and each one removes a different way of being wrong:
 *
 *   it is a live CARRY row      the branch's current answer for the slot. A
 *                               retired row, a vacancy or a superseded one is
 *                               not on her face, and `liveReferences` is the
 *                               one fold that decides that (law 4 — this does
 *                               not re-implement the lineage rules)
 *   it already has a BOX        a words-only row draws no rectangle, so there
 *                               is nothing on screen to be wrong. Reading for
 *                               one would be buying a box the panel has never
 *                               shown and the mint deliberately declined to cut
 *   this render did NOT file it the mint has just cut a fresh crop with fresh
 *                               geometry off this very frame. Re-reading it
 *                               would be paying twice for one answer, and the
 *                               second answer could disagree with the first
 *   it has a question to ask    a surface — her jaw, her skin — has no
 *                               segmentation word that names it, and D-213
 *                               forbids inventing one
 */
export function carriedSlotsForGeometry(input: {
  /** The branch's lineage rows, as the render already read them. */
  rows: readonly StoredReference[];
  /** The slots this render's mint filed. */
  minted: ReadonlySet<string>;
  /** Everything the branch has ever said per slot — an open kind is asked in
   *  her own words, and `askWordsForSlot` is the string the mint asks. */
  priorWords?: ReadonlyMap<string, readonly string[]>;
}): CarriedSlotToReRead[] {
  const out: CarriedSlotToReRead[] = [];
  const live = liveReferences(input.rows);
  /*
    ⚠ AND A FIFTH CONDITION THAT IS NOT A ROW PROPERTY: she took it off.

    `liveReferences` keys on (slot, ROLE), so a slot holding a live VACANCY can
    hold a live carry underneath it — that is deliberate there, because the
    vacancy has to stay the newest state or the older carry would surface as the
    branch's answer. The panel drops such a row entirely (*"do not display
    it"*), so a read here would buy a box for the glasses she removed and file
    a rectangle nothing draws.

    The test is the PANEL'S OWN — the newest live row of any role, not merely
    the presence of a vacancy — because she can take a thing off and put it back
    on, and then the carry is the newer of the two and the row is on her face.
  */
  const emptied = new Set(
    Array.from(live.reduce((held, row) => {
      const seen = held.get(row.slot);
      if (!seen || row.version > seen.version) held.set(row.slot, row);
      return held;
    }, new Map<string, StoredReference>()).values())
      .filter((row) => row.role === "vacancy")
      .map((row) => row.slot),
  );
  for (const row of live) {
    if (row.role !== "carry") continue;
    if (row.geometry === null) continue;
    if (emptied.has(row.slot)) continue;
    if (input.minted.has(row.slot)) continue;

    const spec = slotSpecFor(row.slot as FeatureSlot, row.words);
    if (spec === null || spec.question === null) continue;

    const open = openKindOfSlot(row.slot);
    const question = open === null
      ? spec.question
      : openKindAsk({
        words: askWordsForSlot({ slot: row.slot, words: row.words, prior: input.priorWords }),
      })?.question ?? null;
    if (question === null || question.trim() === "") continue;

    /* A per-side slot says which side in its own key, and an open kind's side
       rides the open grammar rather than the closed one. Read from the key in
       both cases, never from the words: `sideFromWords` is the inference
       fable-1115 §3 outlawed on the one field where a confident guess is a
       refund and an apology. */
    const side = open === null ? parseSlot(row.slot)?.instance ?? null : open.side;
    out.push({ slot: row.slot as FeatureSlot, question, side });
  }
  return out;
}

/**
 * THE SAME DEFECT ON THE TATTOO ROW — a delivery crop's box drifts too
 * (law 7's sweep, opus-1106 §4; ruled fable-1448 §4).
 *
 * A delivery crop is **minted ONCE, from the frame that FIRST delivered it,
 * never re-cut from a later carry** — its own design note's words — and its six
 * geometry columns ARE the panel's rectangle. So the moment she edits anything
 * else, the tattoo card's box is a measurement of a frame nobody is looking at.
 *
 * Measured on production before this was built:
 *
 *     casting_ink_delivery_crops                                    6
 *     …with at least one ready version after the delivering one     5
 *     cand 1643 · ink:upperArm@left · v216 box x=0 · v217 box x=834
 *
 * That last line is the finding in one row: the same slot on the same cast, two
 * adjacent versions, 834px apart.
 *
 * # ⚠ `upperChest` REFUSES RATHER THAN FILING, and it is the one rule here
 *
 * The roll prompt dresses her in a crew-neck tee, so the ordinary master's
 * chest is covered — and **a read the mint cannot make under that shirt is not
 * one this re-read can make either.** `gate_ink_uncarried` exists because of
 * exactly that: the words road walls `upperChest` because the mint writes
 * nothing there. Asking anyway risks worse than a stale box, because a
 * segmenter asked for a covered surface may outline the GARMENT.
 *
 * So the refusal is stated, free, and named — the wardrobe is the reason, and
 * the countable line says so rather than leaving a silent empty read.
 *
 * ⚠ **AND THERE IS A THIRD OUTCOME ON THE RECORD THAT THIS DELIBERATELY DOES
 * NOT SERVE.** Production cand 1641 v207 shows the engine SCOOPING the neckline
 * and delivering onto bare skin — a chest that IS readable, whose box drifts
 * like any other. Serving it would need a court first (does `upper chest` on a
 * clothed frame answer nothing, or answer the shirt?), and until somebody buys
 * that reading the safe answer and the ruled one are the same answer.
 */
export function carriedInkSlotsForGeometry(input: {
  /** The version's worn tattoos — `slot → cropId`, off its own composed delta. */
  delivered: Readonly<Record<string, string>>;
  /** The slot this render delivered, whose crop is cut from THIS frame. */
  deliveredThisRender?: string | null;
}): { slots: CarriedSlotToReRead[]; refused: string[] } {
  const slots: CarriedSlotToReRead[] = [];
  const refused: string[] = [];
  for (const slot of Object.keys(input.delivered)) {
    if (slot === input.deliveredThisRender) continue;
    const placement = inkPlacementOfSlot(slot);
    if (placement === null || !isInkPlacement(placement.placement)) continue;
    if (!INK_SURFACES_READABLE_ON_A_DRESSED_FRAME.includes(placement.placement)) {
      refused.push(slot);
      continue;
    }
    slots.push({
      slot: slot as FeatureSlot,
      /* The MEASURED segmenter word, never the copy noun beside it — they are
         identical for all three placements today, which is exactly how that
         conflation would survive review. */
      question: inkPlacementEntry(placement.placement).readerWord,
      side: placement.side,
    });
  }
  return { slots, refused };
}

/**
 * The placements a re-read may be asked of on an ordinary delivered frame.
 *
 * Derived from what the WORDS ROAD already proved end to end rather than
 * re-decided here: `neck` and `upperArm` are the two the mint demonstrably
 * writes a crop for, and `upperChest` is the one it does not, under the roll
 * prompt's own crew tee. A second list would drift from that one.
 */
const INK_SURFACES_READABLE_ON_A_DRESSED_FRAME: readonly InkPlacement[] = ["neck", "upperArm"];

export type CarriedGeometryResult = {
  /** How many features were asked about. */
  asked: number;
  /** How many came back with a rectangle. */
  filed: number;
  /** The slots whose read did not settle, so a quiet regression is countable. */
  unread: readonly string[];
  /** Whether the row was written. False on every failure and on a stand-down. */
  written: boolean;
};

/**
 * RE-READ EVERY CARRIED FEATURE ON THIS FRAME AND FILE THE RESULT.
 *
 * Never throws. Never awaits anything the customer's picture depends on.
 *
 * The reads run together rather than one after another: they are independent
 * questions about one photograph, and the provider's own courtesy pool
 * (`FAL_CONCURRENCY`) is what bounds them — a loop here would add its own
 * seconds to a wait somebody is already inside, and would bound nothing that is
 * not already bounded.
 */
export async function reMintCarriedGeometry(input: {
  userId: number;
  candidateId: number;
  candidatePublicId: string;
  variantId: number | null;
  /** The key the delivered bytes were stored under — the staleness guard's
   *  other end. A row whose frame has moved is refused rather than served. */
  frameKey: string;
  frame: { bytes: Buffer; url?: string | null };
  slots: readonly CarriedSlotToReRead[];
  reader: RegionReader;
  dependencies?: {
    write?: typeof keepCarriedGeometry;
  };
}): Promise<CarriedGeometryResult> {
  const empty: CarriedGeometryResult = { asked: 0, filed: 0, unread: [], written: false };
  if (input.slots.length === 0) return empty;

  if (input.slots.length > CARRIED_GEOMETRY_COST_NOTE_ABOVE) {
    log.info(
      { candidateId: input.candidateId, carried: input.slots.length },
      "[carriedGeometry] this face carries more features than the per-render cost note was written for — re-read CARRIED_GEOMETRY_COST_NOTE_ABOVE",
    );
  }

  const write = input.dependencies?.write ?? keepCarriedGeometry;
  try {
    const read = async (one: CarriedSlotToReRead): Promise<StoredCarriedSlot | null> => {
      const ask = {
        image: input.frame.bytes,
        name: one.question,
        /*
          NOTHING FOUND IS AN ANSWER, and it is the right one here. This asks a
          DELIVERED frame where a feature the branch says she has now sits; an
          empty reply means the frame does not show it, which is a rectangle we
          must not draw rather than a question that failed.
        */
        absentIsAnswer: true,
        /* Her axis is hers, not this frame's — the same 0.3px measurement the
           mint's own bilateral reads ride on. */
        axisKey: input.candidatePublicId,
        ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
      };
      const mask = one.side === null
        ? await input.reader.region(ask)
        /* A side is scoped by the reader or it is not scoped at all: the
           whole-frame answer to a bilateral question is BOTH of them, and a box
           drawn from it would span her two horns and be labelled as one. */
        : await input.reader.regionSides?.(ask).then((sides) => sides?.[one.side!] ?? null) ?? null;
      if (!mask) return null;
      const bounds = boundsOf(mask);
      if (bounds === null) return null;
      /* The frame travels WITH the box and is taken from the same object it was
         measured in — `PanelBox`'s own rule, kept across the write. Two
         readings of the frame's size could disagree; a mask and its own
         dimensions cannot. */
      return { slot: one.slot, box: { ...bounds, frame: { width: mask.width, height: mask.height } } };
    };

    const settled = await Promise.all(input.slots.map(async (one) => {
      try {
        return { one, found: await read(one) };
      } catch (error) {
        log.warn(
          { err: String(error).slice(0, 200), slot: one.slot, candidateId: input.candidateId },
          "[carriedGeometry] a carried feature's geometry was not re-read",
        );
        return { one, found: null };
      }
    }));

    const carried = settled.map((entry) => entry.found).filter((one): one is StoredCarriedSlot => one !== null);
    const unread = settled.filter((entry) => entry.found === null).map((entry) => entry.one.slot);
    if (unread.length > 0) {
      /*
        THE COUNTABLE LINE (fable-1443 condition 2), and its reason is the whole
        of why it exists: **a re-mint that quietly starts failing is stale
        geometry returning with a green suite.** Slot and variant, so a grep
        answers *which feature, on whose render* without a database.
      */
      log.info(
        { candidateId: input.candidateId, variantId: input.variantId, unread },
        "[carriedGeometry] a carried feature's geometry was not re-read — its box is still the frame it was minted on",
      );
    }
    if (carried.length === 0) return { asked: input.slots.length, filed: 0, unread, written: false };

    const kept = await write({
      publicId: randomUUID(),
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      frameKey: input.frameKey,
      carried,
    });
    if (!kept.written) {
      log.info(
        { candidateId: input.candidateId, variantId: input.variantId, reason: kept.reason },
        "[carriedGeometry] this version's row is about different bytes — the carried geometry stood down",
      );
    }
    return { asked: input.slots.length, filed: carried.length, unread, written: kept.written };
  } catch (error) {
    /*
      THE ABSENT TABLE ARRIVES HERE (fable-1445 condition 3), along with every
      other failure, and it is the same answer: the render lands, the panel is
      exactly what it was yesterday, and the line above says so. An environment
      that has not taken migration 0032 must never lose a picture to a
      convenience.
    */
    log.warn(
      { err: String(error).slice(0, 200), candidateId: input.candidateId, variantId: input.variantId },
      "[carriedGeometry] this render's carried geometry was not filed — the picture stands and the boxes are the ones they were",
    );
    return { asked: input.slots.length, filed: 0, unread: input.slots.map((one) => one.slot), written: false };
  }
}
