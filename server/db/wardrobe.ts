/**
 * Wardrobe DB Helpers — CRUD operations for garments, outfits, and sessions.
 */
import { eq, and, desc, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import {
  wardrobeGarments,
  wardrobeOutfits,
  wardrobeSessions,
  wardrobeLooks,
  models,
  storageCleanupBatches,
  storageCleanupItems,
  type InsertWardrobeGarment,
  type InsertWardrobeOutfit,
  type InsertWardrobeSession,
  type InsertWardrobeLook,
} from "../../drizzle/schema";
import { assertOwnedAvailableModelIn } from "./modelReferenceFence";
import { undischargedStorageCleanupBatchWhere } from "./storageCleanup";
import { wardrobeOwnedKeyPrefixes } from "./accountDeletion";
import { classifyStorageReference } from "../casting/deletionAudit";

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

export class GarmentPictureReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarmentPictureReceiptError";
  }
}

/**
 * RELEASE ONE WARDROBE RECEIPT, INSIDE THE CALLER'S TRANSACTION — the one
 * discharge every wardrobe keeper uses (#2094, #2095).
 *
 * `createGarment` (#1961) and `appendSessionResult` (#1980) each spelled this
 * out inline; #2095 adds `updateGarment` and #2094 the Look and the Outfit, and
 * five copies of the predicate that decides whether the worker may still
 * delete a picture would be five chances for one of them to drift. So it is
 * here once.
 *
 * Scoped three ways, and each is load-bearing:
 * - the OWNER — another account's manifest is never discharged by this one;
 * - the KIND — only a `wardrobe_scratch_cleanup` manifest; a receipt for some
 *   other feature's manifest is not a wardrobe row's to spend;
 * - UNDISCHARGED — a batch the worker has already claimed is past saving.
 *
 * ⚠ **THE BATCH GOES FIRST, and its items only if that delete took exactly one
 * row.** The inline copies deleted the items first and relied on the caller's
 * throw to roll them back. That is fine for a caller that throws, and wrong for
 * the one caller that may lose quietly (`adoptOwnedScratchKeyIn`), which would
 * have left a batch the worker had claimed with no items in it.
 *
 * Returns whether the receipt was released. A caller holding a receipt it was
 * handed throws on `false`; a caller only looking for one does not.
 */
