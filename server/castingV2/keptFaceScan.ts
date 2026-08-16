/**
 * KEEPING A SCAN, AND HANDING IT BACK (migration 0032, founder yes via
 * fable-698).
 *
 * A face-version is scanned the first time it is looked at — twelve segmenter
 * questions, about ten cents — and the answer lived in memory alone. The
 * process dies on every deploy, and this program deploys many times a night, so
 * the same face was bought again and again: 58 paid scans for 28 distinct faces
 * across two days of ordinary live use.
 *
 * This module is both halves of the fix, and nothing else. `faceScanService`
 * gains two call sites; every rule about WHAT may be kept lives here where it
 * can be driven directly rather than through a scan.
 *
 * # The rules, and whose they are
 *
 * **Only a clean reading is kept.** A scan that lost regions is served to
 * whoever is waiting and then dropped, so the next look re-asks — that is the
 * missing-eyes law, and persisting a damaged reading would make one bad minute
 * permanent. The caller decides cleanliness; this module cannot see it, so it
 * takes the decision as an argument rather than guessing.
 *
 * **The stencils are objects, not columns.** Measured before the table existed:
 * a row with stencils base64 inside is 12,365 B against 1,212 B without, which
 * is ~4.7 GB of MySQL at ten thousand users. The founder's yes was conditional
 * on storage — *"as long as it wont clog up storage"* — so the shapes live in
 * R2 under the candidate's own purge path and the row holds geometry.
 *
 * **The bytes are registered for cleanup BEFORE they are written.** A crash
 * between the object write and the row insert would otherwise leave stencils
 * nothing points at, and the sweep only finds what a row names.
 *
 * **A row whose frame has moved is not served.** `frameKey` records which bytes
 * were read; if the version now points somewhere else, the kept reading is a
 * reading of a picture that is no longer there. It is ignored, and the re-scan
 * replaces it through the unique key.
 *
 * **Nothing here may break a scan.** Every failure — storage, database, a
 * stencil that will not fetch — falls back to exactly today's behaviour, which
 * is a fresh read. A courtesy read's bookkeeping never costs the courtesy.
 */
import { randomUUID } from "node:crypto";

import {
  keepFaceScan,
  readKeptFaceScan,
  type StoredScanGeometry,
} from "../db/castingV2FaceScans";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn, storageCleanupManifestHeldUntil } from "../db/storageCleanup";
import { createModuleLogger } from "../logging/logger";
import { storagePut, storageReadBytes } from "../storage";
import type { FeatureSlot } from "./recipeAssembler";
import type { PanelBox } from "./facePanel";

const log = createModuleLogger("castingV2/keptFaceScan");

/** The shape this module keeps and restores — the panel's own reading. */
export type KeptScanShape = {
  slots: ReadonlyMap<FeatureSlot, { box: PanelBox; maskUrl: string }>;
  words: ReadonlyMap<FeatureSlot, readonly string[]>;
  asked: number;
  empty: readonly string[];
  stencilBytes: number;
  sides: string;
};

export type KeptScanDependencies = {
  store?: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<unknown>;
  readBytes?: typeof storageReadBytes;
  manifest?: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  read?: typeof readKeptFaceScan;
  write?: typeof keepFaceScan;
};

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* Synthetic, like the mint's and the retention sweep's: the column is
       unique and NOT NULL, and this is not a user operation. */
    operationId: randomUUID(),
    /* BORN HELD, for the mint's reason exactly: the worker's in-flight fence
       tests a batch against a live operation row, a synthetic id matches none,
       and without a hold this manifest is claimable while the stencils it
       names are still being written. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

/** A data URL's own bytes, or null if it is not one this module wrote. */
function bytesOfDataUrl(url: string): Buffer | null {
  const at = url.indexOf("base64,");
  if (!url.startsWith("data:image/png;") || at < 0) return null;
  return Buffer.from(url.slice(at + "base64,".length), "base64");
}

/**
 * Write this reading down. Never throws: a failure here costs the library a
 * fact and costs the customer nothing, because she already has her panel.
 */
