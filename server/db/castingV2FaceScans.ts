/**
 * The kept face scan's database layer (migration 0032).
 *
 * A scan is twelve segmenter questions about one face-version — about ten
 * cents — and it used to live in memory alone, which meant every deploy bought
 * every open face again. This is where a finished scan is written down and read
 * back.
 *
 * # Three rules, and each of them is somebody's scar
 *
 * 1. **The owner is in the statement that reads or writes** (invariant 1).
 *    Never a SELECT to check and then a write keyed on an id: `userId` is in
 *    every WHERE here, so one account's face cannot be served to another even
 *    if a caller passes the wrong candidate.
 *
 * @invariant1 module-wide — every statement here carries the owner, or is
 *   listed with its reason in `server/ownerScopedModules.test.ts` (#1312).
 * 2. **Only a CLEAN scan is written**, and this file cannot see whether a scan
 *    is clean — the caller decides that, and the caller is the only one who
 *    knows what `failed` held. What this file guarantees is the other half: an
 *    upsert, so a re-scan of the same version replaces rather than
 *    accumulates, and the founder's one-row-per-version bound is the unique
 *    key rather than a convention.
 * 3. **The stencils are NOT in the row.** Each slot's entry names an object
 *    key; the objects are swept with the candidate by
 *    `candidateRetention.ts`, which reads {@link listPurgeableFaceScansIn}
 *    unconditionally — the flag governs whether rows are WRITTEN and nothing
 *    governs whether they are purged.
 */
import { and, eq } from "drizzle-orm";

import { randomUUID } from "node:crypto";

import { castingFaceScans, storageCleanupBatches, storageCleanupItems } from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import {
  purgeScopeIsEmpty,
  purgeScopeWhere,
  type PurgeCandidateSelector,
} from "./castingV2PurgeScope";
import { createStorageCleanupManifestIn, undischargedStorageCleanupBatchWhere } from "./storageCleanup";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/** One feature the scan found, as it is stored. */
export type StoredScanSlot = {
  slot: string;
  /**
   * THE BOX AND THE FRAME IT WAS MEASURED ON, together — `PanelBox`'s own rule
   * kept across the write: *"a box without its frame is a rectangle in an
   * unknown space"*. A row that stored four numbers alone would be readable and
   * wrong the first time a version was delivered at a different size.
   */
  box: { x: number; y: number; width: number; height: number; frame: { width: number; height: number } };
  /** The stencil's object key. Never the bytes — see the migration's note. */
  maskKey: string;
};

/**
 * ONE CARRIED FEATURE'S BOX, RE-READ ON THE FRAME THIS VERSION DELIVERED
 * (fable-1443's option (iii), store settled fable-1445 §2).
 *
 * A library crop is minted once and then carried forever, so its geometry is
 * about the frame it was cut from and about no other. Drawn over a later
 * version — which is every version after the mint, measured 9 of 9 on
 * production — it is a promise about the wrong pixels.
 *
 * So the render re-READS where each carried feature now is and files it here.
 * **Geometry only**: the crop's PIXELS are still the right reference and
 * re-cutting them would pay the expensive half to fix the cheap one. There is
 * deliberately no `maskKey` — nothing here owns an object, so nothing here can
 * orphan one.
 */
export type StoredCarriedSlot = {
  slot: string;
  /** The same box-and-its-frame rule {@link StoredScanSlot.box} states. */
  box: { x: number; y: number; width: number; height: number; frame: { width: number; height: number } };
};

/**
 * What a row's `geometry` column holds.
 *
 * The shape is the panel's own reading minus the pictures: where each feature
 * is, the two rows that can only be described, and the counts that make a thin
 * scan legible rather than mysterious.
 *
 * # AND ONE HALF THAT IS NOT A SCAN AT ALL
 *
 * `carried` is written by the RENDER rather than by a look, and `scanned` is
 * what tells the two apart. The table's meaning is its shape — *geometry of a
 * version* — and the scan was only ever its first writer (fable-1445 §2).
 */
