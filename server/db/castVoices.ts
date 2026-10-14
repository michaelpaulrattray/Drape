/**
 * THE KEPT VOICE'S STATEMENTS — N4b-1 (#2469).
 *
 * Every statement here carries the owner in its OWN `WHERE` or join
 * (enforcement invariants 1 and 2). There is no read-then-write keyed on an id
 * alone, and the cast id is re-anchored to the OWNED, LIVE, SIGNED cast in the
 * same statement that touches the voice — `signedCastWhere(userId)` is the
 * subquery that does it, the same reader the creation record uses.
 *
 * ⚠ **EXPLICIT PROJECTIONS ONLY (invariant 8).** The `models` read below names
 * its columns. It reads `voice` — the customer's own line, which is what a
 * voice is designed FROM — and nothing else creative: no `masterPrompt`, no
 * `technicalSchema`, no `preferences`, no `personality`. **The one voice
 * module that does read them is `castVoiceCards.ts`** (#2498): the hidden
 * voice card is written FROM the customer's words and picture, so that read is
 * kept in its own module and returned to the card writer alone.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  castVoices,
  models,
  storageCleanupBatches,
  storageCleanupItems,
  type CastVoiceRow,
} from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { isDuplicateKey } from "./castingV2InkDeliveryCrops";
import {
  createStorageCleanupManifestIn,
  undischargedStorageCleanupBatchWhere,
} from "./storageCleanup";

/*
  The roster's own predicate, imported statically.

  It is exported precisely so a new store decides "is this the owner's signed
  live cast" with the SAME rule the roster draws by rather than a second copy
  that drifts (working law 4) — the campaign store (#2249) and the creation
  record (#2311) both reach for it this way.

  ⚠ **IT WAS A LAZY `await import` FOR ONE DAY AND IS STATIC AGAIN BECAUSE THE
  REASON IS GONE (#2483, fixed by the relay in `a18141bd`).** The static import
  originally turned 26 money assertions red in two refund suites this card never
  touched: the `./db` barrel reached this module, which reached `castingV2Sign`,
  which reached `casting/atomicCredits`, whose **static** `addCredits` binding
  came through the barrel — so a suite mocking that barrel with `importOriginal()`
  initialised the real one first and the mock never bound. `atomicCredits` now
  imports the money functions from the module that DECLARES them, so no import
  edge under `db/` can bypass that mock again, and the indirection here has
  nothing left to buy. **Kept as a comment rather than deleted silently**: the
  next person adding a store under `db/` would otherwise rediscover the chain.
*/
import { signedCastWhere } from "./castingV2Sign";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("[castVoices] database not available");
  return db;
}

function assertPositiveId(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

/** Every column of a kept voice, for the owner. Never a staff projection. */
const VOICE_COLUMNS = {
  id: castVoices.id,
  modelId: castVoices.modelId,
  userId: castVoices.userId,
  designSentence: castVoices.designSentence,
  voiceId: castVoices.voiceId,
  clipStorageKey: castVoices.clipStorageKey,
  clipSha256: castVoices.clipSha256,
  clipBytes: castVoices.clipBytes,
  clipContentType: castVoices.clipContentType,
  passageVersion: castVoices.passageVersion,
  lastUsedAt: castVoices.lastUsedAt,
  keptAt: castVoices.keptAt,
} as const;

/**
 * The voice LINE a design is made from, read off the owned live signed cast.
 *
 * Returns `null` when the cast is not one this road may touch — not owned, not
 * live, not signed — which is the same answer for all three on purpose: a road
 * that distinguishes "not yours" from "not signed" tells a stranger which cast
 * ids exist.
 */
export async function readCastVoiceLine(
  userId: number,
  modelId: number,
): Promise<{ modelId: number; name: string | null; voice: string | null } | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select({ modelId: models.id, name: models.name, voice: models.voice })
    .from(models)
    .where(and(eq(models.id, modelId), signedCastWhere(userId)))
    .limit(1);
  return row ?? null;
}

