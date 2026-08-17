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
import { captureCastingScanTableEnabled } from "./castingV2Scope";
import { keepScan, serveKeptScan } from "./keptFaceScan";
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
      const served: ScannedFace = {
        frameUrl: publicUrl(input.imageKey),
        slots: kept.slots,
        words: kept.words,
        asked: kept.asked,
        found: kept.slots.size,
        empty: kept.empty,
        /* A kept reading is a CLEAN one by construction — nothing else is
           written — so this is not an assumption, it is the table's own rule
           read back. */
        failed: [],
        stencilBytes: kept.stencilBytes,
        sides: kept.sides,
      };
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

    A scan is house money — around fourteen segmenter calls per version looked
    at — and until now the only figure for it was an estimate written in a
    design note. The same census the paid render opens is opened here, so the
    courtesy read's cost is measured by the same instrument rather than by a
    second one that would disagree with it (law 4).

    What it costs the user: nothing. What it buys: the scan's own line in the
    cost table, and the arithmetic behind "promote this cache to a table".
  */
  let spent: CallCensus | null = null;
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
    const scan = await scanFace({
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
            };
          }
        })().catch(() => {
          /* A partial is a courtesy on top of a courtesy: if a stencil will not
             cut here, the settled scan cuts it again a moment later. */
        });
      },
    });
    return await displayOf(scan, url);
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
      */
      const weather = value.failed.filter((one) => one.retryable === true);
      if (weather.length > 0) {
        counters.damaged += 1;
        log.warn(
          { failed: value.failed.length, weather: weather.map((one) => one.question) },
          "[faceScanService] this reading lost regions — serving it and NOT keeping it, so the next look re-asks",
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
