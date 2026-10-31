/**
 * KEEPING A SCAN, AND HANDING IT BACK (migration 0032, founder yes via
 * fable-698).
 *
 * A face-version is scanned the first time it is looked at — a run of
 * segmenter questions priced by `faceScanUsd()` in `scripts/lib/falSpend.mts`
 * — and the answer lived in memory alone. The
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
 * **A row taken under older cut rules is not served either** (#2890, added
 * after the first one of these was measured). For a year the frame's bytes were
 * the ONLY thing that could ever invalidate a row — so a rule that fixed a
 * wrong cut fixed every future scan and not one stored answer, and the stale
 * answer went on being handed to the panel for as long as the picture stayed
 * put. Seven of 86 production readings were serving an eye cut the product had
 * already learnt to drop, two of them on signed casts. A reading now records
 * `FACE_CUT_RULES_VERSION`, and a row below it is condemned here exactly as a
 * row with a missing stencil is.
 *
 * **Nothing here may break a scan.** Every failure — storage, database, a
 * stencil that will not fetch — falls back to exactly today's behaviour, which
 * is a fresh read. A courtesy read's bookkeeping never costs the courtesy.
 */
import { randomUUID } from "node:crypto";

import {
  FACE_CUT_RULES_VERSION,
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
import { cleanKind, type FeatureKind } from "./faceDiscovery";
import type { NamedNotCut } from "./pointerCut";

const log = createModuleLogger("castingV2/keptFaceScan");

/**
 * ONE ROW THE READING FOUND THAT NO CATALOGUE QUESTION COVERS, as this module
 * carries it (#2566 slice 2).
 *
 * The noun rides beside the key because nothing may read a customer-facing word
 * out of a key — see `pointerCut`'s own header — so this cannot be folded into
 * `slots`, whose words come from the catalogue.
 */
export type KeptDiscoveredRow = {
  slot: FeatureSlot;
  noun: string;
  instance: number;
  /** The panel's grouping grammar — see `StoredDiscoveredSlot.kind`, which
   *  carries why a row written before slice 2's grouping restores as a
   *  hostless `anatomy` and therefore as today's panel exactly. */
  kind: FeatureKind;
  on: string;
  box: PanelBox;
  maskUrl: string;
  /** Whether this shape lies over the face's own cuts — see
   *  `StoredDiscoveredSlot.coversFace`, which carries why a row written before
   *  the check restores as *not covering* and therefore as today's panel. */
  coversFace: boolean;
};

/** The shape this module keeps and restores — the panel's own reading. */
export type KeptScanShape = {
  slots: ReadonlyMap<FeatureSlot, { box: PanelBox; maskUrl: string }>;
  words: ReadonlyMap<FeatureSlot, readonly string[]>;
  asked: number;
  empty: readonly string[];
  stencilBytes: number;
  sides: string;
  /**
   * ⚠ **THE ROWS THE POINTER ROAD CUT, AND THEY ARE KEPT FOR THE DEFECT SLICE 1
   * WAS HELD ON** (#2566 slice 2).
   *
   * `CASTING_SCAN_TABLE_SCOPE` stands at `all`, so the FIRST look is kept and
   * every later look is served from the row. A shape that held the catalogue
   * rows and not these would show a jacket on the panel once and never again on
   * the same frame — *"the same frame gave a different panel on different
   * readings"*, arriving by a different road than the one the relay closed.
   *
   * Optional, and absent is the ordinary answer: a reading taken with the
   * discovery flag off has none, and so has every row written before this
   * landed. Absent is NOT the same as empty and nothing here needs to tell them
   * apart — both draw no found rows, which is today's panel.
   */
  discovered?: readonly KeptDiscoveredRow[];
  /**
   * WHAT THE READING NAMED AND NOTHING CUT — kept for `discovered`'s own
   * reason, said about words instead of pictures (#2566 slice 2).
   *
   * Without it a kept reading loses the freckles' words off the Skin row on the
   * second look at an unchanged frame, which is the same once-and-never-again
   * defect the field above is kept against.
   *
   * Optional and absent in the ordinary case, exactly as above. There is no
   * stencil and no object here, so it costs the cleanup manifest nothing.
   */
  namedNotCut?: readonly NamedNotCut[];
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

    /*
      THE RECEIPT, CARRIED TO THE ROW — and the reason it is a variable rather
      than an inline id is the defect this fixes. The manifest used to be
      created here and never discharged, so the worker deleted every stencil
      about six minutes after it was written and the kept row survived pointing
      at nothing. `keepFaceScan` releases it in the same transaction that files
      the row, exactly as the ink upload and the plate mint do.
    */
    /*
      THE FOUND ROWS GO INTO THE SAME MANIFEST AND THE SAME TRANSACTION, which
      is the whole reason they are planned here beside the catalogue's rather
      than written in a second pass (#2566 slice 2). A second manifest would be
      a second thing to discharge, and the defect this file already carries a
      paragraph about is a manifest that was created and never discharged — the
      worker deleted every stencil six minutes later and the row survived
      pointing at nothing. One batch, one release.
    */
    const plannedFound: Array<KeptDiscoveredRow & { key: string; bytes: Buffer }> = [];
    for (const row of input.scan.discovered ?? []) {
      const bytes = bytesOfDataUrl(row.maskUrl);
      if (!bytes) continue;
      plannedFound.push({ ...row, key: `casting-v2/scans/${randomUUID()}.png`, bytes });
    }

    const objects = [...planned, ...plannedFound];
    const cleanupBatchId = objects.length > 0 ? randomUUID() : undefined;
    if (cleanupBatchId) {
      await manifest({
        id: cleanupBatchId,
        userId: input.userId,
        storageKeys: objects.map((one) => one.key),
      });
      for (const one of objects) {
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
      /*
        WHICH CUT RULES THIS READING MET (#2890) — written on every scan,
        unconditionally, because the one thing this field must never be is
        absent on a row taken today. See {@link FACE_CUT_RULES_VERSION}: the
        serving door condemns a row below it, and absent is the condemn case.
      */
      rules: FACE_CUT_RULES_VERSION,
      /*
        ABSENT RATHER THAN EMPTY when there are none, so a row written by a
        reading that never ran the pointer road is byte for byte the row this
        table held before the field existed — which is what makes the field
        free and what makes `carried`'s own *absent means before this landed*
        reading hold for this one too.
      */
      ...(plannedFound.length > 0
        ? {
          discovered: plannedFound.map((one) => ({
            slot: one.slot,
            noun: one.noun,
            instance: one.instance,
            kind: one.kind,
            on: one.on,
            box: one.box,
            maskKey: one.key,
            coversFace: one.coversFace,
          })),
        }
        : {}),
      /* Absent rather than empty for the sibling field's reason, and the
         reading is unaffected either way: an absent list and an empty one both
         route no words. */
      ...((input.scan.namedNotCut ?? []).length > 0
        ? { namedNotCut: (input.scan.namedNotCut ?? []).map((one) => ({ ...one })) }
        : {}),
    };
    await write({
      publicId: randomUUID(),
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      frameKey: input.frameKey,
      geometry,
      stencilBytes: input.scan.stencilBytes,
      cleanupBatchId,
    });
    return { kept: true, objects: objects.length };
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
    /*
      ⚠ A ROW IS NOT ALWAYS A SCAN — since the render started filing carried
      geometry into this table (fable-1445 §2).

      A carried-only row has an EMPTY `slots` list, and served as a reading it
      would say *this face was scanned and has nothing on it*: no cutouts, no
      described words, and — because the panel would then believe the scan had
      landed — never scanned again. The one field that tells them apart is read
      here, at the only door that turns a row into a reading.

      Absent means true. Every row written before the field existed is a scan.
    */
    if (kept.geometry.scanned === false) return null;

    /*
      ⚠ A READING TAKEN UNDER OLDER CUT RULES IS NOT SERVED — it is taken again
      (#2890).

      This is the SAME condemnation the missing stencil below gets, for the same
      reason one step earlier: a reading whose boxes cannot be trusted is worse
      than no reading, because the panel believes it and never asks again. The
      difference is only in what cannot be trusted — there, a cutout that will
      not fetch; here, a cut the product has since learnt was wrong.

      **What it fixes, measured.** Seven of the 86 kept readings on production
      carried an eye cut below the middle of the frame, the worst of them a
      392×772 box called *Left eye* that ran from the eye down to a tattooed
      face on the cast's arm. The rule that drops exactly that piece shipped on
      2026-10-30 and reached none of them: all seven were still alive, still on
      their original frame and therefore still served, two of them on SIGNED
      casts. Pressing such a row would have aimed a paid refine at an arm.

      It is placed AFTER the carried-only test on purpose. A carried-only row
      has never been scanned, so it has no cut rules to be stale against and no
      scan to take again — it is refused one line up and must stay refused
      there, not condemned here as though a scan had gone wrong.

      The re-scan is house money and the customer is never charged for it, so
      the cost of being wrong in this direction is cents; the cost of being
      wrong in the other is a paid edit on the wrong pixels.
    */
    if ((kept.geometry.rules ?? 0) < FACE_CUT_RULES_VERSION) {
      log.info(
        {
          candidateId: input.candidateId,
          rules: kept.geometry.rules ?? null,
          current: FACE_CUT_RULES_VERSION,
        },
        "[keptFaceScan] the kept reading was taken under older cut rules — the reading is condemned and this face re-scans at full price",
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
      if (!stencil?.bytes) {
        /*
          AND IT SAYS SO — this branch was silent, and its silence is why a
          table that had never once answered took a database investigation to
          find instead of a glance at a log.

          The row is present and the frame matches, so the reading SHOULD have
          served; a stencil that will not fetch means its object is gone, which
          is a finding about the store and never a shrug. The slot is named
          because which feature lost its cutout is the first thing anybody
          diagnosing this will want, and a slot name is a feature word — "ear",
          "brow" — and nothing about the face itself.
        */
        log.warn(
          { candidateId: input.candidateId, slot: slot.slot },
          "[keptFaceScan] a kept stencil would not fetch — the reading is condemned and this face re-scans at full price",
        );
        return null;
      }
      slots.set(slot.slot as FeatureSlot, {
        box: slot.box,
        maskUrl: `data:image/png;base64,${stencil.bytes.toString("base64")}`,
      });
    }

    /*
      THE FOUND ROWS, UNDER THE SAME CONDEMNATION RULE AS THE CATALOGUE'S
      (#2566 slice 2).

      A stencil that will not fetch condemns the WHOLE reading, exactly as it
      does above, and the reasoning is the same sentence in a wider place: a
      panel with a hole in it is the founder's own complaint, and a found row
      without its cutout is a row that promises a picture of his cast's jacket
      and draws nothing. The alternative — drop just this row and serve the rest
      — is worse than it looks: the row would be gone and the reading would be
      KEPT, so the jacket would never come back without the frame changing.
    */
    const discovered: KeptDiscoveredRow[] = [];
    for (const row of kept.geometry.discovered ?? []) {
      const stencil = await readBytes(row.maskKey);
      if (!stencil?.bytes) {
        log.warn(
          { candidateId: input.candidateId, slot: row.slot },
          "[keptFaceScan] a kept stencil would not fetch — the reading is condemned and this face re-scans at full price",
        );
        return null;
      }
      discovered.push({
        slot: row.slot as FeatureSlot,
        noun: row.noun,
        instance: row.instance,
        /*
          ⚠ **A ROW WRITTEN BEFORE THE GROUPING RESTORES AS TODAY'S PANEL, not
          as a guess** (#2566 slice 2) — `StoredDiscoveredSlot.kind` carries the
          argument. `anatomy` can never enter the Outfit row and an empty host
          resolves to nothing, so every found row on such a reading is a
          top-level sibling in *Also on this character*, which is exactly where
          it was drawn before this slice.

          ⚠ **AND THE CAST IS NARROWED RATHER THAN TRUSTED.** The column is
          JSON, so `kind` is whatever was written there, and a value outside the
          five would reach the panel's `clothing` test as a string nobody
          checked. `FEATURE_KINDS` is the reading's own vocabulary and
          `cleanKind` is the one reader of it (shared with `parseDiscovery`, so
          a sixth kind cannot be admitted here and refused there).
        */
        kind: cleanKind(row.kind),
        on: typeof row.on === "string" ? row.on : "",
        box: row.box,
        maskUrl: `data:image/png;base64,${stencil.bytes.toString("base64")}`,
        /*
          ⚠ **READ AS A BOOLEAN AND NEVER AS TRUTHINESS, for the sibling
          fields' reason one clause up**: the column is JSON, so this is
          whatever was written there, and `=== true` is the only test that
          cannot be satisfied by a string somebody stored. Anything else —
          absent, null, a word — is *not covering*, which is the panel this
          product drew before his check existed.
        */
        coversFace: row.coversFace === true,
      });
    }

    return {
      slots,
      words: new Map(kept.geometry.words.map(([slot, said]) => [slot as FeatureSlot, said])),
      asked: kept.geometry.asked,
      empty: kept.geometry.empty,
      stencilBytes: kept.stencilBytes,
      sides: kept.geometry.sides,
      /* Absent rather than empty, for the reason `keepScan` writes it absent:
         a reading with no found rows is byte for byte the shape this module
         served before the field existed. */
      ...(discovered.length > 0 ? { discovered } : {}),
      /*
        THE WORDS WITH NO PICTURE, read back under the same narrowing the kinds
        above get and for the same reason: the column is JSON, so `why` is
        whatever was written. A row whose `why` is not one of the four is
        DROPPED rather than admitted as an unknown reason — the panel branches
        on it (makeup never reaches a row), and a fifth value would take a
        branch nobody wrote. Dropping one entry costs its words; admitting it
        costs a destination nobody chose.

        ⚠ **`dropped` IS THE FOURTH AND ITS DESTINATION WAS CHOSEN IN THE SAME
        COMMIT (#2805), which is the only reason it is admitted** — the clause
        above is the bar, not a ban, and it is met here rather than waived: the
        panel treats a `dropped` entry exactly as an `uncut` one, so the branch
        exists and nothing a customer sees moves. It records a name whose
        detector call never completed, told apart from a name the detector
        answered and could not usefully be cut.

        ⚠ **A ROLLBACK DROPS THESE ENTRIES, AND THAT IS NAMED RATHER THAN
        DISCOVERED**: a reading kept by this build and read back by the
        previous one hits the three-value narrowing and loses its `dropped`
        rows. It costs exactly what the entry carries — the words of a thing
        with no row, which the panel already says nowhere — so the reading
        reads as it did before this card, not as damaged.
      */
      ...(() => {
        const said: NamedNotCut[] = [];
        for (const one of kept.geometry.namedNotCut ?? []) {
          if (
            one.why !== "scattered" && one.why !== "makeup"
            && one.why !== "uncut" && one.why !== "dropped"
          ) continue;
          if (typeof one.noun !== "string" || one.noun.trim() === "") continue;
          said.push({
            noun: one.noun,
            on: typeof one.on === "string" ? one.on : "",
            about: typeof one.about === "string" ? one.about : "",
            kind: cleanKind(one.kind),
            why: one.why,
          });
        }
        return said.length > 0 ? { namedNotCut: said } : {};
      })(),
    };
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 200), candidateId: input.candidateId },
      "[keptFaceScan] the kept reading could not be read — scanning as if it were not there",
    );
    return null;
  }
}
