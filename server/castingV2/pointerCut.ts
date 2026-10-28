/**
 * THE POINTER ROAD — cutting a thing the catalogue has never heard of (#2566
 * slice 2 of the design he approved on #2532).
 *
 * # What it is for, in his words
 *
 * *"n3 is meant to be bringing in the ability to detect all/any features right
 * rather than from a list?"* Slice 1 answered the first half: a discovery read
 * NAMES everything on the cast, including the third eye, the jaw hardware, the
 * jacket and the sash. It then threw every one of those names away, because the
 * catalogue has no question for them and the panel draws no row without a
 * picture (his ruling on #2532: *"no features should ride in the image analyzer
 * on the right panel unless it has an image to go with it like i dont wanna
 * just see words in there"*). This module is the picture.
 *
 * Two calls per instance, and both are the measured choice rather than the
 * obvious one:
 *
 *   1. the open-vocabulary DETECTOR puts a rectangle round the customer's own
 *      bare noun (`RegionReader.pointer` -> moondream3 `detect`);
 *   2. the SEGMENTER cuts inside that one rectangle (`RegionReader.regionInBox`
 *      -> SAM 3 `box_prompts`).
 *
 * #2532's bench, 15 cells on three production casts: **`detect` -> box cuts the
 * whole feature 7 times in 10, where the text road manages 3 and a point
 * manages 4.** The text road asked `jaw hardware` and returned nothing at all.
 *
 * # ⚠ THE COUNT IS A CAP, AND IT IS THE ONE LINE THAT STOPS A RIGHT ANSWER
 * GOING WRONG
 *
 * The design says both of these and they read as a contradiction until the
 * measurement is in front of you: *"`box_prompts` with the FIRST box"*, and
 * *"a `detect` that returns several boxes on a counted feature is several
 * rows"*. What reconciles them is clause 2 of the same comment — **sending
 * several boxes does not combine them, it switches which object you get.** Two
 * boxes on the jaw moved the cut from the right tube to the left; on the
 * three-eyed cast the detector returned THREE boxes for `third eye` and sending
 * all three made the segmenter cut **a normal eye**, turning a right answer
 * wrong.
 *
 * So: **one box per call, always** — the reader's type refuses an array — and
 * **at most `count` boxes, in the order the detector returned them**, where
 * `count` is what the discovery read said it could see. On a count of one that
 * is exactly the arm that won 7 of 10. On a count of two it is the design's
 * *several rows*, one cut each, never a union (#2565 §6: left and right are
 * separate items). And on the cast that defeated the old shape it is the cap
 * doing its job: `third eye` counted ONE, so the two extra rectangles the
 * detector found round the ordinary eyes are never asked about.
 *
 * # WHICH NAMES COME HERE, AND THE LIST IS DERIVED
 *
 * A name the catalogue already asks about must NOT come here — the scan asks the
 * whole catalogue on every reading (the relay's second finding on PR #2570), so
 * a pointer call for `hair` would be the same feature bought twice and filed
 * twice. {@link coveredByCatalogue} answers that from `catalogueSlots()` itself
 * rather than from a second list beside it: slice 1 shipped a hand-written
 * phrasebook and the relay deleted it, and a replacement roster here would be
 * working law 4's mirror in the same week.
 *
 * ⚠ **The match is on the WHOLE normalised name and never a substring**, which
 * is not fussiness: `jaw` is a catalogue slot and **`jaw hardware` is the
 * feature this whole road exists for.** So is `third eye` against `eyes`, and
 * `neck tattoo` against nothing at all. Measured against the 69 names the three
 * production fixtures really produced (#2566's own full-frame run), a substring
 * rule would have swallowed the jaw hardware and the third eye — the two
 * headline finds of the card.
 *
 * # WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT JUDGE
 *
 * Two refusals, and neither is a threshold somebody picked:
 *
 *   **a mask with no pixels** — there is nothing to draw and nothing to point
 *   at, so there is no row;
 *   **a mask that does not overlap the rectangle that asked for it** — the
 *   segmenter answered about something else. A yes/no about two rectangles,
 *   with no tolerance to tune.
 *
 * ⚠ **WHOLENESS AND LOOSENESS ARE NOT JUDGED HERE, AND THAT IS DECLARED RATHER
 * THAN OVERLOOKED.** #2532's own open list ends *"the loose-region case is still
 * unsolved"* — a shoulder wrap the detector declines, a forehead the detector
 * returns with the eyes inside it — and the bar that handles it is **#2565 §4's**
 * (*"a cut with holes or broken edges is not used"*, with the clean-up that
 * closes gaps and feathers outside only). That card's slice 2 is unbuilt at the
 * time of writing, so this road has no clean-and-refuse pipeline to call and
 * does not invent one: an area threshold here would be a number nobody
 * measured, standing in for a bar he has already approved the shape of. What
 * guards it meanwhile is that the flag is dark and the flip is **his eye on real
 * panels** (the design's §8 step 4), and that every cut logs its noun and its
 * area so the frames can be read rather than guessed at.
 *
 * # It cannot take a row off the panel, and it cannot break a scan
 *
 * Every failure is local to one name: a detector that errors, a segmenter that
 * returns nothing, a mask that will not fetch — each drops THAT row and leaves
 * every other row and the whole catalogue scan exactly as they are. A reader
 * without the capability produces no rows at all, which is today's panel. That
 * is the property slice 1 was held on twice and it is the one to protect.
 */
