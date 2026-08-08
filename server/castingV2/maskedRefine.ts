/**
 * MASKED EDITING, ON THE PRODUCT PATH — the workstream's seam, and it is one
 * function in one place.
 *
 * The founder's walk died on drift: a freckles edit replaced her hairstyle, an
 * earrings edit deleted her glasses, a removal refused at a face plainly wearing
 * the thing. The fix is not a better prompt or a stricter reader. **The model
 * returns a whole frame; we take only the pixels inside the region that was
 * asked about, and put them into an otherwise untouched master.** What happened
 * everywhere else stops being a question for a judge and becomes `Buffer.compare`.
 *
 * # Where this sits
 *
 * `refineService` already calls the engine once and gets a frame back. That call
 * does not change — **full-frame context with local harvest** is the standing
 * rider, because the model needs the whole face to know what it is editing. This
 * runs immediately after it, on the bytes, and returns a different set of bytes.
 * Everything downstream — the fault detector, the verification net, the retry,
 * the refund — is untouched and does not know this happened.
 *
 * # Dark by default, and SCOPED when it opens
 *
 * `MASKED_EDITING_SCOPE` is `off`, so a deploy of this changes nothing at all:
 * the function returns the engine's own bytes, byte for byte, and a test proves
 * it.
 *
 * It is a SCOPE rather than a boolean because this program has one convention for
 * every spendable surface — `off` / `all` / `users:<ids>` — and the first flip
 * goes to the founder's account alone. A boolean would have made "on for me" and
 * "on for everyone" the same edit, which is exactly the decision that deserves
 * two. Widening is a separate founder call after the walk, never a rider on the
 * flip. Same parser as `CASTING_V2_SCOPE`, deliberately: a second scope grammar
 * would be a mirror, and mirrors drift (law #4).
 *
 * # It REFUSES rather than falling open
 *
 * When the flag is on and a mask cannot be built, this throws instead of quietly
 * returning the unmasked frame. Falling open would be the invoked-but-inert
 * class in its purest form: the guarantee would be present in the code, absent
 * in the picture, and nothing would say so. A throw routes into the refund path
 * that already exists for a failed refinement, which is the honest outcome —
 * the user is not charged for an edit the system could not make safely.
 *
 * The one exception is a facet with no region at all. An expression is not a
 * region edit (D-233): a smile moves cheeks, eyes, jaw and brow at once, and any
 * zone drawn for it would be a lie about what changes. Those route full-frame by
 * design, so this returns the engine's frame untouched and says why.
 */
import { createModuleLogger } from "../logging/logger";
import {
  MaskError,
  assertUsable,
  coverage,
  dilateMask,
  expandUntilClear,
  harvestMatteFrom,
  intersectMask,
  subtractMask,
  unionMasks,
} from "./maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  confirmedColour,
  differenceMatte,
  harvestGate,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "./maskedComposite";
import { compositeSeam } from "./compositeIntegrity";
import { ProviderError } from "../providers/types";
import { hasRegion, zoneScopeOf } from "./zoneScope";
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import type { Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/maskedRefine");

/**
 * THE FLAG. **LIVE FOR THE FOUNDER'S ACCOUNT ONLY** (founder decision,
 * 2026-08-06, after the face wall passed).
 *
 * `users:1` — the sole admin, and the only account this path touches. Widening
 * to `all` is a separate founder decision after the walk, never a rider on this
 * one; that separation is the entire reason this is a scope rather than a
 * boolean.
 *
 * **The rollback is this line: set it back to `"off"`.** Nothing else has to
 * change, and every other user is already on that path.
 */
export const MASKED_EDITING_SCOPE = "users:1";

/** Is the masked path live for this user? Off means off for everyone. */
export function maskedEditingEnabledFor(userId: number | undefined): boolean {
  const scope = parseCastingV2Scope(MASKED_EDITING_SCOPE);
  if (scope.kind === "off") return false;
  if (scope.kind === "all") return true;
  return userId !== undefined && castingV2EnabledForUser(scope, userId);
}

/** Feathering the zone; the harvest matte supplies the visible edge. */
const FEATHER_PX = 4;
/**
 * REACHES ARE FRACTIONS OF THE FRAME, NOT PIXEL CONSTANTS.
 *
 * They were absolute — 40px for strand recovery, 14px for the interaction band —
 * which is local on the 1024x1536 the workstream was measured on and the WHOLE
 * FRAME on anything small. A constant in pixels is a constant that assumes a
 * resolution, and this path already promises never to resample; it should not
 * quietly assume one instead.
 *
 * The fractions are the measured values divided by 1024, so behaviour at the
 * resolution everything was calibrated on is unchanged.
 */
const STRAND_REACH_FRACTION = 40 / 1024;
const BAND_FRACTION = 14 / 1024;
/**
 * How far the painted region is grown before the reveal is measured against it.
 *
 * Two segmentations of the same face on two frames do not agree pixel for pixel,
 * and every pixel they disagree on would read as vacated territory — painter
 * background shipped along an unchanged hair edge on an edit that only recoloured
 * it. This absorbs that wobble, and the novelty gate downstream catches whatever
 * survives it.
 *
 * A fraction rather than a pixel count, for the reason the two above it are:
 * **a constant in pixels is a constant that assumes a resolution**, on a path
 * that promises never to resample. Provisional at 8 — large enough to swallow
 * SAM 3's frame-to-frame boundary jitter on the specimens measured, small enough
 * that a real reveal (a shoulder, a temple) is orders of magnitude wider.
 */
const VACANCY_TOLERANCE_FRACTION = 8 / 1024;
/**
 * How far from her old region a DEPARTED strand is still looked for.
 *
 * Deliberately its own number rather than sharing `STRAND_REACH_FRACTION`,
 * because it answers a different physical question. That one asks how far a
 * newly painted strand tip may extend past the segmenter's confidence — a tip,
 * so a short distance. This asks how far her EXISTING loose hair lay from the
 * mass it belonged to, and on a long style that is not a tip: her flyaways run
 * most of the way down her chest, hundreds of pixels from the ponytail.
 *
 * The bound is not really this number — it is the projection, which fires only
 * where the master carries old-hair content against the painter's plate, and the
 * novelty gate under it. Distance is the cheap outer fence that keeps the
 * question anywhere near the hair at all.
 */
const DEPARTED_REACH_FRACTION = 160 / 1024;
/**
 * The share of old content above which a revealed pixel is replaced WHOLE.
 *
 * See the note at `departedFully`: for a removal the strand opacity is not the
 * alpha, it is the evidence. A pixel a quarter covered by the departing hair is
 * still a contaminated pixel, and taking the plate at a quarter strength leaves
 * a ghost. Low rather than zero so that the projection's own noise floor cannot
 * vacate a whole shoulder, and so the outer edge still has somewhere to ramp.
 */
const REMOVAL_TOTAL_ABOVE = 0.25;
const scaled = (fraction: number, width: number, height: number) =>
  Math.max(4, Math.round(Math.min(width, height) * fraction));

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /**
   * Everything the named region covers in this image.
   *
   * `absentIsAnswer` is the difference between *the model could not answer* and
   * *the answer is nowhere*, and conflating them is what made a removal
   * impossible. Asked of the MASTER for a region the record says is there, an
   * empty reply is a failed question and must refuse — composing on it would
   * deliver "nothing changed" at full price. Asked of the PAINTED frame after
   * *"take her glasses off"*, an empty reply is **the painter doing the job**,
   * and refusing it charges her for the picture she already had.
   *
   * The caller knows which of the two it is asking, so the caller says. Same
   * asymmetry D-235 drew for the reader's affirmatives: silence resolves in
   * whichever direction does not take the user's money, and which direction that
   * is depends on the question.
   */
  region(input: { image: Buffer; name: string; absentIsAnswer?: boolean }): Promise<Mask>;
  /** A soft whole-subject matte, for edge ramps. */
  subject(input: { image: Buffer }): Promise<Mask>;
  /**
   * WHERE A THING WOULD BE, even when nothing can see it.
   *
   * A different capability from segmentation, not a worse one. A segmenter
   * answers *where is this in the picture* and returns nothing at all when hair
   * covers the ear; a landmark model answers *where is the ear on this face* and
   * still answers. That distinction is D-213's sibling, and it is the whole
   * reason an addition can be placed at all.
   */
  landmark(input: { image: Buffer; name: string }): Promise<{ x: number; y: number }[]>;
};