/**
 * ONE THING THE READING FOUND THAT NO CATALOGUE QUESTION COVERS — a jacket, a
 * sash, a third eye, a mole (#2566 slice 2's pointer road).
 *
 * ⚠ **THE NOUN IS STORED AND IS NOT DERIVABLE FROM THE KEY, so this is a third
 * row shape rather than a slot on the list above.** A catalogued slot's words
 * come from the catalogue; a found row's noun is **the customer's own**, written
 * by the reading, and `found:cat-ears#1` cannot say whether the reading wrote
 * *cat ears* or *cat-ears* (the open lane's own binding condition). A row that
 * reconstructed it from the key would show somebody a word nothing ever said.
 *
 * ⚠ **AND IT IS STORED AT ALL FOR ONE REASON WORTH NAMING: A KEPT READING THAT
 * DROPPED THESE WOULD BE THE DEFECT SLICE 1 WAS HELD ON.** `CASTING_SCAN_TABLE_SCOPE`
 * stands at `all`, so the first look is kept and every later look is served
 * from this column — and a column that holds the catalogue rows and not the
 * found ones would give the same frame a panel with a jacket on it and then a
 * panel without, which is *"the same frame gave a different panel on different
 * readings"* arriving by a different road. It rides INSIDE the existing JSON
 * for `carried`'s reason: absent on every row written before this landed, which
 * is why it is optional, and no migration for a field the column can already
 * hold.
 */
export type StoredDiscoveredSlot = {
  slot: string;
  /** The reading's own bare noun. Never derived from {@link StoredDiscoveredSlot.slot}. */
  noun: string;
  /** Which instance of that noun, from 1. */
  instance: number;
  /** The same box-and-its-frame rule {@link StoredScanSlot.box} states. */
  box: { x: number; y: number; width: number; height: number; frame: { width: number; height: number } };
  /** The stencil's object key, as {@link StoredScanSlot.maskKey}. */
  maskKey: string;
  /**
   * WHAT THE READING SAID IT IS AND WHAT IT SITS ON — the panel's grouping
   * grammar, kept for the reason the noun is (#2566 slice 2's grouping design).
   *
   * ⚠ **A READING SERVED FROM THIS ROW GROUPS ITSELF, so these have to survive
   * the keep.** `CASTING_SCAN_TABLE_SCOPE` stands at `all`: the first look is
   * kept and every later look is served from here, so a row holding the boxes
   * and not the two facts would put the jacket in the Outfit row on the first
   * look and back in *Also on this character* on the second — the same
   * different-panel-same-frame defect the field above is kept for, one level up.
   *
   * ⚠ **BOTH OPTIONAL, AND THE ABSENT CASE IS TODAY'S PANEL EXACTLY RATHER THAN
   * A GUESS.** A row written between slice 2's two landings has `discovered`
   * and neither of these. Read as `anatomy` with no host, which is what every
   * reader here defaults them to: `anatomy` can never enter the Outfit row and
   * an empty `on` resolves to no host — so every found row on such a reading is
   * a top-level sibling in *Also on this character*, which is byte for byte
   * where it was drawn before this slice. No migration, no backfill, and the
   * next reading of a changed frame writes them.
   */
  kind?: string;
  on?: string;
  /**
   * DOES THIS SHAPE LIE OVER THE FACE'S OWN CUTS — his check 1 (#2856,
   * 2026-10-30), kept for the two fields above's reason.
   *
   * It is a PIXEL measurement taken once, while the scan's masks and this
   * shape's mask are both raw bytes in one process. A reading served from this
   * row has neither any more, so a row that did not keep the answer would put
   * a face-covering garment outside the whole-Outfit outline on the first look
   * and back inside it on the second.
   *
   * ⚠ **Optional, and absent is today's panel exactly rather than a guess** —
   * the same sentence the two fields above carry. A row written before this
   * field reads as *not covering*, which is how every outfit piece was treated
   * before the check existed: inside the outline. No migration, no backfill,
   * and the next reading of a changed frame writes it.
   */
  coversFace?: boolean;
};