async function releaseWardrobeReceiptIn(
  tx: TransactionHandle,
  input: { cleanupBatchId: string; userId: number },
): Promise<boolean> {
  const released = await tx.delete(storageCleanupBatches).where(and(
    eq(storageCleanupBatches.id, input.cleanupBatchId),
    eq(storageCleanupBatches.userId, input.userId),
    eq(storageCleanupBatches.kind, "wardrobe_scratch_cleanup"),
    undischargedStorageCleanupBatchWhere(),
  ));
  if (affectedRows(released) !== 1) return false;
  await tx.delete(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
  return true;
}

/**
 * A SAVED LOOK OR OUTFIT ADOPTS THE PICTURE IT NAMES — when, and only when,
 * that picture is this account's own wardrobe object still waiting in a live
 * scratch manifest (#2094).
 *
 * Since #1980 a try-on result made with NO session sits in a manifest and the
 * worker deletes it after `WARDROBE_SCRATCH_HOLD_MS`. `looks.save` and
 * `outfits.save` store the URL the browser sends, so a Look saved from such a
 * picture pointed at nothing a day later. There is no receipt to hand over
 * here — the browser never sees one, by design — so the key is derived from
 * the very URL being stored and the manifest is FOUND by it.
 *
 * What it will adopt, and why each limit is there:
 * - **a URL on the bucket we serve from today**, read by the same
 *   `classifyStorageReference` the erasure sweep reads with;
 * - **under one of THIS account's wardrobe prefixes** (`wardrobeOwnedKeyPrefixes`,
 *   imported rather than restated) — exactly what account erasure later reads
 *   a Look's or Outfit's URL as owning. Adopting a key the sweep would not read
 *   (a model photo under `<id>-models/`) would move it from "the worker will
 *   delete it" to "nothing ever will";
 * - **named by a manifest THIS account owns** — another customer's URL, live
 *   manifest or not, is never adopted (`releaseWardrobeReceiptIn`'s owner
 *   scope, and the owner in the read below);
 * - **a manifest naming that key and nothing else**, so a release can never
 *   rescue some other object riding in the same batch.
 *
 * Returns the key it adopted, or `null`. A `null` changes nothing about the
 * save: the row is written exactly as before — the right answer for a picture
 * a session already adopted (no manifest is left), and the only one there is
 * for a picture already past its hold.
 *
 * The first read takes no lock, on purpose: `storage_cleanup_items.storageKey`
 * has no index of its own, and a locking scan would hold every manifest row it
 * passed. The statement that decides is the release's delete, by primary key,
 * re-checking that the batch is still undischarged.
 */
async function adoptOwnedScratchKeyIn(
  tx: TransactionHandle,
  input: { userId: number; url: string | null | undefined; currentPublicUrl: string },
): Promise<string | null> {
  if (!input.url) return null;
  const classified = classifyStorageReference({ url: input.url, currentPublicUrl: input.currentPublicUrl });
  if (classified.kind !== "current_origin_url") return null;
  const key = classified.key;
  if (!wardrobeOwnedKeyPrefixes(input.userId).some((prefix) => key.startsWith(prefix))) return null;

  const candidates = await tx
    .select({ id: storageCleanupBatches.id })
    .from(storageCleanupBatches)
    .innerJoin(storageCleanupItems, eq(storageCleanupItems.batchId, storageCleanupBatches.id))
    .where(and(
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.kind, "wardrobe_scratch_cleanup"),
      undischargedStorageCleanupBatchWhere(),
      eq(storageCleanupItems.storageKey, key),
      eq(storageCleanupItems.storageBackend, "public_r2"),
    ));

  let adopted = false;
  for (const { id } of candidates) {
    const items = await tx
      .select({ storageKey: storageCleanupItems.storageKey })
      .from(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, id));
    if (items.length !== 1) continue;
    if (await releaseWardrobeReceiptIn(tx, { cleanupBatchId: id, userId: input.userId })) adopted = true;
  }
  return adopted ? key : null;
}

// ── Garments ───────────────────────────────────────────────────────────────

/**
 * Insert a garment, discharging the receipts for the objects it now owns.
 *
 * ⚠ **`adoptedReceipts` IS REQUIRED, NOT OPTIONAL, AND THAT IS THE WHOLE
 * CONTROL** (#1961, the relay's finding on PR #1979). An optional field is one
 * a caller can forget, and forgetting it is precisely the defect this repair is
 * about: `wardrobe.garments.import` wrote scratch URLs onto a row and handed no
 * receipt to anything, so the cleanup worker kept its promise and the row
 * survived pointing at nothing. The precedent and its own history are in
 * `server/db/castingV2ReferenceAttachments.ts`. A required parameter makes
 * every future caller answer *does this garment own bytes somebody registered
 * for deletion?* instead of inheriting an answer.
 *
 * ⚠ Pass `[]` only when the garment's objects were never registered — and that
 * is a defect rather than a clean state, because a picture written before its
 * row with no manifest is an orphan if the request dies in between. **No
 * caller passes `[]` today**: `garments.upload` was the last one, and since
 * #2021 its photograph goes through `putWardrobeScratchUpload` and the receipt
 * comes here.
 */