export type MaskedRefineInput = {
  /** The master — her current picture. Never resampled. */
  master: { bytes: Buffer; contentType: string };
  /** What the engine returned, whole-frame. */
  painted: { bytes: Buffer; contentType: string };
  /** Which facets this instruction wrote. Decides the zone's scope. */
  facets: readonly Facet[];
  reader: RegionReader;
  /** Whose refinement this is — the scope is per user, not per deploy. */
  userId?: number;
  /** What the instruction said the thing IS. Places an addition. */
  described?: string;
  /**
   * WHAT A REMOVAL TOOK OFF HER — carried, because the record cannot say it.
   *
   * An object removal deletes its own facet from the recipe, so
   * `facetsWrittenBy(composed)` no longer names it and no question is ever
   * asked about the thing being removed. The painter takes the glasses off, the
   * harvest claims nothing at the eyes, and `outsideMaskUnchanged` then
   * guarantees the master is kept exactly there — the composite puts them back
   * and she pays for the face she started with.
   *
   * `described` cannot stand in for this: it holds the SURVIVORS, so a chain of
   * earrings plus glasses minus the glasses would place the question at her
   * earlobes — the failure `LANDMARK_OF_ACCESSORY` exists to prevent.
   */
  departed?: string;
  /** For the log line, so a composite can be traced to its operation. */
  operationId?: string;
  /**
   * RETURN THE WORKING, for calibration only.
   *
   * The alternative is a harness that rebuilds this pipeline to look inside it,
   * and that alternative has already cost this program three silent divergences
   * — `maskedRefine` and the calibration harness drifting apart while both stayed
   * green. A fixture that inspects THIS function's own masks cannot drift from
   * it. Off on every product path, and it only adds allocations.
   */
  explain?: boolean;
};

export type MaskedRefineResult = {
  bytes: Buffer;
  contentType: string;
  /** What actually happened, for the record and the log. */
  outcome: "composited" | "flag-off" | "no-region";
  /** Present when composited — the promise, restated in numbers. */
  guarantee?: {
    outsideIdentical: boolean;
    blendBandPixels: number;
    zoneCoverage: number;
  };
  /**
   * The masks this composite was actually built from, when `explain` was asked
   * for. `applied` is the canonical one: it is the only boundary source that
   * cannot disagree with the picture, and three of this session's four wrong
   * measurements came from checking against something else.
   */
  explain?: {
    /** The zone as the facet's scope drew it, before any boundary expansion. */
    zoneAsScoped: Mask;
    zone: Mask;
    harvested: Mask;
    vacated: Mask;
    departed: Mask;
    delivered: Mask;
    applied: Mask;
  };
};

/**
 * WHICH SEGMENTATION QUESTION A FACET ASKS.
 *
 * Deliberately small and explicit rather than derived from the facet id: the
 * words here are sent to a segmentation model, and D-213 is that a segmenter is
 * never asked an open question. A facet with no entry has no masked path and
 * says so, rather than having a prompt invented for it.
 */
const REGION_OF_FACET: Partial<Record<Facet, string>> = {
  "hair.cut": "hair",
  "hair.colour": "hair",
  "hair.texture": "hair",
  hairFinish: "hair",
  hairWorn: "hair",
  facialHair: "facial hair",
  marks: "face skin",
  "eye.colour": "eyes",
  "eye.shape": "eyes",
  brows: "eyebrows",
  lashes: "eyes",
  ears: "ear",
  cheekbones: "face skin",
  nose: "nose",
  lips: "lips",
  teeth: "lips",
  chin: "face skin",
  jaw: "face skin",
  makeup: "face skin",
  skinTone: "face skin",
  skinCharacter: "face skin",
};

export function regionNameOf(facet: Facet): string | null {
  return REGION_OF_FACET[facet] ?? null;
}

/**
 * WHICH REGIONS HAVE CONTENT FINER THAN A SEGMENTER'S BOUNDARY.
 *
 * # The defect this ends
 *
 * `differenceMatte` recovers a strand as the projection of `(patch − master)`
 * onto `(strand − master)`, where `strand` is measured from the interior of the
 * confirmed content. It was run for **every** region, and for a `marks` edit
 * the confirmed content is FACE SKIN — so the reference colour is her skin, and
 * the recovery reaches forty pixels past the jaw into her hair.
 *
 * *Dark hair → pale background* is very nearly parallel to *dark hair → skin*.
 * Measured on the production pixels of run-6's torn render (candidate
 * `7c796a72`, variant `198005a3`, charged 25 and scored compliant):
 *
 *   left notch     master [8,6,6] → delivered [136,129,127]   alpha **0.730**
 *   left wash      master [7,6,6] → delivered  [92, 90, 88]   alpha **0.490**
 *   untouched hair / untouched background                     alpha 0.000
 *
 * So the mechanism written to rescue a hem on her hair ends claimed a slab of
 * background lying over it, at 73% opacity, and the composite delivered it as a
 * hole punched through her hair. The module's own doc anticipates the
 * neighbouring case correctly — a repainted shirt moves grey toward a slightly
 * different grey, a delta nearly ORTHOGONAL to `(strand − master)`, projecting
 * to ~0 — but that defence assumes master and patch are the SAME MATERIAL. It
 * has nothing to say about the painter having replaced one material with
 * another, which is what a drifting hair silhouette does.
 *
 * # Why a region property, and why declared rather than derived from the name
 *
 * Fringe is a fact about the MATERIAL, not about the edit: hair has flyaway
 * strands whether you are recolouring it or cutting it, and skin has none
 * whatever you do to it. So it belongs to the region, once.
 *
 * `Record<string, …>` with a test that closes the reverse direction — every
 * region name reachable from `REGION_OF_FACET` or `LANDMARK_OF_ACCESSORY` must
 * have an entry — because this file already carries the scar of the other
 * approach: a `names[0]` harvest and a literal `"earring"` fallback, both true
 * for the only case anyone had driven and silent about the rest.
 *
 * # What this does NOT fix, stated
 *
 * The regions that keep fringe keep the projection's blind spot with it: a
 * glasses harvest can still confuse *skin → hair-drift* with *skin → frame*.
 * Turning fringe off there would lose the thing it is for — a wire temple arm
 * is two pixels wide and is exactly what a segmenter's boundary discards. That
 * exposure is closed by the territory rule, not by this table.
 */
