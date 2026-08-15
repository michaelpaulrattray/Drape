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
  /**
   * THE SAME QUESTION AT THE OTHER BOUNDARY — coverage of the whole frame by
   * ONE SIDE of a paired thing, above which that side is wearing one.
   *
   * A pair is read two-sidedly wherever it is drawn per instance, and a side is
   * about half the union the number above was measured on. Carrying one figure
   * across that boundary is what {@link EARRING_SIDE_COVERAGE_FLOOR}'s own
   * provenance was written to prevent — the shipped union floor sits ABOVE two
   * of sixteen measured worn sides.
   *
   * `null` for a kind worn singly, which has no side to judge, and for a paired
   * kind nobody has measured per side — which cannot arm (see below).
   */
  sideFloor: number | null;
  /** Where THAT number came from, or why there isn't one. */
  sideMeasurement: string;
  /**
   * Worn in twos, from the placement table's own `pair` field — never restated
   * here. It governs which boundary this class is judged at, and a whole-frame
   * reading of a pair is a reading of BOTH of them at once.
   */
  pair: boolean;
  /** Armed classes are asked and may file rows. Unarmed ones are inert. */
  armed: boolean;
  /**
   * WHY NOBODY IS GOING TO MEASURE THIS ONE — `null` when a court is simply
   * owed (fable-647).
   *
   * A kind with no floor has two entirely different futures, and until this
   * field they looked identical from outside: a court NOT YET RUN, which is
   * work on the board, and a court REFUSED on evidence, which is a decision.
   * The V4 map reads it so the phase's worklist can tell its remaining
   * substance from its closed rows — an unmeasured kind that nobody wants is
   * not a gap in what the product can see, it is a thing nobody says.
   *
   * It can never arm anything: arming reads `floor` and `deferArming`, and a
   * refusal is recorded beside a null floor, which was already inert.
   */
  courtDeferred: string | null;
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
 * THE SAME QUESTION ABOUT ONE EAR — and it is a different number, which is the
 * entire point of it existing.
 *
 * `EARRING_COVERAGE_FLOOR` above was measured on the WHOLE-FRAME union (8 worn
 * faces, 0.0404–0.0621%) and its provenance claims a 2x margin. That claim is
 * true of the boundary its consumers read at: both departure gates call
 * `reader.region(...)`, which IS the union. It is FALSE at the per-side
 * boundary, and not by a little — a court of sixteen worn SIDES read
 * 0.0189–0.0347%, so the shipped floor sits at **0.945x the smallest worn
 * side, above it rather than under it**. Two of those sixteen read at or under
 * it, so arming a per-side detector on the union's number would file a worn
 * earring as ABSENT on one wearing ear in eight — the founder's missing-row bug
 * half-closed and then reopened on 12.5% of faces.
 *
 * So: 0.00009 — the same 2x margin the union floor was written with, derived at
 * the boundary it is applied at rather than carried across one. The
 * wrong-boundary class's sixth member, dead unpublished.
 *
 * **Rounded DOWN, and that is not tidiness.** Half of the smallest worn side is
 * 0.0000945, and the court prints to four decimals — so the true smallest worn
 * side lies in [0.01885%, 0.01895%] and a floor of 0.000095 would sit at 1.99x
 * under it while its own provenance said 2x. A margin claim that is false in
 * the third digit is the same defect as one false in the first, found earlier.
 * 0.00009 is at least 2.09x under the smallest worn side across the whole
 * rounding interval, and it costs nothing on the other arm: every non-wearing
 * side in the court read EXACTLY zero, so no floor above zero separates them
 * differently.
 */
export const EARRING_SIDE_COVERAGE_FLOOR = 0.00009;

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
     * The per-side number, for a kind worn in twos. See
     * {@link BornWornClass.sideFloor} for why it cannot be the one above.
     */
    sideFloor?: number | null;
    sideMeasurement?: string;
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
    /**
     * A COURT DELIBERATELY NOT RUN, and why — see
     * {@link BornWornClass.courtDeferred}. Absent means the court is owed.
     */
    courtDeferred?: string;
  }
