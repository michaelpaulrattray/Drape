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
 * with neither a `question` nor a `display` region is words-only BY THE
 * CATALOGUE'S OWN ACCOUNT — chin, jaw and cheekbones under the founder's third
 * shape — and is not asked, so the regions that can be pictured fall out of the
 * vocabulary rather than being typed here. (A slot with a null `question` and a
 * `display` region IS asked, under the display name: it may not be CUT as this
 * feature and can still be POINTED AT — teeth and skin are both in that state,
 * and the line below is where the two fields meet.) Accessories are asked only
 * when their class is ARMED (`armedBornWornClasses`), because a detector
 * without its court is a guess about a customer's face.
 *
 * WHICH kinds those are is deliberately not written here. This sentence used to
 * say "glasses today, earring and nose stud when their courts pass", and it was
 * false from the day the earring court passed — as were three other prose sites
 * carrying the same roster, while the test beside this file skipped its own
 * check precisely because the kind it guarded had become armed. `FLOOR_OF_CLASS`
 * is the one place that answers it, and `faceScan.test.ts` now asserts this plan
 * EQUAL to `armedBornWornClasses()` in both directions — so arming a kind moves
 * the plan and the assertion together, and this file still needs no edit.
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
import { armedBornWornClasses, detectionFloorFor } from "./bornWornDetector";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import {
  assertEveryDescribedFeatureHasAnAsk,
  DESCRIBED_ASKS,
  describedFeatures,
  type FaceDescriptions,
} from "./faceDescribe";
import { createModuleLogger } from "../logging/logger";
import type { Mask } from "./maskedComposite";
import { belowHeadMask, binaryCoverage, MaskError } from "./maskGeometry";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";
import {
  catalogueSlots,
  facetsOfSlot,
  isAskable,
  isDerivedRegion,
  DERIVED_REGION_ASKS,
  slotsForFeature,
  type SlotDefinition,
} from "./referenceSlotCatalogue";
import { subjectsOfFacet, type Facet } from "./refineFacets";
import { isDepartableSubject } from "./refineSubjects";
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
  /**
   * What could not be read, and WHETHER ASKING AGAIN MIGHT HELP.
   *
   * `retryable` is weather — a provider limit, a 5xx, a timeout. The cache reads
   * it: a reading damaged by weather is served and dropped so the next look
   * re-asks, and one damaged by a stable fact ("nothing of her is below her chin
   * in this frame") is kept, because asking again buys the same nothing.
   */
  failed: readonly { question: string; why: string; retryable?: boolean }[];
};

/** The armed accessory questions, by the catalogue's own account of arming. */
function armedQuestions(): ReadonlySet<string> {
  return new Set(armedBornWornClasses().map((entry) => entry.region));
}

/**
 * IS THIS QUESTION A THING WORN ON THE EARS (#2781)?
 *
 * Read off the two tables that already say it, never a word typed here: the
 * accessory table names each worn kind's SITE (`site.question`), and the
 * catalogue names what an ear is asked as. An earring's site is the ear, so the
 * reader is told to keep only the pieces of its answer that are where an ear is
 * — the septum ring the segmenter also answered `earring` on is not.
 *
 * Anatomy pairs are never asked this: an eye is nearer the middle of the face
 * than its side, so the rule an ear passes would take an eye away.
 */
const EAR_QUESTION = slotsForFeature("ear")?.[0]?.question ?? null;

export function wornOnTheEars(question: string): boolean {
  if (EAR_QUESTION === null) return false;
  return LANDMARK_OF_ACCESSORY.some((entry) => entry.region === question && entry.site.question === EAR_QUESTION);
}

/**
 * The slots worth asking about on a frame nobody has edited, grouped so that a
 * bilateral feature is one question rather than two.
 *
 * Accessory slots are dropped unless armed. Words-only slots are dropped by
 * having no question at all, which is the catalogue speaking rather than this
 * function deciding.
 */