const FRINGE_AT_EDGE: Record<string, { readonly fringe: boolean; readonly why: string }> = {
  hair: { fringe: true, why: "flyaway strands and coils stand proud of any outline — the founding case" },
  "facial hair": { fringe: true, why: "stubble and beard edges are individual hairs over skin" },
  eyebrows: { fringe: true, why: "brow hairs stand outside the brow's own shape" },
  eyes: { fringe: true, why: "lashes reach well past the lid the segmenter draws" },
  earring: { fringe: true, why: "hooks and fine chains are thinner than a confidence frontier" },
  glasses: { fringe: true, why: "a wire temple arm is a couple of pixels wide" },
  "face skin": { fringe: false, why: "skin is a surface bounded by other features; it has no fringe, and this is where the tear came from" },
  lips: { fringe: false, why: "the vermilion border is an edge, not a fringe" },
  nose: { fringe: false, why: "a contour against the face, with nothing finer at its boundary" },
  ear: { fringe: false, why: "hair may fall across it, but that fringe is the HAIR's, harvested when hair is the question" },
  "nose stud": { fringe: false, why: "a bead — solid, and larger than the boundary's error" },
};

/**
 * Whether this region's harvest may reach beyond the segmenter's boundary.
 *
 * Unknown regions do NOT get fringe. A name nobody has considered is a name
 * whose material nobody has considered, and the failure mode of guessing yes is
 * the torn frame; the failure mode of guessing no is a slightly tight boundary.
 * The test closes the gap so this default never has to be relied on.
 */
export function hasFringeAtEdge(region: string): boolean {
  return FRINGE_AT_EDGE[region]?.fringe === true;
}

/**
 * WHICH REGIONS CAN BE MISTAKEN FOR THIS ONE AT ITS BOUNDARY.
 *
 * # The half of the torn frame that no fringe rule can reach
 *
 * `FRINGE_AT_EDGE` removed the strand projection from regions that have no
 * strands, and replaying run-6's own torn render through it took the left notch
 * down 67% and the right phantom 21% — **and left both tears alive**. The
 * remainder is not a recovery reaching too far. It is the harvest itself: once
 * the painter moved her hair, a segmenter asked *"where is her face skin"* on
 * that frame answers with pixels the MASTER has hair in. The harvest is then
 * behaving perfectly by its own lights, and delivering a hole.
 *
 * So the rule is about the OUTCOME rather than about any one mechanism:
 *
 * > A harvest may not deliver a pixel that on the MASTER belongs to a
 * > confusable neighbour this edit does not name — minus every extent the edit
 * > legitimately owns.
 *
 * # Nearly every entry is "hair", and that is the finding
 *
 * Hair is the only region that moves a large silhouette across everything else,
 * which is why every tear in this campaign has been at a hair boundary. The
 * table says so plainly rather than padding for symmetry.
 *
 * # What it must NOT break, because subtracting territory is how you rebuild
 * "the composite puts them back"
 *
 * Three kinds of edit legitimately deliver onto a neighbour's master territory,
 * and all three are exempted by `ownedExtents` at the call site:
 *
 *   - a REMOVAL — glasses arms cross her temples, and the reveal has to land
 *     exactly where the master says "hair";
 *   - a SHRINK — a smaller ponytail reveals background that was hair;
 *   - an ADDITION — wire frames sit ON her hair at the temples, and an
 *     addition's master extent is EMPTY by definition, so its destination
 *     corridor is what owns that ground. Without this exemption "round
 *     wire-frame glasses" delivers arms clipped at the temples after a perfect
 *     paint, and the Tier A catalogue asks for exactly that.
 */
const CONFUSABLE_NEIGHBOURS: Record<string, { readonly with: readonly string[]; readonly why: string }> = {
  "face skin": { with: ["hair", "facial hair"], why: "both grow over and against skin, and hair is what moved in run-6" },
  lips: { with: ["facial hair"], why: "a moustache sits on the vermilion border" },
  eyes: { with: ["hair", "eyebrows"], why: "a fringe falls across the eyes" },
  eyebrows: { with: ["hair"], why: "a fringe reaches the brow" },
  nose: { with: [], why: "nothing that moves borders it" },
  ear: { with: ["hair"], why: "hair falls over the ear" },
  earring: { with: ["hair"], why: "the lobe sits under her hair" },
  glasses: { with: ["hair"], why: "the arms run into it at the temples" },
  "nose stud": { with: [], why: "small, and its anchor is named" },
  "facial hair": { with: ["hair"], why: "they meet at the sideburn" },
  hair: { with: [], why: "hair is the aggressor here, never the victim" },
};

/** Regions that could be mistaken for this one. Unknown regions have none. */
export function confusableNeighboursOf(region: string): readonly string[] {
  return CONFUSABLE_NEIGHBOURS[region]?.with ?? [];
}

/** Regions declared in the neighbour table — for the reverse-direction test. */
export function neighbourTableNames(): string[] {
  return Object.keys(CONFUSABLE_NEIGHBOURS).sort();
}

/**
 * WHICH FACETS CAN MOVE THEIR REGION'S EDGE — and therefore may claim a reveal.
 *
 * # The third mechanism in run-6's torn frame
 *
 * With the strand projection scoped (`FRINGE_AT_EDGE`) and the territory rule
 * in place, run-6's left notch fell 90% and the RIGHT PHANTOM did not move at
 * all. Per-mask attribution on the replay named it: `vacated` is zero
 * everywhere and **`departed` claims 7,955 px of that band.**
 *
 * `departed` is the reversed projection — it asks what content LEFT a region,
 * with a 160px reach, so a shrinking ponytail's old flyaways can be found far
 * from the mass they belonged to. It was computed for **every** question. On a
 * `marks` edit that means a freckle instruction hunting for skin that departed
 * from her face, across 160 pixels, and then delivering the painter's
 * replacement for it — which is where a hank of hair arrived on her neck.
 *
 * # The rule
 *
 * A reveal only exists where something can leave. A facet that repaints a
 * region's SURFACE cannot move its edge: freckles do not remove skin, a tan
 * does not, lipstick does not, and neither does a hair colour — a recoloured
 * ponytail is the same ponytail. Those facets get no `vacated`, no `departed`,
 * and no reveal, and lose nothing by it.
 *
 * # Its own table, deliberately not `CHANGE_AMPLITUDE`
 *
 * The amplitude record has a SURFACE band that looks like the same distinction
 * and it is **instrument-only** — it exists to tell a band table what threshold
 * to count at. Reusing it here would quietly promote a measurement constant
 * onto the paid render path, which is the class of thing this program keeps
 * finding. They also genuinely disagree: `hair.colour` is REPLACEMENT amplitude
 * (every strand pixel moves) and moves no edge at all.
 *
 * `Record<Facet, …>` so a new facet does not compile without a decision, with a
 * test closing the other direction.
 */