export type StoredScanGeometry = {
  slots: readonly StoredScanSlot[];
  words: ReadonlyArray<readonly [string, readonly string[]]>;
  sides: string;
  asked: number;
  found: number;
  empty: readonly string[];
  /** Carried features' boxes on THIS version's own frame. Absent on every row
   *  written before the re-mint landed, which is why it is optional. */
  carried?: readonly StoredCarriedSlot[];
  /** What the reading found that no catalogue question covers — see
   *  {@link StoredDiscoveredSlot}. Absent on every row written before #2566
   *  slice 2, and absent on every reading taken with the discovery flag off.
   *  ⚠ Named for the ROAD and not `found`, which one field up is the catalogue's
   *  own COUNT — two facts one word apart is the collision this name avoids. */
  discovered?: readonly StoredDiscoveredSlot[];
  /**
   * WHAT THE READING NAMED AND NOTHING CUT — words with no picture (#2566
   * slice 2's grouping design, rules 2, 3 and 4).
   *
   * Kept for the same reason {@link StoredScanGeometry.discovered} is: a
   * reading served from this row would otherwise lose the freckles' words off
   * the Skin row on the second look, with the frame unchanged. There is no
   * geometry here and no object to clean up — it is prose, three short fields
   * per entry, and the JSON column already holds it.
   *
   * Absent on every row written before this landed and on every reading that
   * named nothing it could not cut, which is the ordinary case.
   */
  namedNotCut?: readonly {
    noun: string;
    on: string;
    about: string;
    /** One of the five feature kinds. Narrowed on the way back out, for
     *  {@link StoredDiscoveredSlot.kind}'s reason. */
    kind?: string;
    /** `scattered` · `makeup` · `uncut` · `dropped` — see `pointerCut`'s
     *  `NamedNotCut`. Narrowed on the way back out, where a value outside the
     *  four is dropped rather than admitted (`keptFaceScan`). */
    why: string;
  }[];
  /**
   * WHETHER A SCAN HAS EVER WRITTEN THIS ROW — `false` only on a row the render
   * created for its carried geometry alone.
   *
   * ⚠ It is the trap this field exists to close. `serveKeptScan` returns a row
   * as a finished reading, and a carried-only row has an EMPTY `slots` list —
   * so without this a render would file a row that the panel then served as
   * *"this face was scanned and has no features"*, and the face would never be
   * scanned again. Absent means `true`: every row written before this field
   * existed is a scan.
   */
  scanned?: boolean;
  /**
   * WHICH CUT RULES SHAPED THIS READING — {@link FACE_CUT_RULES_VERSION} as it
   * stood when the scan was taken (#2890).
   *
   * ⚠ **A kept reading outlives the rules that would have shaped it, and until
   * this field nothing anywhere said so.** A rule that drops a wrong cut fixes
   * every FUTURE scan and not one stored answer, because the only thing that
   * has ever invalidated a row is the frame's own bytes moving
   * (`serveKeptScan`'s `frameKey` test) — so the row goes on being served, with
   * the old cut, for as long as the picture stays put.
   *
   * **Measured, which is why this is a field and not a note.** Of the 86 kept
   * readings on production, **seven carried an eye cut below the middle of the
   * frame** — one of them a 392×772 box called *Left eye*, reaching from the
   * eye down to a tattooed face on the cast's arm. Every one of the seven was
   * written BEFORE `a29f503e1` (2026-10-30T04:56:45Z), the commit that made
   * `keepPiecesOnTheFace` drop exactly that piece; the worst of them by
   * forty-eight minutes. And all seven were **still alive, still matching their
   * frame, and therefore still served** — two of them on signed casts. The
   * repair had shipped and could not reach them.
   *
   * ⚠ **It is a CLASS and not those seven.** Eight rulings that shape a cut
   * landed in nine days (#2752, #2800, #2810, #2833, #2844, #2862, #2885,
   * #2887), and each one left every earlier row serving its old answer in
   * silence. The next one would have too.
   *
   * ⚠ **Optional, and absent is the CONDEMN case rather than a guess** — which
   * is where this field departs from its three neighbours above, each of whose
   * absence means *today's panel exactly*. A row with no version was taken
   * before the cut rules were versioned at all, so nothing can say which rules
   * it met; that is not a reading to serve, it is a reading to take again. No
   * migration and no backfill: the row is condemned at the door and the face
   * re-scans, which is house money the customer is never charged for.
   */
  rules?: number;
};

