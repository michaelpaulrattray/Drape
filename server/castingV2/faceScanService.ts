/**
 * SERVING THE AUTO-SCAN — one read per face-version, and never a second one.
 *
 * `faceScan.ts` reads a frame and says where every feature is. This is the part
 * that decides WHEN that read happens, WHO pays for it twice (nobody), and what
 * the panel actually receives.
 *
 * # THE CACHE WAS SCAFFOLDING, AND THE TABLE HAS NOW ARRIVED (fable-373 4b,
 * # founder yes via fable-698, migration 0032)
 *
 * The scaffolding was declared rather than drifted into: memory is instant, has
 * no migration, and is lost on every deploy. **What promoted it was a reading,
 * not an anecdote** — the re-scan rate this file logs said 58 paid scans for 28
 * distinct faces across two days of ordinary use, and that number bought the
 * table.
 *
 * So there are now THREE places an answer can come from, and the order is not
 * arbitrary: the memory below (free), then `casting_face_scans` (a round trip),
 * then the reader (money). `CASTING_SCAN_TABLE_SCOPE` gates the middle one; off,
 * this file behaves exactly as it did, and the paragraphs below about writing
 * nothing are true again.
 *
 * The re-scan rate keeps being logged, and it keeps meaning the MEMORY's misses
 * — the kept-reading hit is counted separately. A figure that justified a change
 * must remain able to show whether the change worked.
 *
 * # A SECOND CLICK MUST NOT BUY A SECOND SCAN
 *
 * The cache holds the PROMISE, not the answer. Two selections a second apart —
 * or the panel query and the scan query racing on a fresh key — join the same
 * read. A cache that stored only settled values would have cost fourteen extra
 * calls on every double-click, which is exactly the shape of spending that is
 * invisible until the bill.
 *
 * # WHAT LEAVES THIS MODULE IS DISPLAY FURNITURE
 *
 * Boxes in the frame's own pixels, and a one-bit stencil per feature so the
 * panel can draw a masked cutout from the frame it is already showing
 * (fable-374: *"masked cutouts."*).
 *
 * With the table off, nothing is written and there is no manifest, no purge
 * ordering and no born-held race — the scan cannot outlive or drift from its
 * frame, because it never leaves the process. With it on, the stencils DO
 * become objects, and all three of those problems come with them: they are
 * answered in `keptFaceScan.ts` (manifest born held before the bytes are
 * written; rows and objects swept with the candidate; a row whose `frameKey`
 * has moved is refused rather than served).
 *
 * **The stencils are DOWNSAMPLED and that is declared too**: they are drawn at
 * 34px and travel in a query payload, so a full-resolution hair mask would be
 * a hundred kilobytes to render a thumbnail. They are nearest-neighbour
 * reduced to a longest side of {@link STENCIL_MAX_SIDE}, which keeps them
 * binary — a downsample that smoothed would invent partial coverage where the
 * reader claimed none. The BOX is full resolution and exact; only the picture
 * of the shape is cheap. Nothing downstream may read these bytes as geometry.
 */
import { createModuleLogger } from "../logging/logger";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";
import { withCallCensus, type CallCensus } from "./callCensus";
import { storagePublicUrl, storageReadBytes } from "../storage";
import { describeFace, type FaceDescriptions } from "./faceDescribe";
import { scanFace, scanPlan, type FaceScan } from "./faceScan";
import { interpreterEngine } from "./interpreter";
import { createFalRegionReader } from "./falRegionReader";
import type { PanelBox, PanelScan } from "./facePanel";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";
import { captureCastingFaceDiscoveryEnabled, captureCastingScanTableEnabled } from "./castingV2Scope";
import { discoverFeatures, discoveryCropsOf, type FaceDiscovery, type FeatureKind } from "./faceDiscovery";
import { keepScan, serveKeptScan, type KeptScanShape } from "./keptFaceScan";
import { coversAFaceCut } from "./maskCoverage";
import { slotDefinition } from "./referenceSlotCatalogue";
import {
  catalogueCutsOf,
  unDrawnCutsOf,
  cutDiscovered,
  type CatalogueCut,
  type DiscoveredRegion,
  type NamedNotCut,
} from "./pointerCut";
import { cropMask } from "./segmentCuts";
import sharp from "sharp";

const log = createModuleLogger("castingV2/faceScanService");

/** The longest side a display stencil travels at. 34px on screen, 8× the pixels. */
export const STENCIL_MAX_SIDE = 256;

/**
 * How many face-versions are held.
 *
 * Bounded on purpose: an unbounded map keyed by every version anybody looks at
 * is a leak with a slow fuse, and this process also holds image buffers. At
 * eight stencils each the ceiling is a couple of megabytes.
 */
export const FACE_SCAN_CACHE_LIMIT = 64;

/** How many keys are remembered for the re-scan rate, beyond the cache itself. */
const SEEN_KEY_LIMIT = 4096;

export type ScannedFace = {
  /** The frame every row draws from — the picture the viewer already has. */
  frameUrl: string;
  slots: ReadonlyMap<FeatureSlot, { box: PanelBox; maskUrl: string }>;
  /**
   * The rows that can only be described — build and skin, one line each.
   *
   * A map of the same shape as `slots` because the panel merges them the same
   * way: the library wins where it has anything, and this fills the rest.
   */
  words: ReadonlyMap<FeatureSlot, readonly string[]>;
  /** What was asked and what came back, so a thin scan is legible. */
  asked: number;
  found: number;
  empty: readonly string[];
  failed: readonly { question: string; why: string; retryable?: boolean }[];
  /** What the stencils cost the payload, measured rather than assumed. */
  stencilBytes: number;
  /**
   * WHICH SIDES CAME BACK, per bilateral feature: `eye:LR brow:L- ear:LR`.
   *
   * The eyes court cost two shifts and could not be settled from the record:
   * the founder reported one eye, the log carried `asked/found/empty` counts,
   * and the scan writes nothing — so his specimen could only be RE-DRIVEN on
   * the same bytes, never read back (fable-383 ruling 2). One field closes
   * that. `-` is a side that was asked about and answered nothing, which is an
   * honest answer on a face with an ear behind her hair and a finding on a face
   * looking straight at the camera.
   */
  sides: string;
  /**
   * WHAT THE READING FOUND THAT NO CATALOGUE QUESTION COVERS — one row per cut
   * instance, carrying the customer's own noun (#2566 slice 2's pointer road).
   *
   * A LIST and not a map, which is the one shape decision in this field: a map
   * keyed by slot could hold the geometry and not the NOUN, and the noun cannot
   * be read back out of the key (`pointerCut`'s header, and the open lane's own
   * binding condition before it). A row here is a jacket, a sash, a third eye —
   * things the fixed list cannot see at any price.
   *
   * Empty is the ordinary answer and means nothing went wrong: the flag is off,
   * or the discovery named only things the catalogue already asks about, or the
   * detector found none of them. There is no state here for *the pointer road
   * failed*, because a failure costs exactly the rows it could not cut and the
   * panel is then what it is today.
   *
   * ⚠ **"Exactly the rows it could not cut" was true of ONE look and false of
   * every look after it until #2833**: a reading that lost its found rows was
   * kept like a clean one, so the loss outlived the minute that caused it. Such
   * a reading is now served and NOT kept (`foundRowsLost` in `scannedFace`), so
   * the next look asks again. Still no field here: it is a fact about whether
   * to keep the reading, not about what the panel draws.
   */
  discovered: readonly DiscoveredPanelRow[];
  /**
   * WHAT THE READING NAMED AND NOTHING CUT — words with no picture (#2566
   * slice 2's grouping design, rules 2, 3 and 4).
   *
   * Three different things with one shape, and the design sends each somewhere:
   * a SCATTERED thing has no outline to cut, so its words belong to whatever it
   * sits on (freckles on skin → the Skin row's words line); MAKEUP gets no row
   * at all, by his ruling, and travels only as words; and an UNCUT thing was
   * asked about and produced nothing drawable.
   *
   * ⚠ **Empty is the ordinary answer and does NOT mean the reading was thin** —
   * the flag may be off, or every name may have been cut. It is a record, never
   * a count of failures.
   */
  namedNotCut: readonly NamedNotCut[];
};

