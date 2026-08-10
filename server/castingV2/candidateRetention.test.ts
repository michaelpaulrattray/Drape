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
  listSegments: vi.fn(),
  deleteSegments: vi.fn(),
  listReferences: vi.fn(),
  deleteReferences: vi.fn(),
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

/*
  Segments purge with their candidate, in the SAME transaction and onto the
  SAME manifest — the founder's condition on the store, held from its first
  migration. Mocked here so the sweep's own orchestration can be driven; the
  statements themselves are proved against real MySQL in
  `server/castingV2-segment-store-db.test.ts`.
*/
vi.mock("../db/castingV2Segments", () => ({
  listPurgeableSegmentsIn: (_tx: unknown, ...args: unknown[]) => calls.listSegments(...args),
  deleteSegmentRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteSegments(...args),
}));

/* The reference library purges on exactly the same terms (migration 0028): same
   transaction, same manifest, unconditional. Same reason for the mock, too —
   the statements are proved against real MySQL in
   `server/castingV2-reference-library-db.test.ts`. */
vi.mock("../db/castingV2ReferenceLibrary", () => ({
  listPurgeableReferencesIn: (_tx: unknown, ...args: unknown[]) => calls.listReferences(...args),
  deleteReferenceRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteReferences(...args),
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
  calls.listSegments.mockResolvedValue([]);
  calls.deleteSegments.mockResolvedValue(0);
  calls.listReferences.mockResolvedValue([]);
  calls.deleteReferences.mockResolvedValue(0);
  delete process.env.CASTING_SEGMENTS_SCOPE;
  delete process.env.CASTING_REFERENCE_LIBRARY_SCOPE;
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

describe("a candidate's segments purge with it", () => {
  beforeEach(() => {
    calls.listPurgeableCandidates.mockResolvedValue([
      { id: 1, userId: 7, imageKey: "casting-v2/candidates/a.png", thumbKey: null },
    ]);
    calls.deleteCandidates.mockResolvedValue(1);
  });

  it("carries the mask AND the crop onto the candidate's own manifest", async () => {
    calls.listSegments.mockResolvedValue([
      { id: 5, maskKey: "segments/a-mask.png", contentKey: "segments/a-content.png" },
    ]);

    const result = await runCandidateRetentionSweep();

    const [manifest] = calls.queueStorageCleanup.mock.calls.at(-1) as [
      { kind: string; storageItems: Array<{ storageKey: string }> },
    ];
    /*
      ONE manifest, not two. A segment holds a crop of a person's face at a
      public URL, and a second retention path is how those outlive the sheet
      that promised to destroy them — so the assertion is deliberately about
      WHICH batch they are on, not merely that they were queued.
    */
    expect(manifest.kind).toBe("casting_candidate_cleanup");
    expect(manifest.storageItems.map((item) => item.storageKey)).toEqual([
      "casting-v2/candidates/a.png",
      "segments/a-mask.png",
      "segments/a-content.png",
    ]);
    expect(calls.deleteSegments).toHaveBeenCalledWith([1]);
    expect(result.objectsQueued).toBe(3);
  });

  it("purges segments whatever the segment flag says — the flag governs writing, never purging", async () => {
    /*
      The failure this pins is silent and permanent. Turn the store off after
      rows exist and a per-user or per-flag purge would strand them: the
      candidate row goes, and the only record of those objects goes with it.
      Nothing may gate the collection of bytes that already exist.
    */
    process.env.CASTING_SEGMENTS_SCOPE = "off";
    calls.listSegments.mockResolvedValue([
      { id: 5, maskKey: "segments/orphan-mask.png", contentKey: "segments/orphan-content.png" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteSegments).toHaveBeenCalledWith([1]);
    expect(result.objectsQueued).toBe(3);
  });

  it("tolerates a database whose segment table does not exist yet — but only while disarmed", async () => {
    // Production gets the table by ceremony; the code that knows about it
    // deploys on its own schedule. In that window there is nothing to purge.
    const missing = Object.assign(new Error("Table 'x.casting_segments' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    calls.listSegments.mockRejectedValue(missing);

    const result = await runCandidateRetentionSweep();

    // The candidate still purges — the sweep is not taken down by the absence.
    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteSegments).not.toHaveBeenCalled();
  });

  it("recognises the absence THROUGH the query wrapper, which is the only shape production sends", async () => {
    /*
      THE DEFECT THIS PINS, found by reading production's own log two minutes
      after the deploy that introduced it.

      The first version read `code` off the top-level error. Drizzle wraps the
      driver's error in a `DrizzleQueryError` and hangs the original off
      `cause`, so the tolerance never fired: the sweep threw, and 56 candidates
      went uncollected on its first pass. The test passed throughout, because it
      had invented the error it expected — a test of its own invention.
    */
    const driver = Object.assign(new Error("Table 'railway.casting_segments' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    const wrapped = Object.assign(new Error("Failed query: select `id` from `casting_segments`"), {
      name: "DrizzleQueryError",
      cause: driver,
    });
    calls.listSegments.mockRejectedValue(wrapped);

    const result = await runCandidateRetentionSweep();

    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteSegments).not.toHaveBeenCalled();
  });

  it("still refuses a wrapped absence once the store is armed", async () => {
    process.env.CASTING_SEGMENTS_SCOPE = "users:1";
    calls.listSegments.mockRejectedValue(Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("no such table"), { code: "ER_NO_SUCH_TABLE", errno: 1146 }),
    }));

    await expect(runCandidateRetentionSweep()).rejects.toThrow(/Failed query/);
  });

  it("does not mistake an unrelated wrapped failure for an absent table", async () => {
    // The chain walk must not become "anything with a cause is forgiven".
    calls.listSegments.mockRejectedValue(Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("Deadlock found"), { code: "ER_LOCK_DEADLOCK", errno: 1213 }),
    }));

    await expect(runCandidateRetentionSweep()).rejects.toThrow(/Failed query/);
  });

  it("refuses to tolerate the missing table once the store is armed", async () => {
    process.env.CASTING_SEGMENTS_SCOPE = "users:1";
    calls.listSegments.mockRejectedValue(Object.assign(new Error("no such table"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    }));

    // Armed and missing is a real fault, and a warning would bury it.
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/no such table/);
  });

  it("purges the reference library whatever ITS flag says, and takes the words-only rows too", async () => {
    /*
      The same silent, permanent failure as the segment case one flight up, and
      it arrives by a second door: a library crop is a crop of a person's face
      at a permanently public URL.

      The words-only row is the extra trap here. A surface slot stores a word
      stack and no object at all, so a list filtered to rows-with-keys would come
      back empty and the delete would be skipped — the row surviving its own
      candidate while every count read zero. The fixture holds one of each, and
      the assertion is that the delete ran with only ONE key queued.
    */
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "off";
    calls.listReferences.mockResolvedValue([
      {
        id: 9,
        storageKey: "casting-v2/library/orphan-crop.png",
        maskKey: "casting-v2/library/orphan-mask.png",
      },
      { id: 10, storageKey: null, maskKey: null },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteReferences).toHaveBeenCalledWith([1]);
    /* The candidate's own object plus the crop AND its mask — and nothing for
       the words-only row, which has no object to queue and is deleted anyway. */
    expect(result.objectsQueued).toBe(3);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(expect.objectContaining({
      storageItems: expect.arrayContaining([
        { storageKey: "casting-v2/library/orphan-crop.png", storageBackend: "public_r2" },
      ]),
    }));
  });

  it("tolerates an absent library table only while the library is disarmed", async () => {
    const missing = Object.assign(new Error("Table 'x.casting_reference_library' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    calls.listReferences.mockRejectedValue(missing);

    const result = await runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteReferences).not.toHaveBeenCalled();

    /* Armed and missing is a real fault, and a warning would bury it. */
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "users:1";
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/doesn't exist/);
  });

  it("rethrows every other database failure, armed or not", async () => {
    calls.listSegments.mockRejectedValue(Object.assign(new Error("Deadlock found"), {
      code: "ER_LOCK_DEADLOCK",
      errno: 1213,
    }));

    // Swallowing this one would turn a purge into a claim.
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/Deadlock/);
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