import { boundsOf } from "./segmentCuts";
import { catalogueSlots } from "./referenceSlotCatalogue";
import { createModuleLogger } from "../logging/logger";
import type { DiscoveredFeature } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { PanelBox } from "./facePanel";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";

const log = createModuleLogger("castingV2/pointerCut");

/**
 * THE KEY PREFIX FOR A ROW NOBODY CATALOGUED.
 *
 * `open:` is already taken and means something different — a kind the CUSTOMER
 * introduced by editing, whose rows live in the library. These are rows the
 * READING found, so they get their own namespace and cannot be confused with
 * either a catalogue slot or an open kind by anything that parses a key.
 *
 * ⚠ **NOTHING MAY READ A CUSTOMER-FACING WORD OUT OF THIS KEY**, which is the
 * open lane's own binding condition arriving again: `cat ears` and `cat-ears`
 * both slug the same way, so the key cannot say which was written. The noun
 * travels as data on {@link DiscoveredRegion}, and the panel reads it from
 * there.
 */
export const DISCOVERED_SLOT_PREFIX = "discovered:";

/*
  AND THERE IS NO `isDiscoveredSlot` BESIDE IT, deliberately. A predicate here
  would read as diligence and have no caller: nothing in the product branches on
  whether a key is this road's, because the prefix makes a collision with a
  catalogue slot or an `open:` kind impossible by construction. `pointerCut.test.ts`
  holds that non-collision against the real catalogue, which is the one place it
  can actually be checked — an unread export is what #2605 swept 62 of.
*/

/**
 * The key for one instance of one found name.
 *
 * Stable across readings of the same frame so a client keying on it does not
 * remount a row for no reason, and unique within a reading, which is all it has
 * to be: it is an identity, not a description.
 */
export function discoveredSlotOf(name: string, instance: number): FeatureSlot {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${DISCOVERED_SLOT_PREFIX}${slug === "" ? "feature" : slug}#${instance}`;
}

/** One cut instance of one thing the reading found on this cast. */
export type DiscoveredRegion = {
  slot: FeatureSlot;
  /** The customer's own bare noun, as the reading wrote it. Never derived from
   *  {@link DiscoveredRegion.slot}. */
  noun: string;
  /** Which instance of that noun, from 1 — so a row can say so if it ever
   *  needs to, and so two rows of one noun are legibly two. */
  instance: number;
  box: PanelBox;
  mask: Mask;
};

/**
 * Every word the catalogue already asks about or already draws, normalised.
 *
 * Derived from `catalogueSlots()` on every call — the catalogue is a pure
 * function over module constants, so this is cheap, and a cached copy is the
 * second list this function exists to avoid.
 *
 * Five fields rather than one, each for a different reason a name can already
 * be covered: `question` is what goes to the segmenter, `display` is the region
 * a row may be drawn from, `noun` and `pairNoun` are what the panel calls it,
 * and `feature` is the key's own half. A discovery saying any of them is talking
 * about a row the scan is already buying.
 */
function catalogueVocabulary(): ReadonlySet<string> {
  const words = new Set<string>();
  for (const definition of catalogueSlots()) {
    for (const word of [
      definition.question,
      definition.display,
      definition.noun,
      definition.pairNoun,
      definition.feature,
    ]) {
      if (typeof word !== "string" || word.trim() === "") continue;
      words.add(normalisedName(word));
    }
  }
  return words;
}