/**
 * THE FACE'S OWN CUTS, out of everything a scan cut — for his check 1 (#2856).
 *
 * Derived from the catalogue's own `group` rather than from a list of nouns
 * written here, so a face row added to the catalogue is asked about on the day
 * it is added and nobody has to remember this line (working law 4). Only rows
 * this scan actually CUT are in it: an unasked or empty face row has no mask,
 * and a question nothing can answer is not asked.
 *
 * Exported so it can be driven on its own. The bench the scan suite uses
 * answers every question with one shape, so an arm going through a scan cannot
 * tell which group this reads — it was sabotaged to `accessories` and stayed
 * green. This is the population, read directly.
 */
export function faceCutsOf(masks: ReadonlyMap<FeatureSlot, Mask>): Mask[] {
  return Array.from(masks.entries())
    .filter(([slot]) => slotDefinition(slot)?.group === "face")
    .map(([, mask]) => mask);
}

/**
 * ONE FOUND ROW AS THE PANEL RECEIVES IT — its mask already a stencil, the way
 * {@link ScannedFace.slots} carries one.
 */
export type DiscoveredPanelRow = {
  slot: FeatureSlot;
  /** The reading's own bare noun. Never derived from the slot. */
  noun: string;
  instance: number;
  /**
   * WHAT THE READING SAID IT IS, AND WHAT IT SITS ON — the panel's whole
   * grouping grammar (#2566 slice 2).
   *
   * They travel here because the panel is where the grouping happens and the
   * panel has no reader: `clothing` is what may enter the one Outfit row,
   * `accessory` lists under Accessories (his ruling of 2026-10-29, #2789), and
   * `on` is what chains a buckle to its strap. Neither is ever re-derived from
   * the noun, which is the rule his ⚠ about the *Collar* implants is about.
   */
  kind: FeatureKind;
  on: string;
  box: PanelBox;
  maskUrl: string;
  /**
   * DOES THIS THING'S CUT-OUT SHAPE LIE OVER THE FACE'S OWN FEATURES — his
   * ruling of 2026-10-30 (#2856, check 1) as amended by him the same hour.
   *
   * ⚠ **The rectangle is never the question, and that is his own correction**:
   * *"im not worried about the box covering the neck that sort of normal if
   * its the outfit or whatever"*. A rag cloth, a scarf or a high collar has a
   * rectangle that reaches the chin and is still outfit. What fails is a shape
   * lying over the mouth, the nose, the eyes — the skin a refine would repaint.
   *
   * ⚠ **So it is measured HERE and carried, rather than asked by the panel.**
   * `facePanel` is a pure projection — *"rows in, rows out"* — and by the time
   * it sees a row the mask is a base64 PNG it cannot decode. This module holds
   * the scan's own face cuts and the piece's cut as raw bytes at the same
   * moment, and it is the only place in the product that ever does.
   *
   * `false` is the honest answer for a row nothing could measure: a reading
   * kept before this field existed restores without it and is treated as not
   * covering, which is today's panel exactly.
   */
  coversFace: boolean;
};

/**
 * The laterality summary, derived from the plan the scan actually ran.
 *
 * From `scanPlan()` rather than from the slots that came back, so a feature
 * that answered NOTHING still prints `--` — an absence is only legible beside
 * the question that produced it.

 */
function sidesOf(slots: ReadonlyMap<FeatureSlot, unknown>): string {
  return scanPlan()
    .filter((region) => region.slots.some((slot) => slot.instance !== null))
    .map((region) => {
      const found = (instance: string) =>
        region.slots.some((slot) => slot.instance === instance && slots.has(slot.slot));
      return `${region.feature}:${found("left") ? "L" : "-"}${found("right") ? "R" : "-"}`;
    })
    .join(" ");
}

type CacheEntry = {
  promise: Promise<ScannedFace>;
  /** Set on resolve, so a caller that must not block can ask what is ready. */
  settled: ScannedFace | null;
  /**
   * WHAT HAS LANDED SO FAR — the rows a panel can draw while the rest is still
   * being read (fable-521 §3).
   *
   * Fourteen questions run in parallel and the slowest decides when `settled`
   * appears, so for several seconds this holds real rows nobody could see.
   * It is grown by the scan's own `onFiled`, from the same boxes and masks that
   * end up in `settled` — never a second reading of anything.
   *
   * `null` until the first feature lands, which is a different thing from an
   * empty scan and is why it is not an empty map.
   */
  partial: ScannedFace | null;
};

const cache = new Map<string, CacheEntry>();
const seen = new Set<string>();
const counters = { scans: 0, rescans: 0, hits: 0, misses: 0, failures: 0, damaged: 0, kept: 0 };

/**
 * The key: the owner, the face, and the version.
 *
 * `userId` is in it even though the ids below are internal and unique, because
 * a cache keyed on a resource alone is one refactor away from serving one
 * account's face to another. Cheap, and it makes that class impossible rather
 * than unlikely.
 */
function keyOf(input: { userId: number; candidateId: number; variantId: number | null }): string {
  return `${input.userId}:${input.candidateId}:${input.variantId ?? "master"}`;
}

function remember(key: string): void {
  if (seen.size >= SEEN_KEY_LIMIT) {
    const oldest = seen.values().next();
    if (!oldest.done) seen.delete(oldest.value);
  }
  seen.add(key);
}