/**
 * THE VERSION OF THE RULES THAT DECIDE WHAT A SCAN CUTS, stored on every
 * reading so a stale one can be told apart from a current one (#2890).
 *
 * ⚠ **BUMP THIS IN THE SAME COMMIT AS ANY RULE THAT CHANGES WHAT A SCAN CUTS,
 * OR THE RULE DOES NOT REACH A SINGLE FACE THAT HAS ALREADY BEEN READ.** That
 * is the whole of the obligation and it is the reason the constant exists. It
 * covers every rule a reading's boxes come out of — which piece of an answer is
 * kept (`keepPiecesOnTheFace`, `keepPiecesAtTheSide`, `judgedFace`), where a
 * pair is split, what earns a row at all — not the words, not the panel's
 * grouping, and not a change that only moves where an existing row is listed.
 *
 * A version is how a later reader knows two readings are not comparable, and
 * the reading's own copy of the rules would be a second statement of them that
 * drifts (working law 4). It is the `VOICE_AUDITION_PASSAGE_VERSION` shape
 * (`server/castingV2/voiceAuditionPassage.ts`), which exists for the identical
 * reason: a stored artifact and the thing that produced it, told apart.
 *
 * ⚠ **A bump re-scans every face anybody opens, once** — ~$0.08–0.11 of house
 * money each, never the customer's (`faceScanDailyUsage`'s own docblock), and
 * only for a face someone actually looks at. That is the price of a cut rule
 * reaching the faces already read, and it is the cheap half of the trade: the
 * expensive half is a paid refine aimed at the wrong pixels.
 *
 * **1** is the first version: today's rules, as of #2890. Every row written
 * before this field existed has no version and is condemned.
 */
export const FACE_CUT_RULES_VERSION = 1;

export type KeptFaceScan = {
  publicId: string;
  frameKey: string;
  geometry: StoredScanGeometry;
  stencilBytes: number;
};

/**
 * The version discriminator, in ONE place.
 *
 * The in-memory cache has always keyed on the variant id or the word `master`,
 * and the row's unique key is the same discriminator — so it is derived here
 * and nowhere else. A second spelling of this rule is a second thing to keep in
 * step, and the one that falls behind serves the master's scan for a version or
 * the other way round.
 */
export function versionKeyOf(variantId: number | null): string {
  return variantId === null ? "master" : String(variantId);
}

/**
 * The scan for this face-version, or null.
 *
 * `frameKey` is compared by the CALLER rather than in the WHERE, deliberately:
 * a row whose frame has moved is a different outcome from no row at all — one
 * is a first look and the other is a stale reading that should be replaced —
 * and a query that returned null for both would make them indistinguishable in
 * the log.
 */
export async function readKeptFaceScan(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
}): Promise<KeptFaceScan | null> {
  const db = await requireDb();
  const [row] = await db
    .select({
      publicId: castingFaceScans.publicId,
      frameKey: castingFaceScans.frameKey,
      geometry: castingFaceScans.geometry,
      stencilBytes: castingFaceScans.stencilBytes,
    })
    .from(castingFaceScans)
    .where(and(
      eq(castingFaceScans.userId, input.userId),
      eq(castingFaceScans.candidateId, input.candidateId),
      eq(castingFaceScans.versionKey, versionKeyOf(input.variantId)),
    ))
    .limit(1);
  if (!row) return null;
  return {
    publicId: row.publicId,
    frameKey: row.frameKey,
    geometry: row.geometry as StoredScanGeometry,
    stencilBytes: row.stencilBytes,
  };
}

