/**
 * V4's TARGET, MADE READABLE — *"what the product can say, the scan can see."*
 *
 * The vocabulary overhaul's fourth milestone
 * (`docs/specs/VOCABULARY_OVERHAUL_REVIEW.md` Part 2, V4) is the only phase in
 * the program whose target is a PROPERTY of the whole vocabulary rather than a
 * build: every armed detector court-proven, no detector armed by default, and
 * nothing the customer can ask about left invisible to the scan without a
 * written reason.
 *
 * That property had no reader. Arming was pinned in one test, the scan plan in
 * another, and the join between them — the sentence the milestone is actually
 * about — was held by review, which in this program means it was held by prose.
 * It rotted in five places at once and was found by reading rather than by any
 * instrument (shift 91).
 *
 * # It JOINS, it does not restate
 *
 * Every column here is read from the table that owns it: `allFacets()` for what
 * can be said, `FACET_SLOTS` for where those words land, `catalogueSlots()` for
 * what can be pictured, `scanPlan()` for what is actually asked, and
 * `BORN_WORN_CLASSES` for what is armed and on what court. Nothing is listed
 * twice, so nothing here can disagree with production — it can only report what
 * production already decided (working law 4).
 *
 * # The three verdicts, and why GAP is not a defect
 *
 *   SEEN       the product can say it and the scan asks about it
 *   GAP        the product can say it and nothing measures where it is —
 *              with the catalogue's OWN reason where it has one. A gap is a
 *              legitimate state: `chin` is words-only by the founder's third
 *              shape, and a nose stud is unarmed because nobody has run its
 *              court. What a gap must never be is SILENT.
 *   VIOLATION  a state the rules forbid: a detector armed on a floor no court
 *              measured, an accessory asked without being armed, or an armed
 *              accessory the scan does not ask. These are the failures the
 *              milestone's target is written against, and there should be none.
 */
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { BORN_WORN_CLASSES, type BornWornClass } from "./bornWornDetector";
import { composedPlan, scanPlan } from "./faceScan";
import { allFacets, facetHeading, subjectsOfFacet, type Facet } from "./refineFacets";
import { catalogueSlots, FACET_SLOTS, type SlotDefinition } from "./referenceSlotCatalogue";

export type DetectionVerdict = "SEEN" | "GAP" | "VIOLATION";

export type DetectionRow = {
  /** The facet, which is the unit the product's words land in. */
  facet: Facet;
  /** What that facet is spoken as, for a reader who does not know the ids. */
  heading: string;
  /** The free subjects that write it — what a customer would type. */
  subjects: string[];
  /** The slot family: a feature, the accessory table, or `notASlot` + reason. */
  lands: string;
  /** The segmentation question(s) the scan sends for it, if any. */
  asked: string[];
  /** Armed classes involved, for an accessory facet. */
  armed: string[];
  /** Arming states for every accessory kind, so an unarmed one is not silent. */
  unarmed: string[];
  verdict: DetectionVerdict;
  /** Why, in one sentence — from the owning table wherever it has one. */
  why: string;
};

/** A measurement provenance that says, in its own words, that nothing was measured. */
export function hasCourt(measurement: string): boolean {
  return !/^NOT MEASURED|^NOT CONSIDERED/.test(measurement.trim());
}

/**
 * THE ARMING RULES, ASKED OF ONE CLASS — exported so both the map and its test
 * drive the same sentence.
 *
 * `pair` is deliberately not a violation on its own: an armed paired kind that
 * the whole-frame catalogue cannot file is a documented, correct state
 * (`catalogueCanFile`), and the per-side panel scan is where it lives.
 */
export function armingViolationOf(
  entry: BornWornClass,
  askedQuestions: ReadonlySet<string>,
): string | null {
  if (entry.armed && !hasCourt(entry.measurement)) {
    return `${entry.id} is ARMED on a floor no court measured — "${entry.measurement}"`;
  }
  if (entry.armed && entry.pair && !hasCourt(entry.sideMeasurement)) {
    return `${entry.id} is a PAIR armed without a per-side court — "${entry.sideMeasurement}"`;
  }
  if (entry.armed && !askedQuestions.has(entry.region)) {
    return `${entry.id} is ARMED and the scan never asks it — a detector nothing consults`;
  }
  if (!entry.armed && askedQuestions.has(entry.region)) {
    return `${entry.id} is asked by the scan without being ARMED — a guess about a customer's face`;
  }
  return null;
}