function hold(key: string, entry: CacheEntry): void {
  cache.set(key, entry);
  while (cache.size > FACE_SCAN_CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * One stencil, cropped to its own box and reduced to display size.
 *
 * Cropped first: a full-frame mask is mostly empty, and the panel positions the
 * cutout from the box anyway, so the stencil and the box describe the same
 * rectangle. Nearest-neighbour, so the shape stays the two values the reader
 * gave it.
 */
async function stencilOf(mask: Mask, box: PanelBox): Promise<Buffer> {
  const cropped = cropMask(mask, { x: box.x, y: box.y, width: box.width, height: box.height });
  const longest = Math.max(cropped.width, cropped.height);
  const scale = longest > STENCIL_MAX_SIDE ? STENCIL_MAX_SIDE / longest : 1;
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));
  let image = sharp(cropped.data, {
    raw: { width: cropped.width, height: cropped.height, channels: 1 },
  });
  if (scale < 1) image = image.resize(width, height, { kernel: "nearest" });
  return image
    /* One channel out, stated — sharp promotes a raw single-channel input to
       truecolour and the result would be three copies of every stencil value
       (`writeMaskPng`'s own scar). */
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The scan, as the panel receives it.
 *
 * A data URL rather than an object at a key: these are display bytes with no
 * lifecycle, and minting sixteen objects per face-version to draw eight
 * thumbnails is the manifest-and-purge machinery 4a exists to avoid.
 */
async function displayOf(
  scan: FaceScan,
  frameUrl: string,
  /* The pointer road's rows, cut beside the catalogue's and stencilled here for
     the reason the catalogue's are: one function turns masks into what the
     panel draws, so a found row and a catalogued one cannot end up two
     different kinds of picture (#2566 slice 2). */
  found: readonly DiscoveredRegion[] = [],
  /* The words of everything the reading named and nothing cut, carried through
     for the reason `found` is: one function assembles what the panel reads, so
     a row's picture and a row's words cannot be built by two different hands
     (#2566 slice 2). */
  namedNotCut: readonly NamedNotCut[] = [],
): Promise<ScannedFace> {
  const slots = new Map<FeatureSlot, { box: PanelBox; maskUrl: string }>();
  let stencilBytes = 0;
  for (const [slot, box] of Array.from(scan.boxes.entries())) {
    const mask = scan.masks.get(slot);
    /* Box and mask are set together by `scanFace`, always. A box without its
       shape here would render as a hard-edged rectangle beside its cutout
       neighbours, so it is skipped rather than shipped half-dressed. */
    if (!mask) continue;
    const stencil = await stencilOf(mask, box);
    stencilBytes += stencil.length;
    slots.set(slot, { box, maskUrl: `data:image/png;base64,${stencil.toString("base64")}` });
  }
  const words = new Map<FeatureSlot, readonly string[]>();
  for (const [slot, line] of Array.from(scan.descriptions.entries())) words.set(slot, [line]);

  /*
    THE FACE'S OWN CUTS, for his check 1 below (#2856, 2026-10-30).

    Derived from the catalogue's own `group` rather than from a list of nouns
    written here, so a face row added to the catalogue is asked about on the
    day it is added and nobody has to remember this line (working law 4). Only
    rows this scan actually CUT are in it — an unasked or empty face row has no
    mask, and a question nothing can answer is not asked.
  */
  const faceCuts = faceCutsOf(scan.masks);

  const discovered: DiscoveredPanelRow[] = [];
  for (const region of found) {
    const stencil = await stencilOf(region.mask, region.box);
    stencilBytes += stencil.length;
    /*
      HIS CHECK 1, MEASURED AT THE PIXELS (#2856, and his amendment the same
      hour: *"im not worried about the box covering the neck that sort of
      normal if its the outfit or whatever"*).

      Measured here because this is the one moment both shapes exist as raw
      bytes in one process: the panel receives a base64 stencil it cannot
      decode, and the kept reading restores one. What the answer is FOR is the
      whole-Outfit outline — a garment lying over the mouth must not drag the
      row's rectangle up over the face with it.

      ⚠ **Measured on every found row and not only on clothing**, because what
      counts as a piece of the outfit is the panel's grouping decision and not
      this module's; asking only the rows one caller happens to want today is
      how a fact goes missing the first time a second caller wants it.
    */
    const coversFace = coversAFaceCut(region.mask, faceCuts);
    if (coversFace) {
      log.info(
        { slot: region.slot, noun: region.noun, faceCuts: faceCuts.length },
        "[faceScanService] a found shape lies over one of the face's own cuts — it is kept as a row and left out of the whole-outfit outline",
      );
    }
    discovered.push({
      slot: region.slot,
      noun: region.noun,
      instance: region.instance,
      kind: region.kind,
      on: region.on,
      box: region.box,
      maskUrl: `data:image/png;base64,${stencil.toString("base64")}`,
      coversFace,
    });
  }

  return {
    frameUrl,
    slots,
    words,
    asked: scan.asked,
    /* STILL THE CATALOGUE'S COUNT, deliberately. `found` is read beside `asked`
       to tell a thin reading from a broken one, and both are about the plan the
       scan ran; adding the pointer road's rows to it would make a dressed cast
       report more found than asked, which reads as an instrument fault. The
       pointer road's own counts are in `pointerCut`'s log line and the length of
       `discovered` is the panel's answer. */
    found: slots.size,
    empty: scan.empty,
    failed: scan.failed,
    stencilBytes,
    sides: sidesOf(slots),
    discovered,
    namedNotCut,
  };
}

/**
 * The live words reader, or nothing.
 *
 * Built here beside the region reader for the same reason it is: this module
 * decides what a real scan uses, and `scanFace` takes what it is given.
 */
function defaultDescriber(): ((input: { bytes: Buffer; contentType: string }) => Promise<FaceDescriptions>) | null {
  return interpreterEngine() === null ? null : describeFace;
}

/**
 * ASK A PAIR ONCE INSTEAD OF TWICE — `ENABLE_CASTING_PAIR_ONE_READ`, off unless it is
 * exactly `"true"` (#2191, his goal of 2026-10-10: *"our goal would be to
 * reduce this cost by as much as possible"*).
 *
 * A face scan's five bilateral regions cost two segmenter reads each, one per
 * half-frame. #2532's arm 1 measured that one whole-frame read can answer both
 * sides: **the derived floor falls 18 → 13, about 2.5¢ off a 12¢ scan.** The
 * road and its geometry are `falRegionReader`'s (`pairInOneRead`,
 * `splitAtMidline`); what is decided HERE is only that the SCAN takes it, which
 * is why it is read in this module and passed in rather than read down there.
 *
 * ⚠ **The REFINE deliberately does not get it**, and that is this flag's whole
 * shape rather than an omission: `refineService` builds its own reader and a
 * masked refine PAINTS on the mask it is handed, so a wrong side there is a
 * delivered picture the customer paid for, where here it is a panel row. One
 * flag that moved both would be the widening nobody meant.
 *
 * ⚠ **Not on `OPTIONAL_VARS`, for the reason the retired image key is on
 * neither list**: every entry there earns a boot WARNING, which is right for a
 * variable whose absence switches a capability OFF and wrong here — absent,
 * this is today's answer, bought the way it has always been bought. And
 * compared against `"true"` exactly, never truthiness: a Railway variable
 * created with no value holds the empty string, and `??` does not catch it.
 */
export const PAIR_ONE_READ_ENV = "ENABLE_CASTING_PAIR_ONE_READ";

/** Exported for its own arms: the predicate is the whole of the flag, and a
 *  reader of it that nothing drives is a position nobody has checked. */
export function pairInOneReadEnabled(): boolean {
  return process.env[PAIR_ONE_READ_ENV] === "true";
}

function defaultRegionReader(): RegionReader | null {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey, pairInOneRead: pairInOneReadEnabled() }) : null;
}

/**
 * ASK THE PICTURE BEFORE ASKING THE LIST — `CASTING_FACE_DISCOVERY_SCOPE`
 * (#2566, the design approved on #2532).
 *
 * Decided HERE, for the reason the pair-one-read flag is: `scanFace` takes what
 * it is given and never reaches for a paid transport of its own, so what this
 * module owns is whether a discovery is bought at all.
 *
 * ⚠ **Four separate roads lead to "ask the whole catalogue", and all four are
 * silent.** The flag is off for this user; there is no text transport
 * configured; the read itself failed, timed out or came back unparseable; or
 * only one of its two crops answered. The scan behaves identically in every one
 * of them and the customer sees today's panel — a discovery is a courtesy on
 * top of a courtesy, and it is not allowed to be the thing that takes a feature
 * off somebody's panel.
 *
 * ⚠ **AND THAT LAST SENTENCE WAS A CLAIM ABOUT THE FAILURE ROADS ONLY — IT IS
 * NOW TRUE OF A SUCCESSFUL READING TOO.** The relay drove the flag on and
 * measured features leaving real panels on readings where nothing had failed
 * (the finding on PR #2570); `faceDiscovery.ts`'s header carries the repairs.
 * The second finding closed the class rather than the instance: the discovery
 * no longer cancels any question, so no reading it touches can be thinner than
 * a flag-off one.
 *
 * ⚠ **Exported for its own arms, on `pairInOneReadEnabled`'s own reasoning, and
 * that export was bought by a sabotage rather than chosen.** Driven through a
 * scan, replacing the flag check here with a constant left the whole suite
 * green — because the next line finds no transport, or the read fails, and
 * both of those fall open to exactly the answer a correctly-gated scan gives.
 * **The three silent roads that make this road safe are the same three that
 * make it untestable from the outside**, so the decision is driven where it is
 * made: a flag nothing can be shown to consult is a feature on for everyone.
 */
