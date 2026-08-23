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
} from "../../shared/inkPlacementVocabulary";
import { wardrobeCoversSurface } from "./inkSurfaceCoverage";
import type { WardrobeResolution } from "./wardrobeLine";
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
  /**
   * WHETHER AN EMPTY ANSWER HERE IS EXPLAINED RATHER THAN BROKEN.
   *
   * `unread` is the countable line that means *a re-mint has quietly started
   * failing* (fable-1443 condition 2). A surface this cast's own outfit covers
   * answers nothing every single time, correctly — and counting that as a
   * regression is how a working counter stops meaning anything within a week.
   *
   * Set by the caller, from the ONE OWNER of *does this cast's wardrobe cover
   * this surface* (`inkSurfaceCoverage`), never from a list of placements kept
   * here. It says nothing about whether to ASK: the scoop court's arm A is a
   * frame whose stored line says `covered` and whose chest is bare, so a
   * coverage answer may explain an absence and must never suppress a read.
   */
  coveredWhenEmpty?: boolean;
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
 * # ⚠ `upperChest` USED TO BE REFUSED HERE. THE COURT RAN AND IT IS NOT
 *
 * A constant — `INK_SURFACES_READABLE_ON_A_DRESSED_FRAME = ["neck",
 * "upperArm"]` — stood here and dropped every chest slot before a read was
 * spent. Its stated reason was a HYPOTHESIS: *a segmenter asked for a covered
 * surface may outline the GARMENT.* The commit that wrote it filed the court
 * that would settle it, and that court ran (opus-1110, ruled fable-1452 ASK 1).
 *
 * **`upper chest` on a clothed frame answers NOTHING. It does not answer the
 * shirt.** Ten frames across three casts and two garments, one word, one
 * instrument, every overlay opened and looked at:
 *
 * ```
 *   cand 1641 v207  the SCOOPED delivery, chest bare    111,608 px   the bare skin,
 *                                                                    stopping at the
 *                                                                    fabric edge
 *   cand 1641 v206  the same man, crew tee                     0 px  NOTHING
 *   cand 1641       his pristine master, crew tee              0 px  NOTHING
 *   cand 1643 v217  a different cast, crew tee                 0 px  NOTHING
 *   the caveman sheet, a PICKED hide wrap × 2       66,046 / 64,942  the bare chest
 *                                                                    beside the hide
 *   the basics sheet, a sports top × 4                        0 px  NOTHING
 * ```
 *
 * ⚠ **AND THE HYPOTHESIS IS NOT FALSE IN GENERAL — IT IS FALSE OF THIS WORD,
 * AND TRUE ONE SYNONYM AWAY.** On the same Basics frame where `upper chest`,
 * `chest skin` and `chest` all read ZERO, **`decolletage` returned 88,032 px —
 * and the overlay is the SPORTS BRA, outlined precisely, with no skin in it**
 * (`output/two-paths-court/READ-BASICS-word-decolletage.jpg`). That is the
 * garment-outlining failure the refusal feared, photographed, reached by
 * changing nothing but the noun.
 *
 * So what makes asking the chest safe is not the reader's good judgement; it is
 * that {@link inkPlacementEntry}'s `readerWord` is a MEASURED word and this
 * code asks that and nothing else. D-213 was already the rule. It now has a
 * specimen: swapping in a more natural-sounding synonym would draw a rectangle
 * over a woman's sports bra and label it the surface her tattoo sits on.
 *
 * So the chest is asked like every other surface. On a covered frame the read
 * comes back empty, `boundsOf` answers null, **no rectangle is drawn**, and the
 * outcome is `covered` rather than `unread` — see {@link CarriedSlotToReRead}'s
 * own field, which is what keeps the regression counter meaning something.
 *
 * ⚠ **AND THE ANSWER WAS ALREADY IN THIS REPOSITORY WHEN THE REFUSAL WAS
 * WRITTEN**, which is the more useful half of the story.
 * `docs/specs/V3B_PLACEMENT_VOCABULARY_READING.md` §4 measured the same word on
 * a bare-scoop frame and a covered-crew frame as its own negative control —
 * *"upper chest FOUND 2.69% · nothing"* — and called it *"the occlusion-aware,
 * per-frame honesty a placement vocabulary needs"*. `inkPlacementVocabulary.ts`
 * carries that sentence on the `upperChest` entry to this day, one import away
 * from the constant that refused on the opposite assumption. **The hypothesis
 * was not merely untested; it disagreed with a driven reading nobody re-read.**
 *
 * ⚠ **THE VERDICT IS SCOPED TO THE GREY CREW TEE BY CONSTRUCTION, and that is
 * this reading's real limit** (fable-1452 ASK 1, condition 2). Every production
 * master wears the roll prompt's own line, so the clothed population is three
 * frames of ONE GARMENT — the fixture lesson exactly: *a fixture family shares
 * the property that kills you.* **The Wardrobe path's first non-house garments
 * — a picked one-shoulder hide, a customer-named apron — RE-OPEN this court**,
 * and the same sentence is written into the Two Paths flip preconditions so
 * that whoever widens the flag meets it there too. The Basics path argues the
 * other way and needs no line: it leaves the chest bare by design.
 */