/**
 * Write this reading down, replacing whatever was there for the same version.
 *
 * An upsert rather than an insert because a re-scan is a legitimate event: the
 * frame moved, or the row was refused as stale. Two rows for one version would
 * break the founder's bound, and the unique key would refuse the second write
 * anyway — so the replace is stated here rather than discovered as an error.
 *
 * # THE MANIFEST IS DISCHARGED HERE, AND ITS ABSENCE COST THE WHOLE TABLE
 *
 * The library's discipline is manifest → bytes → row, and **the row's own
 * transaction releases the receipt**. Every other writer on this road does it
 * (`recordInkDesign`, the plate mint); this one did not, and the consequence
 * was not a leak — it was the exact opposite, and it was silent.
 *
 * `keepScan` registered the stencil keys for cleanup, wrote the bytes, and
 * wrote this row with nothing to discharge. So the hold lapsed at five minutes,
 * the sweep ran within sixty seconds, and **the worker deleted the stencils the
 * scan had just paid for.** The row survived, pointing at objects that no
 * longer existed; `serveKeptScan` found it, matched the frame, failed to fetch
 * a stencil and returned null — on the one branch that logs nothing. Every look
 * at that face then re-bought a twenty-call segmenter scan, forever.
 *
 * Measured on production, 2026-08-19: three faces re-scanned at 01:16, 01:17
 * and 01:20 despite holding matching kept rows, each with a cleanup batch born
 * seconds later and `succeeded` about six minutes after that. The table had
 * never once answered since it was flipped on.
 *
 * # AND THE REPLACED ROW'S OWN STENCILS ARE HANDED TO THE WORKER
 *
 * The other half, and it is the same rule pointing the other way. An upsert
 * that replaced a row used to orphan the previous reading's objects: nothing
 * referenced them and nothing would ever collect them, because the candidate
 * purge reads the CURRENT row's geometry. So the old keys are registered on a
 * fresh manifest in this same transaction — the receipt for bytes that have
 * just stopped being referenced.
 */
export async function keepFaceScan(input: {
  publicId: string;
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
  geometry: StoredScanGeometry;
  stencilBytes: number;
  /**
   * The manifest holding the new stencils while this row is written.
   *
   * Optional in the type only so a caller with nothing to discharge cannot be
   * forced to invent one — a scan that found no slots writes no objects. On
   * every path that DID store bytes, the caller passes it.
   */
  cleanupBatchId?: string;
}): Promise<void> {
  const row = {
    publicId: input.publicId,
    userId: input.userId,
    candidateId: input.candidateId,
    versionKey: versionKeyOf(input.variantId),
    frameKey: input.frameKey,
    geometry: input.geometry,
    stencilBytes: input.stencilBytes,
  };
  return withTransaction(async (tx) => {
    /* What is about to be replaced, read INSIDE the transaction — a reading
       taken before it would be a claim about a row another write may have
       moved. */
    const [previous] = await tx
      .select({ geometry: castingFaceScans.geometry, frameKey: castingFaceScans.frameKey })
      .from(castingFaceScans)
      .where(and(
        eq(castingFaceScans.userId, input.userId),
        eq(castingFaceScans.candidateId, input.candidateId),
        eq(castingFaceScans.versionKey, row.versionKey),
      ))
      .limit(1);

    /*
      THE RENDER'S CARRIED GEOMETRY SURVIVES A SCAN — but only while the frame
      it was read on is still this version's frame.

      A scan replaces this column wholesale, and the render wrote its half here
      first (a version's row is born at its render, and is looked at later). So
      the two halves are merged rather than one overwriting the other. The
      frameKey condition is the whole of the care: carrying boxes of a
      superseded frame onto a new one is the defect they were written to fix,
      arriving by the back door.
    */
    const carried = previous && previous.frameKey === row.frameKey
      ? (previous.geometry as StoredScanGeometry | null)?.carried
      : undefined;
    const geometry: StoredScanGeometry = {
      ...input.geometry,
      ...(carried && carried.length > 0 ? { carried } : {}),
      scanned: true,
    };
    row.geometry = geometry;

    await tx.insert(castingFaceScans).values(row).onDuplicateKeyUpdate({
      set: {
        frameKey: row.frameKey,
        geometry: row.geometry,
        stencilBytes: row.stencilBytes,
      },
    });

    if (input.cleanupBatchId) {
      /*
        The new stencils are now referenced by a row, so the manifest holding
        them must go — in this same transaction, or the worker deletes the
        objects this reading depends on. Asserted rather than assumed: a
        manifest that does not delete means something else already claimed it,
        and committing on top of that files a row whose bytes are already
        scheduled to die. Which is the state this function was in.
      */
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removed = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        undischargedStorageCleanupBatchWhere(),
      ));
      if (affectedRows(removed) !== 1) {
        throw new Error("the kept scan's manifest was already claimed — refusing to file a row whose stencils are scheduled for deletion");
      }
    }

    const orphaned = ((previous?.geometry as StoredScanGeometry | null)?.slots ?? [])
      .map((slot) => slot.maskKey)
      .filter((key): key is string => Boolean(key));
    if (orphaned.length > 0) {
      /* Nothing references these any more, and the candidate purge only ever
         sees the CURRENT row — so without this they outlive everything. */
      await createStorageCleanupManifestIn(tx, {
        id: randomUUID(),
        userId: input.userId,
        operationId: randomUUID(),
        kind: "casting_candidate_cleanup",
        storageItems: orphaned.map((storageKey) => ({
          storageKey,
          storageBackend: "public_r2" as const,
        })),
      });
    }
  });
}