export function defaultDiscoverer(
  userId: number,
): ((frame: { bytes: Buffer; width: number; height: number }) => Promise<FaceDiscovery>) | null {
  if (!captureCastingFaceDiscoveryEnabled(userId)) return null;
  const engine = interpreterEngine();
  if (engine === null) return null;
  return async (frame) => discoverFeatures({ crops: await discoveryCropsOf(frame), engine });
}

export type FaceScanDependencies = {
  reader?: RegionReader | null;
  describe?: ((input: { bytes: Buffer; contentType: string }) => Promise<FaceDescriptions>) | null;
  readBytes?: typeof storageReadBytes;
  publicUrl?: (key: string) => string;
  /**
   * THE DISCOVERY READ, or nothing — handed the frame, answering what is on it.
   *
   * A seam like `reader` and `describe`: `undefined` means "the live one if the
   * flag names this user", and an explicit `null` means "do not discover",
   * which is what every existing suite gets without changing a line.
   */
  discover?: ((frame: { bytes: Buffer; width: number; height: number }) => Promise<FaceDiscovery>) | null;
};

/**
 * WHAT A KEPT ROW MEANS, in one place.
 *
 * Two callers turn a row into a reading now — {@link scannedFace} and
 * {@link scannedFaceAlreadyRead} — and the `failed: []` rule below is the kind of
 * clause that goes quietly wrong in a second copy (working law 4).
 */
function readingFromKept(kept: KeptScanShape, frameUrl: string): ScannedFace {
  return {
    frameUrl,
    slots: kept.slots,
    words: kept.words,
    asked: kept.asked,
    found: kept.slots.size,
    empty: kept.empty,
    /* A kept reading is a CLEAN one by construction — nothing else is written —
       so this is not an assumption, it is the table's own rule read back. */
    failed: [],
    stencilBytes: kept.stencilBytes,
    sides: kept.sides,
    /*
      ⚠ THE FOUND ROWS COME BACK OUT OF THE ROW, AND THIS LINE IS THE WHOLE
      REASON THEY ARE STORED (#2566 slice 2).

      `CASTING_SCAN_TABLE_SCOPE` is `all`, so the FIRST look is kept and every
      later look on the same frame comes through here. Reading the catalogue
      rows and not these would put a jacket on the panel once and never again —
      *"the same frame gave a different panel on different readings"*, which is
      the finding slice 1 was held on, arriving by the storage road instead of
      the reader's.

      `?? []` is the pre-#2566 row and the flag-off row alike, and both mean the
      same thing: no found rows, which is today's panel.
    */
    discovered: kept.discovered ?? [],
    /* The same sentence about words: a kept reading that dropped these would
       lose the freckles' words off the Skin row on the second look at an
       unchanged frame. `?? []` is the pre-grouping row and the flag-off row
       alike, and both route no words, which is today's panel. */
    namedNotCut: kept.namedNotCut ?? [],
  };
}

/**
 * WHAT HAS ALREADY BEEN READ FOR THIS FACE — memory, THEN the table. Never a
 * scan, and never a wait on one (#1378).
 *
 * # The defect this closes, and it is a tier one reader never learned about
 *
 * {@link scannedFaceIfReady} is the panel's first paint, and it reads the
 * in-memory cache alone. That was the whole truth when it was written
 * (`35815459`, 2026-08-13): memory was the only tier there was. The kept table
 * arrived three days later (`30835252`, 2026-08-16) and touched
 * `faceScanService.ts` and its own suite and **nothing else** — so
 * {@link scannedFace} gained the tier and the panel's first paint did not.
 *
 * What a customer got: the **first** open of a face in a fresh process showed
 * the library-only panel — no scanned regions — **while the answer sat on disk**,
 * and then paid a fresh twenty-call segmenter read to learn what had already
 * been bought. This program deploys many times a night, so "a fresh process" is
 * the ordinary case rather than an edge one. Measured on 2026-09-26: 14 rows and
 * 3 regions cold against 9 rows and 13 regions warm, same tree, same subject,
 * one restart between the readings (#1378).
 *
 * # Why it is a separate function rather than `scannedFaceIfReady` made async
 *
 * That one promises never to touch a database and the panel's other caller
 * relies on it; this one costs one indexed SELECT, which is what a first paint
 * can afford and a scan is not.
 *
 * ⚠ **It deliberately does not move `counters`.** Those measure the MEMORY's
 * miss rate — the number that bought the table — and a second caller would change
 * their denominator. A hit here is still counted exactly once, by the `faceScan`
 * query that always follows and finds the memory warm.
 */
export async function scannedFaceAlreadyRead(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
  /** The frame on screen. The staleness guard's other end: a row read from
   *  different bytes is a stale reading, not this one. */
  imageKey: string;
  dependencies?: Pick<FaceScanDependencies, "publicUrl">;
}): Promise<ScannedFace | null> {
  const key = keyOf(input);
  const held = cache.get(key);
  /* A settled answer in memory is the same answer and free. An UNSETTLED entry
     means a scan is in flight and its own query owns it — answering with a
     partial here would have the first paint draw rows the panel is about to be
     told are still arriving. */
  if (held) return held.settled;
  if (!captureCastingScanTableEnabled(input.userId)) return null;
  const kept = await serveKeptScan({
    userId: input.userId,
    candidateId: input.candidateId,
    variantId: input.variantId,
    frameKey: input.imageKey,
  });
  if (!kept) return null;
  const publicUrl = input.dependencies?.publicUrl ?? storagePublicUrl;
  const served = readingFromKept(kept, publicUrl(input.imageKey));
  /* HELD, so the `faceScan` query that follows finds it warm and answers
     `done` without ringing a segmenter. Without this the panel would be right
     and the money would still be spent. */
  hold(key, { settled: served, partial: null, promise: Promise.resolve(served) });
  return served;
}

/**
 * Read this face-version once, and hand back what the panel draws.
 *
 * The reader is built PER SCAN rather than shared, and that is load-bearing:
 * `createFalRegionReader` verifies the frame's URL against the bytes in hand
 * once per reader, so one reader per frame is one verification per frame. A
 * shared reader would carry one frame's proof into another frame's calls.
 */