const MOVES_ITS_EDGE: Record<Facet, { readonly moves: boolean; readonly why: string }> = {
  "hair.cut": { moves: true, why: "a cut is a new silhouette" },
  "hair.colour": { moves: false, why: "a recoloured ponytail is the same ponytail" },
  "hair.texture": { moves: true, why: "curl pattern changes how far the mass stands out" },
  hairFinish: { moves: false, why: "shine changes how light sits, not where the hair is" },
  hairWorn: { moves: true, why: "up, down, tied back — the shrink this machinery was built for" },
  facialHair: { moves: true, why: "shaving removes it entirely" },
  statedAccessories: { moves: true, why: "an object arrives or departs" },
  ink: { moves: false, why: "a design is drawn on skin; the skin stays where it is" },
  "eye.colour": { moves: false, why: "the iris does not change shape" },
  "eye.shape": { moves: true, why: "a corner lift moves the lid boundary" },
  brows: { moves: true, why: "a shape change moves the brow's edge" },
  lashes: { moves: true, why: "lashes extend and retract past the lid" },
  nose: { moves: true, why: "a contour edit moves the edge" },
  lips: { moves: true, why: "fuller lips move the vermilion border" },
  teeth: { moves: false, why: "behind the lips; the lips' own edge is unmoved" },
  cheekbones: { moves: false, why: "bone structure reads as shading over a wide area" },
  jaw: { moves: true, why: "a contour against the background" },
  chin: { moves: true, why: "as the jaw, over a smaller arc" },
  ears: { moves: true, why: "an ear is exposed or covered" },
  skinTone: { moves: false, why: "a tan is her own surface, a few levels different" },
  skinCharacter: { moves: false, why: "texture is the freckle case by another name" },
  marks: { moves: false, why: "freckles do not remove skin — the right phantom's own facet" },
  makeup: { moves: false, why: "makeup sits on the surface it is painted on" },
  expression: { moves: true, why: "features move; it routes full-frame and never reaches here" },
};

/** May any facet in this edit legitimately reveal what was behind something? */
export function anyFacetMovesAnEdge(facets: ReadonlyArray<Facet>): boolean {
  return facets.some((facet) => MOVES_ITS_EDGE[facet]?.moves === true);
}

/** Facets declared in the edge table — for the reverse-direction test. */
export function edgeTableNames(): string[] {
  return Object.keys(MOVES_ITS_EDGE).sort();
}

/** Every region this file can ask a segmenter about — the table's own domain. */
export function segmentableRegionNames(): string[] {
  return Array.from(new Set([
    ...Object.values(REGION_OF_FACET).filter((name): name is string => typeof name === "string"),
    ...LANDMARK_OF_ACCESSORY.map((entry) => entry.region),
  ])).sort();
}

/** Regions declared in the fringe table — for the reverse-direction test. */
export function fringeTableNames(): string[] {
  return Object.keys(FRINGE_AT_EDGE).sort();
}

/**
 * THE NAMED GAP, declared rather than discovered.
 *
 * `object`-class facets — earrings, glasses, ink placements — have a zone, but
 * it does not come from segmenting the master: **the thing is not there yet, so
 * nothing can segment it** (D-213). Their destination is derived from a LANDMARK
 * plus the described object's own extent, which the harness has (`the-walk.mts`
 * builds earring corridors from `moondream3-preview/point`) and this adapter
 * does not yet.
 *
 * That path is now wired: `landmarkNameOf` names the anchor, `additionDestination`
 * builds the corridor, and boundary-contact auto-expand catches an under-estimate.
 * A facet with no landmark vocabulary — ink, whose "left forearm" is not a facial
 * landmark — still refuses by its own name rather than having one invented.
 */
export function needsLandmarkDestination(facet: Facet): boolean {
  return zoneScopeOf(facet) === "object";
}

/**
 * WHERE AN ADDITION IS PLACED — the landmark a facet is anchored to.
 *
 * Only accessories have one today. Ink has no landmark vocabulary — "left
 * forearm" is not a facial landmark, and inventing one would be the same lie as
 * inventing a region prompt — so it still refuses by name.
 */
const LANDMARK_OF_ACCESSORY: {
  words: readonly string[];
  landmark: string;
  drops: boolean;
  /**
   * WHAT TO ASK A SEGMENTER FOR ONCE IT EXISTS — the other half of the same
   * table, and it was missing.
   *
   * An addition cannot be segmented before it is painted, but it can be
   * segmented AFTER, and that is what the harvest asks. The name for that
   * question was a hardcoded `"earring"` fallback, so **an edit adding or
   * removing GLASSES harvested wherever her earrings were.** Exactly the defect
   * `landmarkNameOf` exists to prevent, one line lower down: `statedAccessories`
   * is one facet over several objects, and every question about it needs the
   * instruction as well as the facet.
   */
  region: string;
}[] = [
  { words: ["earring", "stud", "hoop", "dangle", "drop"], landmark: "earlobe", drops: true, region: "earring" },
  { words: ["glasses", "spectacles", "frames", "sunglasses", "eyewear"], landmark: "eye", drops: false, region: "glasses" },
  { words: ["nose ring", "nose stud", "septum", "nostril"], landmark: "nose", drops: false, region: "nose stud" },
];

/**
 * WHICH LANDMARK AN ADDITION HANGS FROM — facet AND instruction, again.
 *
 * `statedAccessories` is one facet covering earrings, glasses and piercings, and
 * they do not share an anchor: an earring hangs from the lobe, glasses sit at the
 * eyes. Keying the landmark on the facet alone would put her spectacles on her
 * earlobes — the same class as the audit's marks-versus-freckles finding, which
 * is now the second time the instruction has turned out to carry half the
 * placement.
 *
 * An accessory nobody has a landmark for REFUSES. Guessing an anchor is guessing
 * anatomy, and a guess dressed as anatomy is the D-210 family.
 *
 * **Longest match wins, not first match.** "A small nose stud" contains both
 * "stud" and "nose stud", and a first-match scan put it on her earlobe — the
 * answer depended on the order of a list, which is a defect waiting for someone
 * to tidy the array. The longest matched word is the most specific thing the
 * instruction said.
 */
function accessoryEntry(described?: string) {
  const said = (described ?? "").toLowerCase();
  let best: { landmark: string; drops: boolean; region: string; length: number } | null = null;
  for (const entry of LANDMARK_OF_ACCESSORY) {
    for (const word of entry.words) {
      if (!said.includes(word)) continue;
      if (!best || word.length > best.length) {
        best = { landmark: entry.landmark, drops: entry.drops, region: entry.region, length: word.length };
      }
    }
  }
  return best;
}

export function landmarkNameOf(facet: Facet, described?: string): string | null {
  if (!needsLandmarkDestination(facet)) return null;
  if (facet !== "statedAccessories") return null;
  return accessoryEntry(described)?.landmark ?? null;
}

/** Does the described object hang below its anchor? A drop does; glasses do not. */
export function hangsBelowAnchor(described?: string): boolean {
  return accessoryEntry(described)?.drops ?? false;
}

/** A filled disc at a normalised point — the unit an addition is built from. */
function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/**
 * THE DESTINATION FOR AN ADDITION — a corridor per landmark, conservative on
 * purpose.
 *
 * The extent comes from the described object, and this deliberately does not try
 * to be clever about it: a stud is a disc at the lobe, a drop hangs below it, and
 * the founder's rider is explicit that **boundary-contact auto-expand catches
 * under-estimates.** So the default is the smaller guess and the expansion loop
 * grows it when paint presses against the edge. Guessing generously would hand
 * the painter more canvas than the ask deserves.
 *
 * **Scale comes from the face, never from a number somebody liked.** The distance
 * between the two landmarks is the head's width at that feature, so a stud is a
 * fraction of it on any face at any framing.
 */
