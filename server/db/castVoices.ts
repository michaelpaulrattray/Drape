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

/**
 * THE ROSTER'S OWN PREDICATE, FETCHED LAZILY — and the reason is measured, not
 * stylistic.
 *
 * `signedCastWhere` is a four-line pure drizzle predicate and importing it is
 * the right call: it is exported precisely so a new store decides *"is this the
 * owner's signed live cast"* with the SAME rule the roster draws by rather than
 * a second copy that drifts (working law 4), and the campaign store (#2249) and
 * the creation record (#2311) both already reach for it this way.
 *
 * ⚠ **BUT A STATIC IMPORT OF IT HERE BROKE 26 MONEY TESTS IN TWO SUITES THAT
 * THIS CARD NEVER TOUCHED, and the chain is worth writing down because the next
 * new store under `db/` will meet it.** Measured by bisection, with the
 * suites green on `main` and green again with this one line changed:
 *
 *   the `./db` BARREL → `accountDeletion` → `accountCastingPurge` → THIS MODULE
 *   → `castingV2Sign` → `casting/atomicCredits` → `import { addCredits } from "../db"`
 *
 * `batchC-doors` and `batchC-failureInjection` mock the `./db` barrel with a
 * factory that calls `importOriginal()`. That call initialises the REAL barrel,
 * which — once this module joined its closure — initialised `atomicCredits`,
 * whose **static** `addCredits` binding therefore captured the real function
 * before the mock existed. Every refund then went to the real credit layer,
 * found no database, and logged *"REFUND FAILED TO RECORD"* while the mocked
 * `addCredits` was never called: `expect(addCredits).toHaveBeenCalledTimes(2)`
 * saw 0, and a `refunded: 300` assertion read `refunded: 0`.
 *
 * **Nothing here can bite production, which is why this is a lazy import and
 * not a money-path change**: production mocks nothing, so the static binding
 * resolves to the same function either way. What the edge does is make a money
 * test's mock sensitive to who else imports the barrel — so **the root cause is
 * filed on its own card** (`atomicCredits` reaching money functions through the
 * barrel rather than through `db/credits`) — **#2483** — and is deliberately NOT
 * repaired here: it is the money path, and a fix there wants its own review and
 * its own eye, not a ride on a voice card. When #2483 lands, this helper goes
 * back to being a static import and that card says so.
 */
async function signedCastWhereLazy(userId: number) {
  const { signedCastWhere } = await import("./castingV2Sign");
  return signedCastWhere(userId);
}

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
    .where(and(eq(models.id, modelId), await signedCastWhereLazy(userId)))
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
        .where(and(eq(models.id, input.modelId), await signedCastWhereLazy(input.userId))),
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