/**
 * A FEATURE THAT CAN HONESTLY NOT BE THERE — derived, never listed (fable-530 §4).
 *
 * The re-ask below exists because *"she is in frame, looking at the camera, and
 * an empty read of her LIPS is a missed reading rather than a fact"*. That
 * reasoning is about features which are ALWAYS in frame. A beard, a tattoo, a
 * pair of horns can simply be absent, and asking twice about a clean-shaven
 * chin only makes the product careful twice — on every clean face, for ever.
 *
 * So the discriminator is the subject vocabulary's own `departable`, read
 * through the slot's facets: a slot is "can be absent" when EVERY subject that
 * writes into it can leave. That last word is load-bearing — `skin` holds
 * `marks` (departable) beside `skinTone` and `skinCharacter` (not), and her
 * skin is always in frame, so it keeps its second look.
 *
 * The accepted tradeoff, stated rather than discovered: a bearded face whose
 * first read misses the beard now waits for the next scan instead of buying a
 * second look. Chosen because the wasted call is EVERY clean face and the
 * missed large feature is rare and self-corrects.
 */
/**
 * ANATOMY AN ORDINARY POSE CAN HIDE — the third case, and the one the re-ask's
 * own reasoning never covered (#2525, his word 2026-10-15: *"stop looking for
 * teeth twice"*).
 *
 * `canBeAbsent` above splits the world in two: a feature that is ALWAYS in
 * frame (lips, skin — an empty read is a missed reading, so ask again) and one
 * that can simply not be there (a beard, horns — an empty read is a fact, so
 * do not). **Teeth are neither.** They are anatomy nobody is missing, and a
 * closed mouth hides them while the face is in frame — so the first branch
 * claimed them and bought a second look at a question whose answer cannot
 * change.
 *
 * # Measured, and the measurement was already in the tree
 *
 * The catalogue's own teeth bench put four phrasings against three closed
 * mouths and every one of them came back **silent on all three**
 * (`referenceSlotCatalogue.ts`, the `all the teeth` entry): *"the segmenter
 * answers this question with the teeth themselves when they are in the picture
 * and with nothing when they are not — which makes the region its own
 * discriminator: a closed mouth yields no box, no row"*. So the second look at
 * a closed mouth is not merely unlikely to find teeth; it is measured not to,
 * deterministically, for every wording anybody has tried.
 *
 * # What it saves and what it costs
 *
 * fal bills SAM 3 per request ($0.005), so this is **half a cent on every
 * closed-mouth face**, and a closed mouth is the common face. What it costs is
 * stated rather than discovered: a smiling face whose FIRST read misses its
 * teeth now waits for the next scan instead of buying a second look — the same
 * trade `canBeAbsent` already took for the beard, and accepted here on the
 * narrower ground that the bench found no closed mouth the second look rescues.
 *
 * # Why a declared set rather than a predicate
 *
 * There is nothing in the subject vocabulary that means "occludable by an
 * expression" — `departable` is about leaving the person, not about being out
 * of view — so there is nothing honest to derive this from, and inventing a
 * vocabulary flag for one member would be a taxonomy nobody asked for. It is
 * therefore a one-member set with a measured entry bar, which is the shape this
 * product already uses for exactly this kind of decision (`FINE_DETAIL_FACETS`,
 * `UNRELIABLE_FACETS`). **Candidates NOT added, because nobody has measured
 * them: `lips` (benched as always in frame and keeping its second look),
 * `lashes`, `tongue`.** Each needs its own bench first.
 *
 * Keyed through `facetsOfSlot`, the same machinery `canBeAbsent` reads, so a
 * slot renamed in the catalogue cannot quietly fall out of this set.
 */
const POSE_HIDDEN_FACETS: ReadonlySet<Facet> = new Set<Facet>(["teeth"]);

/** Test seam: a list the suite can read is a list the suite can hold to. */
export function facetsHiddenByAPose(): Facet[] {
  return Array.from(POSE_HIDDEN_FACETS);
}

/**
 * Whether every subject this slot draws is anatomy a pose can conceal.
 *
 * EVERY, on `canBeAbsent`'s own argument one block up: a slot that holds a
 * pose-hidden facet beside one that is always in frame is still always in
 * frame, and must keep its second look.
 */
function canBeHiddenByAPose(slot: SlotDefinition): boolean {
  const facets = facetsOfSlot(slot.slot);
  if (facets === null || facets.length === 0) return false;
  return facets.every((facet) => POSE_HIDDEN_FACETS.has(facet));
}