/** The cast's kept voice, or `null`. Owner and cast in the one statement. */
export async function readCastVoice(
  userId: number,
  modelId: number,
): Promise<CastVoiceRow | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select(VOICE_COLUMNS)
    .from(castVoices)
    .where(and(eq(castVoices.modelId, modelId), eq(castVoices.userId, userId)))
    .limit(1);
  return (row as CastVoiceRow | undefined) ?? null;
}

/**
 * The write-ahead manifest was not there to discharge — an invariant violation
 * rather than a race, since the same Keep created it moments earlier. Exported
 * so a driver can assert it by type instead of on a message.
 */
export class CastVoiceManifestUndischargeable extends Error {}

/** The row did not land: the cast went away, or a second Keep won the index. */
class CastVoiceRowNotWritten extends Error {}

/**
 * The voice a Keep REPLACED, read under lock inside the Keep's own transaction
 * (#2497). `null` from {@link insertCastVoice} means the cast had no voice.
 *
 * Returned so the caller can release the old provider slot AFTER the commit —
 * the same order the cast-deletion road uses, because a vendor call inside a
 * transaction holds row locks for as long as the vendor takes.
 */
export type ReplacedCastVoice = { voiceId: string | null };

/**
 * Write the kept voice — the first one, or one that REPLACES the cast's
 * current voice (#2497, his *"keeping a new one replaces the old"*).
 *
 * # REPLACING IS ONE TRANSACTION, AND THE OLD VOICE IS TOUCHED ONLY INSIDE IT
 *
 * His rule on the card: *"the old voice is released only after the new one is
 * fully kept (slot saved, clip stored, row written); a failed replace leaves the
 * old voice exactly as it was."* By the time this runs the new slot is saved
 * and the new clip stored, so this statement IS "the row written", and the old
 * voice's row changes in the same transaction or not at all:
 *
 *   1. the cast's current voice row, read `FOR UPDATE` (owner and cast bound);
 *   2. if there is one, it is UPDATED IN PLACE to the new voice — keyed on its
 *      own id AND the owner AND the owned-live-signed cast, so the deleted-cast
 *      race below holds for a replace exactly as for an insert; otherwise the
 *      `INSERT … SELECT` below;
 *   3. the OLD clip is handed to an unheld cleanup manifest — the worker that
 *      already deletes every other object this product retires;
 *   4. the NEW clip's write-ahead manifest is discharged.
 *
 * A throw anywhere rolls all four back: the old row, its clip and its slot are
 * untouched, and the new bytes are still held by their manifest.
 *
 * ⚠ **THE OLD CLIP'S MANIFEST IS `casting_candidate_cleanup`, AND THE SCHEMA'S
 * OWN DOCBLOCK SAID A REPLACE WOULD NEED A NEW ENUM VALUE.** Read at the code
 * instead of taken from it: two shipped roads already retire a customer's KEPT
 * casting bytes under this value, unheld, in the transaction that drops their
 * row — a replaced face scan's stencils (`castingV2FaceScans.ts`) and a removed
 * ink design (`castingV2InkDesignRemoval.ts`). A replaced voice's clip is the
 * same policy — *nothing references these bytes now; delete them* — so it gets
 * the same value, and no `MODIFY COLUMN` (a destructive migration, his hand) is
 * owed. The schema's paragraph is corrected in the same commit.
 */