export async function scannedFace(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
  /** The frame being looked at: the version's own image, or the master's. */
  imageKey: string;
  dependencies?: FaceScanDependencies;
}): Promise<ScannedFace> {
  const key = keyOf(input);
  const held = cache.get(key);
  if (held) {
    counters.hits += 1;
    /* Refresh its place in the queue — the version she keeps looking at is the
       one worth keeping. */
    cache.delete(key);
    cache.set(key, held);
    return held.promise;
  }

  /*
    THE READING THIS FACE HAS ALREADY PAID FOR (migration 0032, founder yes via
    fable-698).

    The memory above dies with the process, and this program deploys many times
    a night — 58 paid scans for 28 distinct faces across two days of ordinary
    use. So before spending anything, ask the table.

    It sits BELOW the memory and ABOVE the reader, which is the only place it
    can sit: below, because a warm answer costs nothing and a database round
    trip is not nothing; above, because everything past this line spends money.

    A miss here is not counted as a re-scan and does not write the audit row —
    both of those measure the MEMORY's misses, which is the number that bought
    this table, and folding a second cache into them would make the figure that
    justified the change unable to show whether it worked.

    Dark until `CASTING_SCAN_TABLE_SCOPE` names the user: off, `serveKeptScan`
    is never called and not one row is read.
  */
  if (captureCastingScanTableEnabled(input.userId)) {
    const kept = await serveKeptScan({
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      frameKey: input.imageKey,
    });
    if (kept) {
      counters.hits += 1;
      counters.kept += 1;
      const publicUrl = input.dependencies?.publicUrl ?? storagePublicUrl;
      const served = readingFromKept(kept, publicUrl(input.imageKey));
      log.info(
        { candidateId: input.candidateId, found: served.found, kept: counters.kept },
        "[faceScanService] served a face-version from the kept reading — nothing was spent",
      );
      const entry: CacheEntry = { settled: served, partial: null, promise: Promise.resolve(served) };
      hold(key, entry);
      remember(key);
      return served;
    }
  }

  counters.misses += 1;
  counters.scans += 1;
  const rescan = seen.has(key);
  if (rescan) counters.rescans += 1;
  remember(key);

  /*
    THE MISS IS WRITTEN DOWN, because the rate is what decides the table.

    This cache is in memory and dies with the process, so on a night with a
    dozen deploys a version looked at twice is READ twice — and the re-scan rate
    the design note promised would be "a reading rather than an anecdote" lived
    only in a log line whose window rotates on every one of those deploys. That
    is the refusal counter's lesson on another surface: a number nobody can read
    back is not a measurement.
    
    A miss writes one row; a HIT writes nothing, because a free answer is not
    worth a row. It carries no reading about her face — a candidate id, whether
    this pair had been read before, and how full the cache was.
  */
  void logAuditEvent({
    userId: input.userId,
    action: AUDIT_ACTIONS.CASTING_SCAN_MISS,
    resourceType: "casting_candidate",
    resourceId: String(input.candidateId),
    metadata: { rescan, variantId: input.variantId ?? null, cacheSize: cache.size },
    severity: "info",
  }).catch(() => {
    /* A scan is a courtesy read; its bookkeeping may never break it. */
  });

  /*
    THE ENTRY IS DECLARED BEFORE THE READ, because the read grows it.

    `onFiled` runs while the scan is still in flight and writes each landed
    feature onto this entry, so a panel asking mid-scan gets the rows that
    exist rather than nothing at all. The alternative — a second structure the
    endpoint reads — would be the same facts twice (law 4), and the two would
    disagree on exactly the frames somebody was watching.
  */
  const entry: CacheEntry = { settled: null, partial: null, promise: null as never };

  /*
    AND THE SCAN IS ON THE STOPWATCH TOO (the latency-and-cost program).

    A scan is house money — a run of segmenter calls per version looked at,
    measured and priced in `scripts/lib/falSpend.mts` (`FACE_SCAN_FAL_CALLS`)
    — and until now the only figure for it was an estimate written in a
    design note. The same census the paid render opens is opened here, so the
    courtesy read's cost is measured by the same instrument rather than by a
    second one that would disagree with it (law 4).

    What it costs the user: nothing. What it buys: the scan's own line in the
    cost table, and the arithmetic behind "promote this cache to a table".
  */
  let spent: CallCensus | null = null;
  /*
    WHY THE READING'S OWN ROWS CANNOT BE TRUSTED COMPLETE, or `null` (#2833,
    his eye round 9).

    The missing-eyes law below decides whether a reading is kept, and until
    this card it read the CATALOGUE's failures alone. The discovery road fails
    open by design (a read that came back `{ ok: false }`, a detect or a cut
    that threw, a road that threw outright), and each of those leaves a reading
    that LOOKS clean: every catalogue row drawn, and not one row the reading
    would have added. Kept, it is the end of the asking for that frame, so one
    bad minute at the provider took the outfit and the tattoos off that
    candidate for good. His round-9 panel is that shape exactly: a settled
    panel with Eyes, Brows, Nose, Lips, Ears, Hair and Earrings, and not one
    found row, where two readings of the same picture on the same build both
    drew an Outfit and a Tattoo.

    Set by the discovery road, read once at the keep decision. A plain variable
    rather than a field on the reading, because the reading is what gets kept
    and this is a fact about whether to keep it.
  */
  let foundRowsLost: string | null = null;
  const read = (async () => {
    const { value, census } = await withCallCensus(async () => {
    const readBytes = input.dependencies?.readBytes ?? storageReadBytes;
    const publicUrl = input.dependencies?.publicUrl ?? storagePublicUrl;
    const reader = input.dependencies?.reader === undefined
      ? defaultRegionReader()
      : input.dependencies.reader;
    if (reader === null) {
      /* No transport, no reading. It refuses rather than returning an empty
         scan, because an empty scan and a face with nothing on it are the same
         payload and the panel would show the second while meaning the first. */
      throw new Error("the region reader is not configured (FAL_KEY)");
    }

    const frame = await readBytes(input.imageKey);
    const metadata = await sharp(frame.bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("the frame has no readable size");
    const url = publicUrl(input.imageKey);
    /*
      THE DISCOVERY, BESIDE THE QUESTIONS AND NEVER IN FRONT OF THEM (#2566).

      ⚠ It used to run FIRST and decide which questions got bought, and that is
      gone on the relay's second HELD finding on PR #2570: a discovery that
      missed a visible feature cancelled its question and took the row off the
      panel (cast 812's Earrings, reading 2 of 3), and running first made a
      flag-on reading 29 s against 20 s for a saving the measurement could not
      see. The discovery may only ADD now, and what it adds is slice 2's. So
      nothing here waits for it: it is started beside the scan, the scan asks
      the whole catalogue exactly as it does with the flag off, and the read's
      counts are logged by `discoverFeatures` itself.

      It cannot throw. `discoverFeatures` turns every failure into `{ ok: false }`,
      and a discoverer that is absent is no read at all.
    */
    /**
     * ONE FOUND ROW ONTO THE PARTIAL, as it lands.
     *
     * It reads every other field off `entry.partial` and writes a whole new
     * object, which is precisely what `onFiled` below does for a catalogue row
     * — so the two writers cannot clobber each other's half, and neither has to
     * know the other exists. That is the existing idiom in this function rather
     * than a new one, and the reason it is safe is single-threaded JavaScript:
     * each of these runs to completion between awaits.
     */
    const fileToPartial = async (region: DiscoveredRegion): Promise<void> => {
      try {
        const stencil = await stencilOf(region.mask, region.box);
        const discovered = [...(entry.partial?.discovered ?? []), {
          slot: region.slot,
          noun: region.noun,
          instance: region.instance,
          kind: region.kind,
          on: region.on,
          box: region.box,
          maskUrl: `data:image/png;base64,${stencil.toString("base64")}`,
          /*
            ⚠ **NOT MEASURED ON THE PARTIAL, AND IT IS A `false` WITH A REASON
            RATHER THAN AN OMISSION.** His check 1 (#2856) asks whether this
            shape lies over the face's own CUTS, and on this road a found row
            lands the moment it is cut — the face rows it would be compared
            against may not have come back yet, so the answer here would depend
            on which read finished first. A partial is the preview the panel
            draws WHILE the scan runs and `displayOf` replaces it wholesale
            when the reading lands; `false` is that preview drawn exactly as it
            was drawn before this field existed.
          */
          coversFace: false,
        }];
        const slots = new Map(entry.partial?.slots ?? []);
        entry.partial = {
          frameUrl: url,
          slots,
          words: entry.partial?.words ?? new Map(),
          asked: scanPlan().length,
          found: slots.size,
          empty: [],
          failed: [],
          stencilBytes: (entry.partial?.stencilBytes ?? 0) + stencil.length,
          sides: sidesOf(slots),
          discovered,
          /* Read off the entry rather than reset, for `discovered`'s own
             reason: the words-only names land in ONE write at the end of the
             pointer road, and a partial that cleared them would drop them if a
             catalogue row happened to file afterwards. */
          namedNotCut: entry.partial?.namedNotCut ?? [],
        };
      } catch {
        /* A partial is a courtesy on top of a courtesy — the settled reading
           cuts the same stencil from the same mask a moment later. */
      }
    };

    /**
     * THE WORDS WITH NO PICTURE, ONTO THE PARTIAL (#2566 slice 2).
     *
     * `fileToPartial`'s sibling, written the same way and for the same reason:
     * it reads every other field off `entry.partial` and writes a whole new
     * object, so neither writer has to know the other exists and neither can
     * clobber the other's half. Single-threaded JavaScript is what makes that
     * safe — each of these runs to completion between awaits.
     *
     * It cuts no stencil and touches no storage, so unlike its sibling it has
     * nothing that can throw; the shape is kept identical anyway, because the
     * next hand to add a field here will add it to whichever one it is reading.
     */
    const fileWordsToPartial = (said: readonly NamedNotCut[]): void => {
      const slots = new Map(entry.partial?.slots ?? []);
      entry.partial = {
        frameUrl: url,
        slots,
        words: entry.partial?.words ?? new Map(),
        asked: scanPlan().length,
        found: slots.size,
        empty: [],
        failed: [],
        stencilBytes: entry.partial?.stencilBytes ?? 0,
        sides: sidesOf(slots),
        discovered: entry.partial?.discovered ?? [],
        namedNotCut: said,
      };
    };

    /*
      ⚠ **AND NOW IT HAS A CONSUMER, WHICH IS SLICE 2 (#2566).** The paragraph
      above still holds in every word — the discovery runs BESIDE the catalogue
      questions and cancels none of them — and what has changed is only that its
      names are no longer thrown away. They go to the pointer road, which cuts
      the ones no catalogue question covers and hands back rows with pictures.

      **The scan is still not waiting on any of it.** `scanFace` is awaited
      below exactly as before, its `onFiled` fills the partial exactly as
      before, and a panel asking mid-reading gets the catalogue rows at the same
      moment it does today. What the SETTLED answer waits for is both — because
      a settled reading that omitted the jacket would be kept, and the jacket
      would then never arrive on that frame at all (see `readingFromKept`).

      It cannot throw: every road through `discoverFeatures` and `cutDiscovered`
      ends in a value, and the `.catch` here is the belt on the braces.
    */
    const discover = input.dependencies?.discover === undefined
      ? defaultDiscoverer(input.userId)
      : input.dependencies.discover;
    /*
      THE CATALOGUE'S CUTS, HANDED TO THE POINTER ROAD WHEN THEY LAND (#2789).

      His eye found one hoop drawn twice — the catalogue's Earrings and a found
      *Ear piercing* — and a star drawn as a septum ring. Both are answered by
      comparing a found cut with the scan's own cuts on the same frame, which
      only exist once `scanFace` below resolves; so the pointer road is handed a
      promise of them, settled exactly once with the scan or with `null` if the
      scan throws. The scan does not wait on the discovery, so nothing here can
      wait on itself; the pointer road usually lands after the scan anyway (the
      discovery read is the long pole), and a found row that lands first simply
      waits for the catalogue before it is drawn — rows appear whole or not at
      all.
    */
    let settleCatalogue: (
      cuts: { rows: readonly CatalogueCut[]; unDrawn: readonly CatalogueCut[] } | null,
    ) => void = () => {};
    /* The rows a found cut may fold into, and the places the panel draws no row
       for (#2810) — one scan, so one settle: the two can never disagree about
       which reading they came from. */
    const catalogueLanded = new Promise<{ rows: readonly CatalogueCut[]; unDrawn: readonly CatalogueCut[] } | null>((resolve) => {
      settleCatalogue = resolve;
    });
    /*
      BOTH HALVES OF THE READING'S ANSWER, in ONE promise (#2566 slice 2).

      The pointer road produces rows with pictures AND words with none, and the
      second half only exists because the first one declined to cut something.
      Two promises would be two things to await and a shape in which one can
      land without the other — and the settled reading is what gets KEPT, so a
      reading written down with its rows and without its words is a reading that
      lost the freckles for good on that frame.
    */
    const discovering: Promise<{
      regions: readonly DiscoveredRegion[];
      namedNotCut: readonly NamedNotCut[];
    }> = discover === null
      ? Promise.resolve({ regions: [], namedNotCut: [] })
      : discover({ bytes: frame.bytes, width: metadata.width, height: metadata.height })
        .then(async (discovery) => {
          /* Fail-open is still the answer the panel gets — the catalogue,
             exactly as before. What changes is only that it is not written
             down as complete (#2833, `foundRowsLost` above). The `why` is the
             reader's own fixed sentence, never a word of the reading. */
          if (!discovery.ok) {
            foundRowsLost = `the discovery read: ${discovery.why}`;
            return { regions: [], namedNotCut: [] };
          }
          const cut = await cutDiscovered({
            frame: {
              bytes: frame.bytes,
              width: metadata.width as number,
              height: metadata.height as number,
              url,
            },
            features: discovery.features,
            reader,
            catalogue: () => catalogueLanded.then((cuts) => cuts?.rows ?? null),
            unDrawn: () => catalogueLanded.then((cuts) => cuts?.unDrawn ?? null),
            /* Each found row onto the partial as it lands, for the catalogue
               rows' own reason: a reading that takes forty seconds must look
               like a reading that is working. `fileToPartial` is shared with
               `onFiled` below so the two cannot describe one entry
               differently. */
            onFiled: (region) => { void fileToPartial(region); },
          });
          /* Onto the partial in ONE write, once, because nothing streams here:
             two of the three `why`s are known before the first call and the
             third only at the end, so a per-name write would show a flickering
             list of reasons on a panel that is already drawing pictures. */
          if (cut.named.length > 0) fileWordsToPartial(cut.named);
          /* A detect or a cut that THREW is a row this reading could not ask
             about, which is weather and not an answer (`RegionReader.pointer`:
             *"a transport failure is NOT an absence"*). The detector finding
             nothing is an answer, and `declined` does not land here. Counted,
             never named: the `pointer road` line already carries the nouns. */
          if (cut.failed.length > 0) {
            foundRowsLost = `the pointer road: ${cut.failed.length} name(s) whose call failed`;
          }
          return { regions: cut.regions, namedNotCut: cut.named };
        })
        .catch(() => {
          foundRowsLost = "the pointer road threw";
          return { regions: [], namedNotCut: [] };
        });
    let scan: Awaited<ReturnType<typeof scanFace>>;
    try {
      scan = await scanFace({
        frame: { bytes: frame.bytes, width: metadata.width, height: metadata.height, url },
        reader,
        contentType: frame.contentType,
        describe: input.dependencies?.describe === undefined
          ? defaultDescriber()
          : input.dependencies.describe,
        /*
          EACH FEATURE, AS IT LANDS. The stencil for it is cut here rather than at
          the end, which is the same work in a different order — `displayOf` will
          cut the same shapes from the same masks when the scan resolves, and the
          settled answer is still the authority. This one is what she can look at
          in the meantime.
        */
        onFiled: (filed) => {
          void (async () => {
            for (const one of filed) {
              const stencil = await stencilOf(one.mask, one.box);
              const slots = new Map(entry.partial?.slots ?? []);
              slots.set(one.slot, {
                box: one.box,
                maskUrl: `data:image/png;base64,${stencil.toString("base64")}`,
              });
              entry.partial = {
                frameUrl: url,
                slots,
                words: entry.partial?.words ?? new Map(),
                asked: scanPlan().length,
                found: slots.size,
                empty: [],
                failed: [],
                stencilBytes: (entry.partial?.stencilBytes ?? 0) + stencil.length,
                sides: sidesOf(slots),
                /* Read off the entry rather than reset, so a found row that
                   landed first is not wiped by the next catalogue row —
                   `fileToPartial` above preserves `slots` the same way. */
                discovered: entry.partial?.discovered ?? [],
                namedNotCut: entry.partial?.namedNotCut ?? [],
              };
            }
          })().catch(() => {
            /* A partial is a courtesy on top of a courtesy: if a stencil will not
               cut here, the settled scan cuts it again a moment later. */
          });
        },
      });
      settleCatalogue({ rows: catalogueCutsOf(scan), unDrawn: unDrawnCutsOf(scan) });
    } catch (error) {
      /* Nothing to compare a found cut with: the pointer road folds nothing and
         draws no row the product's word placed. The read rejects either way. */
      settleCatalogue(null);
      throw error;
    }
    /*
      ⚠ **THIS IS AWAITED NOW, AND THE PREVIOUS COMMENT'S REASONING IS WHY IT
      HAS TO BE** (#2566 slice 2). It read *"not awaited: the panel never waits
      on a read that changes nothing on it"* — correct while the discovery's
      names were logged and discarded, and false the moment they became rows.

      The SETTLED reading is what gets kept (`keepScan`, under
      `CASTING_SCAN_TABLE_SCOPE`, which is `all`), and a kept reading is the end
      of the asking for that frame: a settled answer that omitted the found rows
      would be written down as complete, and the jacket would never appear on
      that version again. What the customer waits for is unchanged in the only
      place it is measured — the panel's first paint reads the PARTIAL, which
      both writers fill as rows land.
    */
    const found = await discovering;
    return await displayOf(scan, url, found.regions, found.namedNotCut);
    });
    spent = census;
    return value;
  })();
  entry.promise = read;

  read.then(
    (value) => {
      /*
        A SCAN WITH FAILED REGIONS IS NOT KEPT — the founder's second missing-eyes
        cause (fable-547), and it hid behind the first one.
        
        The segmenter answers "eyes" on his bespectacled frame (0.0942%), the
        shipped scan finds both of them (0.0421% / 0.0516% per side), and the
        panel builds an Eyes row from that scan. All three were measured on his
        own specimen. What his panel actually showed was an OLDER reading of the
        same version: the burst that lost eleven regions to the provider's
        concurrency limit resolved into a scan whose `failed` list was long, and
        that scan was cached for the life of the process. Every later look at
        that version returned the damage rather than re-asking.
        
        The rule the code already had for a THROWN read is the right one here
        too — *"a failed read is not cached; the next look pays again, which is
        the right trade for a courtesy read"* — and it simply did not cover a
        read that came back holding failures. It does now: a clean scan is kept,
        a damaged one is served to whoever is waiting and then dropped, so the
        next look re-asks the regions that were lost.
        
        What it costs: a face with a genuinely unanswerable region re-scans on
        each new look rather than once. The client holds its own answer for the
        session (staleTime Infinity), so that is bounded by how often somebody
        opens the version afresh — and the alternative is a wrong panel that
        cannot be fixed by looking again.

        ⚠ **AND IT COVERED THE CATALOGUE ROAD ONLY UNTIL #2833.** The rows the
        discovery road adds (an outfit, a tattoo, a collar) were lost the same
        way and kept anyway, because nothing they lost reached `failed`. Same
        law, same trade, one more road: `foundRowsLost` is read beside the
        weather. It is NOT put into `failed`, on purpose — `failed` is a list
        of catalogue QUESTIONS that `absentSlotsOf` and the panel read, and a
        found row is not one of them.
      */
      const weather = value.failed.filter((one) => one.retryable === true);
      if (weather.length > 0 || foundRowsLost !== null) {
        counters.damaged += 1;
        log.warn(
          { failed: value.failed.length, weather: weather.map((one) => one.question), foundRowsLost },
          weather.length > 0
            ? "[faceScanService] this reading lost regions — serving it and NOT keeping it, so the next look re-asks"
            : "[faceScanService] this reading lost the rows it would have found — serving it and NOT keeping it, so the next look re-asks",
        );
        if (cache.get(key) === entry) cache.delete(key);
      } else {
        entry.settled = value;
        /*
          AND A CLEAN READING IS KEPT (migration 0032).

          Exactly here, in the branch that already decides cleanliness — not in
          a second place that would have to re-derive it and could disagree.
          The damaged branch above is the missing-eyes law, and the whole reason
          this write sits inside the `else`: persisting a reading that lost
          regions would make one bad minute permanent.

          Fire-and-forget on purpose. She already has her panel; the row is
          bookkeeping, and `keepScan` never throws — its own failures fall back
          to today's behaviour, which is that the next look pays again.
        */
        if (captureCastingScanTableEnabled(input.userId)) {
          void keepScan({
            userId: input.userId,
            candidateId: input.candidateId,
            variantId: input.variantId,
            frameKey: input.imageKey,
            scan: value,
          });
        }
      }
      log.info(
        {
          asked: value.asked,
          found: value.found,
          empty: value.empty.length,
          failed: value.failed.length,
          stencilBytes: value.stencilBytes,
          /* Counted beside the boxes: a panel with every cutout and no
             descriptions is a different failure from one with neither, and the
             founder's complaint was about the rows that have no cutout. */
          described: value.words.size,
          /* WHICH SIDES, per bilateral feature — the field the eyes court
             needed and did not have. */
          sides: value.sides,
          /*
            THE RE-SCAN RATE, on every scan — the number that promotes this
            cache to a table (4b), or declines to. A rate near zero says the
            memory shortcut is costing nothing; a rate that climbs after
            deploys says the migration has earned itself.
          */
          scans: counters.scans,
          rescans: counters.rescans,
          rescanRate: counters.scans === 0 ? 0 : Number((counters.rescans / counters.scans).toFixed(3)),
          cacheHits: counters.hits,
          cacheSize: cache.size,
          /* WHAT THIS READ COST, from the same census the paid render uses —
             the courtesy read's own line in the cost table. */
          calls: spent?.total.calls ?? null,
          callMs: spent?.total.ms ?? null,
          wallMs: spent?.wallMs ?? null,
          /* WHICH QUESTIONS the scan's minutes went on. The panel's cost is
             argued about in whole scans; the lever is per question, and it was
             being collected on every call and summed nowhere. */
          byAbout: spent?.byAbout ?? null,
        },
        "[faceScanService] scanned a face-version",
      );
    },
    (error) => {
      counters.failures += 1;
      /* A failed read is not cached. The next look pays again, which is the
         right trade for a courtesy read: a cached rejection would make one bad
         minute permanent for that version. */
      if (cache.get(key) === entry) cache.delete(key);
      log.warn({ err: error, failures: counters.failures }, "[faceScanService] a scan failed");
    },
  );

  hold(key, entry);
  return entry.promise;
}

/**
 * What is ALREADY read for this face-version — never a read, never a wait.
 *
 * The panel query calls this. It must answer in the time a panel takes to
 * render, and a scan takes seconds, so the panel's first paint is the library
 * alone and the scan arrives on its own query. On every look after the first,
 * this is already warm and the panel is complete in one round trip.
 */
export function scannedFaceIfReady(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
}): ScannedFace | null {
  const held = cache.get(keyOf(input));
  return held?.settled ?? null;
}

