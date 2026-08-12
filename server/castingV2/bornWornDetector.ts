/**
 * WHAT THE PICTURE SAYS SHE ALREADY HAS — the born-worn catalogue's detector
 * (segment permanence, slice 1; founder ruling, fable-085: "build the whole
 * system together").
 *
 * The store holds two kinds of row. An `edit_patch` is pixels an edit ADDED and
 * she kept; a `detected_born` row is a thing the master already had — glasses
 * that came with her brief, her own earrings, a stud the roll gave her. This
 * module finds the second kind.
 *
 * # A detected segment is a FACT, and the difference is the whole design
 *
 * It has no promise behind it, so it has no verdict and never enters a delivery
 * denominator. It has no pixels to re-composite, because it already lives in
 * the master and the compositor never pastes it. And removing one is still a
 * real render — taking off glasses she was rolled wearing means inventing the
 * skin, hair and shadow behind them, which is the departed/vacancy machinery,
 * untouched. Anyone reading this catalogue as "removal is solved" would delete
 * the hardest machinery in the product.
 *
 * # The vocabulary is DERIVED, never restated
 *
 * The classes are the accessory table's own regions (`accessoryKinds.ts`), one
 * per kind of object the product can already name, place and segment. A second
 * list of "things a face can wear" is a second answer to *are these the same
 * thing*, and law 4 says the copies drift — so there is one list and this file
 * only adds what a catalogue needs that a placement table does not: a floor,
 * and whether that floor has been measured yet.
 *
 * # A class files nothing until its controls have run (working law 2)
 *
 * `armed: false` is not a todo, it is the honest state of an instrument whose
 * verdicts nobody has earned the right to trust. An unarmed class is never even
 * asked — no vision call, no row, no cost — and arming one means putting its
 * positive and negative controls in the file that arms it, the way `glasses`
 * carries the 23-bare/8-bespectacled reading below. A catalogue that lists
 * things it merely suspects is worse than a short catalogue: it is a product
 * telling a customer what is on her face while guessing.
 */
import { createModuleLogger } from "../logging/logger";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { GLASSES_COVERAGE_FLOOR } from "./canthalTilt";
import { binaryCoverage } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

const log = createModuleLogger("castingV2/bornWornDetector");

/**
 * WHICH DETECTOR SAID SO — written onto every row it files.
 *
 * Detectors improve. A row that cannot say which one found it cannot be
 * re-earned by a better one, and the re-scan below keys its idempotency on
 * exactly this string: the same detector re-reading an unchanged master learns
 * nothing, so it files nothing.
 */
export const BORN_WORN_DETECTOR = "sam3-coverage@1";

export type BornWornClass = {
  /** The facet a filed row carries — the user's word for the thing. */
  id: string;
  /** The segmentation question that finds it. */
  region: string;
  /**
   * Coverage of the whole frame, above which the thing is IN the picture.
   * `null` means nobody has measured it, and an unmeasured class cannot arm.
   */
  floor: number | null;
  /** Where that number came from, in one sentence, or why there isn't one. */
  measurement: string;
  /** Armed classes are asked and may file rows. Unarmed ones are inert. */
  armed: boolean;
};

/**
 * Coverage of the whole frame, above which a pair of earrings is IN the picture.
 *
 * Beside the glasses floor in spirit and a hundredth of its size, which is the
 * whole reason the eyewear band could never stand in for it: the departure gate
 * was judging hoops against `COVERAGE_BANDS.eyewearFrames.min` (0.4%), **6.4x
 * the LARGEST of eight measured worn readings**, so no face wearing earrings
 * could ever be found to be wearing them. See the court table in
 * `FLOOR_OF_CLASS.earring` below for the two populations and their caveats.
 */
export const EARRING_COVERAGE_FLOOR = 0.0002;

/**
 * The floor for each kind of thing the accessory table can name, and its
 * provenance — every entry filled in, because a kind nobody has considered is
 * exactly the silent gap `FRINGE_AT_EDGE`'s closure test exists to forbid. A
 * new accessory kind arrives here as `null` and inert rather than as a guess.
 *
 * **A provenance sentence is not a citation, it is the court.** It names both
 * populations, their n, how they were classified, and what the number cannot
 * do — because the next person to move one of these will have only this line.
 */