export async function insertCastVoice(input: {
  userId: number;
  modelId: number;
  designSentence: string;
  voiceId: string | null;
  clipStorageKey: string;
  clipSha256: string;
  clipBytes: number;
  clipContentType: string;
  passageVersion: number;
  cleanupBatchId: string;
}): Promise<{ inserted: boolean; replaced: ReplacedCastVoice | null }> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  await requireDb();

  try {
    return await withTransaction(async (tx) => {
      const [prior] = await tx
        .select({
          id: castVoices.id,
          voiceId: castVoices.voiceId,
          clipStorageKey: castVoices.clipStorageKey,
        })
        .from(castVoices)
        .where(and(eq(castVoices.modelId, input.modelId), eq(castVoices.userId, input.userId)))
        .limit(1)
        .for("update");

      if (prior) {
        const updated = await tx
          .update(castVoices)
          .set({
            /* Bound values, as in the insert: the sentence is the customer's own. */
            designSentence: input.designSentence,
            voiceId: input.voiceId,
            clipStorageKey: input.clipStorageKey,
            clipSha256: input.clipSha256,
            clipBytes: input.clipBytes,
            clipContentType: input.clipContentType,
            passageVersion: input.passageVersion,
            /* A new voice has never been used, whatever the old one had. */
            lastUsedAt: null,
            keptAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(
            eq(castVoices.id, prior.id),
            eq(castVoices.userId, input.userId),
            eq(castVoices.modelId, input.modelId),
            /*
              THE OWNED-AND-LIVE PROOF RIDES THE WRITE, exactly as the insert's
              does: a cast deleted during the three provider calls makes this
              move zero rows and the whole Keep rolls back.
            */
            inArray(
              castVoices.modelId,
              tx.select({ id: models.id }).from(models).where(and(
                eq(models.id, input.modelId),
                signedCastWhere(input.userId),
              )),
            ),
          ));
        if (affectedRows(updated) !== 1) throw new CastVoiceRowNotWritten();

        /* The old clip goes to the worker — inside this transaction, so it is
           queued if and only if the row stopped naming it. */
        await createStorageCleanupManifestIn(tx, {
          id: randomUUID(),
          userId: input.userId,
          operationId: randomUUID(),
          kind: "casting_candidate_cleanup",
          storageItems: [{ storageKey: prior.clipStorageKey, storageBackend: "public_r2" as const }],
        });
      } else {
        await insertVoiceRowIn(tx, input);
      }

      await dischargeClipManifestIn(tx, input);
      return { inserted: true, replaced: prior ? { voiceId: prior.voiceId } : null };
    });
  } catch (error) {
    if (error instanceof CastVoiceRowNotWritten) return { inserted: false, replaced: null };
    if (isDuplicateKey(error)) return { inserted: false, replaced: null };
    if (isLostLockRace(error)) return { inserted: false, replaced: null };
    throw error;
  }
}

/**
 * THE OTHER SHAPE A LOST KEEP ARRIVES IN — #2503, item 1.
 *
 * Two FIRST Keeps on one cast at once both run the `SELECT … FOR UPDATE` above
 * against a row that does not exist yet. Under REPEATABLE READ that takes a
 * GAP lock on `uq_cast_voices_model`, and gap locks do not conflict with each
 * other — so both get one, both reach the `INSERT`, each insert waits on the
 * other's gap, and InnoDB kills one of them with **1213 (deadlock)**. That
 * transaction is the race's loser exactly as a 1062 would have made it: the
 * survivor's insert proceeds and its voice is the cast's. Before this it was
 * rethrown, so the customer saw the generic failure instead of the clean
 * refusal the duplicate-key loser already gets.
 *
 * **1205 (lock wait timeout)** is the same contest decided by the clock rather
 * than the detector. What holds these rows that long can only be another Keep,
 * a Remove, a cast deletion or an account erasure; whichever it was, THIS Keep
 * did not land — the transaction is rolled back in full on the way out
 * (`withTransaction` rethrows, drizzle rolls back), so nothing it wrote
 * survives — and "it did not land" is the true sentence, where a generic
 * failure is not.
 *
 * ⚠ **IT IS DELIBERATELY NOT A RETRY.** Retrying a deadlock victim here would
 * walk straight into the survivor's committed row and replace it — two Keeps
 * pressed at once would silently become "the second one wins and the first
 * voice's slot is released", which is a product decision nobody made. The loser
 * owns nothing; its caller releases the new slot and deletes the new clip.
 *
 * Walks `cause` the way `isDuplicateKey` does, because drizzle wraps the driver
 * error and a top-level read passes its own test and fails live.
 */
export function isLostLockRace(error: unknown): boolean {
  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {
    const { code, errno, cause } = link as { code?: string; errno?: number; cause?: unknown };
    if (code === "ER_LOCK_DEADLOCK" || errno === 1213) return true;
    if (code === "ER_LOCK_WAIT_TIMEOUT" || errno === 1205) return true;
    link = cause;
  }
  return false;
}