/**
 * WHAT IS READY RIGHT NOW, and whether that is all of it (fable-521 §3).
 *
 * The settled scan when there is one; otherwise the rows that have landed so
 * far, which is what lets the panel fill a feature at a time instead of waiting
 * for the slowest of fourteen questions.
 *
 * `done` is about the READING, not about the rows: a scan that finished with
 * three features is done, and a scan that has three of fourteen so far is not.
 * The panel needs the difference — one draws an empty row as absent, the other
 * as still coming.
 *
 * `null` for a key nobody has asked about, which is neither.
 */
export function scanProgressOf(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
}): { scan: ScannedFace; done: boolean } | null {
  const held = cache.get(keyOf(input));
  if (held === undefined) return null;
  if (held.settled !== null) return { scan: held.settled, done: true };
  return held.partial === null ? null : { scan: held.partial, done: false };
}

/**
 * WHETHER A LOOK AT THIS FACE-VERSION WOULD BUY ANYTHING (#2170).
 *
 * `true` exactly when {@link scannedFace}'s FIRST branch would answer — an
 * entry is held, whether its reading is still in flight or settled — and that
 * branch returns the held promise without ringing a segmenter. So `true` means
 * "already paid for", read off the same `cache.get(key)` the spend itself reads
 * rather than a second record of it (working law 4).
 *
 * It exists for the daily scan cap. The panel asks `faceScan` again every
 * second while a reading fills, and until #2170 every one of those asks spent a
 * count: 55 counts for 20 faces on the first real day, and 15 refusals after.
 * A look that this answers `true` for buys nothing, so it must spend nothing.
 *
 * ⚠ **`false` does not promise a spend**, and that is the safe direction: a
 * reading in the kept table but not in memory answers `false` here and is then
 * served free by `scannedFace`'s second branch. In practice the panel's own
 * first paint (`scannedFaceAlreadyRead`) has usually HELD that reading already,
 * so it reads `true` by the time `faceScan` asks.
 *
 * Never a read, never a wait, never a write.
 */
