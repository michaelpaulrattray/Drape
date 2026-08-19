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
  listScans: vi.fn(),
  deleteScans: vi.fn(),
  listInkDesigns: vi.fn(),
  deleteInkDesigns: vi.fn(),
  listInkPlates: vi.fn(),
  deleteInkPlates: vi.fn(),
  listReferenceCrops: vi.fn(),
  listReferenceAttachments: vi.fn(),
  deleteReferenceAttachments: vi.fn(),
  deleteReferenceCrops: vi.fn(),
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

/* And the kept face scan (migration 0032), on exactly those terms again: same
   transaction, same manifest, unconditional. Its statements are proved against
   real MySQL in `server/castingV2-face-scan-db.test.ts`. */
vi.mock("../db/castingV2FaceScans", () => ({
  listPurgeableFaceScansIn: (_tx: unknown, ...args: unknown[]) => calls.listScans(...args),
  deleteFaceScanRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteScans(...args),
}));

/* And an uploaded ink design (migration 0034), on exactly those terms: same
   transaction, same manifest, unconditional. A design is a picture a CUSTOMER
   supplied — the one artifact class here that was never ours — so it leaving
   with her Cast is the whole promise. Statements proved against real MySQL in
   `server/castingV2-ink-design-db.test.ts`. */
vi.mock("../db/castingV2InkDesigns", () => ({
  listPurgeableInkDesignsIn: (_tx: unknown, ...args: unknown[]) => calls.listInkDesigns(...args),
  deleteInkDesignRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteInkDesigns(...args),
}));

/* And the PLATE a design was drawn onto (migration 0037). A plate has no
   `candidateId` of its own, so the only path from a Cast to its plates runs
   through the design row — which makes the ORDER part of the contract and not
   an implementation detail. Asserted below. */
/*
  THE INGESTION MAP, mocked on ONE function only.

  `cropStoreArmed()` derives from the map rather than from an env var, so the
  armed arm cannot be reached by setting a variable — and an arm that cannot be
  reached is an arm that does not exist (the bench-skips-the-gate class). The
  default here is `importOriginal`, so every other test in this file runs
  against the REAL map and the disarmed arm proves today's actual state; only
  the armed test flips the switch, and it puts it back.
*/
const mapState = vi.hoisted(() => ({ cropOpen: null as boolean | null }));

vi.mock("../../shared/referenceIntents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/referenceIntents")>();
  return {
    ...actual,
    referenceIntentIsOpen: (key: Parameters<typeof actual.referenceIntentIsOpen>[0]) =>
      mapState.cropOpen !== null && actual.referenceIntentIngestionForm(key) === "crop"
        ? mapState.cropOpen
        : actual.referenceIntentIsOpen(key),
  };
});

/* The CUT taken from a customer's own reference (migration 0040). It has no
   flag of its own: the ingestion map decides whether a crop can exist, so the
   sweep's tolerance is armed by the map rather than by an env var. */
vi.mock("../db/castingV2ReferenceCrops", () => ({
  listPurgeableReferenceCropsIn: (_tx: unknown, ...args: unknown[]) => calls.listReferenceCrops(...args),
  deleteReferenceCropRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteReferenceCrops(...args),
}));

/* The PICTURE a customer attached (migration 0043). Its tolerance is armed by
   its OWN flag rather than by the ingestion map, because an attachment is not a
   form — any open intent can produce one, and what decides whether a row can
   exist is whether the attach door is open at all. */
vi.mock("../db/castingV2ReferenceAttachments", () => ({
  listPurgeableReferenceAttachmentsIn: (_tx: unknown, ...args: unknown[]) => calls.listReferenceAttachments(...args),
  deleteReferenceAttachmentRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteReferenceAttachments(...args),
}));

