import { readFile } from "node:fs/promises";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The 7-day sweep.
 *
 * Written because the founder asked the right question: an inert sweep would
 * mean unsigned sheets never actually die, and the product would be quietly
 * promising a retention it does not perform. The sweep turned out to be wired
 * and running — but with no test at all, so its behaviour at real expiry was
 * unproven. Production has never exercised it, because nothing there is seven
 * days old yet.
 *
 * These cover the orchestration: what it selects, what it spares, and that a
 * failure on one session does not abandon the rest.
 */

const calls = {
  listExpiredSessions: vi.fn(),
  markSessionExpired: vi.fn(),
  expireSessionCandidates: vi.fn(),
  listPurgeableCandidates: vi.fn(),
  deleteCandidates: vi.fn(),
  queueStorageCleanup: vi.fn(),
};

vi.mock("../db/castingV2", () => ({
  listExpiredSessions: (...args: unknown[]) => calls.listExpiredSessions(...args),
  markSessionExpired: (...args: unknown[]) => calls.markSessionExpired(...args),
  expireSessionCandidates: (...args: unknown[]) => calls.expireSessionCandidates(...args),
  listPurgeableCandidates: (...args: unknown[]) => calls.listPurgeableCandidates(...args),
  deleteCandidateRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteCandidates(...args),
}));

// The purge runs inside a transaction; the handle is only passed through.
vi.mock("../db/connection", () => ({
  withTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));

/*
  The variant purge runs inside the SAME transaction as the candidate delete
  (D-122), so the sweep's own tests have to know about it. Stubbed to "this
  candidate had no refinements", which is every case this file was written for
  — the variant-specific behaviour is proved in `castingV2Variants`'s own
  statements, not by re-mocking the whole table here.
*/
vi.mock("../db/castingV2Variants", () => ({
  listPurgeableVariantsIn: vi.fn(async () => []),
  deleteVariantRowsIn: vi.fn(async () => 0),
}));

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: (_tx: unknown, ...args: unknown[]) =>
    calls.queueStorageCleanup(...args),
}));

const { runCandidateRetentionSweep } = await import("./candidateRetention");

beforeEach(() => {
  vi.clearAllMocks();
  calls.listExpiredSessions.mockResolvedValue([]);
  calls.markSessionExpired.mockResolvedValue(true);
  calls.expireSessionCandidates.mockResolvedValue(0);
  calls.listPurgeableCandidates.mockResolvedValue([]);
  calls.deleteCandidates.mockResolvedValue(0);
  calls.queueStorageCleanup.mockResolvedValue(undefined);
});

describe("the 7-day retention sweep", () => {
  it("does nothing, loudly or quietly, when nothing has expired", async () => {
    const result = await runCandidateRetentionSweep();
    expect(result.sessionsExpired).toBe(0);
    expect(result.candidatesPurged).toBe(0);
    // The silence in production logs is this branch, not an inert timer.
    expect(calls.markSessionExpired).not.toHaveBeenCalled();
  });

  it("expires a session past its idle window and expires its candidates", async () => {
    calls.listExpiredSessions.mockResolvedValue([{ id: 11, userId: 7 }]);
    calls.expireSessionCandidates.mockResolvedValue(6);

    const result = await runCandidateRetentionSweep();

    expect(calls.markSessionExpired).toHaveBeenCalledWith(11);
    expect(calls.expireSessionCandidates).toHaveBeenCalledWith({ sessionId: 11, userId: 7 });
    expect(result.sessionsExpired).toBe(1);
  });

  it("expires candidates BEFORE flipping the session, and counts only a won CAS", async () => {
    calls.listExpiredSessions.mockResolvedValue([{ id: 11, userId: 7 }]);
    // Someone else moved it out of `open` between the select and the update.
    calls.markSessionExpired.mockResolvedValue(false);

    const result = await runCandidateRetentionSweep();

    /*
      The candidate expiry still runs, and that ordering is deliberate: once
      the session row leaves `open` it is no longer selected by any future
      sweep, so a crash between the two statements would strand its candidates
      outside every pass forever. Doing the reversible half first is what makes
      the sweep safe to interrupt.
    */
    expect(calls.expireSessionCandidates).toHaveBeenCalledWith({ sessionId: 11, userId: 7 });
    // But a lost CAS is not a session this pass expired.
    expect(result.sessionsExpired).toBe(0);
  });

  it("queues every purgeable candidate's objects before deleting the rows", async () => {
    calls.listPurgeableCandidates.mockResolvedValue([
      { id: 1, userId: 7, imageKey: "casting-v2/candidates/a.png", thumbKey: null },
      { id: 2, userId: 7, imageKey: "casting-v2/candidates/b.png", thumbKey: "t/b.png" },
    ]);
    calls.deleteCandidates.mockResolvedValue(2);

    const result = await runCandidateRetentionSweep();

    expect(calls.queueStorageCleanup).toHaveBeenCalled();
    expect(result.candidatesPurged).toBe(2);
    /*
      Three objects across two candidates. Rows are deleted only after the
      objects are queued: a row deleted first is a key nobody can ever find
      again, and the cleanup worker only deletes keys a row handed it.
      */
    expect(result.objectsQueued).toBe(3);
  });
});

describe("abandoning a sheet releases it, rather than waiting for a sweep", () => {
  it("expires the candidates in the same transaction as the status change", async () => {
    /*
      THE BUG THIS CLOSES, and it is a leak rather than a loss.
      `abandonCastingSession` wrote `status = 'abandoned'` and stopped, while
      `listExpiredSessions` selected `open` past its expiry. A sheet the user
      deleted was therefore never swept: candidates stayed `ready`, the purge
      requires `expired`, and the objects stayed in the bucket forever. Both the
      db helper's and the route's doc comments claimed the downstream machinery
      ran. It never did — invariant 7, in the two places that promised it was
      fine.

      Asserted at the SOURCE rather than through the sweep, because widening the
      sweep is the fix that looks cheaper and is wrong: an abandoned sheet's
      `expiresAt` is whatever the last activity set, so the purge would be
      deferred up to seven days; and nothing transitions `abandoned`, so the
      sweep would re-select it every tick forever.
    */
    const source = await readFile(
      new URL("../db/castingV2.ts", import.meta.url),
      "utf8",
    );
    const abandon = source.slice(
      source.indexOf("export async function abandonCastingSession"),
      source.indexOf("export async function markSessionExpired"),
    );
    // One transaction: the CAS and the release together.
    expect(abandon).toContain("withTransaction");
    expect(abandon).toContain('eq(castingSessions.status, "open")');
    expect(abandon).toContain("expireSessionCandidatesIn(tx,");
    // The session row is locked, which is the serialization point the Sign
    // ceremony also takes — so a Sign cannot land mid-release.
    expect(abandon).toContain('.for("update")');
    // And the status stays distinct: it is the only record of WHICH happened.
    expect(abandon).toContain('set({ status: "abandoned" })');
    expect(abandon).not.toContain('set({ status: "expired" })');
  });

  it("shares one release body with the sweep, never a second copy", async () => {
    const source = await readFile(new URL("../db/castingV2.ts", import.meta.url), "utf8");
    // `expireSessionCandidates` is now a thin wrapper over the `In` variant, so
    // the §G.6 carve-outs cannot drift between the two callers.
    expect(source).toContain("return withTransaction((tx) => expireSessionCandidatesIn(tx, input));");
    expect(source.match(/expiredReason: "retention"/g) ?? []).toHaveLength(1);
  });
});