/**
 * One spelling of a name, for comparison only.
 *
 * Lowercased, hyphens and runs of space folded to one space, and a trailing
 * `s` dropped from the LAST word — so `ears` reaches the catalogue's `ear`,
 * `facial-hair` reaches `facial hair`, and `shoulder plates` reaches
 * `shoulder plate` without either of them reaching anything they should not.
 *
 * ⚠ The plural fold is on the last word only and is deliberately crude: it is
 * used to decide WHICH ROAD cuts a name, where both roads produce a row, so a
 * wrong answer costs a feature being bought on the cheaper road or on the wider
 * one. It is never shown to anybody and never sent to a model — the noun the
 * customer reads is the reading's own, untouched.
 */
export function normalisedName(name: string): string {
  const flat = name.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  const words = flat.split(" ");
  const last = words[words.length - 1];
  if (last !== undefined && last.length > 3 && last.endsWith("s") && !last.endsWith("ss")) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(" ");
}

/**
 * Whether the catalogue already asks about this name.
 *
 * Whole-name equality after {@link normalisedName}, and the module header says
 * why it may never be a substring test.
 */
export function coveredByCatalogue(name: string): boolean {
  return catalogueVocabulary().has(normalisedName(name));
}

/**
 * The reading's names that no catalogue question covers — the pointer road's
 * whole population.
 *
 * Order is the reading's own, which is the order the model named things in and
 * is as good an order as any; the panel sorts its own rows.
 */
export function offListFeatures(
  features: readonly DiscoveredFeature[],
): readonly DiscoveredFeature[] {
  return features.filter((feature) => !coveredByCatalogue(feature.name));
}

/** Do two rectangles share any pixel at all. */
function overlaps(a: PointerBox, b: PointerBox): boolean {
  return a.x < b.x + b.width
    && b.x < a.x + a.width
    && a.y < b.y + b.height
    && b.y < a.y + a.height;
}

/**
 * Cut every off-list thing the reading named.
 *
 * `onFiled` is called as each row lands, so a panel that is already on screen
 * fills in rather than waiting for the last garment — the same courtesy
 * `scanFace` gives the catalogue rows, and the reason a reading that takes
 * forty seconds does not read as a reading that is stuck.
 *
 * ⚠ **EVERY NAME IS ASKED IN PARALLEL AND THE BOUND IS THE READER'S OWN GATE,
 * NOT A NUMBER HERE.** A dressed cast produces a dozen off-list names and each
 * one is two calls, so serial would be seventy-odd seconds in front of somebody
 * watching a panel fill — against the design's own estimate of 40–60 s for a
 * whole first reading. Every call this road makes goes through
 * `throughFalGate`, whose width is `FAL_CONCURRENCY` and whose reason is the
 * account's twenty-concurrent ceiling, so the queueing already happens in the
 * one place that knows about the catalogue scan running beside it. A second
 * limiter here would be a second opinion about one ceiling (working law 4), and
 * the one that fell behind would either waste the allowance or exceed it.
 */