vi.mock("../db/castingV2InkPlates", () => ({
  listPurgeableInkPlatesIn: (_tx: unknown, ...args: unknown[]) => calls.listInkPlates(...args),
  deleteInkPlateRowsIn: (_tx: unknown, ...args: unknown[]) => calls.deleteInkPlates(...args),
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
  calls.listScans.mockResolvedValue([]);
  calls.deleteScans.mockResolvedValue(0);
  calls.listInkDesigns.mockResolvedValue([]);
  calls.deleteInkDesigns.mockResolvedValue(0);
  calls.listInkPlates.mockResolvedValue([]);
  calls.deleteInkPlates.mockResolvedValue(0);
  calls.listReferenceCrops.mockResolvedValue([]);
  calls.listReferenceAttachments.mockResolvedValue([]);
  calls.deleteReferenceAttachments.mockResolvedValue(0);
  calls.deleteReferenceCrops.mockResolvedValue(0);
  mapState.cropOpen = null;
  delete process.env.CASTING_SEGMENTS_SCOPE;
  delete process.env.CASTING_REFERENCE_LIBRARY_SCOPE;
  delete process.env.CASTING_SCAN_TABLE_SCOPE;
  delete process.env.CASTING_INK_STUDIO_SCOPE;
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

  /*
    THE REFERENCE CROP STORE (migration 0040, ruled fable-1015 §3, obligation 2).

    These exist BEFORE the writer does, deliberately. `candidateRetention.ts` is
    row-driven, so a store whose rows nothing sweeps is a store whose objects
    nothing deletes — and the objects here are cut-outs of a real person taken
    from a picture a customer supplied. The founder-queue's §1a defect
    (`captureRefusedRender` writing frames no manifest ever names) is that shape
    exactly, and it was written into the roadmap rather than into a test.
  */
  /*
    THE ATTACHED PICTURE (migration 0043, countersigned fable-1063 §2).

    Same argument as the crop above, one degree sharper. A crop is a CUT of one
    feature; an attachment is **the whole photograph a customer handed us,
    uncut**, sitting at a permanently public URL. If this clause is ever removed
    or its store renamed, the objects it stops naming are pictures of people
    that nothing will ever collect — and nothing would go red, because a purge
    that sweeps fewer rows still succeeds.

    Written before the door that writes them is open anywhere, for the reason
    the crop arm gives: a row-driven sweep that gains its clause after the
    writer ships was missing for however long the writer shipped first.
  */
  it("collects an attached picture's bytes and deletes its rows with the Cast", async () => {
    calls.listReferenceAttachments.mockResolvedValue([
      { id: 4, storageKey: "casting-v2/reference/she-uploaded-this.jpg" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteReferenceAttachments).toHaveBeenCalledWith([1]);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        storageItems: expect.arrayContaining([
          { storageKey: "casting-v2/reference/she-uploaded-this.jpg", storageBackend: "public_r2" },
        ]),
      }),
    );
    /* The candidate's own image, plus this picture. */
    expect(result.objectsQueued).toBe(1 + 1);
  });

  it("purges an attached picture whatever the ATTACH FLAG says — the flag governs writing, never purging", async () => {
    /*
      THE NEGATIVE CONTROL FOR THE FLAG, and it is the arm that matters most on
      this store. `CASTING_REFERENCE_ATTACH_SCOPE` is off everywhere today, so
      the whole clause runs in the disarmed state on every real sweep — if the
      purge were gated on the flag, a picture attached during a trial would
      outlive the Cast it was promised to leave with the moment the flag went
      back off. A retention path that narrows with a feature flag is how that
      happens, and it happens silently.
    */
    delete process.env.CASTING_REFERENCE_ATTACH_SCOPE;
    calls.listReferenceAttachments.mockResolvedValue([
      { id: 5, storageKey: "casting-v2/reference/attached-while-it-was-on.png" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteReferenceAttachments).toHaveBeenCalledWith([1]);
    expect(result.objectsQueued).toBe(1 + 1);
  });

  it("collects a reference crop's bytes and deletes its rows with the Cast", async () => {
    calls.listReferenceCrops.mockResolvedValue([
      { id: 9, storageKey: "reference-crops/her-hair.png" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteReferenceCrops).toHaveBeenCalledWith([1]);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        storageItems: expect.arrayContaining([
          { storageKey: "reference-crops/her-hair.png", storageBackend: "public_r2" },
        ]),
      }),
    );
    /* Two: the candidate's own image, plus this crop. Written as the sum rather
       than as a bare number so a future object added to the default fixture
       reads as an arithmetic change and not as a mystery. */
    expect(result.objectsQueued).toBe(1 + 1);
  });

  it("tolerates the crop table's absence while NO crop-form feature is open", async () => {
    /*
      Today's real state, run against the REAL map rather than a flipped one:
      hair and eye colour are both `open: false`, so no door can have written a
      row and an absent table is genuinely an empty set.
    */
    calls.listReferenceCrops.mockRejectedValue(Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("Table 'railway.casting_reference_crops' doesn't exist"), {
        code: "ER_NO_SUCH_TABLE",
        errno: 1146,
      }),
    }));

    const result = await runCandidateRetentionSweep();

    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteReferenceCrops).not.toHaveBeenCalled();
  });

  it("REFUSES the same absence once a crop-form feature is open", async () => {
    /*
      The arm that makes the tolerance a control rather than a permanent excuse.
      It cannot be reached by setting an env var — `cropStoreArmed()` derives
      from the ingestion map — so the map's `open` is what moves here, which is
      the same switch the founder's first-run gate flips for real.

      Without this arm the tolerance would swallow a missing table forever, and
      a customer's crops would be stranded silently the day the door opened.
    */
    mapState.cropOpen = true;
    /* The outer message names the SQL, the way drizzle's wrapper really does —
       so the assertion below is about the fault reaching the caller intact and
       not about a string this test invented. */
    calls.listReferenceCrops.mockRejectedValue(Object.assign(new Error("Failed query: select `id` from `casting_reference_crops`"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("Table 'railway.casting_reference_crops' doesn't exist"), {
        code: "ER_NO_SUCH_TABLE",
        errno: 1146,
      }),
    }));

    /* Armed and missing is a real fault, and a warning would bury it — the same
       expectation the segment store's armed arm carries one flight down. */
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/casting_reference_crops/);
    expect(calls.deleteCandidates).not.toHaveBeenCalled();
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

  it("purges the kept scans whatever ITS flag says, and takes their stencils", async () => {
    /*
      The founder gave the scan table a condition rather than a blessing: *"as
      long as it wont clog up storage eventually many users will be using
      this"*. This is that condition mechanised — and the flag is OFF here on
      purpose, because a purge that narrows with its own feature flag strands
      every row written while it was on.

      The second trap is the library case's, arrived at by a third door: a scan
      that found nothing still has a ROW and owns no objects, so a list filtered
      to rows-with-keys would come back empty, the delete would be skipped, and
      the row would outlive its cast while every count read zero.
    */
    process.env.CASTING_SCAN_TABLE_SCOPE = "off";
    calls.listScans.mockResolvedValue([
      { id: 3, maskKeys: ["casting-v2/scans/eye-left.png", "casting-v2/scans/hair.png"] },
      { id: 4, maskKeys: [] },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteScans).toHaveBeenCalledWith([1]);
    /* The candidate's own object, plus two stencils — and nothing for the scan
       that found nothing, which is deleted all the same. */
    expect(result.objectsQueued).toBe(3);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(expect.objectContaining({
      storageItems: expect.arrayContaining([
        { storageKey: "casting-v2/scans/eye-left.png", storageBackend: "public_r2" },
        { storageKey: "casting-v2/scans/hair.png", storageBackend: "public_r2" },
      ]),
    }));
  });

  it("purges an uploaded ink design whatever ITS flag says, and takes its bytes", async () => {
    /*
      A DESIGN IS THE ONE PICTURE HERE THAT WAS NEVER OURS. Everything else the
      sweep collects — variants, segments, library crops, stencils — this
      product made. A design is a photograph a customer handed us, and "it
      leaves when your Cast does" is the promise the upload is allowed to make
      only because this block exists.

      The flag is OFF here on purpose, for the standing reason: the studio flag
      governs whether a row is WRITTEN, and nothing governs whether it is
      purged. A flag turned back off after rows exist must not strand them.
    */
    process.env.CASTING_INK_STUDIO_SCOPE = "off";
    calls.listInkDesigns.mockResolvedValue([
      { id: 9, storageKey: "casting-v2/ink/design-one.png" },
      { id: 10, storageKey: "casting-v2/ink/design-two.jpg" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteInkDesigns).toHaveBeenCalledWith([1]);
    /* The candidate's own object, plus both designs. */
    expect(result.objectsQueued).toBe(3);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(expect.objectContaining({
      storageItems: expect.arrayContaining([
        { storageKey: "casting-v2/ink/design-one.png", storageBackend: "public_r2" },
        { storageKey: "casting-v2/ink/design-two.jpg", storageBackend: "public_r2" },
      ]),
    }));
  });

  it("purges a minted plate whatever ITS flag says, and takes its bytes", async () => {
    /* Same terms as the design it was drawn from: the studio flag governs
       whether a plate is WRITTEN and nothing governs whether it is purged. */
    process.env.CASTING_INK_STUDIO_SCOPE = "off";
    calls.listInkPlates.mockResolvedValue([
      { id: 21, storageKey: "casting-v2/ink/plates/one.png" },
    ]);

    const result = await runCandidateRetentionSweep();

    expect(calls.deleteInkPlates).toHaveBeenCalledWith([1]);
    /* The candidate's own object, plus the plate. */
    expect(result.objectsQueued).toBe(2);
    expect(calls.queueStorageCleanup).toHaveBeenCalledWith(expect.objectContaining({
      storageItems: expect.arrayContaining([
        { storageKey: "casting-v2/ink/plates/one.png", storageBackend: "public_r2" },
      ]),
    }));
  });

  it("reads the plates BEFORE the designs are deleted, because that is the only path to them", async () => {
    /*
      THE ORDER IS THE CONTRACT.

      A plate row carries no `candidateId` — deliberately, so there is no
      mirrored parent id to drift (working law 4) — and the read that finds it
      joins through the design. Delete the designs first and every plate becomes
      an orphan nothing can find, with its bytes left at a permanently public URL
      forever. Nothing about the sweep's own result would say so, which is why
      this is asserted on the CALL ORDER rather than on the outcome.
    */
    calls.listInkPlates.mockResolvedValue([{ id: 21, storageKey: "casting-v2/ink/plates/one.png" }]);
    calls.listInkDesigns.mockResolvedValue([{ id: 9, storageKey: "casting-v2/ink/design-one.png" }]);

    await runCandidateRetentionSweep();

    const platesRead = calls.listInkPlates.mock.invocationCallOrder[0]!;
    const designsDeleted = calls.deleteInkDesigns.mock.invocationCallOrder[0]!;
    expect(platesRead).toBeLessThan(designsDeleted);
    /* The control: both really ran, so the comparison above is between two
       numbers rather than between two undefineds. */
    expect(calls.listInkPlates).toHaveBeenCalledTimes(1);
    expect(calls.deleteInkDesigns).toHaveBeenCalledTimes(1);
  });

  it("tolerates an absent ink plate table only while the studio is disarmed", async () => {
    /* Production has taken neither 0034 nor 0037, and a plate cannot exist
       without a design, so this window is doubly empty — and armed, the same
       silence is a fault said out loud. */
    const missing = Object.assign(new Error("Table 'x.casting_ink_plates' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    calls.listInkPlates.mockRejectedValue(missing);

    const result = await runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteInkPlates).not.toHaveBeenCalled();

    process.env.CASTING_INK_STUDIO_SCOPE = "users:1";
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/doesn't exist/);
  });

  it("tolerates an absent ink design table only while the studio is disarmed", async () => {
    /* Production has NOT taken migration 0034 and runs this sweep every pass,
       so the window where this code knows the table and the database does not
       is live right now. Armed, the same silence would be a fault. */
    const missing = Object.assign(new Error("Table 'x.casting_ink_designs' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    calls.listInkDesigns.mockRejectedValue(missing);

    const result = await runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteInkDesigns).not.toHaveBeenCalled();

    process.env.CASTING_INK_STUDIO_SCOPE = "users:1";
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/doesn't exist/);
  });

  it("tolerates an absent scan table only while the scan table is disarmed", async () => {
    const missing = Object.assign(new Error("Table 'x.casting_face_scans' doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      errno: 1146,
    });
    calls.listScans.mockRejectedValue(missing);

    const result = await runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBe(1);
    expect(calls.deleteScans).not.toHaveBeenCalled();

    /* Armed and missing is a real fault — the ceremony has not run, or it ran
       somewhere else. A warning would bury it. */
    process.env.CASTING_SCAN_TABLE_SCOPE = "users:1";
    await expect(runCandidateRetentionSweep()).rejects.toThrow(/doesn't exist/);
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