export async function createGarment(
  data: InsertWardrobeGarment,
  adoptedReceipts: readonly string[],
) {
  if (adoptedReceipts.length === 0) {
    const db = (await getDb())!;
    const [result] = await db.insert(wardrobeGarments).values(data).$returningId();
    return result.id;
  }
  const receipts = Array.from(new Set(adoptedReceipts));
  if (receipts.length !== adoptedReceipts.length) {
    throw new GarmentPictureReceiptError("a garment's receipts must each name one object");
  }
  return withTransaction(async (tx) => {
    /*
      THE RECEIPTS ARE RELEASED IN THE SAME TRANSACTION AS THE ROW, and never
      before it — the keeper-receipt pattern. Until this commits, a crash leaves
      undischarged manifests and the worker collects the copies, which is
      correct: no row references them.

      Each delete is scoped to the OWNER and to an UNDISCHARGED batch, and a
      count of anything but one throws. A discharge that silently affected zero
      rows would leave exactly the state this fixes while reporting success.
    */
    for (const batchId of receipts) {
      if (!await releaseWardrobeReceiptIn(tx, { cleanupBatchId: batchId, userId: data.userId })) {
        throw new GarmentPictureReceiptError("no undischarged manifest for this garment's picture");
      }
    }
    const [result] = await tx.insert(wardrobeGarments).values(data).$returningId();
    return result.id;
  });
}

export async function getGarmentById(garmentId: number) {
  const db = (await getDb())!;
  const [garment] = await db
    .select()
    .from(wardrobeGarments)
    .where(eq(wardrobeGarments.id, garmentId))
    .limit(1);
  return garment || null;
}
/**
 * How many garment ids one `IN (…)` read carries (#2000).
 *
 * It bounds the length of ONE list and nothing else — the chunks run one
 * after another, so a request holds a single pool slot for this read whatever
 * the caller sent.
 */
export const GARMENT_BATCH_CHUNK = 200;

/**
 * THIS ACCOUNT'S GARMENTS, BY ID, IN ONE READ PER CHUNK (#2000).
 *
 * The four try-on roads in `server/routes/wardrobe.ts` each used to call
 * {@link getGarmentById} once per id inside a `Promise.all` over an input
 * array with no `.max()` on it. That is one pool slot per garment, fired at
 * once, onto the shared pool `server/db/connection.ts` configures at 20
 * connections + 50 queued — the 71st concurrent query is refused with
 * `Queue limit reached.`, so a request naming more than about seventy
 * garments failed outright. #1989 is the same shape in the data export, and
 * #2000's three already-landed siblings are the same shape again.
 *
 * ⚠ **THE OWNER IS IN THE STATEMENT, NOT CHECKED AFTER IT (invariant 1).**
 * Every call site read the row and then compared `userId` in TypeScript. This
 * takes the owner as an argument and puts it in the `WHERE` beside the ids, so
 * another account's garment is not read at all rather than read and
 * discarded. The callers' refusal is unchanged — a garment that is not in the
 * returned map is "not found", which is what someone else's garment already
 * produced.
 *
 * Returns a Map so a caller can answer per id, in ITS OWN order, and say which
 * id was missing. The old fan-out rejected with whichever lookup lost the
 * race, so the id named in the error was not deterministic; now it is the
 * first missing id in the order the customer sent.
 */
export async function getOwnedGarmentsByIds(userId: number, garmentIds: number[]) {
  const db = (await getDb())!;
  const wanted = Array.from(new Set(garmentIds));
  const found = new Map<number, Awaited<ReturnType<typeof getGarmentById>>>();
  for (let at = 0; at < wanted.length; at += GARMENT_BATCH_CHUNK) {
    const chunk = wanted.slice(at, at + GARMENT_BATCH_CHUNK);
    const rows = await db
      .select()
      .from(wardrobeGarments)
      .where(and(eq(wardrobeGarments.userId, userId), inArray(wardrobeGarments.id, chunk)));
    for (const row of rows) found.set(row.id, row);
  }
  return found;
}

export async function getUserGarments(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeGarments)
    .where(eq(wardrobeGarments.userId, userId))
    .orderBy(desc(wardrobeGarments.createdAt));
}

export async function getUserGarmentsBySlot(userId: number, slotType: string) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeGarments)
    .where(
      and(
        eq(wardrobeGarments.userId, userId),
        eq(wardrobeGarments.slotType, slotType as any),
      ),
    )
    .orderBy(desc(wardrobeGarments.createdAt));
}

