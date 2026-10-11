/**
 * CAMPAIGNS — a customer's named collections of signed casts (rung N2c,
 * card #2249; tables in migration 0080).
 *
 * His word, 2026-09-29: *"in n2c instead of calling them shoots call it
 * Campaign"*. A cast may sit in several campaigns; a cast in none is Unfiled.
 *
 * # The ownership rules, and where each one lives
 *
 * - **The owner is in the WHERE of every statement that reads or writes**
 *   (enforcement invariant 1). A campaign is only ever reached by its public id
 *   AND the caller's `userId` in the same statement; no write is keyed on an id
 *   a previous SELECT handed back.
 * - **Child ids are re-anchored to the owned parent in the same statement**
 *   (invariant 2). The membership INSERT joins the owned campaign to the owned,
 *   signed casts inside one `INSERT … SELECT`; the DELETE resolves both the
 *   campaign and the casts through owner-scoped subqueries. Proving the
 *   campaign is the customer's never vouches for the cast ids sent beside it.
 * - **Explicit projections only** (invariant 8). Nothing here returns a row;
 *   every read names its columns, and internal numeric ids never leave.
 * - **"Signed and live" is the roster's own predicate** (`signedCastWhere`),
 *   not a second copy of it (working law 4) — so a cast the roster stops
 *   showing also stops counting in a campaign and can no longer be filed.
 *
 * The REFUSALS the reads exist for (campaign not found, a cast that is not
 * this customer's signed cast) are decided before the write, and the write
 * then re-proves ownership by itself; a cast deleted between the two is simply
 * not inserted.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { castCampaignMembers, castCampaigns, models } from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import { isDuplicateKey } from "./castingV2InkDeliveryCrops";
import { signedCastWhere } from "./castingV2Sign";

/** The longest campaign name, in characters — the column's own width. */
export const CAMPAIGN_NAME_MAX_LENGTH = 64;

/**
 * How many casts one add or remove may name. The roster's own page size, so a
 * "select everything I can see" never needs two calls.
 */
export const CAMPAIGN_CASTS_PER_CALL_MAX = 60;

export type CampaignSummary = {
  campaignId: string;
  name: string;
  /** Signed, live casts only — the casts the library would actually draw. */
  castCount: number;
};

function assertPositiveId(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** A UUID without its dashes: 32 hex characters, the column's width. */
function newCampaignPublicId(): string {
  return randomUUID().replace(/-/g, "");
}

function affectedRows(result: unknown): number {
  return Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

/** The owned campaign's internal id, as a subquery — owner in its own WHERE. */
function ownedCampaignIds(db: Awaited<ReturnType<typeof requireDb>>, userId: number, campaignId: string) {
  return db
    .select({ id: castCampaigns.id })
    .from(castCampaigns)
    .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId)));
}

/**
 * This customer's campaigns, oldest first, each with how many of its casts
 * the library would draw.
 *
 * The count is DERIVED, never stored: a member whose cast has since been
 * deleted, or is no longer one of this customer's signed casts, drops out of
 * the join and out of the number.
 */
export async function listCampaigns(userId: number): Promise<CampaignSummary[]> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const rows = await db
    .select({
      campaignId: castCampaigns.publicId,
      name: castCampaigns.name,
      castCount: sql<number>`count(${models.id})`,
    })
    .from(castCampaigns)
    .leftJoin(castCampaignMembers, and(
      eq(castCampaignMembers.campaignId, castCampaigns.id),
      eq(castCampaignMembers.userId, userId),
    ))
    .leftJoin(models, and(
      eq(models.id, castCampaignMembers.modelId),
      signedCastWhere(userId),
    ))
    .where(eq(castCampaigns.userId, userId))
    .groupBy(castCampaigns.id)
    .orderBy(asc(castCampaigns.sortOrder), asc(castCampaigns.id));
  return rows.map((row) => ({
    campaignId: row.campaignId,
    name: row.name,
    castCount: Number(row.castCount),
  }));
}

export type CreateCampaignResult =
  | { kind: "created"; campaign: CampaignSummary }
  | { kind: "name_taken" };

/** A new, empty campaign. `name` arrives trimmed and within its width. */
export async function createCampaign(userId: number, name: string): Promise<CreateCampaignResult> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const campaignId = newCampaignPublicId();
  try {
    await db.insert(castCampaigns).values({ publicId: campaignId, userId, name });
  } catch (error) {
    /* The unique (userId, name) — the public id is 128 random bits and is not
       what collided. */
    if (isDuplicateKey(error)) return { kind: "name_taken" };
    throw error;
  }
  return { kind: "created", campaign: { campaignId, name, castCount: 0 } };
}

export type RenameCampaignResult = { kind: "renamed" } | { kind: "not_found" } | { kind: "name_taken" };

export async function renameCampaign(
  userId: number,
  campaignId: string,
  name: string,
): Promise<RenameCampaignResult> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  let result: unknown;
  try {
    result = await db
      .update(castCampaigns)
      .set({ name })
      .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId)));
  } catch (error) {
    if (isDuplicateKey(error)) return { kind: "name_taken" };
    throw error;
  }
  if (affectedRows(result) > 0) return { kind: "renamed" };
  /*
    Zero rows is either "not yours / not there" or "renamed to the name it
    already had", depending on how the driver counts an unchanged row. The
    second is a success, so the question is asked rather than assumed.
  */
  const [still] = await ownedCampaignIds(db, userId, campaignId).limit(1);
  return still ? { kind: "renamed" } : { kind: "not_found" };
}

