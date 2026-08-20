/**
 * CLEAR THE PICTURES A DRIVE LEFT ON ONE CAST — object first, row second.
 *
 * The attach door has no customer-facing removal (see opus-870), so a driver
 * that attaches eight pictures fills the Cast and there is no product path to
 * empty it. This does what the retention sweep does, scoped to one candidate:
 * the objects go on a cleanup manifest and the rows go inside the same
 * transaction, so no row is deleted while its bytes are still nobody's.
 *
 * OWNER-SCOPED in the statement that reads (invariant 1) and confined to one
 * named candidate — a sweep that took a `userId` alone would be one typo from
 * emptying a Cast nobody asked about.
 *
 *   npx tsx scripts/clear-drive-attachments-disposable.mts <candidatePublicId>
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { castingCandidates } from "../drizzle/schema";
import { withTransaction } from "../server/db/connection";
import {
  deleteReferenceAttachmentRowsIn,
  listPurgeableReferenceAttachmentsIn,
} from "../server/db/castingV2ReferenceAttachments";
import { createStorageCleanupManifestIn } from "../server/db/storageCleanup";

const candidatePublicId = process.argv[2];
if (!candidatePublicId) {
  console.error("usage: clear-drive-attachments-disposable.mts <candidatePublicId>");
  process.exit(2);
}

const cleared = await withTransaction(async (tx) => {
  const [candidate] = await tx
    .select({ id: castingCandidates.id, userId: castingCandidates.userId })
    .from(castingCandidates)
    .where(eq(castingCandidates.publicId, candidatePublicId))
    .limit(1);
  if (!candidate) return null;

  const attachments = await listPurgeableReferenceAttachmentsIn(tx, [candidate.id]);
  if (attachments.length === 0) return { count: 0, userId: candidate.userId };

  await createStorageCleanupManifestIn(tx, {
    userId: candidate.userId,
    operationId: randomUUID(),
    kind: "casting_candidate_cleanup",
    storageItems: attachments.map((one) => ({
      storageKey: one.storageKey,
      storageBackend: "public_r2" as const,
    })),
  });
  const rows = await deleteReferenceAttachmentRowsIn(tx, [candidate.id]);
  return { count: rows, userId: candidate.userId };
});


console.log(cleared === null
  ? `no such candidate: ${candidatePublicId}`
  : `cleared ${cleared.count} attachment(s) from ${candidatePublicId} (user ${cleared.userId}) — objects queued for the cleanup worker`);
process.exit(0);