export function carriedInkSlotsForGeometry(input: {
  /** The version's worn tattoos — `slot → cropId`, off its own composed delta. */
  delivered: Readonly<Record<string, string>>;
  /** The slot this render delivered, whose crop is cut from THIS frame. */
  deliveredThisRender?: string | null;
  /**
   * WHAT THIS CAST IS WEARING — the resolution, whole, never flattened.
   *
   * Only ever used to EXPLAIN an empty answer, never to decide whether to ask.
   * Absent is the house crew tee, which is what `wardrobeCoversSurface` does
   * with silence and is every roll in production today.
   */
  wardrobe?: WardrobeResolution;
}): CarriedSlotToReRead[] {
  const slots: CarriedSlotToReRead[] = [];
  for (const slot of Object.keys(input.delivered)) {
    if (slot === input.deliveredThisRender) continue;
    const placement = inkPlacementOfSlot(slot);
    if (placement === null || !isInkPlacement(placement.placement)) continue;
    slots.push({
      slot: slot as FeatureSlot,
      /* The MEASURED segmenter word, never the copy noun beside it — they are
         identical for all three placements today, which is exactly how that
         conflation would survive review. */
      question: inkPlacementEntry(placement.placement).readerWord,
      side: placement.side,
      /*
        THE ONE OWNER ANSWERS THIS, and a placement list here would be the
        second copy of it (working law 4).

        `INK_PLACEMENTS.skin` — the frozen `dependsOnGarment` field this would
        once have read — was DELETED at item 7a (fable-1368 ruling 3), for the
        reason that applies here word for word: it was a fact about ONE OUTFIT
        wearing the shape of a fact about a placement. `inkSurfaceCoverage` is
        its named successor and it answers from the cast's own stored line, so
        a Basics cast's bare chest is not called covered by a table.

        `unknown` is deliberately NOT `covered`: a line nobody has read the
        coverage of gives no reason for an empty answer, so it stays countable.
      */
      coveredWhenEmpty:
        wardrobeCoversSurface(input.wardrobe, placement.placement) === "covered",
    });
  }
  return slots;
}

/**
 * What one re-read came back as. `empty` and `failed` are deliberately not one
 * value — see the note at the read itself.
 */
type ReadOutcome =
  | { kind: "box"; box: StoredCarriedSlot }
  | { kind: "empty" }
  | { kind: "failed" };