/**
 * Update a garment, discharging the receipts for any object the update makes
 * it own (#2095).
 *
 * The digitize road writes a flat-lay to the public bucket, and
 * `garments.upload` / `garments.import` record it here as `isolatedImageUrl`.
 * It was written with no manifest, so when `analyzeGarmentMetadata` threw
 * after the upload the catch marked the garment failed and nothing ever named
 * the key again. The flat-lay is now registered before it is written
 * (`uploadGarmentFlatLay`) and its receipt comes here: the row records the key
 * (`isolatedImageKey`, which until now had no writer) and the manifest is
 * released in ONE transaction, so either the garment owns the flat-lay or the
 * worker collects it. The failure road passes `[]` and the manifest stands.
 *
 * ⚠ **`adoptedReceipts` IS REQUIRED** — `createGarment`'s rule and reason: a
 * caller must answer *does this update hand the garment bytes somebody
 * registered for deletion?* rather than inherit "no".
 *
 * ⚠ **THE OWNER IS IN THE WHERE (invariant 1).** It was the id alone. Every
 * caller holds an id it has just minted for this account, so nothing moves for
 * them — but the receipt is scoped to an owner, and a write keyed on id alone
 * is the shape invariant 1 forbids.
 *
 * A garment that is gone (deleted mid-pipeline) is not an error: nothing is
 * written and NO receipt is discharged, so the flat-lay is collected.
 */
export async function updateGarment(
  garmentId: number,
  userId: number,
  data: Partial<InsertWardrobeGarment>,
  adoptedReceipts: readonly string[],
): Promise<void> {
  const ownGarment = and(eq(wardrobeGarments.id, garmentId), eq(wardrobeGarments.userId, userId));
  if (adoptedReceipts.length === 0) {
    const db = (await getDb())!;
    await db.update(wardrobeGarments).set(data).where(ownGarment);
    return;
  }
  const receipts = Array.from(new Set(adoptedReceipts));
  if (receipts.length !== adoptedReceipts.length) {
    throw new GarmentPictureReceiptError("a garment's receipts must each name one object");
  }
  await withTransaction(async (tx) => {
    const [garment] = await tx
      .select({ id: wardrobeGarments.id })
      .from(wardrobeGarments)
      .where(ownGarment)
      .limit(1)
      .for("update");
    if (!garment) return;
    await tx.update(wardrobeGarments).set(data).where(ownGarment);
    for (const batchId of receipts) {
      if (!await releaseWardrobeReceiptIn(tx, { cleanupBatchId: batchId, userId })) {
        throw new GarmentPictureReceiptError("no undischarged manifest for this garment's flat-lay");
      }
    }
  });
}

export async function deleteGarment(garmentId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeGarments)
    .where(
      and(
        eq(wardrobeGarments.id, garmentId),
        eq(wardrobeGarments.userId, userId),
      ),
    );
}

// ── Outfits ────────────────────────────────────────────────────────────────

/**
 * Save an Outfit. Its thumbnail ADOPTS a session-less try-on picture still in
 * this account's scratch manifest, in the insert's own transaction (#2094 —
 * see `adoptOwnedScratchKeyIn`), and the row then carries the key in
 * `resultThumbKey`, which the erasure sweep reads as an explicit key. The key
 * is written only when it was adopted, which is to say proven this account's.
 */
export async function createOutfit(data: InsertWardrobeOutfit, currentPublicUrl: string) {
  return withTransaction(async (tx) => {
    const adoptedKey = await adoptOwnedScratchKeyIn(tx, {
      userId: data.userId,
      url: data.resultThumbUrl,
      currentPublicUrl,
    });
    const [result] = await tx.insert(wardrobeOutfits)
      .values(adoptedKey ? { ...data, resultThumbKey: adoptedKey } : data)
      .$returningId();
    return result.id;
  });
}

export async function getUserOutfits(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeOutfits)
    .where(eq(wardrobeOutfits.userId, userId))
    .orderBy(desc(wardrobeOutfits.createdAt));
}