export async function cutDiscovered(input: {
  frame: { bytes: Buffer; width: number; height: number; url?: string };
  features: readonly DiscoveredFeature[];
  reader: RegionReader;
  onFiled?: (region: DiscoveredRegion) => void;
}): Promise<{ regions: DiscoveredRegion[]; asked: number; declined: string[]; failed: string[] }> {
  const { pointer, regionInBox } = input.reader;
  const regions: DiscoveredRegion[] = [];
  const declined: string[] = [];
  const failed: string[] = [];
  let asked = 0;

  /* A reader without the capability produces no rows, which is today's panel.
     It is checked once here rather than per name so the log says it once. */
  if (pointer === undefined || regionInBox === undefined) {
    log.warn({}, "this reader cannot point at a thing it has no word for — no found rows");
    return { regions, asked, declined, failed };
  }

  const frame = { width: input.frame.width, height: input.frame.height };
  const population = offListFeatures(input.features);
  asked = population.length;

  const perName = await Promise.all(population.map(async (feature) => {
    const mine: DiscoveredRegion[] = [];
    let boxes: readonly PointerBox[];
    try {
      boxes = await pointer.call(input.reader, {
        image: input.frame.bytes,
        name: feature.name,
        imageUrl: input.frame.url,
      });
    } catch (error) {
      /* A transport failure is NOT an absence — see `RegionReader.pointer`. It
         costs this one row and nothing else. */
      log.warn(
        { name: feature.name, why: error instanceof Error ? error.message : String(error) },
        "the detector could not be asked about this one — no row for it",
      );
      return { name: feature.name, regions: mine, declined: false, broke: true };
    }
    if (boxes.length === 0) {
      /* The reading named it and the detector cannot find it. No row, by his
         ruling, and it is recorded rather than silently dropped: the words
         still reach the current description (#2565 §2) and the next edit to
         that area asks again. */
      return { name: feature.name, regions: mine, declined: true, broke: false };
    }

    /* THE CAP — the module header carries the measurement it comes from. */
    const asking = boxes.slice(0, Math.max(1, feature.count));
    let broke = false;
    const cut = await Promise.all(asking.map(async (box, index) => {
      try {
        const mask = await regionInBox.call(input.reader, {
          image: input.frame.bytes,
          name: feature.name,
          box,
          imageUrl: input.frame.url,
        });
        if (mask === null) return { index, region: null, broke: false };
        const bounds = boundsOf(mask);
        if (bounds === null) {
          log.debug({ name: feature.name }, "the cut had no pixels in it — no row");
          return { index, region: null, broke: false };
        }
        if (!overlaps(bounds, box)) {
          /* The segmenter cut something, somewhere else. Not a quality
             judgement and not a tolerance: the rectangle WAS the question. */
          log.warn(
            { name: feature.name, askedAbout: box, answered: bounds },
            "the cut sits outside the rectangle it was asked about — no row",
          );
          return { index, region: null, broke: false };
        }
        return {
          index,
          region: {
            slot: discoveredSlotOf(feature.name, index + 1),
            noun: feature.name,
            instance: index + 1,
            box: { ...bounds, frame },
            mask,
          } satisfies DiscoveredRegion,
          broke: false,
        };
      } catch (error) {
        log.warn(
          { name: feature.name, why: error instanceof Error ? error.message : String(error) },
          "the cut inside that rectangle could not be made — no row for it",
        );
        return { index, region: null, broke: true };
      }
    }));
    for (const one of cut.sort((a, b) => a.index - b.index)) {
      if (one.broke) broke = true;
      if (one.region === null) continue;
      mine.push(one.region);
      input.onFiled?.(one.region);
    }
    return { name: feature.name, regions: mine, declined: false, broke };
  }));

  /* Gathered in the READING's own order, never in the order the provider
     happened to answer in: a panel that re-orders itself between two readings
     of one frame is the instability slice 1 was held on. */
  for (const one of perName) {
    if (one.declined) declined.push(one.name);
    if (one.broke) failed.push(one.name);
    for (const region of one.regions) regions.push(region);
  }

  /*
    ⚠ `found` IS ROWS, NOT CALLS, AND THE DIFFERENCE IS THE COST (the relay's
    note on PR #2692, #2566).

    A cut that came back with no mask, with no pixels in it, or sitting outside
    the rectangle it was asked about is a call BOUGHT and a gate slot SPENT
    with no row to show for it — so `found` systematically understates what a
    reading cost, in the one direction that hides it. The header's own
    three-eyed-cast specimen is exactly that: a rectangle answered, a normal
    eye cut, the row discarded.

    **The number of calls is the call census's, not this line's** — one
    instrument, which is why there is no counter here (working law 4). They are
    `POINTER_DETECT_ABOUT` and `POINTER_BOX_ABOUT` in the census's `byAbout`,
    kept apart because a `detect` is one per name and a box call is up to
    `count` of them; `wallMs` beside them is the reading's wall time. The
    scan logs the whole table on every reading (`[faceScanService] scanned a
    face-version`).
  */
  log.info(
    {
      asked,
      found: regions.length,
      declined: declined.length,
      failed: failed.length,
      /* The noun and the share of the frame each row covers, so the flip can be
         judged at the frames rather than at a count — the loose-cut question the
         header declares is open is exactly what this line is for. */
      rows: regions.map((region) => ({
        noun: region.noun,
        instance: region.instance,
        area: Number(
          ((region.box.width * region.box.height) / (frame.width * frame.height)).toFixed(4),
        ),
      })),
    },
    "pointer road",
  );
  return { regions, asked, declined, failed };
}