/**
 * FILE THIS RENDER'S CARRIED GEOMETRY — the render's half of the row.
 *
 * Called at the mint, before the landing, for the features this render did NOT
 * write and therefore carried forward with a box measured on somebody else's
 * frame.
 *
 * # Three things it refuses to do, and each is a defect it would otherwise be
 *
 * **It never touches the scan half.** A row that already holds a reading keeps
 * every slot, word and stencil key it had; only `carried` is replaced. The
 * alternative loses a paid fourteen-question reading to a free one.
 *
 * **It never writes onto a row about different bytes.** A row whose `frameKey`
 * is not this frame's is a reading of a picture that is no longer there, and
 * merging into it would attach this frame's boxes to that one. It stands down
 * and says so — the caller counts it.
 *
 * **It owns no objects.** Geometry only, so there is no manifest, no born-held
 * hold and no orphan: the three things that cost `keepScan` a whole table.
 *
 * Returns whether the row was written, so a caller can count a stand-down
 * without having to tell it apart from a throw.
 */
export async function keepCarriedGeometry(input: {
  publicId: string;
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
  carried: readonly StoredCarriedSlot[];
}): Promise<{ written: boolean; reason?: "frame-moved" }> {
  const versionKey = versionKeyOf(input.variantId);
  return withTransaction(async (tx) => {
    const [previous] = await tx
      .select({ geometry: castingFaceScans.geometry, frameKey: castingFaceScans.frameKey })
      .from(castingFaceScans)
      .where(and(
        eq(castingFaceScans.userId, input.userId),
        eq(castingFaceScans.candidateId, input.candidateId),
        eq(castingFaceScans.versionKey, versionKey),
      ))
      .limit(1);

    if (previous && previous.frameKey !== input.frameKey) {
      return { written: false, reason: "frame-moved" as const };
    }

    const held = (previous?.geometry as StoredScanGeometry | null) ?? null;
    const geometry: StoredScanGeometry = held === null
      ? {
        /* A row nothing has scanned: empty on every scan field, and `scanned`
           false so nothing serves it as a reading. */
        slots: [], words: [], sides: "", asked: 0, found: 0, empty: [],
        carried: input.carried,
        scanned: false,
      }
      : { ...held, carried: input.carried };

    await tx.insert(castingFaceScans).values({
      publicId: input.publicId,
      userId: input.userId,
      candidateId: input.candidateId,
      versionKey,
      frameKey: input.frameKey,
      geometry,
      /* Only ever used by the INSERT arm, where there is no row and this write
         owns no objects. The update arm deliberately does not touch it: a
         scan's stencil bill is the scan's, and zeroing it here would erase the
         growth reading the founder's yes was conditional on. */
      stencilBytes: 0,
    }).onDuplicateKeyUpdate({ set: { geometry } });
    return { written: true };
  });
}