const FLOOR_OF_CLASS: Record<
  string,
  {
    floor: number | null;
    measurement: string;
    /**
     * Withhold DETECTION while the departure floor stands. Absent = arm.
     *
     * The two jobs a floor does are not the same job. `departureFloorFor` judges
     * a frame the customer has already asked to change, where refusing to read
     * refuses every removal of the kind; `armed` decides whether this class is
     * hunted on a customer's untouched master and written into a record. A
     * number can be good enough for the first and premature for the second, and
     * until this field existed there was no way to say so.
     */
    deferArming?: string;
  }
> = {
  glasses: {
    floor: GLASSES_COVERAGE_FLOOR,
    measurement:
      "23 bare faces read 0.000% and 8 bespectacled faces 1.349–2.093% through the "
      + "production segmenter, 2026-08-09; the floor sits in the empty three orders "
      + "of magnitude between them (canthalTilt.ts)",
  },
  earring: {
    floor: EARRING_COVERAGE_FLOOR,
    measurement:
      "8 faces wearing hoops read 0.0404–0.0621% and 4 faces with VISIBLE BARE lobes "
      + "read 0.0000% through the production segmenter, 2026-08-13, across both worlds; "
      + "the floor sits 2x under the smallest worn reading "
      + "(scripts/read-earring-court-coverage-disposable.mts). Two honest caveats, "
      + "because they change what this number is for: the negatives are STRUCTURAL "
      + "zeros — SAM3 returned no segmentation at all, not a faint one — so the floor's "
      + "only current work is insurance against a spurious partial segmentation nobody "
      + "has yet observed; and a further 3 faces whose ears were HIDDEN BY HAIR read "
      + "0.0000% identically, so this reading cannot tell a bare ear from an unseen one",
    deferArming:
      "the court measured what the DEPARTURE gate needs and not what detection needs. "
      + "Hunting earrings on an untouched master asks the same reading that cannot "
      + "separate a bare lobe from one behind hair, and fable-340 rules that these kinds "
      + "arm only once their court uses the three-class design — a site may be called "
      + "bare only when it is VISIBLY bare. The floor is live for departures now; "
      + "arming waits for that court",
  },
  "nose stud": {
    floor: null,
    measurement: "NOT MEASURED — no positive/negative court has been run for nose studs",
  },
};

/**
 * The catalogue, derived from the placement table it shares a vocabulary with.
 *
 * A class is armed only when it has a floor AND that floor came from a
 * measurement — the two are separated so that writing a number here without a
 * court cannot arm anything by itself.
 *
 * **That implication runs one way only, and the earring court is why it had to
 * be said.** No floor still means never armed, which is the safety property.
 * But a floor no longer means armed by itself: `deferArming` lets a kind hold a
 * measured DEPARTURE floor while detection waits for the court detection needs.
 * Writing the earring number armed the detector as a side effect and the
 * existing pin caught it — the fix is to let the table say which job the
 * measurement was for, rather than to let one number answer two questions.
 */
export const BORN_WORN_CLASSES: readonly BornWornClass[] = LANDMARK_OF_ACCESSORY.map((entry) => {
  const measured = FLOOR_OF_CLASS[entry.region];
  return {
    id: entry.region,
    region: entry.region,
    floor: measured?.floor ?? null,
    measurement: measured?.measurement ?? "NOT CONSIDERED — this kind has no entry in FLOOR_OF_CLASS",
    armed: typeof measured?.floor === "number" && measured.deferArming === undefined,
  };
});

export function armedBornWornClasses(): readonly BornWornClass[] {
  return BORN_WORN_CLASSES.filter((entry) => entry.armed);
}

