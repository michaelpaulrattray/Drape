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
 * `technicalSchema`, no `preferences`, no `personality`. A voice road has no
 * use for the recipe, and the cheapest way to keep it out of a provider request
 * is never to load it.
 */
import { and, eq, sql } from "drizzle-orm";

import { castVoices, models, type CastVoiceRow } from "../../drizzle/schema";
import { getDb, type TransactionHandle } from "./connection";
import { isDuplicateKey } from "./castingV2InkDeliveryCrops";

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
 * Write the kept voice.
 *
 * ⚠ **THE OWNED-AND-LIVE PROOF IS IN THE INSERT ITSELF**, not in a `SELECT`
 * before it. Invariant 1's whole content: a check-then-write leaves a race, and
 * this one has a real window — a Keep calls the provider three times between
 * any prior check and this statement, which is tens of seconds in which the
 * cast can be deleted. The `SELECT … WHERE signedCastWhere` inside the
 * `INSERT … SELECT` closes it: a deleted cast makes the insert write zero rows
 * and the caller is told, rather than a voice landing on a tombstone.
 *
 * Returns `inserted: false` when the cast already has a kept voice (the unique
 * index refuses it) or when the cast is no longer one this road may touch. The
 * two are told apart by the caller's own read, because only it knows which it
 * asked for.
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
}): Promise<{ inserted: boolean }> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await requireDb();

  try {
    const result = await db.insert(castVoices).select(
      db
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
    return { inserted: affectedRows(result) === 1 };
  } catch (error) {
    if (isDuplicateKey(error)) return { inserted: false };
    throw error;
  }
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

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
    .where(and(eq(castVoices.modelId, input.modelId), eq(castVoices.userId, input.userId)));
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
    .where(eq(castVoices.userId, input.userId));
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