export type DeleteCampaignResult = { kind: "deleted"; membersRemoved: number } | { kind: "not_found" };

/**
 * The campaign and its member rows go; the casts stay exactly as they were.
 * One transaction, members first, each statement owner-scoped.
 */
export async function deleteCampaign(userId: number, campaignId: string): Promise<DeleteCampaignResult> {
  assertPositiveId(userId, "userId");
  await requireDb();
  return withTransaction(async (tx) => {
    const members = await tx
      .delete(castCampaignMembers)
      .where(and(
        eq(castCampaignMembers.userId, userId),
        inArray(
          castCampaignMembers.campaignId,
          tx.select({ id: castCampaigns.id })
            .from(castCampaigns)
            .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId))),
        ),
      ));
    const campaign = await tx
      .delete(castCampaigns)
      .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId)));
    if (affectedRows(campaign) === 0) return { kind: "not_found" as const };
    return { kind: "deleted" as const, membersRemoved: affectedRows(members) };
  });
}

export type AddCastsResult =
  | { kind: "added"; added: number }
  | { kind: "campaign_not_found" }
  | { kind: "cast_not_found" };

/**
 * File casts into a campaign. Idempotent: a cast already there stays one row.
 *
 * All or nothing at the refusal: if ANY named cast is not one of this
 * customer's signed, live casts — another account's, an unsigned sheet, a
 * deleted cast, or an id that was never anything — nothing is filed.
 */
export async function addCastsToCampaign(
  userId: number,
  campaignId: string,
  castIds: readonly string[],
): Promise<AddCastsResult> {
  assertPositiveId(userId, "userId");
  const wanted = Array.from(new Set(castIds));
  if (wanted.length === 0) return { kind: "added", added: 0 };
  await requireDb();
  return withTransaction(async (tx) => {
    const [campaign] = await tx
      .select({ id: castCampaigns.id })
      .from(castCampaigns)
      .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId)))
      .limit(1);
    if (!campaign) return { kind: "campaign_not_found" as const };

    const casts = await tx
      .select({ id: models.id })
      .from(models)
      .where(and(inArray(models.agencyId, wanted), signedCastWhere(userId)));
    if (casts.length !== wanted.length) return { kind: "cast_not_found" as const };

    const already = await tx
      .select({ modelId: castCampaignMembers.modelId })
      .from(castCampaignMembers)
      .where(and(
        eq(castCampaignMembers.userId, userId),
        eq(castCampaignMembers.campaignId, campaign.id),
        inArray(castCampaignMembers.modelId, casts.map((cast) => cast.id)),
      ));

    /*
      THE WRITE RE-PROVES EVERYTHING ITSELF (invariants 1 and 2): one
      INSERT … SELECT joining the campaign — by public id and owner — to the
      casts — by public id, owner and the roster's signed predicate. Nothing
      from the reads above is trusted as a key. The duplicate clause is what
      makes a second add of the same cast a no-op rather than an error.
    */
    await tx
      .insert(castCampaignMembers)
      .select(
        tx
          .select({
            id: sql<number>`NULL`.as("id"),
            campaignId: castCampaigns.id,
            modelId: models.id,
            userId: sql<number>`${userId}`.as("userId"),
            createdAt: sql<Date>`CURRENT_TIMESTAMP`.as("createdAt"),
          })
          .from(castCampaigns)
          .innerJoin(models, and(inArray(models.agencyId, wanted), signedCastWhere(userId)))
          .where(and(eq(castCampaigns.publicId, campaignId), eq(castCampaigns.userId, userId))),
      )
      .onDuplicateKeyUpdate({ set: { campaignId: sql`${castCampaignMembers.campaignId}` } });

    return { kind: "added" as const, added: casts.length - already.length };
  });
}

export type RemoveCastsResult = { kind: "removed"; removed: number } | { kind: "campaign_not_found" };

/**
 * Take casts out of a campaign. The casts themselves are untouched. A cast
 * that was not in the campaign, or is not this customer's, removes nothing —
 * there is nothing of theirs to refuse.
 */
export async function removeCastsFromCampaign(
  userId: number,
  campaignId: string,
  castIds: readonly string[],
): Promise<RemoveCastsResult> {
  assertPositiveId(userId, "userId");
  const wanted = Array.from(new Set(castIds));
  const db = await requireDb();
  const [campaign] = await ownedCampaignIds(db, userId, campaignId).limit(1);
  if (!campaign) return { kind: "campaign_not_found" };
  if (wanted.length === 0) return { kind: "removed", removed: 0 };

  const result = await db
    .delete(castCampaignMembers)
    .where(and(
      eq(castCampaignMembers.userId, userId),
      inArray(castCampaignMembers.campaignId, ownedCampaignIds(db, userId, campaignId)),
      /* Any of this customer's casts, signed or not: a cast deleted after it
         was filed can still be taken out. */
      inArray(
        castCampaignMembers.modelId,
        db.select({ id: models.id })
          .from(models)
          .where(and(inArray(models.agencyId, wanted), eq(models.userId, userId))),
      ),
    ));
  return { kind: "removed", removed: affectedRows(result) };
}