export function additionDestination(input: {
  landmarks: { x: number; y: number }[];
  width: number;
  height: number;
  /** How far the object hangs below its anchor, in multiples of its own radius. */
  dropSteps?: number;
}): Mask {
  if (input.landmarks.length === 0) {
    throw new MaskError("an addition needs a landmark to be placed against — none was returned");
  }
  const { width, height, landmarks } = input;
  const span = landmarks.length > 1
    ? Math.hypot((landmarks[0].x - landmarks[1].x) * width, (landmarks[0].y - landmarks[1].y) * height)
    : Math.min(width, height) * 0.25;
  const radius = Math.max(4, span * 0.035);
  const steps = input.dropSteps ?? 0;
  const parts: Mask[] = [];
  for (const landmark of landmarks) {
    for (let step = 0; step <= steps; step += 1) {
      parts.push(discAt(
        { x: landmark.x, y: landmark.y + (step * radius * 1.4) / height },
        radius, width, height,
      ));
    }
  }
  return parts.length === 1 ? parts[0] : unionMasks(...parts);
}

/**
 * HOW BIG THE ZONE IS FOR THIS FACET — every scope class handled by NAME, and
 * the unimplemented ones throwing rather than defaulting.
 *
 * # Why this is a switch and not a ternary
 *
 * It was `isDistributed(facet) ? dilate(region, 48) : region` — a five-valued
 * table collapsed to a boolean, so three classes shared one branch that had been
 * written for one of them. **`allSkin` was the casualty and it was silent:**
 * `zoneScope.ts` says a tan or a skin tone spans all visible skin, *"scoping a
 * tan to the face manufactures a body mismatch"* — and the adapter handed it
 * `region("face skin")`, which is her face. Her neck and arms would have kept
 * her old tone, and nothing anywhere would have said so.
 *
 * That is the same class as the `"earring"` fallback one screen up: **a default
 * that was true for the only implemented case and silent about being
 * scaffolding.** The rule the module already practices twenty lines above
 * (`REGION_OF_FACET` throws by name rather than inventing a prompt) applies to
 * every dispatch over a facet or an object type: handle the case, or throw
 * naming it. A default value may not stand in for an unimplemented branch.
 *
 * TypeScript's exhaustiveness check does the rest — a sixth `ZoneScope` stops
 * compiling here rather than quietly taking somebody else's branch.
 */
async function scopedZone(facet: Facet, region: Mask): Promise<Mask> {
  const scope = zoneScopeOf(facet);
  switch (scope) {
    case "distributedFacet":
      /* A pattern through a region is rendered WHOLE, with a destination
         allowance — scoping it to where it shows is the fringe error (D-233). */
      return dilateMask(region, 48);
    case "bilateralPair":
      /* Two regions, one question. The two sides are already unioned by the
         reader, which is the only door that rule cannot be forgotten behind. */
      return region;
    case "localFacet":
      /* The thing occupies one bounded place and stays there. */
      return region;
    case "allSkin":
      /*
        DECLARED, NOT IMPLEMENTED — and it says so instead of shipping a face.
        The honest zone is every visible patch of her skin (neck, chest, arms),
        which is a different segmentation question from "face skin" and does not
        have one written yet. Refusing costs a refund; the quiet version costs a
        customer a picture whose face and neck do not match.
      */
      throw new MaskError(
        `"${facet}" spans all of her visible skin, and this path can only ask about her face `
        + "— scoping it to the face would leave her neck and arms behind",
      );
    case "object":
      /* Unreachable: an addition's destination comes from a landmark, and those
         facets are filtered out before this runs. Named anyway — "it cannot get
         here" is the sentence every quiet default was written under. */
      throw new MaskError(`"${facet}" is an addition and is placed from a landmark, never segmented`);
    case "fullFrame":
      /* Unreachable: regionless facets are routed out before any zone is built.
         Kept so the switch is total rather than nearly total. */
      throw new MaskError(`"${facet}" is not a region edit and should never have reached a zone builder`);
    default: {
      const unhandled: never = scope;
      throw new MaskError(`facet "${facet}" has an unhandled zone scope ${String(unhandled)}`);
    }
  }
}

/**
 * THE REVEAL — territory the region USED to occupy and no longer does.
 *
 * Exported and pure so it can be driven with masks instead of with a painter.
 * The behaviour it encodes is the difference between a shrink that works and one
 * that is silently undone, and a test of it that has to summon a real render to
 * fire is a test of the render (working law #3).
 *
 * Read it as one sentence: **inside the zone, where her region was and the
 * painted one is not.** No instruction is consulted, so no phrasing can be
 * missed; a grow returns nothing here and takes the path it always took.
 */
export async function vacancyOf(input: {
  /** The outer bound. Vacancy can never exceed it, like every other claim. */
  zone: Mask;
  /** Where the thing is on HER picture — the territory that may be given up. */
  masterRegion: Mask;
  /** Where the painter left it. Empty is a legitimate answer: a removal. */
  paintedRegion: Mask;
  /** Grown before subtraction, so a jittering boundary vacates nothing. */
  tolerancePx: number;
}): Promise<Mask> {
  const kept = input.tolerancePx > 0
    ? await dilateMask(input.paintedRegion, input.tolerancePx)
    : input.paintedRegion;
  return intersectMask(input.zone, subtractMask(input.masterRegion, kept));
}

/**
 * Take only what was asked for, and leave the rest of her exactly as she was.
 */