export async function getOutfitById(outfitId: number) {
  const db = (await getDb())!;
  const [outfit] = await db
    .select()
    .from(wardrobeOutfits)
    .where(eq(wardrobeOutfits.id, outfitId))
    .limit(1);
  return outfit || null;
}

export async function deleteOutfit(outfitId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeOutfits)
    .where(
      and(
        eq(wardrobeOutfits.id, outfitId),
        eq(wardrobeOutfits.userId, userId),
      ),
    );
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(data: InsertWardrobeSession) {
  return withTransaction(async (tx) => {
    if (data.modelId != null) {
      await assertOwnedAvailableModelIn(tx, { modelId: data.modelId, userId: data.userId });
    }
    const [result] = await tx.insert(wardrobeSessions).values(data).$returningId();
    return result.id;
  });
}

export async function getSessionById(sessionId: number, userId: number) {
  const db = (await getDb())!;
  const [session] = await db
    .select()
    .from(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.id, sessionId),
        eq(wardrobeSessions.userId, userId),
      ),
    )
    .limit(1);
  return session || null;
}

export async function getUserSessions(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeSessions)
    .where(eq(wardrobeSessions.userId, userId))
    .orderBy(desc(wardrobeSessions.updatedAt));
}

export async function updateSession(
  sessionId: number,
  userId: number,
  data: Partial<InsertWardrobeSession>,
) {
  const db = (await getDb())!;
  await db
    .update(wardrobeSessions)
    .set(data)
    .where(
      and(
        eq(wardrobeSessions.id, sessionId),
        eq(wardrobeSessions.userId, userId),
      ),
    );
}

/**
 * A try-on result joins a session's history, and the session ADOPTS it (#1980).
 *
 * `vto.generate`, `vto.incremental` and `vto.refine` each read the session,
 * pushed the URL in TypeScript and wrote the whole array back — three
 * statements and no lock. Their result is now registered in a cleanup manifest
 * before its bytes exist (`uploadTryOnResult`), so the history write is also
 * where the manifest must be discharged, and the read-then-write had to close
 * first: two results landing at once would each read the same history, the
 * second write would drop the first URL, and BOTH manifests would be
 * discharged — one object named by nothing, which is the orphan this card
 * exists to end, now with a receipt saying it was kept.
 *
 * So the read takes the row `FOR UPDATE`, the push, the write and the
 * discharge happen in one transaction, and a discharge that does not remove
 * exactly one undischarged batch for this owner throws and rolls the history
 * back with it (`createGarment`'s rule, one table over). Until this commits, a
 * crash leaves the manifest standing and the worker collects the object, which
 * is correct: no row names it.
 *
 * Returns `false`, touching nothing, when the session is not this account's —
 * the result is then left to its manifest, exactly as the no-session road is.
 */
export async function appendSessionResult(input: {
  sessionId: number;
  userId: number;
  resultUrl: string;
  /** The manifest `uploadTryOnResult` registered for `resultUrl`. */
  cleanupBatchId: string;
  patch?: Omit<Partial<InsertWardrobeSession>, "history" | "historyIndex" | "userId" | "id">;
}): Promise<boolean> {
  return withTransaction(async (tx) => {
    const [session] = await tx
      .select({ id: wardrobeSessions.id, history: wardrobeSessions.history })
      .from(wardrobeSessions)
      .where(and(
        eq(wardrobeSessions.id, input.sessionId),
        eq(wardrobeSessions.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!session) return false;

    const history = [...((session.history as string[] | null) ?? []), input.resultUrl];
    await tx
      .update(wardrobeSessions)
      .set({ ...input.patch, history, historyIndex: history.length - 1 })
      .where(and(
        eq(wardrobeSessions.id, input.sessionId),
        eq(wardrobeSessions.userId, input.userId),
      ));

    if (!await releaseWardrobeReceiptIn(tx, { cleanupBatchId: input.cleanupBatchId, userId: input.userId })) {
      throw new GarmentPictureReceiptError("no undischarged manifest for this try-on result");
    }
    return true;
  });
}

export async function deleteSession(sessionId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.id, sessionId),
        eq(wardrobeSessions.userId, userId),
      ),
    );
}