/**
 * The whole map, one row per facet, in the vocabulary's own order.
 *
 * `injectedClasses` exists for the negative controls and for nothing else: a
 * map that cannot be shown a kind it has never seen is an inventory nobody can
 * prove reads anything (the blank-reader law). Production callers pass nothing
 * and get the shipped tables.
 */
export function detectionMap(injectedClasses?: readonly BornWornClass[]): DetectionRow[] {
  const classes = injectedClasses ?? BORN_WORN_CLASSES;
  const plan = scanPlan();
  const askedQuestions = new Set(plan.map((region) => region.question));
  const askedFeatures = new Set(plan.map((region) => region.feature));
  /*
    A COMPOSED REGION IS MEASURED WITHOUT BEING ASKED — and the first cut of this
    map called all five of her body facets a GAP because of it.

    `build` carries a region KEY rather than a question (`derived:below-head`),
    because handing that key to a segmenter would be the open question D-213
    forbids. The scan measures it anyway, from a head read and a subject matte
    composed together (`composedPlan`). A map that only reads `scanPlan` sees a
    feature with a question the plan does not carry and calls it invisible —
    which is precisely the false GAP a reader nobody controls would publish.
  */
  const composedFeatures = new Set(composedPlan().map((definition) => definition.feature));
  const slots = catalogueSlots();
  const accessoryRegions = new Set(LANDMARK_OF_ACCESSORY.map((entry) => entry.region));

  return allFacets().map((facet): DetectionRow => {
    const assignment = FACET_SLOTS[facet];
    const subjects = subjectsOfFacet(facet).map(String);
    const heading = facetHeading(facet);

    /* NOT A SLOT — the product can say it and the catalogue has already decided,
       in writing, that no picture holds it. The reason is the assignment's own. */
    if (assignment !== undefined && "notASlot" in assignment) {
      return {
        facet, heading, subjects,
        lands: "notASlot",
        asked: [], armed: [], unarmed: [],
        verdict: "GAP",
        why: assignment.notASlot,
      };
    }

    /* THE ACCESSORY FAMILY — one facet over several kinds, so its row carries
       every kind's arming state rather than a single yes. */
    if (assignment !== undefined && "family" in assignment) {
      const armed = classes.filter((entry) => entry.armed);
      const unarmed = classes.filter((entry) => !entry.armed);
      /*
        THE THIRD STATE (fable-647 §2). A kind with no court has two futures
        that looked identical from here: one is work on V4's board, and one is a
        decision already taken. `nose stud` is the second — its court was
        REFUSED on a demand reading, not left undone — and a phase that cannot
        tell those apart cannot say how much of itself is left.
      */
      /* `?? null` rather than `=== null`: the shipped catalogue always fills
         this field, and an INJECTED class (a control, a future caller) may
         omit it — in which case the honest reading is "a court is owed", never
         "refused, reason undefined". A spelling this reader gets wrong would
         quietly move a kind out of V4's worklist. */
      const owed = unarmed.filter((entry) => (entry.courtDeferred ?? null) === null);
      const refused = unarmed.filter((entry) => (entry.courtDeferred ?? null) !== null);
      const violations = classes
        .map((entry) => armingViolationOf(entry, askedQuestions))
        .filter((problem): problem is string => problem !== null);
      return {
        facet, heading, subjects,
        lands: "accessories",
        asked: armed.filter((entry) => askedQuestions.has(entry.region)).map((entry) => entry.region),
        armed: armed.map((entry) => entry.id),
        unarmed: unarmed.map((entry) => `${entry.id} — ${entry.measurement}`),
        verdict: violations.length > 0 ? "VIOLATION" : armed.length > 0 ? "SEEN" : "GAP",
        why: violations.length > 0
          ? violations.join(" · ")
          : armed.length > 0
            ? `${armed.length} of ${classes.length} kinds armed`
              /* Named, never counted: "the rest have no court" is how a kind
                 nobody can see stays invisible in the instrument built to
                 find it. And a refused court is named as REFUSED, so V4's
                 remaining work is not padded with a decision already taken. */
              + (owed.length > 0
                ? ` — ${owed.map((entry) => entry.id).join(", ")} `
                  + `${owed.length === 1 ? "is" : "are"} OWED a court`
                : "")
              + (refused.length > 0
                ? ` — ${refused.map((entry) => `${entry.id} NOBODY-SAYS-THIS (${entry.courtDeferred})`).join("; ")}`
                : "")
              + (unarmed.length === 0 ? ", the whole table" : "")
            : "no accessory kind has a measured court",
      };
    }

    const feature = assignment === undefined ? null : assignment.feature;
    const mine: SlotDefinition[] = feature === null
      ? []
      : slots.filter((definition) => definition.feature === feature);

    /* A FACET WITH NO ASSIGNMENT AT ALL is the silent-decider class the
       catalogue's own totality test forbids — reported as a violation rather
       than a gap, because nobody decided it. */
    if (assignment === undefined || mine.length === 0) {
      return {
        facet, heading, subjects,
        lands: feature === null ? "UNASSIGNED" : `${feature} (no slot)`,
        asked: [], armed: [], unarmed: [],
        verdict: "VIOLATION",
        why: assignment === undefined
          ? "no entry in FACET_SLOTS — a facet nobody assigned"
          : `FACET_SLOTS names the feature "${feature}" and the catalogue has no such slot`,
      };
    }

    const asked = feature !== null && askedFeatures.has(feature)
      ? plan.filter((region) => region.feature === feature).map((region) => region.question)
      : [];
    if (asked.length > 0) {
      const drawnFrom = mine.find((definition) => definition.question === null && definition.display !== null);
      return {
        facet, heading, subjects,
        lands: feature ?? "",
        asked, armed: [], unarmed: [],
        verdict: "SEEN",
        why: drawnFrom
          ? `asked under its DISPLAY region "${drawnFrom.display}" — it may be pointed at and not cut`
          : `asked as "${asked.join('", "')}"`,
      };
    }

    if (feature !== null && composedFeatures.has(feature)) {
      const composed = composedPlan().find((definition) => definition.feature === feature);
      return {
        facet, heading, subjects,
        lands: feature,
        asked: [composed?.question ?? "derived"], armed: [], unarmed: [],
        verdict: "SEEN",
        why: `COMPOSED, not asked — "${composed?.question}" is a region key the scan builds `
          + "from a head read and a subject matte, never a question sent to a segmenter",
      };
    }

    /* An accessory-region slot that the scan skips is the arming rule working,
       not a hole in the catalogue — say which, so the two never look alike. */
    const unarmedKind = mine.find((definition) => (
      definition.question !== null && accessoryRegions.has(definition.question)
    ));
    const wordsOnly = mine.find((definition) => definition.wordsOnly !== undefined)?.wordsOnly;
    return {
      facet, heading, subjects,
      lands: feature ?? "",
      asked: [], armed: [], unarmed: [],
      verdict: "GAP",
      why: unarmedKind
        ? `the kind "${unarmedKind.question}" has no measured court, so the scan does not ask it`
        : wordsOnly
          ?? `the catalogue gives "${feature}" a question and the scan plan does not carry it`,
    };
  });
}

/** Every row the map calls a VIOLATION — the list that must always be empty. */
export function detectionViolations(injectedClasses?: readonly BornWornClass[]): DetectionRow[] {
  return detectionMap(injectedClasses).filter((row) => row.verdict === "VIOLATION");
}

/** Every gap, keyed by facet, for pinning: a NEW gap must be loud. */
export function detectionGaps(injectedClasses?: readonly BornWornClass[]): string[] {
  return detectionMap(injectedClasses)
    .filter((row) => row.verdict === "GAP")
    .map((row) => row.facet)
    .sort();
}