/**
 * The first Keep's row.
 *
 * ⚠ **THE OWNED-AND-LIVE PROOF IS IN THE INSERT ITSELF**, not in a `SELECT`
 * before it. Invariant 1's whole content: a check-then-write leaves a race, and
 * this one has a real window — a Keep calls the provider three times between
 * any prior check and this statement, which is tens of seconds in which the
 * cast can be deleted. The `SELECT … WHERE signedCastWhere` inside the
 * `INSERT … SELECT` closes it: a deleted cast makes the insert write zero rows
 * and the caller is told, rather than a voice landing on a tombstone.
 *
 * A zero-row insert, or the unique index refusing a Keep that raced another,
 * reaches the caller as `inserted: false`.
 */
async function insertVoiceRowIn(
  tx: TransactionHandle,
  input: Parameters<typeof insertCastVoice>[0],
): Promise<void> {
  const result = await tx.insert(castVoices).select(
    tx
      .select({
        id: sql<number>`NULL`.as("id"),
        modelId: models.id,
        userId: models.userId,
        /*
          BOUND VALUES, never interpolation. The design sentence is a
          customer's own writing and travels as a parameter; `sql` with a
          `${}` placeholder is what makes that true.
        */
        designSentence: sql<string>`${input.designSentence}`.as("designSentence"),
        voiceId: sql<string | null>`${input.voiceId}`.as("voiceId"),
        clipStorageKey: sql<string>`${input.clipStorageKey}`.as("clipStorageKey"),
        clipSha256: sql<string>`${input.clipSha256}`.as("clipSha256"),
        clipBytes: sql<number>`${input.clipBytes}`.as("clipBytes"),
        clipContentType: sql<string>`${input.clipContentType}`.as("clipContentType"),
        passageVersion: sql<number>`${input.passageVersion}`.as("passageVersion"),
        lastUsedAt: sql<Date | null>`NULL`.as("lastUsedAt"),
        keptAt: sql<Date>`CURRENT_TIMESTAMP`.as("keptAt"),
      })
      .from(models)
      .where(and(eq(models.id, input.modelId), signedCastWhere(input.userId))),
  );
  /*
    A zero-row insert is the deleted-cast race the docblock above describes.
    It THROWS rather than returning, so the transaction rolls back and the
    manifest is left standing — the bytes stay the worker's, and the caller
    deletes them immediately besides.
  */
  if (affectedRows(result) !== 1) throw new CastVoiceRowNotWritten();
}

/**
 * THE WRITE-AHEAD MANIFEST HOLDING THE NEW CLIP'S BYTES, discharged in the SAME
 * transaction that writes the row — the keeper-receipt pattern, and the same
 * shape `recordReferenceAttachment` uses.
 *
 * The clip is in the public bucket before this runs, named by a manifest and by
 * no row. Discharging it here is what makes the bytes the row's rather than the
 * worker's, and doing it in this transaction is the whole of it: until this
 * commits, a crash leaves the manifest standing and the worker collects bytes
 * nothing references, which is correct.
 */
