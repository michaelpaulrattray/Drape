/**
 * Generations Domain — generation record CRUD and history queries.
 */

import { eq, desc } from "drizzle-orm";
import { generations, InsertGeneration } from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
import { assertClientRequestId } from "../../shared/clientRequestId";
const log = createModuleLogger("db/generations");

export function assertGenerationAttemptLink(data: Pick<
  InsertGeneration,
  "operationId" | "stepKey" | "viewAngle"
>): void {
  const operationId = data.operationId ?? null;
  const stepKey = data.stepKey ?? null;
  const viewAngle = data.viewAngle ?? null;
  if (operationId === null) {
    if (stepKey !== null || viewAngle !== null) {
      throw new TypeError("Generation attempt metadata requires an operation id");
    }
    return;
  }
  assertClientRequestId(operationId);
  if (typeof stepKey !== "string" || !/^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(stepKey)) {
    throw new TypeError("Generation attempt requires a valid step key");
  }
  if (
    viewAngle !== null &&
    (typeof viewAngle !== "string" || !/^[a-z][a-zA-Z0-9_-]{0,31}$/.test(viewAngle))
  ) {
    throw new TypeError("Generation attempt has an invalid view angle");
  }
}

export async function createGeneration(
  data: InsertGeneration
): Promise<{ success: boolean; generationId?: number; error?: string }> {
  assertGenerationAttemptLink(data);
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // $returningId, never newest-by-createdAt: concurrent inserts (the mint
    // package runs slots in parallel) land in the same second, and a
    // newest-row lookup hands every caller the same id — their completion
    // writes then all hit one row while the rest stay "processing" forever
    // (the silent-audit-gap class, caught at VC-R3b on a Production mint).
    const [inserted] = await db.insert(generations).values(data).$returningId();

    // Check if this is the user's first generation — trigger REFEREE credit (welcome bonus)
    // Referrer credit is awarded separately on first paid subscription (Stripe webhook)
    const allGens = await db
      .select({ id: generations.id })
      .from(generations)
      .where(eq(generations.userId, data.userId))
      .limit(2);
    if (allGens.length === 1) {
      // First generation ever — award referee welcome bonus (async, non-blocking)
      import("./referrals").then(({ completeReferral }) => {
        completeReferral(data.userId).catch(() => {});
      }).catch(() => {});
    }

    return { success: true, generationId: inserted.id };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create generation:");
    return { success: false, error: "Failed to create generation" };
  }
}

export async function updateGeneration(
  generationId: number,
  data: Partial<
    Pick<
      InsertGeneration,
      "status" | "resultUrl" | "errorMessage" | "completedAt" | "metadata"
    >
  >
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db
      .update(generations)
      .set(data)
      .where(eq(generations.id, generationId));
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update generation:");
    return { success: false, error: "Failed to update generation" };
  }
}

export async function getUserGenerations(
  userId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

export async function getGenerationById(generationId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