function canBeAbsent(slot: SlotDefinition): boolean {
  const facets = facetsOfSlot(slot.slot);
  if (facets === null || facets.length === 0) return false;
  const subjects = facets.flatMap((facet) => subjectsOfFacet(facet));
  /* A slot no free subject writes into cannot be judged this way, so it keeps
     today's behaviour rather than acquiring an exemption by silence. */
  if (subjects.length === 0) return false;
  return subjects.every((subject) => isDepartableSubject(subject));
}

export function scanPlan(): { feature: string; question: string; slots: SlotDefinition[] }[] {
  const armed = armedQuestions();
  const byQuestion = new Map<string, { feature: string; question: string; slots: SlotDefinition[] }>();
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
    const held = byQuestion.get(definition.feature);
    if (held) held.slots.push(definition);
    else byQuestion.set(definition.feature, {
      feature: definition.feature,
      question,
      slots: [definition],
    });
  }
  return Array.from(byQuestion.values());
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
  /**
   * A FEATURE HAS LANDED — called as each one does, so the panel can fill a row
   * at a time instead of all at once at the end (fable-521 §3).
   *
   * Fourteen questions are asked in parallel and each takes a couple of
   * seconds; the slowest decides when the whole scan resolves. Publishing per
   * feature is the difference between a panel that fills while she looks at the
   * face and one that arrives after she has stopped waiting for it.
   *
   * It is handed only what THIS reading filed, never the accumulating whole:
   * the caller owns the accumulation, so this cannot become a second copy of
   * the scan drifting from the one that gets returned (law 4). A throw from it
   * is the caller's problem and must never cost the reading — it is caught.
   */
  onFiled?: (filed: ReadonlyArray<{ slot: FeatureSlot; box: ScanBox; mask: Mask }>) => void;
}): Promise<FaceScan> {
  const frame = { width: input.frame.width, height: input.frame.height };
  const boxes = new Map<FeatureSlot, ScanBox>();
  /** Says what just landed, and never lets a listener's failure cost a read. */
  const publish = (filed: ReadonlyArray<{ slot: FeatureSlot; box: ScanBox; mask: Mask }>): void => {
    if (filed.length === 0 || input.onFiled === undefined) return;
    try { input.onFiled(filed); } catch { /* a listener may not break a reading */ }
  };
  const masks = new Map<FeatureSlot, Mask>();
  const empty: string[] = [];
  const failed: { question: string; why: string; retryable?: boolean }[] = [];
  const descriptions = new Map<FeatureSlot, string>();
  const plan = scanPlan();

  /*
    THE WORDS READ RIDES ALONGSIDE, not after: it is one more independent
    question about the same photograph, and serially it would add its own
    seconds to a panel somebody is watching fill.
  */
  const describer = input.describe;
  const words = describer === null
    ? Promise.resolve<FaceDescriptions>({ build: null, skin: null, teeth: null })
    : describer({ bytes: input.frame.bytes, contentType: input.contentType ?? "image/png" })
      .catch((error) => {
        /* Same rule as a failed region: a courtesy read that fails costs the
           user nothing and leaves the row exactly as it is today. */
        failed.push({ question: "descriptions", why: error instanceof Error ? error.message : String(error) });
        return { build: null, skin: null, teeth: null } as FaceDescriptions;
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
  /**
   * WHICH empty anatomy reads were asked again, and what the second read
   * found — the instrument the ruling asks for (fable-468 ruling 1), BY
   * QUESTION since #2191.
   *
   * ⚠ **It was two counters, and a rate cannot answer the question the next
   * cost lever turns on.** `reasked: 5, rescued: 5` says a scan re-asked five
   * questions; it does not say WHICH, so it cannot say whether the second look
   * at `all the teeth` ever finds teeth. That matters because a closed mouth has
   * none to find, a closed mouth is the common face, and the re-ask is half a
   * cent of fal's money on every one of them (#2191's lever 1). The same
   * question is open for `face skin`, `hair`, `nose` and `the lips`.
   *
   * So the outcome is recorded against the question, and the two counts are
   * DERIVED from it rather than tallied beside it (working law 4) — a reading
   * and its summary cannot then disagree. The pair heal already logs per
   * question and needed nothing.
   *
   * It costs one small map per scan and no calls, and the rate arrives free
   * from his own ordinary use rather than from a bought sitting — which is the
   * same bargain the half-answered-pair log struck.
   */
  const reasks = new Map<string, "rescued" | "empty" | "failed">();

  await Promise.all(plan.map(async (region) => {
    const bilateral = region.slots.some((slot) => slot.instance !== null);
    /*
      THE READING IS JUDGED AGAINST THE FLOOR MEASURED AT THE BOUNDARY IT WAS
      TAKEN AT — one rule, asked at whichever boundary this region is read.

      A bilateral region is read a side at a time, so it asks for the per-side
      number; everything else asks whole-frame. For anatomy the answer is 0,
      which is exactly what this loop has always done (`boxIn` is non-null iff
      at least one pixel is set, and `binaryCoverage > 0` iff the same), so no
      face gains or loses a row from the rule existing.

      For an accessory it is the court speaking. The earring court is why it is
      asked per boundary rather than once: the union floor sits ABOVE two of
      sixteen measured worn sides, so a pair judged on it would lose a real
      earring on one wearing ear in eight.

      `binaryCoverage` — the presence arithmetic — and the courts measured with
      alpha-weighted `coverage`. On this reader they are the same reading: its
      masks were read byte by byte and are strictly binary (0/255 only), which
      makes the two identical by arithmetic rather than by luck. The provenance
      strings say so, and the day a matting reader answers one of these
      questions the floors get re-derived rather than reinterpreted.
    */
    const floor = detectionFloorFor(region.question, bilateral ? "side" : "frame").floor;
    /* An ear-worn pair keeps only what is where an ear is (#2781) — both the
       first reading and the half-answered heal's second, so the heal judges
       the same answer the panel will draw. */
    const onTheEars = bilateral && wornOnTheEars(region.question);
    /** One reading of this region: what it filed, without deciding anything. */
    const read = async (): Promise<"filed" | "empty" | "failed" | "capability"> => {
    const landed: Array<{ slot: FeatureSlot; box: ScanBox; mask: Mask }> = [];
    try {
      if (bilateral && input.reader.regionSides) {
        const sides = await input.reader.regionSides({
          image: input.frame.bytes,
          name: region.question,
          absentIsAnswer: true,
          ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
          ...(onTheEars ? { onTheEars: true as const } : {}),
        });
        /*
          `null` is the reader saying this name has no sides for it — a
          capability answer, not a reading. Falling back to the whole-frame
          question would file ONE box for a pair and light both instances off
          it, which is the wrong-boundary class with a rectangle on it. So the
          pair goes unanswered instead, honestly.
        */
        if (sides === null) return "capability";
        /*
          HALF A PAIR IS A MISSED READING, AND IT GETS ONE MORE LOOK
          (fable-749 §3a, on a rate bought in production).

          The founder's specimen was a row with ONE eye box on a frame where his
          own eye saw both plainly behind the lenses. The reason no number
          existed is the shape of this very function: the region is recorded as
          `filed` when EITHER side lands (the `some` below), so one-eye-found is
          a SUCCESS to the instrument, is never re-asked by the empty-anatomy
          rule further down, and appears in no tally of empties. **The count
          folded the exact failure it was built to see.**

          Measured 2026-08-16 against production, the whole bespectacled
          population (9 of 9) beside 12 bare-eyed controls:

              GLASSES   2/9  half-answered   (22.2%)
              CONTROL   0/12 half-answered   ( 0.0%)

          Both misses were LITERAL ZEROES — no pixels at all on the missing
          side, not a marginal read under a floor.

          # THE TRIGGER IS THE FAILURE, NOT THE GLASSES

          That reading does NOT establish that glasses cause it (p≈0.17, and the
          control's own rule-of-three bound sits above the measured rate), and
          this heal does not need it to: it fires when exactly one side is at
          literal zero while the other landed. A frame where BOTH sides are
          empty is a different thing and is already served by the empty-anatomy
          re-ask below; asking here as well would only make it careful twice.

          # ONE RE-READ, AND IT IS A DIFFERENT QUESTION (#2802)

          ⚠ **It was the SAME question until this card, and on production's
          road that made it unable to answer.** A pair is read in one
          whole-picture request now (`ENABLE_CASTING_PAIR_ONE_READ`), so the
          second look went out as the identical request — same endpoint, same
          prompt, same bytes — and came back with the identical answer.
          Measured through the product's own reader on the founder's round-6
          cast, `ear` at 1024 and at 598, five draws a size: **the pair road
          answered nothing on either side, 10 of 10.**

          So the blind side is asked for its OWN half-picture instead
          (`sideByCrop`). That is the one thing this module has measured to be a
          different question rather than the same one louder — `falRegionReader`'s
          `BILATERAL` block: *"the same twelve features, asked as a PLAIN noun
          of a picture containing one side only, read 12 of 12."* On the same
          ten draws it found both ears every time, on a cast whose two ears the
          founder's eye reads plainly, and on two casts whose ears are genuinely
          hidden it recovered nothing on the blind side in 12 of 12 — it does
          not invent a side that is not there. **One read either way**, which is
          what the second look already spends.

          A reader that cannot read one side alone keeps the old road: re-asking
          the whole region is what it has, and on a reader already reading a
          side at a time that re-ask IS the blind side's own half-picture.

          The outcome is still logged, with the road it took, so the recovery
          rate goes on arriving free from his own use.
        */
        const zeroOf = (side: Mask) => binaryCoverage(side) === 0;
        /* The two masks this reading files, held locally: a heal replaces what
           the slots below read, and reaching back into the reader's own return
           value to do it would be editing somebody else's answer in place. */
        let leftMask = sides.left;
        let rightMask = sides.right;
        if (region.slots.length === 2 && zeroOf(leftMask) !== zeroOf(rightMask)) {
          const blindSide = zeroOf(leftMask) ? "left" : "right";
          const ask = {
            image: input.frame.bytes,
            name: region.question,
            ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
            ...(onTheEars ? { onTheEars: true as const } : {}),
          };
          /* Bound here rather than reached for inside the closure below: the
             reader is an interface whose optional members a `?.` chain cannot
             narrow across an `await`. */
          const askItsOwnHalf = input.reader.sideByCrop?.bind(input.reader);
          const askTheRegion = input.reader.regionSides.bind(input.reader);
          const onItsOwnHalf = askItsOwnHalf !== undefined;
          /* A SECOND LOOK MAY NOT DESTROY THE FIRST READING. The half-picture
             is a narrower call than the one that produced the side already in
             hand, so a transport failure in it costs this look and nothing
             else — the same bargain the other-ear look below strikes, and the
             reason it is caught here rather than left to the region's own
             catch, which would file the whole pair as failed. */
          const again = await (async () => {
            try {
              return askItsOwnHalf
                ? await askItsOwnHalf({ ...ask, side: blindSide })
                : (await askTheRegion({ ...ask, absentIsAnswer: true }))?.[blindSide] ?? null;
            } catch (error) {
              log.warn(
                {
                  question: region.question,
                  blindSide,
                  why: error instanceof Error ? error.message : String(error),
                },
                "[faceScan] the second look at the blind side did not answer — the pair stays as read",
              );
              return null;
            }
          })();
          const healed = again !== null && !zeroOf(again);
          log.info(
            {
              question: region.question,
              blindSide,
              healed,
              /* Which question the second look actually asked, so a road change
                 is readable in his own logs rather than inferred from a rate. */
              road: onItsOwnHalf ? "the blind side's own half-picture" : "the whole region again",
              retry: again === null ? null : binaryCoverage(again),
            },
            healed
              ? "[faceScan] half-answered pair — the second look found the missing side"
              : "[faceScan] half-answered pair — the second look found nothing either",
          );
          /* ONLY THE BLIND SIDE IS EVER REPLACED. A second answer that is also
             blind is not better information, and the side that DID land is not
             traded for a coin flip — which is why the second look is asked
             about one side rather than about the pair. */
          if (healed && again !== null) {
            if (blindSide === "left") leftMask = again;
            else rightMask = again;
          }
        }
        /*
          AND AN EAR-WORN PAIR STILL ONE-SIDED IS LOOKED AT BY THE DETECTOR
          (#2800, his eye round 6: *"why did it pick up her left ear but not the
          left earing?"*).

          Measured on his screenshot: asked `earring` of the whole picture, the
          segmenter offered one hoop and never the other, and the second look
          above asked the same question and got the same answer to the last
          digit. The detector boxed both. So one earring found is taken as the
          sign that earrings are worn, and the other ear gets that one
          different look.

          AFTER the second look and never instead of it, so the half-answered
          log above still counts every half-answered pair. A pair empty on both
          sides is not asked: an empty earring read is the born-worn detector
          being careful (see the re-ask below). A failure here costs this look
          and never the side already found.
        */
        if (
          onTheEars && region.slots.length === 2
          && zeroOf(leftMask) !== zeroOf(rightMask) && input.reader.sideByDetector
        ) {
          const blindSide = zeroOf(leftMask) ? "left" : "right";
          try {
            const found = await input.reader.sideByDetector({
              image: input.frame.bytes,
              name: region.question,
              side: blindSide,
              ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
            });
            if (found !== null) {
              if (blindSide === "left") leftMask = found;
              else rightMask = found;
            }
          } catch (error) {
            log.warn(
              { question: region.question, blindSide, why: error instanceof Error ? error.message : String(error) },
              "[faceScan] the detector could not look at the other ear — the pair stays as read",
            );
          }
        }
        for (const slot of region.slots) {
          const mask = slot.instance === "left" ? leftMask : rightMask;
          const box = binaryCoverage(mask) > floor ? boxIn(mask, frame) : null;
          /* Box and mask are set together, always: a slot with a rectangle and
             no shape would render as a hard-edged crop beside its cutout
             neighbours, and one with a shape and no rectangle has nowhere to
             put it. They are one answer. */
          if (box) {
            boxes.set(slot.slot, box);
            masks.set(slot.slot, mask);
            landed.push({ slot: slot.slot, box, mask });
          }
        }
        publish(landed);
        return region.slots.some((slot) => boxes.has(slot.slot)) ? "filed" : "empty";
      }

      const mask = await input.reader.region({
        image: input.frame.bytes,
        name: region.question,
        absentIsAnswer: true,
        ...(input.frame.url ? { imageUrl: input.frame.url } : {}),
      });
      const box = binaryCoverage(mask) > floor ? boxIn(mask, frame) : null;
      if (!box) return "empty";
      for (const slot of region.slots) {
        boxes.set(slot.slot, box);
        masks.set(slot.slot, mask);
        landed.push({ slot: slot.slot, box, mask });
      }
      publish(landed);
      return "filed";
    } catch (error) {
      /*
        A scan is a courtesy the user did not ask to pay for, so a failed
        reading costs them nothing and changes nothing: this region has no box
        and the panel is exactly what it was before the scan existed. Recorded
        rather than swallowed, because a silent catch is how thirty faces were
        once declared bare.
      */
      failed.push({
        question: region.question,
        why: error instanceof Error ? error.message : String(error),
        /* Weather or fact — the reader says which, and the cache reads it. */
        ...(error instanceof MaskError && error.retryable ? { retryable: true } : {}),
      });
      return "failed";
    }
  };

    /*
      AND AN EMPTY ANATOMY READ IS ASKED ONCE MORE (fable-468 ruling 1, on the
      founder's own three specimens).

      "Empty is a real answer" is true of a thing she may not be wearing and
      false of a part of her face: she is in frame, looking at the camera, and
      an empty read of her lips is a MISSED READING rather than a fact. It was
      costing whole rows — his lips vanished on the frame where she smiled (the
      region changed shape) and his eyes vanished on a build edit that touched
      neither — because a row's price of admission is a rectangle (fable-414),
      and the scan had reported none.

      So anatomy gets a second look at the same frame, once. Worn things do not:
      an empty earring read is the born-worn detector being deliberately
      careful, and asking twice would only make it careful twice.

      The rate is LOGGED rather than assumed. Two empties leave the row off, the
      same as today, and the distribution then says whether it is the segmenter
      or the frames — which three screenshots cannot.
    */
    const anatomy = region.slots.every((slot) => slot.tier === "anatomy")
      && !region.slots.every(canBeAbsent)
      /* And not anatomy a closed mouth or an ordinary expression hides, whose
         second look is measured to buy the same nothing (#2525). */
      && !region.slots.every(canBeHiddenByAPose);
    const first = await read();
    if (first === "filed" || first === "failed" || first === "capability" || !anatomy) {
      if (first === "empty" || first === "capability") empty.push(region.question);
      return;
    }
    const second = await read();
    /* Recorded before the early return, so a rescued question is in the map
       exactly as an unrescued one is — a record that only keeps its failures
       cannot produce a rate. */
    reasks.set(
      region.question,
      second === "filed" ? "rescued" : second === "failed" ? "failed" : "empty",
    );
    if (second === "filed") return;
    if (second !== "failed") empty.push(region.question);
  }));

  /* The composed rows join the same two maps by the same rule as every asked
     one: box and mask together, always. A slot with a rectangle and no shape
     renders as a hard-edged crop beside its cutout neighbours. */
  for (const { definition, mask } of await composing) {
    const box = boxIn(mask, frame);
    if (!box) { empty.push(definition.question ?? definition.slot); continue; }
    boxes.set(definition.slot, box);
    masks.set(definition.slot, mask);
    publish([{ slot: definition.slot, box, mask }]);
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
      /*
        AND WHICH SLOTS CAME BACK EMPTY — DERIVED, not tallied (founder reports
        via fable-730/731, 2026-08-16).

        He filed two bespectacled faces whose EYES were missing from the panel,
        and the second was missing **one eye**: the row existed, hover drew a
        single box, and `eye@right` had returned nothing on a frame where his
        own eye sees both plainly behind the lenses. The question that answers
        it — *do bespectacled eye reads miss more often, and do they skew to one
        image half?* — is a rate over slot NAMES.

        `empty` cannot answer it, and the reason is worth writing down: it holds
        REGION questions, and a bilateral region counts as filed when EITHER
        side lands. His exact specimen — one eye found, one missed — is recorded
        by this scan as a success, is never re-asked, and would appear in no
        tally of empties. The instrument folds the failure it was built to see.

        So this is derived from the answer itself rather than accumulated beside
        it (working law 4): every slot the plan asked for, minus every slot that
        ended with a box. It cannot disagree with the panel, it needs no
        bookkeeping in the read path, and a re-ask that rescues a slot removes
        it from here by arithmetic.

        Recording only. Whether a half-answered PAIR should get the second look
        that a fully empty region gets is a spend decision and is filed for a
        ruling, not decided here.
      */
      emptySlots: plan.flatMap((region) => region.slots.map((slot) => slot.slot))
        .filter((slot) => !boxes.has(slot)),
      failed: failed.length,
      /*
        AND WHY, not just how many (fable-505's own cost).
        
        His panels were missing eyes, brows and ears for two days and the
        container could only say `failed=12`. The reasons were on the object
        the whole time and never reached a line anybody reads, so the diagnosis
        had to reproduce the burst to learn what the provider had already said:
        *"Reached concurrent requests limit of 20"*. Distinct reasons only —
        eleven copies of one sentence is a log nobody finishes.
      */
      whyFailed: Array.from(new Set(failed.map((entry) => entry.why.slice(0, 120)))),
      /* The words are counted separately: a scan with every box and no
         description is a different failure from a scan with neither. */
      described: descriptions.size,
      describable: wordsPlan().length,
      /* The re-ask, as a rate rather than an anecdote (fable-468 ruling 1) —
         and BY QUESTION since #2191, because which question was asked twice is
         what the next cost lever turns on. `all the teeth:empty` repeating
         across faces is the finding; `reasked: 5` could never have shown it.
         Both counts are derived from the same map, so they cannot drift from
         the detail printed beside them. */
      reasked: reasks.size,
      rescued: Array.from(reasks.values()).filter((outcome) => outcome === "rescued").length,
      reaskedBy: Array.from(reasks).map(([question, outcome]) => `${question}:${outcome}`).join(" "),
    },
    "[faceScan] read a face",
  );
  return { boxes, masks, descriptions, asked: plan.length, found: boxes.size, empty, failed };
}
