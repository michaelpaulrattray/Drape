/**
 * THE REFERENCE CROP STORE'S DATABASE HALF — migration 0040, ruled fable-1015
 * §3.
 *
 * **Only the retention half exists today, and that is deliberate.** The table
 * lands ahead of its writer (a new table is in every INSERT the moment a writer
 * ships, and there is no dark landing for one), but the purge is not something
 * that gets added when the writer arrives. `candidateRetention.ts` is
 * ROW-DRIVEN — it builds its purge list by enumerating rows and collecting
 * their storage keys — so a store whose rows nothing sweeps is a store whose
 * objects nothing deletes.
 *
 * The founder-queue's §1a defect is exactly that shape (`captureRefusedRender`
 * writing frames of a person's face that no manifest, batch or sweep ever
 * names), and it was found by reading the function rather than the design note.
 * So the sweep is written FIRST here, before there is anything to sweep, and it
 * is proven against an empty table rather than promised.
 */
import { inArray } from "drizzle-orm";

import { castingReferenceCrops } from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";

/* Local, like every other store in this directory — the mysql2 header shape is
   the driver's, and a shared helper for three lines would be a module whose
   only job is to be imported. */
function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/**
 * Every crop object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a crop attached between the read and the delete cannot slip
 * through and outlive the Cast it was cut for.
 */
export async function listPurgeableReferenceCropsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({ id: castingReferenceCrops.id, storageKey: castingReferenceCrops.storageKey })
    .from(castingReferenceCrops)
    .where(inArray(castingReferenceCrops.candidateId, [...candidateIds]));
}

export async function deleteReferenceCropRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingReferenceCrops)
    .where(inArray(castingReferenceCrops.candidateId, [...candidateIds]));
  return affectedRows(result);
}