export async function harvestRefinement(input: MaskedRefineInput): Promise<MaskedRefineResult> {
  if (!maskedEditingEnabledFor(input.userId)) {
    /* The dark path, and it is byte-for-byte the engine's own answer. */
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "flag-off" };
  }

  /*
    A FACET WITH NO REGION ROUTES FULL-FRAME (D-233). An expression is the whole
    face re-posing; there is no zone that contains it, and drawing one would be
    the fringe error at maximum scale. If ANY facet in this edit is regionless
    the whole edit is, because one render cannot be half-masked.
  */
  const regionless = input.facets.filter((facet) => !hasRegion(facet));
  if (regionless.length > 0) {
    log.info(
      { operationId: input.operationId, facets: regionless },
      "[maskedRefine] facet has no region — routing full-frame by design",
    );
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "no-region" };
  }

  /*
    ADDITIONS ARE PLACED, NOT SEGMENTED. The thing is not there yet, so nothing
    can segment it (D-213) — its destination comes from a landmark on HER face
    plus the described object's own extent. A facet with no landmark vocabulary
    still refuses by name rather than having one invented for it.
  */
  const objects = input.facets.filter(needsLandmarkDestination);
  const unplaceable = objects.filter((facet) => landmarkNameOf(facet, input.described) === null);
  if (unplaceable.length > 0) {
    throw new MaskError(
      `${unplaceable.join(", ")} is an addition with no landmark to place it against`
      + (input.described ? ` for "${input.described}"` : "")
      + " — inventing an anchor would be a guess dressed as anatomy",
    );
  }

  const segmentable = input.facets.filter((facet) => !needsLandmarkDestination(facet));
  const names = segmentable.map((facet) => {
    const name = regionNameOf(facet);
    if (!name) {
      /* Loud. A facet with no segmentation question has no masked path, and
         inventing a prompt for it is exactly what D-213 forbids. */
      throw new MaskError(`facet "${facet}" has no region to segment — add it to REGION_OF_FACET`);
    }
    return name;
  });

  const master: Raster = await readRaster(input.master.bytes);
  let painted: Raster = await readRaster(input.painted.bytes);
  if (painted.width !== master.width || painted.height !== master.height) {
    /*
      MASTER HYGIENE, STATED RATHER THAN HIDDEN — and this is the line that
      refused the founder's first three real edits.
    
      **The MASTER is never resampled**, and that half does not bend: it is the
      picture the guarantee is about. The PATCH is another matter — we are about
      to discard most of it anyway, and the calibration harness has resized it
      since the first fixture for exactly that reason.
    
      Refusing outright was too strict for the wrong half. The engine is now
      told the exact size to return (`createFalMaskedEditEngine` pins
      `image_size`), so this should never fire; it stays as the honest fallback
      for an engine that ignores the ask, and it says so in the log rather than
      quietly resampling.
    */
    log.warn(
      {
        operationId: input.operationId,
        returned: `${painted.width}x${painted.height}`,
        master: `${master.width}x${master.height}`,
      },
      "[maskedRefine] the engine ignored the pinned size — resampling the PATCH, never the master",
    );
    const sharp = (await import("sharp")).default;
    painted = await readRaster(
      await sharp(input.painted.bytes)
        .resize(master.width, master.height, { fit: "fill" })
        .png()
        .toBuffer(),
    );
  }

  /*
    THE ZONE FOLLOWS THE FACET, NOT THE DELTA (D-233). A distributed facet — a
    cut, a colour, a texture — takes its whole region; scoping it to where the
    pixels move is what made a fringe into appliqué.
  */
  /* One paid segmentation per distinct question. Two facets that ask the same
     thing — `hair.cut` and `hair.colour` both segment "hair" — are one call. */
  const asked = new Map<string, Promise<Mask>>();
  const regionOf = (which: "master" | "painted", name: string, absentIsAnswer = false) => {
    const key = `${which}:${name}:${absentIsAnswer}`;
    const pending = asked.get(key)
      ?? input.reader.region({
        image: which === "master" ? input.master.bytes : input.painted.bytes,
        name,
        absentIsAnswer,
      }).then((mask) => {
        /*
          A GUARD ON THE PATH THAT ACTUALLY RUNS.

          `requestMatte` checks this and `requestMatte` has no callers, so until
          today nothing checked it where masks are really acquired. A reader
          returning a differently-sized mask misaligns every subsequent index by
          a row and reports nothing: the composite would still produce bytes, the
          guarantee would still "hold" against its own wrong mask, and the
          picture would be quietly wrong. **Never resize a mask to fit** — that
          is a resample on the one path that promises not to have one, and it
          moves every edge it touches.
        */
        if (mask.data.length !== mask.width * mask.height) {
          throw new MaskError(`the "${name}" mask is ${mask.data.length} bytes for ${mask.width}x${mask.height} — not single-channel`);
        }
        return mask;
      });
    asked.set(key, pending);
    return pending;
  };

  let zone: Mask | null = null;
  /*
    GROUND THIS EDIT LEGITIMATELY OWNS, collected as it is computed rather than
    re-derived later. It is what keeps the territory rule from re-creating "the
    composite puts them back": a removal's reveal, a shrink's reveal and an
    addition's destination all land on a neighbour's master territory on
    purpose, and an addition has no master extent of its own to appeal to.
  */
  const owned: Mask[] = [];
  for (let index = 0; index < segmentable.length; index += 1) {
    const region = await regionOf("master", names[index]);
    owned.push(region);
    const scoped = await scopedZone(segmentable[index], region);
    zone = zone ? unionMasks(zone, scoped) : scoped;
  }
  for (const facet of objects) {
    /* Two landmarks means two corridors — the bilateral law, and the reason a
       stud's scale can be read off her face rather than guessed. */
    const points = await input.reader.landmark({
      image: input.master.bytes, name: landmarkNameOf(facet, input.described)!,
    });
    const destination = additionDestination({
      landmarks: points,
      width: master.width,
      height: master.height,
      /* A drop hangs; glasses sit. The described object says which. */
      dropSteps: hangsBelowAnchor(input.described) ? 6 : 0,
    });
    /* THE ADDITION'S OWN GROUND. Its master extent is empty — there are no
       glasses on her yet — so the destination corridor is the only thing that
       can own the temples the arms are about to sit on. */
    owned.push(destination);
    zone = zone ? unionMasks(zone, destination) : destination;
  }
  /*
    A REMOVAL CAN BE THE WHOLE INSTRUCTION, and then there are no facets at all.

    `facetsWrittenBy(composed)` is built from what the recipe still says, and a
    removal that pruned its only step leaves it empty — so this threw "no facets
    to mask" and the refinement refunded, for an ask the painter had carried out
    perfectly. The departed thing is the territory in that case: her own frames,
    from her own master.
  */
  if (!zone && input.departed) {
    const gone = accessoryEntry(input.departed);
    if (!gone) {
      throw new MaskError(
        `nothing names what "${input.departed}" is — refusing to guess where it was`,
      );
    }
    const worn = await regionOf("master", gone.region, true);
    if (coverage(worn) > 0) zone = worn;
  }
  if (!zone) throw new MaskError("no facets to mask");

  /*
    ONE HARVEST PER REGION THE INSTRUCTION TOUCHES — and this is not an edge
    case, it is every chain past its first step.

    The harvest name used to be `names[0]`, with a literal `"earring"` fallback
    when no facet was segmentable. Both were the placeholder-turned-load-bearing
    class: true for the only case anyone had driven, silent about the rest. An
    ask about GLASSES harvested wherever her earrings were, and a compound
    dropped every region after the first.

    **Refusing compounds was my first answer and it was wrong.** Refinements are
    BASE-ANCHORED (D-86): variant N is the ORIGINAL edited by composed
    instructions 1..N, and the master handed to this function is that original.
    So `facetsWrittenBy(composed)` legitimately carries every facet the chain has
    ever written, and by step two of any real session the edit spans two regions.
    A refusal there would have refused the founder's walk at its second step —
    freckles, then fox eyes — while every test stayed green, because nothing in
    the suite drives a CHAIN through this function.

    So each distinct question gets its own harvest, its own reveal and its own
    strand colour, and the results are unioned. The strand colour matters most:
    it is measured from the interior of confirmed content, and one colour shared
    between a hair region and a lip region would be neither of them.

    This is the multi-patch composition D-233's makeup ruling describes, inside
    one render rather than across several. Independently retryable renders are
    still the fuller answer and still their own build.
  */
  type Question = {
    name: string;
    /** May the master legitimately not have this? True only for an addition. */
    absentOnMaster: boolean;
    /** Does her own hair sit in front of it? True only for an accessory. */
    occluded: boolean;
  };
  const questions: Question[] = Array.from(new Set(names))
    .map((name) => ({ name, absentOnMaster: false, occluded: false }));
  if (objects.length > 0) {
    const entry = accessoryEntry(input.described);
    if (!entry) throw new MaskError("nothing names what this accessory is — refusing to guess a region");
    questions.push({ name: entry.region, absentOnMaster: true, occluded: true });
  }
  /*
    AND THE THING THAT LEFT, which no facet in the record points at any more.

    `absentOnMaster: true` is what makes the loop below widen the zone from HER
    OWN frame — for a removal the object is on the master, and the landmark
    corridor is two small discs at the eyes while her frames run out to her
    temples. The vacancy arithmetic is then exactly the distributed shrink's:
    `zone ∩ (masterRegion − painted)`, which for a removed object is its whole
    footprint, because the painter's answer to "where are the glasses" is
    correctly nothing.
  */
  if (input.departed) {
    const gone = accessoryEntry(input.departed);
    if (!gone) {
      throw new MaskError(
        `nothing names what "${input.departed}" is — refusing to guess where it was`,
      );
    }
    if (!questions.some((question) => question.name === gone.region)) {
      questions.push({ name: gone.region, absentOnMaster: true, occluded: true });
    }
  }
  if (questions.length === 0) {
    throw new MaskError("nothing names what this edit is about — refusing to guess a region");
  }

  /*
    FOR A REMOVAL, HER CURRENT OBJECT IS THE TERRITORY THAT MUST STOP BEING IT.

    The landmark corridor is two small discs at the eyes; her frames run out to
    her temples. A zone that does not contain the thing being removed cannot
    remove it — the harness's SHRINK arm has always taken the master's own region
    as the zone, and this is that, unioned rather than substituted so an addition
    keeps its destination allowance.
  */
  for (const question of questions) {
    if (!question.absentOnMaster) continue;
    const worn = await regionOf("master", question.name, true);
    /* Her frames, where they are NOW — the removal's own ground, temples and
       all, and the reason a glasses removal is not clipped by the rule below. */
    if (coverage(worn) > 0) owned.push(worn);
    if (coverage(worn) > 0) zone = unionMasks(zone, worn);
  }

  const paintedSubject = await input.reader.subject({ image: input.painted.bytes });
  /*
    THE DEPTH STACK, for additions. Her hair sits in front of anything at the
    lobe, so it rides as `occludedBy` and an earring under it renders BEHIND it
    by construction — softly, so a half-transparent strand passes half the metal
    through, which is what a real strand does to the light behind it.
  */
  const inFront = questions.some((question) => question.occluded)
    ? await input.reader.region({ image: input.master.bytes, name: "hair" }).catch(() => null)
    : null;

  const strandReach = scaled(STRAND_REACH_FRACTION, master.width, master.height);
  const departedReach = scaled(DEPARTED_REACH_FRACTION, master.width, master.height);
  const tolerancePx = scaled(VACANCY_TOLERANCE_FRACTION, master.width, master.height);

  const perRegion: {
    withStrands: Mask;
    vacated: Mask;
    departed: Mask;
    vacancy: Mask;
    strandColour: [number, number, number];
  }[] = [];

  for (const question of questions) {
    /*
      WHERE THE THING IS *NOW* — the question that makes a shrink possible
      without anything ever classifying the instruction. For a segmentable facet
      the answer is already in hand (the zone was built from it, so this is a
      cache hit). For an accessory it is what separates an addition from a
      removal: she is wearing glasses or she is not, and "nowhere" is a
      legitimate answer rather than a failure.
    */
    const masterRegion = await regionOf("master", question.name, question.absentOnMaster);
    /*
      The harvest asks what the PAINTER actually drew. For an addition that is
      the object itself — now that it exists it can be segmented, which is the
      whole asymmetry: unsegmentable before, segmentable after. And for a removal
      the honest answer is *nothing*, which is the point rather than a problem.
    */
    const paintedContent = await regionOf("painted", question.name, true);
    const harvest = await harvestMatteFrom({
      content: paintedContent,
      matte: paintedSubject,
      taperPx: 8,
      ...(question.occluded && inFront ? { occludedBy: inFront } : {}),
    });

    /*
      The strand alpha the segmenter's boundary discards — exact, because we own
      the background (D-230). ONLY where the material has one: see
      `FRINGE_AT_EDGE`. A face-skin harvest reaching forty pixels past the jaw
      recovered a slab of background lying over her hair at alpha 0.730, and the
      composite delivered it as a hole. Skin has no fringe to rescue, so nothing
      is lost by not looking for one.
    */
    const strands = hasFringeAtEdge(question.name)
      ? differenceMatte({ master, patch: painted, confirmed: harvest, reachPx: strandReach })
      : {
        alpha: { data: Buffer.alloc(harvest.data.length, 0), width: harvest.width, height: harvest.height },
        /* The gate still needs the content's own colour; it just does not need
           a recovery to obtain it. */
        strandColour: confirmedColour(painted, harvest) ?? ([0, 0, 0] as [number, number, number]),
      };
    const withStrands: Mask = {
      data: Buffer.from(harvest.data.map((value, index) => Math.max(value, strands.alpha.data[index]!))),
      width: harvest.width,
      height: harvest.height,
    };

    /*
      A REVEAL ONLY EXISTS WHERE SOMETHING CAN LEAVE — see `MOVES_ITS_EDGE`.

      Both halves of this ran for every question. On a `marks` edit that meant a
      freckle instruction hunting across 160 pixels for skin that had departed
      from her face, and then delivering the painter's replacement for it. That
      is where run-6's phantom hank of hair arrived on her neck: `vacated` was
      zero and `departed` claimed 7,955 px of the band.

      Freckles do not remove skin. Nothing is lost by not asking.
    */
    const empty: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
    const canReveal = anyFacetMovesAnEdge(input.facets)
      /* A departure is a reveal by definition, whatever the facets say — a
         removal that pruned its only step leaves `facets` empty. */
      || input.departed !== undefined;
    const vacated = canReveal
      ? await vacancyOf({ zone, masterRegion, paintedRegion: paintedContent, tolerancePx })
      : empty;
    const departed = canReveal
      ? differenceMatte({
        master: painted, patch: master, confirmed: masterRegion, reachPx: departedReach,
      })
      : { alpha: empty };
    const departedFully: Mask = {
      data: Buffer.from(departed.alpha.data.map((value) =>
        Math.min(255, Math.round(value / REMOVAL_TOTAL_ABOVE)))),
      width: departed.alpha.width,
      height: departed.alpha.height,
    };
    const departedVacated = canReveal
      ? await vacancyOf({
        zone, masterRegion: departedFully, paintedRegion: paintedContent, tolerancePx,
      })
      : empty;

    perRegion.push({
      withStrands,
      vacated,
      departed: departed.alpha,
      vacancy: unionMasks(vacated, departedVacated),
      strandColour: strands.strandColour,
    });
  }

  /*
    The painter's own drift, measured per render — from territory this composite
    claims NOTHING in, across every region. The vacancy is claimed, so it is
    excluded from the sample for the same reason the harvest always was: a
    baseline drawn through the loud part of the frame raises the bar the loud
    part then has to clear.
  */
  const claimed = unionMasks(...perRegion.flatMap((region) => [region.withStrands, region.vacancy]));
  const quietSamples: number[] = [];
  for (let pixel = 0; pixel < claimed.data.length; pixel += 1) {
    if (claimed.data[pixel] !== 0 || pixel % 37 !== 0) continue;
    const at = pixel * 3;
    quietSamples.push((Math.abs(painted.data[at] - master.data[at])
      + Math.abs(painted.data[at + 1] - master.data[at + 1])
      + Math.abs(painted.data[at + 2] - master.data[at + 2])) / 3);
  }
  quietSamples.sort((a, b) => a - b);
  const baselineDelta = quietSamples[Math.floor(quietSamples.length / 2)] ?? 0;

  /*
    Each region gated with ITS OWN strand colour. Only what is really the new
    content, never her surface rendered again — and the reveal narrowed by the
    same gate on `novelty` only, because what lands in a reveal is background and
    skin, and asking it to look like the strand would revert every pixel of it.
  */
  const ungoverned = unionMasks(...perRegion.map((region) => unionMasks(
    harvestGate({
      master, patch: painted, alpha: region.withStrands,
      strandColour: region.strandColour, baselineDelta,
    }).alpha,
    harvestGate({
      master, patch: painted, alpha: region.vacancy,
      strandColour: region.strandColour, baselineDelta, criterion: "novelty",
    }).alpha,
  )));
  const harvested = unionMasks(...perRegion.map((region) => region.withStrands));
  const vacated = unionMasks(...perRegion.map((region) => region.vacated));
  const departedAlpha = unionMasks(...perRegion.map((region) => region.departed));

  /*
    THE TERRITORY RULE — see `CONFUSABLE_NEIGHBOURS`.

    Subtracted from the DELIVERED content rather than from the zone, so the
    expansion, the interaction band and the feather all inherit it and nothing
    downstream has to remember. A pixel that on the MASTER belongs to a region
    this instruction never named is not this edit's to change, however confident
    the harvest is about it.

    `owned` is the escape hatch and it is load-bearing: the named regions' own
    master extents, a departed object's current footprint, an addition's
    destination corridor, and every reveal computed above. Without it this rule
    IS "the composite puts them back" — the defect it exists downstream of.
  */
  const namedRegions = new Set(questions.map((question) => question.name));
  const protectedNames = new Set<string>();
  for (const question of questions) {
    for (const neighbour of confusableNeighboursOf(question.name)) {
      if (!namedRegions.has(neighbour)) protectedNames.add(neighbour);
    }
  }
  let gated = ungoverned;
  let protectedTerritory: Mask | null = null;
  if (protectedNames.size > 0) {
    const ownedGround = unionMasks(
      ...owned,
      ...perRegion.map((region) => region.vacancy),
      ...perRegion.map((region) => region.vacated),
    );
    for (const name of Array.from(protectedNames)) {
      /*
        FROM THE MASTER, ALWAYS. The painted frame is the thing under suspicion;
        asking it where her hair is would let the measurement follow the answer
        around, which is how run-6's harvest came to believe her hair was skin.

        A neighbour the reader cannot find is not a reason to refuse the whole
        render — it is a reason to protect nothing, which is the behaviour this
        path had before the rule existed.
      */
      const territory = await regionOf("master", name, true).catch(() => null);
      if (territory === null || coverage(territory) === 0) continue;
      protectedTerritory = protectedTerritory
        ? unionMasks(protectedTerritory, territory)
        : territory;
    }
    if (protectedTerritory !== null) {
      const forbidden = subtractMask(protectedTerritory, ownedGround);
      gated = subtractMask(gated, forbidden);
      log.info(
        {
          operationId: input.operationId,
          protecting: Array.from(protectedNames),
          surrenderedCoverage: Number((coverage(ungoverned) - coverage(gated)).toFixed(5)),
        },
        "[maskedRefine] territory it was never asked about, given back to her master",
      );
    }
  }

  /* A zone that stops where the content does not is a guillotine (D-230). */
  const grown = await expandUntilClear({
    /*
      THE PAINT THAT WILL ACTUALLY BE DELIVERED, not everything the painter
      touched — and the difference is the whole behaviour of this loop.

      Defined as "any pixel differing by 25 levels", the mask was the painter's
      WHOLE-FRAME DRIFT: a generated frame differs almost everywhere, so content
      pressed against every edge of the zone forever and the loop grew to its
      pass cap with the zone covering 100% of the frame. Sixteen dilations of a
      1024x1536 mask, twenty to thirty seconds, and a destination zone that had
      stopped meaning anything.

      The rider's subject is the CONTENT, and the content is what the harvest
      keeps. A strand pressing against the boundary is a clipped strand; a
      repainted background pixel is not, and it never was.
    */
    painted: { data: Buffer.from(gated.data), width: gated.width, height: gated.height },
    zone,
    stepPx: 48,
    effective: gated,
  });

  /* Contact shadows, darkening only — her hue cannot change (D-229). */
  const adopted = adoptInteraction({
    master, patch: painted, harvest: gated,
    bandPx: scaled(BAND_FRACTION, master.width, master.height),
    mode: "shadow",
  });

  /* Refused before the composite if the mask cannot do its job. */
  assertUsable(adopted.alpha, "skin");

  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: grown.zone, edgeMatte: adopted.alpha, featherRadius: FEATHER_PX,
  });
  /*
    AND DID WE TEAR IT? — the question nothing in the product asked (see
    `compositeIntegrity`). `outsideMaskUnchanged` proves we changed nothing we
    should not have; this asks whether what we changed INSIDE was cut across
    real content. Run-6's torn render passed the first and would have failed
    this one, and it was scored `delivered_compliant`.
  */
  const seam = compositeSeam({
    master, composite: composed.composite, applied: composed.applied,
  });
  /*
    ENFORCING only where a step at the boundary can never be legitimate. A cut,
    a removal or a shrink is SUPPOSED to change the silhouette, and one clean
    specimen of that kind is not a calibration — those record the verdict and
    deliver, which is how `renderFault` shipped before it was flipped on a
    number. The shadow period produces the evidence its own flip needs.
  */
  const seamEnforced = !anyFacetMovesAnEdge(input.facets) && input.departed === undefined;
  if (seam.torn) {
    log[seamEnforced ? "error" : "warn"](
      {
        operationId: input.operationId,
        facets: input.facets,
        enforced: seamEnforced,
        boundaryPixels: seam.boundaryPixels,
        tornPixels: seam.tornPixels,
        worstExcess: Number(seam.worstExcess.toFixed(1)),
      },
      seamEnforced
        ? "[maskedRefine] OUR COMPOSITE TORE THE FRAME — refusing to deliver it"
        : "[maskedRefine] composite seam on an edge-moving edit — SHADOW, delivered anyway",
    );
    if (seamEnforced) {
      /*
        Its own failure class, because the receipt is the record. `render_fault`
        writes "the image came back damaged" about a provider that did nothing
        wrong — the exact mistake `facts_missing` was split out to stop, one
        layer further in. This one is ours.
      */
      throw new ProviderError("composite_fault", seam.detail);
    }
  }

  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  if (!outside.identical) {
    /* Arithmetic, so this cannot happen — which is exactly why it is checked.
       A guarantee nobody verifies at the point of use is a claim. */
    throw new MaskError(
      `the composite changed ${outside.changedPixels} px outside the applied mask — refusing to deliver it`,
    );
  }

  log.info(
    {
      operationId: input.operationId,
      facets: input.facets,
      zoneCoverage: Number(coverage(grown.zone).toFixed(4)),
      blendBand: outside.bandPixels,
      expansionPasses: grown.passes,
    },
    "[maskedRefine] composited — outside the mask, byte-identical to her master",
  );

  return {
    bytes: await writePng(composed.composite),
    contentType: "image/png",
    outcome: "composited",
    guarantee: {
      outsideIdentical: outside.identical,
      blendBandPixels: outside.bandPixels,
      zoneCoverage: coverage(grown.zone),
    },
    ...(input.explain
      ? {
        explain: {
          zoneAsScoped: zone,
          zone: grown.zone,
          harvested,
          vacated,
          departed: departedAlpha,
          delivered: gated,
          applied: composed.applied,
        },
      }
      : {}),
  };
}

/**
 * The reader a caller gets when it has not supplied one.
 *
 * It refuses rather than returning an empty mask, because an empty mask would
 * compose to "nothing changed" and the user would be charged for a picture
 * identical to the one they already had. While the flag is dark nothing ever
 * reaches it — `harvestRefinement` returns before consulting a reader at all,
 * and a test proves the segmenter is not called.
 */
export const refusingRegionReader: RegionReader = {
  region: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  subject: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  landmark: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
};