async function dischargeClipManifestIn(
  tx: TransactionHandle,
  input: { userId: number; cleanupBatchId: string },
): Promise<void> {
  /*
    The discharge is scoped to the OWNER and to an UNDISCHARGED batch, and a
    count of anything but one throws. A discharge that silently affected
    zero rows would leave the worker holding a live clip's bytes while this
    call reported success — the one outcome worse than an orphan.
  */
  await tx
    .delete(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
  const released = await tx.delete(storageCleanupBatches).where(and(
    eq(storageCleanupBatches.id, input.cleanupBatchId),
    eq(storageCleanupBatches.userId, input.userId),
    undischargedStorageCleanupBatchWhere(),
  ));
  if (affectedRows(released) !== 1) {
    /*
      Not a race and not a customer's problem: this manifest was created by
      this same Keep moments ago. It rolls back and propagates, because
      dressing an invariant violation up as a lost race is how one goes
      unnoticed.
    */
    throw new CastVoiceManifestUndischargeable(
      "the kept voice's write-ahead manifest was not there to discharge",
    );
  }
}

/**
 * REMOVE THE CAST'S VOICE — #2497, his *"Remove voice: back to 'No voice yet',
 * slot released, clip deleted. No refund — the customer had the voice."*
 *
 * The ink-design removal's shape (`castingV2InkDesignRemoval.ts`): the row is
 * read and locked with the owner in the statement, its clip is handed to an
 * unheld cleanup manifest, and the row is deleted with the owner AGAIN — all in
 * one transaction, so a crash leaves either the voice with its clip or neither.
 *
 * Returns the provider slot the caller must release AFTER the commit (the
 * deletion road's order), or `null` when there was no voice to remove — which
 * includes a cast that stopped being the owner's live signed cast before the
 * delete ran (#2503: the proof is in the DELETE, and a zero-row delete rolls
 * the whole removal back).
 */
export async function removeCastVoice(
  userId: number,
  modelId: number,
): Promise<ReplacedCastVoice | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  await requireDb();

  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        id: castVoices.id,
        voiceId: castVoices.voiceId,
        clipStorageKey: castVoices.clipStorageKey,
      })
      .from(castVoices)
      .where(and(eq(castVoices.modelId, modelId), eq(castVoices.userId, userId)))
      .limit(1)
      .for("update");
    if (!row) return null;

    await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId,
      operationId: randomUUID(),
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: row.clipStorageKey, storageBackend: "public_r2" as const }],
    });

    const deleted = await tx.delete(castVoices).where(and(
      eq(castVoices.id, row.id),
      eq(castVoices.userId, userId),
      eq(castVoices.modelId, modelId),
      /*
        THE OWNED-AND-LIVE PROOF RIDES THE DELETE — #2503, item 3 (invariant
        1). The route's `requireCast` proves the live signed cast BEFORE this
        transaction; the Keep's write already re-proves it IN its statement,
        and Remove now does the same with the same predicate, so "the cast is
        live and signed" is a fact of this statement rather than of a read
        taken a moment earlier.
      */
      inArray(
        castVoices.modelId,
        tx.select({ id: models.id }).from(models).where(and(
          eq(models.id, modelId),
          signedCastWhere(userId),
        )),
      ),
    ));
    /*
      Zero rows means the cast stopped being live and signed between the route's
      check and here. THROWN, so the clip manifest written above rolls back with
      it — queueing the clip of a voice whose row survives would delete the bytes
      a row still names. The voice is left to the cast's own deletion road,
      which takes it with the cast.
    */
    if (affectedRows(deleted) !== 1) throw new CastVoiceRowNotWritten();
    return { voiceId: row.voiceId };
  }).catch((error: unknown) => {
    if (error instanceof CastVoiceRowNotWritten) return null;
    throw error;
  });
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/*
  ⚠ **THE TWO RELEASE-FACT READS ARE LOCKING READS — #2503, item 2, and its
  sibling.** Each feeds a DELETE a few statements later in the same transaction,
  and the delete takes whatever row is committed by then. A plain `SELECT`
  under REPEATABLE READ reads the transaction's SNAPSHOT instead, which the
  account erasure establishes many statements earlier — so a replacing Keep
  committing between the read and the delete left the read naming the OLD clip
  and slot while the delete removed the row naming the NEW ones: a cloning
  source left in the public bucket and a provider slot nothing would release.

  `FOR UPDATE` reads the latest committed row and holds it (and, on the
  account read, the `ix_cast_voices_user` range, so a FIRST Keep cannot insert
  behind it either) until the transaction ends, so the read and the delete see
  the same rows. A Keep racing it waits, and then finds the cast gone.

  The cast-deletion road's read is the same shape and gets the same repair:
  every other read in `finalCastDeletion`'s transaction is already `FOR UPDATE`,
  and this one was the exception. Neither adds a lock the delete below it was
  not about to take — it takes it one statement earlier.
*/

/** The same read, inside the cast-deletion transaction — its authoritative one. */
export async function readCastVoiceReleaseFactsIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<Array<{ voiceId: string | null; clipStorageKey: string }>> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  return tx
    .select({ voiceId: castVoices.voiceId, clipStorageKey: castVoices.clipStorageKey })
    .from(castVoices)
    .where(and(eq(castVoices.modelId, input.modelId), eq(castVoices.userId, input.userId)))
    .for("update");
}

