/**
 * SERVING THE AUTO-SCAN — one read per face-version, and never a second one.
 *
 * `faceScan.ts` reads a frame and says where every feature is. This is the part
 * that decides WHEN that read happens, WHO pays for it twice (nobody), and what
 * the panel actually receives.
 *
 * # THE CACHE IS SCAFFOLDING, AND IT IS DECLARED (fable-373 ruling 4b)
 *
 * The durable answer is a table — `casting_face_scans`, keyed (candidate,
 * version) — and a table is a MIGRATION, which lands before its code and takes
 * the founder's own ceremony in production. This holds the scan in memory
 * instead, which is instant, has no migration, and is lost on every deploy.
 *
 * That is a shortcut, so it is named as one rather than arrived at by drift.
 * What it costs when it is wrong: one re-read at roughly $0.07 for whoever
 * selects a face in the minutes after a deploy. **What promotes it is a
 * reading, not an anecdote** — every scan logs the RE-SCAN RATE (how often a
 * key we have already paid for comes back around), so the question "is the
 * table worth its migration yet" is answered by a number this file produces.
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
 * (fable-374: *"masked cutouts."*). No objects are written, so there is no
 * manifest, no purge ordering and no born-held race — the scan cannot outlive
 * or drift from its frame, because it never leaves the process.
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
import { storagePublicUrl, storageReadBytes } from "../storage";
import { describeFace, type FaceDescriptions } from "./faceDescribe";
import { scanFace, scanPlan, type FaceScan } from "./faceScan";
import { interpreterEngine } from "./interpreter";
import { createFalRegionReader } from "./falRegionReader";
import type { PanelBox, PanelScan } from "./facePanel";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";
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
  failed: readonly { question: string; why: string }[];
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
};

const cache = new Map<string, CacheEntry>();
const seen = new Set<string>();
const counters = { scans: 0, rescans: 0, hits: 0, misses: 0, failures: 0 };

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
async function displayOf(scan: FaceScan, frameUrl: string): Promise<ScannedFace> {
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

  return {
    frameUrl,
    slots,
    words,
    asked: scan.asked,
    found: slots.size,
    empty: scan.empty,
    failed: scan.failed,
    stencilBytes,
    sides: sidesOf(slots),
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

function defaultRegionReader(): RegionReader | null {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey }) : null;
}

export type FaceScanDependencies = {
  reader?: RegionReader | null;
  describe?: ((input: { bytes: Buffer; contentType: string }) => Promise<FaceDescriptions>) | null;
  readBytes?: typeof storageReadBytes;
  publicUrl?: (key: string) => string;
};

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

  const read = (async () => {
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
    const scan = await scanFace({
      frame: { bytes: frame.bytes, width: metadata.width, height: metadata.height, url },
      reader,
      contentType: frame.contentType,
      describe: input.dependencies?.describe === undefined
        ? defaultDescriber()
        : input.dependencies.describe,
    });
    return await displayOf(scan, url);
  })();
  const entry: CacheEntry = { settled: null, promise: read };

  read.then(
    (value) => {
      entry.settled = value;
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

/** The panel's view of a scan — boxes, stencils and the two described rows. */
export function panelScanOf(scan: ScannedFace): PanelScan {
  return { frameUrl: scan.frameUrl, slots: scan.slots, words: scan.words };
}

/** For tests and for the reliability report. */
export function faceScanCacheStats(): {
  scans: number;
  rescans: number;
  rescanRate: number;
  hits: number;
  misses: number;
  failures: number;
  size: number;
} {
  return {
    ...counters,
    rescanRate: counters.scans === 0 ? 0 : counters.rescans / counters.scans,
    size: cache.size,
  };
}

/** Test-only: a process-wide cache would otherwise leak between cases. */
export function resetFaceScanCache(): void {
  cache.clear();
  seen.clear();
  counters.scans = 0;
  counters.rescans = 0;
  counters.hits = 0;
  counters.misses = 0;
  counters.failures = 0;
}