export type CarriedGeometryResult = {
  /** How many features were asked about. */
  asked: number;
  /** How many came back with a rectangle. */
  filed: number;
  /** The slots whose read did not settle, so a quiet regression is countable. */
  unread: readonly string[];
  /**
   * The slots that came back EMPTY for a reason this cast's own outfit gives.
   *
   * Kept apart from {@link unread} because they are opposite facts wearing one
   * shape: `unread` means *something we expected to work did not*, and this
   * means *the surface is under her clothes, exactly as her wardrobe line
   * says.* Folding the second into the first fires the regression counter on
   * every ordinary render that carries a chest piece, and a counter that fires
   * routinely is a counter nobody reads (fable-1452 ASK 1).
   */
  covered: readonly string[];
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
  const empty: CarriedGeometryResult = { asked: 0, filed: 0, unread: [], covered: [], written: false };
  if (input.slots.length === 0) return empty;

  if (input.slots.length > CARRIED_GEOMETRY_COST_NOTE_ABOVE) {
    log.info(
      { candidateId: input.candidateId, carried: input.slots.length },
      "[carriedGeometry] this face carries more features than the per-render cost note was written for — re-read CARRIED_GEOMETRY_COST_NOTE_ABOVE",
    );
  }

  const write = input.dependencies?.write ?? keepCarriedGeometry;
  try {
    /*
      THREE OUTCOMES, NOT TWO, and the third is the whole of ASK 1's condition.

      A THROW and an EMPTY ANSWER both used to arrive as `null`, which is fine
      while every empty answer is a failure. It stops being fine the moment a
      surface is legitimately covered: `covered` must never absorb a reader that
      fell over, so the two are told apart HERE — where the difference is
      actually known — rather than guessed at from the outside.
    */
    const read = async (one: CarriedSlotToReRead): Promise<ReadOutcome> => {
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
      if (!mask) return { kind: "empty" };
      const bounds = boundsOf(mask);
      if (bounds === null) return { kind: "empty" };
      /* The frame travels WITH the box and is taken from the same object it was
         measured in — `PanelBox`'s own rule, kept across the write. Two
         readings of the frame's size could disagree; a mask and its own
         dimensions cannot. */
      return {
        kind: "box",
        box: { slot: one.slot, box: { ...bounds, frame: { width: mask.width, height: mask.height } } },
      };
    };

    const settled = await Promise.all(input.slots.map(async (one) => {
      try {
        return { one, found: await read(one) };
      } catch (error) {
        log.warn(
          { err: String(error).slice(0, 200), slot: one.slot, candidateId: input.candidateId },
          "[carriedGeometry] a carried feature's geometry was not re-read",
        );
        return { one, found: { kind: "failed" } as ReadOutcome };
      }
    }));

    const carried = settled.flatMap((entry) => (entry.found.kind === "box" ? [entry.found.box] : []));
    /* An empty answer the cast's own outfit explains — and ONLY an empty one.
       A `failed` is never covered, whatever the wardrobe says. */
    const covered = settled
      .filter((entry) => entry.found.kind === "empty" && entry.one.coveredWhenEmpty === true)
      .map((entry) => entry.one.slot);
    const unread = settled
      .filter((entry) => entry.found.kind === "failed"
        || (entry.found.kind === "empty" && entry.one.coveredWhenEmpty !== true))
      .map((entry) => entry.one.slot);
    if (covered.length > 0) {
      /* Its own line, at its own level: this is the product working, and it
         reads as such in a log somebody greps for the line below. */
      log.debug(
        { candidateId: input.candidateId, variantId: input.variantId, covered },
        "[carriedGeometry] a carried feature answered nothing and its wardrobe says why — the surface is under her clothes",
      );
    }
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
    if (carried.length === 0) return { asked: input.slots.length, filed: 0, unread, covered, written: false };

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
    return { asked: input.slots.length, filed: carried.length, unread, covered, written: kept.written };
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
    /* Everything is UNREAD here and nothing is `covered`: this arm is reached
       by the table being absent, the write throwing, or the frame not existing
       — none of which is a fact about her clothes. */
    return {
      asked: input.slots.length,
      filed: 0,
      unread: input.slots.map((one) => one.slot),
      covered: [],
      written: false,
    };
  }
}
