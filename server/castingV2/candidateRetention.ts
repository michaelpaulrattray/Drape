/**
 * Candidate retention sweep (plan §G.6).
 *
 * The founder's ruling is aggressive cleanup — "nothing unused outlives its
 * sheet" — with two deliberate survivors: a signed candidate (it is Cast
 * lineage) and the kept siblings of a signed candidate (the Siblings card
 * needs them while that Cast lives).
 *
 * This sweep never deletes an object itself. It hands exact keys to the
 * existing storage-cleanup worker and deletes the rows once they are handed
 * over, so there is exactly one thing in this system that talks to R2 about
 * deletion, and it is the thing that was audited for it.
 *
 * A retention sweep is not a user operation, so each batch mints a synthetic
 * UUID for its `operationId` — the column is NOT NULL, unique and
 * UUID-validated, and inventing a fake user operation id would poison the
 * receipt space (§G.6).
 */
import { randomUUID } from "node:crypto";

import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import type { PurgeableCandidate } from "../db/castingV2";
import {
  deleteCandidateRowsIn,
  expireSessionCandidates,
  listExpiredSessions,
  listPurgeableCandidates,
  markSessionExpired,
} from "../db/castingV2";
import { createModuleLogger } from "../logging/logger";
import { captureCastingV2Enabled, parseCastingV2Scope, CASTING_V2_SCOPE_ENV } from "./castingV2Scope";

const log = createModuleLogger("castingV2/candidateRetention");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 90 * 1000;

export type RetentionSweepResult = {
  sessionsExpired: number;
  candidatesPurged: number;
  objectsQueued: number;
};

/**
 * One pass. Expire idle sessions first, then purge everything the expiry (and
 * ordinary discarding) has made unreachable — so a session that expires in
 * this pass has its candidates collected in the same pass rather than an hour
 * later.
 */
export async function runCandidateRetentionSweep(now = new Date()): Promise<RetentionSweepResult> {
  let sessionsExpired = 0;
  for (const session of await listExpiredSessions({ now })) {
    // Candidates first: once the session row flips to `expired` it is no
    // longer selected, and a crash between the two statements would otherwise
    // strand its candidates outside every sweep's reach.
    await expireSessionCandidates({ sessionId: session.id, userId: session.userId });
    if (await markSessionExpired(session.id)) sessionsExpired += 1;
  }

  const purgeable = await listPurgeableCandidates({ now });
  if (purgeable.length === 0) {
    return { sessionsExpired, candidatesPurged: 0, objectsQueued: 0 };
  }

  // One batch per user: the manifest carries a userId, and the cleanup
  // worker's own guards are owner-scoped.
  const byUser = new Map<number, PurgeableCandidate[]>();
  for (const candidate of purgeable) {
    const bucket = byUser.get(candidate.userId) ?? [];
    bucket.push(candidate);
    byUser.set(candidate.userId, bucket);
  }

  let candidatesPurged = 0;
  let objectsQueued = 0;

  for (const [userId, candidates] of Array.from(byUser.entries())) {
    const storageItems = candidates.flatMap((candidate) =>
      [candidate.imageKey, candidate.thumbKey]
        .filter((key): key is string => Boolean(key))
        .map((storageKey) => ({ storageKey, storageBackend: "public_r2" as const })),
    );

    await withTransaction(async (tx) => {
      if (storageItems.length > 0) {
        await createStorageCleanupManifestIn(tx, {
          userId,
          operationId: randomUUID(),
          kind: "casting_candidate_cleanup",
          storageItems,
        });
      }
      // Rows go only after their objects are handed over, and the delete is
      // itself owner-scoped and refuses signed or kept rows — belt and braces
      // against a selection bug ever reaching a protected candidate.
      const deleted = await deleteCandidateRowsIn(tx, {
        userId,
        candidateIds: candidates.map((candidate) => candidate.id),
      });
      candidatesPurged += deleted;
      objectsQueued += storageItems.length;
    });
  }

  if (candidatesPurged > 0) {
    log.info(
      { sessionsExpired, candidatesPurged, objectsQueued },
      "[candidateRetention] swept expired casting candidates",
    );
  }
  return { sessionsExpired, candidatesPurged, objectsQueued };
}

/**
 * Starts the hourly sweep, and only when Casting V2 is actually on.
 *
 * There is nothing to retain while the flag is off — no roll can have been
 * created — so an always-on timer would be a query loop against empty tables.
 * It reads the scope rather than a boolean so an operator sees the same
 * switch here as everywhere else.
 */
export function startCandidateRetentionSweep(): void {
  const scope = parseCastingV2Scope(process.env[CASTING_V2_SCOPE_ENV]);
  if (scope.kind === "off") return;

  const run = () => {
    runCandidateRetentionSweep().catch((error) => {
      log.error({ err: error }, "[candidateRetention] sweep failed");
    });
  };
  setTimeout(run, FIRST_SWEEP_DELAY_MS).unref?.();
  setInterval(run, SWEEP_INTERVAL_MS).unref?.();
}

/** Exposed for the boot wiring's readability; the scope is the real switch. */
export function retentionSweepEnabledForUser(userId: number): boolean {
  return captureCastingV2Enabled(userId);
}