export function scanIsInHand(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
}): boolean {
  return cache.has(keyOf(input));
}

/**
 * WHICH SLOTS WERE ASKED ABOUT AND ANSWERED NOTHING, CLEANLY.
 *
 * The fact the bald row is made of (founder ruling fable-889, design note
 * `PANEL_ABSENT_STATE_DESIGN.md`), and it has to be DERIVED here because
 * `empty` holds region QUESTIONS while the panel is a list of SLOTS.
 *
 * Three conditions, and each one is a different way of not being an absence:
 *
 *   in `empty`     the question was asked and answered nothing. A question that
 *                  FAILED is in `failed` instead and is filtered below anyway —
 *                  belt and braces, because "could not look" is precisely the
 *                  fact this must never be confounded with
 *   no box         a bilateral region counts as filed when EITHER side lands,
 *                  so the region-level answer is not per-slot enough on its own.
 *                  The eyes court is the specimen: one eye found and one missed
 *                  is recorded as a success (`faceScan`'s own `emptySlots`
 *                  note), and a slot with a box is present whatever the region
 *                  said
 *   in the plan    a slot nobody asked about is not an absence, it is silence
 *
 * It reports the FACT for every slot. WHICH facts may be spoken is the
 * catalogue's decision (`whenAbsent`), authored per slot beside its reason, and
 * the panel is where the two meet — one place deciding what is true, another
 * deciding what may be said about it.

 */