/**
 * WHERE THIS VERSION'S CARRIED FEATURES ACTUALLY ARE, or an empty map.
 *
 * `frameKey` is compared here rather than in the WHERE for {@link
 * readKeptFaceScan}'s reason exactly: a row about different bytes and no row at
 * all are different facts, and only one of them means *this render never wrote
 * its geometry*.
 *
 * ⚠ **THIS DOOR DOES NOT READ {@link StoredScanGeometry.rules}, AND THAT IS A
 * DECLARED LIMIT RATHER THAN AN OVERSIGHT — #2890.** It is a second way into
 * the same row, outside `serveKeptScan`, and a carried box IS shaped by the cut
 * rules: `carriedGeometry` measures each one through `reader.regionSides`, which
 * is the road `keepPiecesOnTheFace` sits on. So a carried box written before a
 * cut-rule change can hold the same defect a condemned reading does.
 *
 * **Measured before it was left alone: of the 86 kept readings on production,
 * ZERO carry any geometry at all** — no rows, no entries — so the class is
 * reachable in the code and has no population today.
 *
 * It is not condemned here because the trade is genuinely different and is not
 * a cleanup's to make. A condemned READING re-scans on the spot, which costs
 * cents of house money and nothing a customer sees; a condemned CARRIED box has
 * no road back, because it is measured at the RENDER and not on demand — so the
 * box would simply be gone until the next render. Whether a missing box beats a
 * possibly-stale one is a question about what the customer sees, and it is filed
 * as its own card rather than answered inside this one.
 */
export async function readCarriedGeometry(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
}): Promise<ReadonlyMap<string, StoredCarriedSlot["box"]>> {
  const db = await requireDb();
  const [row] = await db
    .select({ frameKey: castingFaceScans.frameKey, geometry: castingFaceScans.geometry })
    .from(castingFaceScans)
    .where(and(
      eq(castingFaceScans.userId, input.userId),
      eq(castingFaceScans.candidateId, input.candidateId),
      eq(castingFaceScans.versionKey, versionKeyOf(input.variantId)),
    ))
    .limit(1);
  if (!row || row.frameKey !== input.frameKey) return new Map();
  const carried = (row.geometry as StoredScanGeometry | null)?.carried ?? [];
  return new Map(carried.map((one) => [one.slot, one.box]));
}

/**
 * Every kept scan belonging to these candidates, with the objects it owns.
 *
 * Read inside the purge's own transaction. Rows with no slots are returned too
 * — a scan that found nothing still has a row, and the caller decides to delete
 * on the LENGTH of this list, so filtering here would let such a row outlive
 * its candidate.
 */
export async function listPurgeableFaceScansIn(
  tx: TransactionHandle,
  candidateIds: PurgeCandidateSelector,
): Promise<Array<{ id: number; maskKeys: readonly string[] }>> {
  if (purgeScopeIsEmpty(candidateIds)) return [];
  const rows = await tx
    .select({ id: castingFaceScans.id, geometry: castingFaceScans.geometry })
    .from(castingFaceScans)
    .where(purgeScopeWhere(castingFaceScans.candidateId, castingFaceScans.userId, candidateIds));
  return rows.map((row) => ({
    id: row.id,
    maskKeys: ((row.geometry as StoredScanGeometry | null)?.slots ?? [])
      .map((slot) => slot.maskKey)
      .filter((key): key is string => Boolean(key)),
  }));
}

export async function deleteFaceScanRowsIn(
  tx: TransactionHandle,
  candidateIds: PurgeCandidateSelector,
): Promise<number> {
  if (purgeScopeIsEmpty(candidateIds)) return 0;
  const result = await tx
    .delete(castingFaceScans)
    .where(purgeScopeWhere(castingFaceScans.candidateId, castingFaceScans.userId, candidateIds));
  return affectedRows(result);
}