> = {
  glasses: {
    floor: GLASSES_COVERAGE_FLOOR,
    measurement:
      "23 bare faces read 0.000% and 8 bespectacled faces 1.349–2.093% through the "
      + "production segmenter, 2026-08-09; the floor sits in the empty three orders "
      + "of magnitude between them (canthalTilt.ts)",
    sideFloor: null,
    sideMeasurement:
      "NOT MEASURED and never needed: glasses are ONE object across two eyes "
      + "(accessoryKinds `pair: false`), so no surface reads them a side at a time",
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
    sideFloor: EARRING_SIDE_COVERAGE_FLOOR,
    sideMeasurement:
      "the same court read PER SIDE through the product's own `regionSides`, 2026-08-14 "
      + "(scripts/read-earring-side-floor-disposable.mts): 16 worn sides 0.0189–0.0347%, "
      + "8 visibly bare sides and 6 sides behind hair ALL exactly 0.0000% — 14 of 14 "
      + "non-wearing sides structural zeros, no segmentation at all. The floor sits at "
      + "least 2x under the smallest worn SIDE (2.09x, rounded down so the margin claim "
      + "survives the court's own four-decimal rounding). Two things this number is "
      + "allowed to do and the "
      + "union floor above is not: judge one ear, and be quoted as a 2x margin. And what "
      + "it still cannot do: license an ABSENCE — a covered side and a bare side both "
      + "read zero, so detection files presence only (fable-435), which satisfies "
      + "fable-340's visibly-bare rule by construction because no absent row exists to "
      + "misfile. Arithmetic checked rather than assumed: this reader's masks are "
      + "strictly binary (0/255 only, read byte by byte on 6 sides across all three "
      + "classes), so the alpha-weighted `coverage` the court measured with and the "
      + "pixel-counting `binaryCoverage` presence applies are the same reading here",
  },
  "nose stud": {
    floor: null,
    measurement: "NOT MEASURED, AND DELIBERATELY SO — no positive/negative court has been run for "
      + "nose studs, and one was refused on 2026-08-16 (fable-647) after the demand was read rather "
      + "than assumed. Every brief and every refine instruction in BOTH worlds, matched against this "
      + "table's own words (scripts/read-vocabulary-demand-disposable.mts): production 205 briefs + 55 "
      + "edits and dev 42 + 117 mention a nose ring, nose stud, septum or nostril exactly ZERO times, "
      + "with the same search finding 24 'hair' briefs as its control. The other two kinds in this "
      + "table are asked for constantly (earring 20, glasses 22 in production), and the single paid "
      + "edit in the whole corpus naming something this vocabulary has no word for is 'give her "
      + "vampire fangs'. So the court would have had to manufacture its own worn population to measure "
      + "the one kind nobody has ever wanted — which is the promotion kit measuring what we find "
      + "interesting, the thing its own last clause forbids. Deferred until somebody asks; the detector "
      + "stays unarmed, which is what a null floor already guarantees",
    courtDeferred: "no demand in either world — zero asks in 260 production and 159 dev briefs and "
      + "instructions, read 2026-08-16 against this table's own words. Deferred until somebody asks "
      + "for one (fable-647)",
    sideFloor: null,
    sideMeasurement:
      "NOT MEASURED and never needed: a nose stud is one thing in one place "
      + "(accessoryKinds `pair: false`)",
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
 *
 * # A PAIRED KIND NEEDS A NUMBER AT BOTH BOUNDARIES
 *
 * The same rule again, one boundary along. A kind worn in twos is drawn and
 * clicked per instance, so something will judge ONE SIDE of it — and a union
 * number applied to a side is a margin that quietly stops being true. The
 * earring court measured that gap at 0.945x rather than the 2x its provenance
 * claimed, which would have filed a worn earring absent on one ear in eight.
 * So `pair: true` here means both floors or no arming: the table cannot say
 * yes to detection on half a court, and the compiler asks the question a
 * reviewer would forget to.
 */
/**
 * One row of the catalogue, from one kind and what has been measured about it.
 *
 * Exported so the arming rule can be DRIVEN rather than restated. A test that
 * re-writes `typeof floor === "number" && …` beside the production line is a
 * second copy of the rule agreeing with itself — it passes on a build where the
 * real one has been deleted. Given this door, the negative arms (a paired kind
 * with no per-side court, a deferred kind, a kind with no court at all) are
 * ordinary readings of the same function that decides in production.
 */
export function bornWornClassFor(
  kind: { region: string; pair: boolean },
  measured: (typeof FLOOR_OF_CLASS)[string] | undefined,
): BornWornClass {
  const sideFloor = measured?.sideFloor ?? null;
  return {
    id: kind.region,
    region: kind.region,
    floor: measured?.floor ?? null,
    measurement: measured?.measurement ?? "NOT CONSIDERED — this kind has no entry in FLOOR_OF_CLASS",
    sideFloor,
    sideMeasurement: measured?.sideMeasurement
      ?? "NOT CONSIDERED — this kind has no entry in FLOOR_OF_CLASS",
    pair: kind.pair,
    armed: typeof measured?.floor === "number"
      && measured.deferArming === undefined
      && (!kind.pair || typeof sideFloor === "number"),
    courtDeferred: measured?.courtDeferred ?? null,
  };
}

export const BORN_WORN_CLASSES: readonly BornWornClass[] = LANDMARK_OF_ACCESSORY
  .map((entry) => bornWornClassFor(entry, FLOOR_OF_CLASS[entry.region]));

export function armedBornWornClasses(): readonly BornWornClass[] {
  return BORN_WORN_CLASSES.filter((entry) => entry.armed);
}

/**
 * WHETHER THIS CATALOGUE CAN FILE THIS CLASS AT ALL — asked before anything is
 * read, and the reason lives here rather than at each caller.
 *
 * The whole-frame write path files ONE row per class from ONE reading, and
 * `reader.region` on a bilateral name returns the union of both sides. A kind
 * worn in twos is drawn, clicked and stored per instance, so a union row would
 * be two objects under one facet, judged at a boundary no surface reads. There
 * is no per-side write path yet; there is a per-side READ path (the panel scan),
 * which is why the class can be armed and still unfileable here.
 *
 * Consulted by the detector, which refuses rather than reads, AND by the
 * catalogue, which leaves the class out of what it wants — one rule, two
 * consumers, no second copy of it (law 4).
 */
export function catalogueCanFile(entry: BornWornClass): boolean {
  return !entry.pair;
}

/**
 * THE FLOOR A READING IS JUDGED AGAINST, ASKED AT THE BOUNDARY IT WAS TAKEN AT
 * — the detection half of this catalogue, and the reason there are two numbers.
 *
 * # Which consumer reads which, in one place
 *
 * - `departureFloorFor` (below) answers the DEPARTURE gates: a delivered frame
 *   the customer already paid to change, asked whole-frame, judged on the union
 *   floor. It decides refunds. Nothing here touches it.
 * - This answers DETECTION: a master or a frame on screen, asked to find what
 *   is already there. The panel scan reads a pair two-sidedly, so it asks at
 *   `"side"`; everything else is asked whole-frame and asks at `"frame"`.
 *
 * They are two questions about the same class and they must never collapse back
 * into one number, because the boundaries genuinely differ: 0.0002 is 2x under
 * the smallest worn UNION and 0.945x the smallest worn SIDE.
 *
 * # Zero for a question this catalogue does not name
 *
 * Anatomy — eyes, ears, hair — has no accessory court and needs none: the scan
 * has always filed a box for any region that answered with pixels at all, and
 * `> 0` is exactly that rule written down. The permissive fallback cannot reach
 * an accessory, because an accessory is only ever asked when its class is
 * ARMED, and arming requires a measured number at every boundary it will be
 * read at.
 */
export function detectionFloorFor(
  question: string | null | undefined,
  boundary: "frame" | "side",
): { floor: number; measured: boolean; provenance: string } {
  const entry = BORN_WORN_CLASSES.find((candidate) => candidate.region === question);
  if (!entry) {
    return {
      floor: 0,
      measured: false,
      provenance: `"${question}" is not a thing a face WEARS, so no accessory court measured it — `
        + "any pixels at all are the region answering, which is what the scan has always done",
    };
  }
  const floor = boundary === "side" ? entry.sideFloor : entry.floor;
  return {
    floor: floor ?? 0,
    measured: typeof floor === "number",
    provenance: boundary === "side" ? entry.sideMeasurement : entry.measurement,
  };
}

/**
 * THE FLOOR A DELIVERED FRAME IS JUDGED AGAINST when a render claims the thing
 * has LEFT her — the departure gate's half of this catalogue.
 *
 * Same segmenter, same question, same arithmetic as the detection above, so it
 * reads the same table: two tables would be two answers to *is this thing in
 * this picture* and law 4 says the copies drift.
 *
 * **One table, two boundaries.** This gate asks whole-frame — both consumers
 * call `reader.region(...)`, which for a pair is the union — so it reads the
 * union floor, and that is the boundary the union floor was measured at. The
 * per-side number belongs to {@link detectionFloorFor}, which the panel scan
 * consults when it reads a pair two-sidedly. The two must never be collapsed
 * back into one: the union floor sits 2x under the smallest worn union and
 * 0.945x the smallest worn side, so a single number would be a false margin at
 * whichever boundary it did not come from. **Nothing about refunds reads the
 * per-side number** — this function is the refund-deciding one, and it is
 * unchanged.
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
    if (!catalogueCanFile(entry)) {
      /*
        A PAIR CANNOT BE FILED FROM A WHOLE-FRAME READING, and arming the
        earring class is what made that reachable rather than theoretical.

        This function asks `reader.region`, which for a bilateral name is the
        UNION of both sides — one mask over two objects. The store keys a pair
        per instance (`earring@left`), the panel draws a rectangle per instance,
        and the library already refuses a per-side crop taken from a union
        because it is "a picture of two things under the name of one". Filing
        the union here would put both hoops in one row under a facet no slot in
        the catalogue answers to, judged against the union floor while every
        surface that reads it works per side.

        So it refuses, loudly and per the file's own rule that a failure is a
        silent non-entry to the customer and a recorded one to us. The panel's
        scan already reads pairs correctly (`faceScan`, `regionSides`, judged at
        `sideFloor`); what is missing is a per-side WRITE path for this
        catalogue, and it is missing rather than approximated.
      */
      scan.failed.push({
        facet: entry.id,
        detail: "worn in twos — a whole-frame reading is both sides at once, and this catalogue "
          + "has no per-side write path yet. Refused rather than filed at the wrong boundary",
      });
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