/**
 * THE FLOOR A DELIVERED FRAME IS JUDGED AGAINST when a render claims the thing
 * has LEFT her — the departure gate's half of this catalogue.
 *
 * Same segmenter, same question, same arithmetic as the detection above, so it
 * reads the same floors: two tables would be two answers to *is this thing in
 * this picture* and law 4 says the copies drift.
 *
 * # An unmeasured kind gets zero, and that is not a threshold
 *
 * `armed` governs whether a class may be LOOKED FOR on a master and file a row
 * about it — an unmeasured class must not, because a coverage number with no
 * court behind it is a guess about a customer's face. A departure is the other
 * situation: the render has already happened, she has already asked for the
 * thing to be gone, and the only question is whether to deliver it. Refusing to
 * read would mean refusing every removal of an unmeasured kind — which is
 * exactly the defect this function was written to end.
 *
 * So an unmeasured kind is judged at zero: not a guessed threshold but the
 * strictest reading there is — *the segmenter found nothing of it at all*. The
 * error it risks is refusing a delivered removal over a stray pixel, and that
 * is the direction that does not take her money (D-235's asymmetry). The
 * coverage is logged at the gate either way, so the court that arms these kinds
 * can be built from real readings rather than from another opinion.
 */
export function departureFloorFor(kind: string | null | undefined): {
  floor: number;
  measured: boolean;
  provenance: string;
} {
  const entry = BORN_WORN_CLASSES.find((candidate) => candidate.id === kind);
  return {
    floor: entry?.floor ?? 0,
    measured: typeof entry?.floor === "number",
    provenance: entry?.measurement
      ?? `"${kind}" is not in the accessory catalogue at all, so nothing has been measured for it`,
  };
}

export type BornWornDetection = {
  /** The facet the row carries. */
  facet: string;
  /** The segmentation question that drew it. */
  region: string;
  /** The answer as segmented — no growth, no feather. A fact is not a paint. */
  mask: Mask;
  /** What it measured, kept so a court table can print the number it judged on. */
  coverage: number;
};

export type BornWornScan = {
  detections: BornWornDetection[];
  /** Classes asked and answered *no* — a fact of absence, and not a row. */
  absent: Array<{ facet: string; coverage: number }>;
  /** Classes whose read failed. Silent non-entries: never blockers. */
  failed: Array<{ facet: string; detail: string }>;
  /** Which detector produced this scan, carried onto every row it files. */
  detector: string;
};

/**
 * Read one master frame for every armed class.
 *
 * `absentIsAnswer` is TRUE here and it is the correct half of that asymmetry:
 * the question is *does this face wear glasses*, asked of the picture, and
 * "nowhere" is a real answer to it. The other half — an empty reply to a region
 * the record insists is there — belongs to the harvest, where refusing is what
 * stops a paid render that changes nothing.
 *
 * Nothing here throws. A detector that can block a cast is a detector that can
 * cost a customer a picture because a segmenter had a bad minute, and fable-085
 * settled it: detection failures are silent non-entries. A face with an
 * uncatalogued thing simply lacks that row until a later scan.
 */
export async function detectBornWorn(input: {
  /** The master frame — the record of what she was born with. */
  image: Buffer;
  reader: RegionReader;
  /** Injectable so a court can drive one class at a time. */
  classes?: readonly BornWornClass[];
  signal?: AbortSignal;
}): Promise<BornWornScan> {
  const classes = (input.classes ?? BORN_WORN_CLASSES).filter((entry) => entry.armed);
  const scan: BornWornScan = { detections: [], absent: [], failed: [], detector: BORN_WORN_DETECTOR };

  for (const entry of classes) {
    if (typeof entry.floor !== "number") {
      /*
        Unreachable through `armed`, and kept anyway: this is the line between a
        catalogue and a guess, and it should not depend on two fields agreeing.
      */
      scan.failed.push({ facet: entry.id, detail: "armed without a measured floor" });
      continue;
    }
    try {
      const mask = await input.reader.region({ image: input.image, name: entry.region, absentIsAnswer: true });
      const covered = binaryCoverage(mask);
      if (covered > entry.floor) {
        scan.detections.push({ facet: entry.id, region: entry.region, mask, coverage: covered });
      } else {
        scan.absent.push({ facet: entry.id, coverage: covered });
      }
    } catch (error) {
      log.warn(
        { err: error, facet: entry.id, region: entry.region },
        "[born-worn] this class could not be read — the face simply lacks that row",
      );
      scan.failed.push({ facet: entry.id, detail: error instanceof Error ? error.message : String(error) });
    }
  }

  return scan;
}