function absentSlotsOf(scan: ScannedFace): ReadonlySet<FeatureSlot> {
  if (scan.empty.length === 0) return new Set();
  const empty = new Set(scan.empty);
  const failed = new Set(scan.failed.map((one) => one.question));
  const absent = new Set<FeatureSlot>();
  for (const region of scanPlan()) {
    if (!empty.has(region.question) || failed.has(region.question)) continue;
    for (const slot of region.slots) {
      if (!scan.slots.has(slot.slot)) absent.add(slot.slot);
    }
  }
  return absent;
}

/** The panel's view of a scan — boxes, stencils, the described rows, and what
 *  came back empty. */
export function panelScanOf(scan: ScannedFace): PanelScan {
  return {
    frameUrl: scan.frameUrl,
    slots: scan.slots,
    words: scan.words,
    /*
      A PARTIAL SCAN CLAIMS NO ABSENCE, AND IT DOES SO BY CONSTRUCTION: the
      in-flight `partial` carries `empty: []` because a question still in the
      air has answered neither way. So a row that will end up saying "bald" is
      simply not there yet while the scan runs, and `scanning` draws it as a
      place for something — which is the difference the panel already knew how
      to make.
    */
    absent: absentSlotsOf(scan),
    /*
      THE FOUND ROWS, STRAIGHT THROUGH (#2566 slice 2). Nothing is decided here:
      which of them becomes a row, and whether it draws at all, is the panel's
      business — it already owns his *"no features ... unless it has an image to
      go with it"* rule for every other row and must own it for these too.
    */
    discovered: scan.discovered,
    /*
      AND THE WORDS WITH NO PICTURE, STRAIGHT THROUGH TOO, for the same reason
      in the same sentence: WHERE a scattered thing's words land — on the row it
      sits on, or on nothing a row can carry — is a question about which rows
      exist, and the only place that knows which rows exist is the panel.
    */
    namedNotCut: scan.namedNotCut,
  };
}

/** For tests and for the reliability report. */
export function faceScanCacheStats(): {
  scans: number;
  rescans: number;
  rescanRate: number;
  hits: number;
  misses: number;
  failures: number;
  /** Scans that came back holding failed regions and were therefore not kept. */
  damaged: number;
  size: number;
} {
  return {
    ...counters,
    rescanRate: counters.scans === 0 ? 0 : counters.rescans / counters.scans,
    size: cache.size,
  };
}

/** Test-only: a process-wide cache would otherwise leak between cases. */
/**
 * Wait for a scan to finish, but never longer than this — the endpoint's own
 * patience, so a first look answers with what has landed rather than holding
 * the request open for the slowest question.
 */
export async function scanSettlesWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<boolean> {
  /*
    AND IT SAYS WHETHER THE READING FINISHED, which is not the same question as
    whether any rows landed — a scan that FAILED has no rows and is over.
    Without that distinction the endpoint would answer "not finished" forever, a
    polling client would ask again every second, and because a failed read is
    deliberately not cached, every one of those asks would start a fresh
    fourteen-question scan. A courtesy read in a retry loop is the one way this
    could cost real money.
  */
  const finished = Symbol("finished");
  const outcome = await Promise.race([
    promise.then(() => finished, () => finished),
    new Promise<undefined>((resolve) => {
      const timer: any = setTimeout(resolve, ms);
      /* Never hold the process open for a courtesy read's patience. */
      timer?.unref?.();
    }),
  ]);
  return outcome === finished;
}

export function resetFaceScanCache(): void {
  cache.clear();
  seen.clear();
  counters.scans = 0;
  counters.rescans = 0;
  counters.hits = 0;
  counters.misses = 0;
  counters.failures = 0;
  counters.damaged = 0;
}
