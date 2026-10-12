/**
 * THE PUBLIC CHECK PAGE'S STATEMENTS — N2d-3 (#2313).
 *
 * Design §1 and §7.3 (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`):
 * the owner of a signed cast may turn on a page where anyone holding the
 * Klieg ID can confirm the ID is real and when the character was made, and see
 * nothing else. OFF by default — `cast_creation_records.publicAt` is NULL until
 * the owner turns it on, and turning it off nulls it again.
 *
 * Two halves, and they are kept apart on purpose:
 *
 *   1. THE OWNER'S STATEMENTS — resolve the cast, read the switch, flip it.
 *      Every one carries the owner in its own `WHERE` (invariants 1 and 2) and
 *      decides "is this still the owner's live, signed cast" with the roster's
 *      own predicate, `signedCastWhere`.
 *   2. THE PUBLIC READ — `readPublicCreationCheck`, keyed on the Klieg ID with
 *      NO session. ⚠ **It is ONE statement, and that is the no-existence-oracle
 *      rule at the database**: an ID that does not exist, an ID whose page is
 *      off, and a deleted cast's ID all come back as "no row" from the same
 *      single query, so neither the answer nor the number of round trips can
 *      tell them apart. The owner is joined from the record row itself
 *      (`models.userId = record.userId`), and liveness is `signedCastLiveWhere`
 *      — the roster's predicate minus the owner, derived from it rather than
 *      copied (working law 4).
 *
 * ⚠ **EXPLICIT PROJECTIONS ONLY (invariant 8).** Nothing here selects
 * `masterPrompt`, `technicalSchema`, `preferences`, a storage key or any
 * address of a picture; the public read selects the record's signed JSON (whose
 * shape the §3 bound already holds), the stamp time, the cast's name and the
 * ID — and the projector in `server/castingV2/creationCheck.ts` narrows that to
 * what a stranger may see. `castCreationCheck.test.ts` reads the SQL this
 * module really sends.
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { castCreationRecords, models } from "../../drizzle/schema";
import { getDb } from "./connection";
import { signedCastLiveWhere, signedCastWhere } from "./castingV2Sign";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("[castCreationCheck] database not available");
  return db;
}

function assertPositiveId(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

/** The owner's signed, live cast behind a public Klieg ID — its internal id and its name. */
export async function resolveOwnedSignedCast(
  userId: number,
  kliegId: string,
): Promise<{ modelId: number; name: string | null } | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [cast] = await db
    .select({ modelId: models.id, name: models.name })
    .from(models)
    .where(and(eq(models.agencyId, kliegId), signedCastWhere(userId)))
    .limit(1);
  return cast ?? null;
}

/** The owner's switch, read without creating anything. `null` = no record yet (so: off). */
export async function readCreationCheckSwitch(
  userId: number,
  modelId: number,
): Promise<{ publicAt: Date | null } | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select({ publicAt: castCreationRecords.publicAt })
    .from(castCreationRecords)
    .innerJoin(models, and(eq(models.id, castCreationRecords.modelId), signedCastWhere(userId)))
    .where(and(eq(castCreationRecords.modelId, modelId), eq(castCreationRecords.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Turn the owner's check page on or off, in ONE statement that re-proves the
 * owner and the live cast (invariant 1). Turning ON keeps the earliest
 * `publicAt` if it is already on; turning OFF nulls it. `updated: false` means
 * there was no record for this owner's live cast to switch — the caller makes
 * the record first, so that is a cast that left between the two.
 */
export async function setCreationCheckPublic(input: {
  userId: number;
  modelId: number;
  on: boolean;
  now?: Date;
}): Promise<{ updated: boolean }> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await requireDb();
  /* The owner and the live cast, decided inside the write itself. */
  const ownedAndLive = and(
    eq(castCreationRecords.modelId, input.modelId),
    eq(castCreationRecords.userId, input.userId),
    inArray(
      castCreationRecords.modelId,
      db.select({ id: models.id }).from(models).where(signedCastWhere(input.userId)),
    ),
  );
  const result = input.on
    ? await db
      .update(castCreationRecords)
      .set({ publicAt: input.now ?? new Date() })
      .where(and(ownedAndLive, isNull(castCreationRecords.publicAt)))
    : await db
      .update(castCreationRecords)
      .set({ publicAt: null })
      .where(ownedAndLive);
  if (affectedRows(result) === 1) return { updated: true };
  /* Zero rows moved can also mean "already on" (the publicAt-is-null guard), so
     read the switch back rather than reporting a refusal for a no-op. */
  const after = await readCreationCheckSwitch(input.userId, input.modelId);
  if (!after) return { updated: false };
  return { updated: input.on ? after.publicAt !== null : after.publicAt === null };
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/** What the public read hands the projector — never a picture, never the recipe. */
export type PublicCreationCheckRow = {
  kliegId: string;
  ownerId: number;
  castName: string | null;
  recordJson: string;
  stampedAt: Date | null;
};

/**
 * THE PUBLIC READ. One statement; see the header for why that is the rule.
 * `null` for an unknown ID, an ID whose page is off, and a deleted or archived
 * cast alike.
 */
export async function readPublicCreationCheck(kliegId: string): Promise<PublicCreationCheckRow | null> {
  const db = await requireDb();
  const [row] = await db
    .select({
      kliegId: models.agencyId,
      ownerId: castCreationRecords.userId,
      castName: models.name,
      recordJson: castCreationRecords.recordJson,
      stampedAt: castCreationRecords.stampedAt,
    })
    .from(castCreationRecords)
    .innerJoin(
      models,
      and(
        eq(models.id, castCreationRecords.modelId),
        eq(models.userId, castCreationRecords.userId),
        signedCastLiveWhere(),
      ),
    )
    .where(and(eq(models.agencyId, kliegId), isNotNull(castCreationRecords.publicAt)))
    .limit(1);
  if (!row || !row.kliegId) return null;
  return { ...row, kliegId: row.kliegId };
}