/**
 * Get the user's most recent active session across all tools.
 * Currently queries wardrobe_sessions; future tools (scenery, editorial)
 * can be added as additional queries in a union pattern.
 *
 * Returns null if no session with at least 1 VTO result exists.
 */
export async function getLatestUserSession(userId: number) {
  const sessions = await getRecentUserSessions(userId, 1);
  return sessions[0] ?? null;
}

const MAX_SESSIONS_PER_USER = 4;

/**
 * Get the user's N most recent sessions that have at least 1 VTO result.
 * Enriches each session with model name/masterPrompt if linked to a cast model.
 */
export async function getRecentUserSessions(userId: number, limit = MAX_SESSIONS_PER_USER) {
  const db = (await getDb())!;

  // Fetch more rows than needed so we can deduplicate by modelId and still
  // return up to `limit` unique models. Sessions with null modelId (uploaded
  // models) are each treated as unique.
  const rawRows = await db
    .select()
    .from(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.userId, userId),
        isNotNull(wardrobeSessions.history),
      ),
    )
    .orderBy(desc(wardrobeSessions.updatedAt))
    .limit(limit * 3);

  // Deduplicate: keep only the latest session per modelId.
  // Sessions with null modelId (uploaded models) pass through individually.
  const seenModelIds = new Set<number>();
  const rows = rawRows.filter((row) => {
    if (row.modelId == null) return true; // uploaded model — always keep
    if (seenModelIds.has(row.modelId)) return false;
    seenModelIds.add(row.modelId);
    return true;
  }).slice(0, limit);

  // Batch-fetch model names + STATUS for sessions linked to cast models.
  // Status rides the payload (Batch B) so resume derives draft/minted/
  // unavailable from status truth instead of assuming every linked model is
  // minted; a missing row (hard-deleted draft) leaves modelStatus null.
  const modelIds = Array.from(new Set(rows.map((r) => r.modelId).filter(Boolean))) as number[];
  const modelMap = new Map<number, { name: string | null; masterPrompt: string | null; status: string }>();
  if (modelIds.length > 0) {
    const modelRows = await db
      .select({ id: models.id, name: models.name, masterPrompt: models.masterPrompt, status: models.status })
      .from(models)
      .where(sql`${models.id} IN (${sql.join(modelIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const m of modelRows) {
      modelMap.set(m.id, { name: m.name, masterPrompt: m.masterPrompt, status: m.status });
    }
  }

  // Batch-fetch saved look counts per modelId from wardrobe_looks
  const lookCountMap = new Map<number, number>();
  if (modelIds.length > 0) {
    const lookRows = await db
      .select({
        modelId: wardrobeLooks.modelId,
        count: sql<number>`COUNT(*)`,
      })
      .from(wardrobeLooks)
      .where(sql`${wardrobeLooks.modelId} IN (${sql.join(modelIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(wardrobeLooks.modelId);
    for (const r of lookRows) {
      if (r.modelId) lookCountMap.set(r.modelId, Number(r.count));
    }
  }

  return rows
    .map((session) => {
      const history = (session.history as string[]) || [];
      if (history.length === 0) return null;
      const model = session.modelId ? modelMap.get(session.modelId) : null;
      return {
        tool: "wardrobe" as const,
        sessionId: session.id,
        modelId: session.modelId,
        modelName: model?.name ?? null,
        modelStatus: model?.status ?? null,
        masterPrompt: model?.masterPrompt ?? null,
        modelImageUrl: session.modelImageUrl,
        lastResultUrl: history[history.length - 1],
        iterationCount: history.length,
        savedLookCount: session.modelId ? (lookCountMap.get(session.modelId) ?? 0) : 0,
        activeGarmentIds: (session.activeGarmentIds as number[]) || [],
        history,
        historyIndex: session.historyIndex ?? history.length - 1,
        updatedAt: session.updatedAt,
        tattooMapData: session.tattooMapData ?? null,
        styleNotes: (session.styleNotes as Record<string, string>) ?? null,
      };
    })
    .filter(Boolean) as Array<NonNullable<ReturnType<typeof formatSession>>>;
}

/** Placeholder for type inference — not called directly */
function formatSession() {
  return null as null | {
    tool: "wardrobe";
    sessionId: number;
    modelId: number | null;
    modelName: string | null;
    modelStatus: string | null;
    masterPrompt: string | null;
    modelImageUrl: string;
    lastResultUrl: string;
    iterationCount: number;
    savedLookCount: number;
    activeGarmentIds: number[];
    history: string[];
    historyIndex: number;
    updatedAt: Date;
    tattooMapData: unknown;
    styleNotes: Record<string, string> | null;
  };
}

// ── Looks (curated VTO results) ───────────────────────────────────────

/**
 * Save a Look. Its picture ADOPTS a session-less try-on result still in this
 * account's scratch manifest, in the insert's own transaction (#2094 — see
 * `adoptOwnedScratchKeyIn`); a Look saved from such a picture used to point at
 * nothing once the scratch hold ran out. A refusal above the adoption leaves
 * the manifest untouched, and a failed insert rolls the adoption back.
 */
export async function saveLook(data: InsertWardrobeLook, currentPublicUrl: string) {
  return withTransaction(async (tx) => {
    await assertOwnedAvailableModelIn(tx, { modelId: data.modelId, userId: data.userId });
    if (data.sessionId != null) {
      const [session] = await tx
        .select({ id: wardrobeSessions.id })
        .from(wardrobeSessions)
        .where(and(
          eq(wardrobeSessions.id, data.sessionId),
          eq(wardrobeSessions.userId, data.userId),
          eq(wardrobeSessions.modelId, data.modelId),
        ))
        .limit(1)
        .for("update");
      if (!session) throw new Error("Wardrobe session does not belong to this model");
    }
    await adoptOwnedScratchKeyIn(tx, { userId: data.userId, url: data.imageUrl, currentPublicUrl });
    const [result] = await tx.insert(wardrobeLooks).values(data).$returningId();
    return result.id;
  });
}

export async function getUserLooksByModel(userId: number, modelId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeLooks)
    .where(
      and(
        eq(wardrobeLooks.userId, userId),
        eq(wardrobeLooks.modelId, modelId),
      ),
    )
    .orderBy(desc(wardrobeLooks.createdAt));
}

export async function getUserLooks(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeLooks)
    .where(eq(wardrobeLooks.userId, userId))
    .orderBy(desc(wardrobeLooks.createdAt));
}

export async function renameLook(lookId: number, userId: number, name: string) {
  const db = (await getDb())!;
  await db
    .update(wardrobeLooks)
    .set({ name })
    .where(
      and(
        eq(wardrobeLooks.id, lookId),
        eq(wardrobeLooks.userId, userId),
      ),
    );
}

export async function deleteLook(lookId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeLooks)
    .where(
      and(
        eq(wardrobeLooks.id, lookId),
        eq(wardrobeLooks.userId, userId),
      ),
    );
}

/**
 * Cap sessions per user — delete oldest sessions beyond the limit.
 * Called after creating a new session to enforce the cap.
 */
export async function capUserSessions(userId: number) {
  const db = (await getDb())!;
  const allSessions = await db
    .select({ id: wardrobeSessions.id })
    .from(wardrobeSessions)
    .where(eq(wardrobeSessions.userId, userId))
    .orderBy(desc(wardrobeSessions.updatedAt));

  if (allSessions.length <= MAX_SESSIONS_PER_USER) return;

  const idsToDelete = allSessions.slice(MAX_SESSIONS_PER_USER).map((s) => s.id);
  for (const id of idsToDelete) {
    await db.delete(wardrobeSessions).where(eq(wardrobeSessions.id, id));
  }
}