/** The same read, inside a transaction — the account purge's door. */
export async function readAccountVoiceReleaseFactsIn(
  tx: TransactionHandle,
  input: { userId: number },
): Promise<Array<{ voiceId: string | null; clipStorageKey: string }>> {
  assertPositiveId(input.userId, "userId");
  return tx
    .select({ voiceId: castVoices.voiceId, clipStorageKey: castVoices.clipStorageKey })
    .from(castVoices)
    .where(eq(castVoices.userId, input.userId))
    .for("update");
}

/**
 * The voice dies with its cast — called from inside the final-deletion
 * transaction, owner and cast in the one `WHERE`.
 */
export async function deleteCastVoicesIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<number> {
  const result = await tx
    .delete(castVoices)
    .where(and(eq(castVoices.modelId, input.modelId), eq(castVoices.userId, input.userId)));
  return (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
}

/** Every voice of one account — the erasure path's door. */
export async function deleteAccountVoicesIn(
  tx: TransactionHandle,
  input: { userId: number },
): Promise<number> {
  const result = await tx.delete(castVoices).where(eq(castVoices.userId, input.userId));
  return (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
}

/**
 * ONE CAST'S KEPT CLIP, BY THE PUBLIC KI ID, FOR THE ACCOUNT THAT OWNS IT —
 * the owner-only clip route's single statement (N4b-2, #2470).
 *
 * ⚠ **THE WHOLE POINT IS THAT IT IS ONE STATEMENT.** The route is handed a
 * `castId` out of a URL, and the thing it must not do is resolve that to a
 * model id, then read the voice by that id — a two-step that leaves a window
 * and spreads the owner across two `WHERE`s (invariant 1, and invariant 2's
 * *re-anchor the child to the owned parent in that same statement*). So the
 * join carries, together: the owner on BOTH tables, the public id, and
 * `signedCastWhere`'s own liveness — the same predicate the roster draws by.
 *
 * A cast that is not this account's, not live, not signed, or has no kept
 * voice, all answer `null`, so the route's 404 cannot be used to discover which
 * cast ids are real.
 *
 * It returns the clip's facts and NOT `designSentence`: the sentence is the
 * customer's own writing and the bytes are what a player needs, so the one
 * statement a byte-serving route makes has no reason to load the other
 * (invariant 8 — sensitive field groups stay out by construction).
 */
export async function readOwnedCastVoiceClipByPublicId(
  userId: number,
  castId: string,
): Promise<{
  modelId: number;
  clipStorageKey: string;
  clipSha256: string;
  clipBytes: number;
  clipContentType: string;
} | null> {
  assertPositiveId(userId, "userId");
  if (typeof castId !== "string" || castId.length === 0) return null;
  const db = await requireDb();
  const [row] = await db
    .select({
      modelId: castVoices.modelId,
      clipStorageKey: castVoices.clipStorageKey,
      clipSha256: castVoices.clipSha256,
      clipBytes: castVoices.clipBytes,
      clipContentType: castVoices.clipContentType,
    })
    .from(castVoices)
    .innerJoin(models, and(
      eq(models.id, castVoices.modelId),
      eq(castVoices.userId, userId),
      eq(models.agencyId, castId),
      signedCastWhere(userId),
    ))
    .limit(1);
  return row ?? null;
}

/**
 * Mark a kept voice as used, so the cache has something to be least-recently
 * used BY (design §4).
 *
 * N4b-4 is what reads it; this slice writes it on every clip serve, because the
 * write has to exist before the eviction that consults it or the column is
 * uniformly null the day that code lands and every voice looks equally cold.
 * Owner and cast in the one `WHERE`; a row that is not this account's is not
 * touched and nothing is reported, since the caller has already proved the
 * ownership it cares about.
 */
export async function touchCastVoiceUsed(input: {
  userId: number;
  modelId: number;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await requireDb();
  await db
    .update(castVoices)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(castVoices.modelId, input.modelId), eq(castVoices.userId, input.userId)));
}