export async function keepScan(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
  scan: KeptScanShape;
  dependencies?: KeptScanDependencies;
}): Promise<{ kept: boolean; objects: number }> {
  const store = input.dependencies?.store ?? (async (one) => storagePut(one.key, one.bytes, one.contentType));
  const manifest = input.dependencies?.manifest ?? defaultManifest;
  const write = input.dependencies?.write ?? keepFaceScan;

  try {
    const planned: Array<{ slot: FeatureSlot; box: PanelBox; key: string; bytes: Buffer }> = [];
    for (const [slot, entry] of Array.from(input.scan.slots.entries())) {
      const bytes = bytesOfDataUrl(entry.maskUrl);
      /* A stencil that is not ours to store is skipped rather than invented —
         its row would name a key nothing will ever find. */
      if (!bytes) continue;
      planned.push({
        slot,
        box: entry.box,
        /* `randomUUID`, never `Math.random` — the repository guard on storage
           writers, and the reason it exists: a guessable key on a permanently
           public bucket is a piece of somebody's face anyone can walk to. */
        key: `casting-v2/scans/${randomUUID()}.png`,
        bytes,
      });
    }

    if (planned.length > 0) {
      await manifest({
        id: randomUUID(),
        userId: input.userId,
        storageKeys: planned.map((one) => one.key),
      });
      for (const one of planned) {
        await store({ key: one.key, bytes: one.bytes, contentType: "image/png" });
      }
    }

    const geometry: StoredScanGeometry = {
      slots: planned.map((one) => ({ slot: one.slot, box: one.box, maskKey: one.key })),
      words: Array.from(input.scan.words.entries()).map(([slot, said]) => [slot, said] as const),
      sides: input.scan.sides,
      asked: input.scan.asked,
      found: planned.length,
      empty: input.scan.empty,
    };
    await write({
      publicId: randomUUID(),
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      frameKey: input.frameKey,
      geometry,
      stencilBytes: input.scan.stencilBytes,
    });
    return { kept: true, objects: planned.length };
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 200), candidateId: input.candidateId },
      "[keptFaceScan] this reading could not be kept — the panel is unaffected and the next look re-scans",
    );
    return { kept: false, objects: 0 };
  }
}

/**
 * The reading already paid for, or null.
 *
 * Null means *scan this face*, and it means that for every reason: no row, a
 * row about different bytes, a stencil that will not fetch, a database that
 * will not answer. One outcome, because every one of them has the same correct
 * response and a caller forced to tell them apart is a caller that will
 * eventually get it wrong.
 */
export async function serveKeptScan(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
  dependencies?: KeptScanDependencies;
}): Promise<KeptScanShape | null> {
  const read = input.dependencies?.read ?? readKeptFaceScan;
  const readBytes = input.dependencies?.readBytes ?? storageReadBytes;
  try {
    const kept = await read({
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
    });
    if (!kept) return null;
    if (kept.frameKey !== input.frameKey) {
      /* Not an error and not a hit: the version points at different bytes than
         the reading was taken from, so the reading is about a picture that is
         no longer on screen. Said out loud because a silent re-scan here looks
         exactly like the table not working. */
      log.info(
        { candidateId: input.candidateId },
        "[keptFaceScan] the kept reading was taken from a different frame — re-scanning, and the row will be replaced",
      );
      return null;
    }

    const slots = new Map<FeatureSlot, { box: PanelBox; maskUrl: string }>();
    for (const slot of kept.geometry.slots) {
      const stencil = await readBytes(slot.maskKey);
      /* One missing stencil condemns the whole reading rather than serving a
         panel with a hole in it: the alternative is a face whose ear silently
         has no cutout, which is the founder's own complaint arriving by a new
         road. */
      if (!stencil?.bytes) return null;
      slots.set(slot.slot as FeatureSlot, {
        box: slot.box,
        maskUrl: `data:image/png;base64,${stencil.bytes.toString("base64")}`,
      });
    }

    return {
      slots,
      words: new Map(kept.geometry.words.map(([slot, said]) => [slot as FeatureSlot, said])),
      asked: kept.geometry.asked,
      empty: kept.geometry.empty,
      stencilBytes: kept.stencilBytes,
      sides: kept.geometry.sides,
    };
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 200), candidateId: input.candidateId },
      "[keptFaceScan] the kept reading could not be read — scanning as if it were not there",
    );
    return null;
  }
}
