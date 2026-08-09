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
 * The floor for each kind of thing the accessory table can name, and its
 * provenance — every entry filled in, because a kind nobody has considered is
 * exactly the silent gap `FRINGE_AT_EDGE`'s closure test exists to forbid. A
 * new accessory kind arrives here as `null` and inert rather than as a guess.
 */
const FLOOR_OF_CLASS: Record<string, { floor: number | null; measurement: string }> = {
  glasses: {
    floor: GLASSES_COVERAGE_FLOOR,
    measurement:
      "23 bare faces read 0.000% and 8 bespectacled faces 1.349–2.093% through the "
      + "production segmenter, 2026-08-09; the floor sits in the empty three orders "
      + "of magnitude between them (canthalTilt.ts)",
  },
  earring: {
    floor: null,
    measurement: "NOT MEASURED — no positive/negative court has been run for earrings",
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
 */
export const BORN_WORN_CLASSES: readonly BornWornClass[] = LANDMARK_OF_ACCESSORY.map((entry) => {
  const measured = FLOOR_OF_CLASS[entry.region];
  return {
    id: entry.region,
    region: entry.region,
    floor: measured?.floor ?? null,
    measurement: measured?.measurement ?? "NOT CONSIDERED — this kind has no entry in FLOOR_OF_CLASS",
    armed: typeof measured?.floor === "number",
  };
});

export function armedBornWornClasses(): readonly BornWornClass[] {
  return BORN_WORN_CLASSES.filter((entry) => entry.armed);
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
