/**
 * The segment store against a real database (segment permanence, slice 1).
 *
 * The unit tests prove the decisions. This file proves the **statements** —
 * that a stranger's variant cannot have a segment filed against it, that
 * re-asking one facet retires its predecessor instead of contesting it, and
 * that the candidate sweep carries a segment's objects onto the same cleanup
 * manifest as the candidate's own, inside the same transaction.
 *
 * The last of those is the founder's condition on this store, and it is the one
 * that cannot be proved by mocking: a purge is a claim until MySQL has actually
 * deleted the row and the manifest actually holds the key.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts`, which
 * creates one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("the segment store (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let segments: typeof import("./db/castingV2Segments");
  let retention: typeof import("./castingV2/candidateRetention");

  const geometry = {
    bbox: { x: 40, y: 120, width: 200, height: 90 },
    frame: { width: 1024, height: 1536 },
  };

  /**
   * The production write, with its manifest — never a shortcut around it.
   *
   * The keys are registered for cleanup before the row exists, exactly as the
   * service does it, so the discharge is exercised by every case below rather
   * than by one test that remembers to.
   */
  async function fileSegment(input: {
    userId: number;
    variantId: number;
    facet?: string;
    region?: string;
    maskKey: string;
    contentKey: string;
    geometry?: typeof geometry;
    verdict?: string | null;
  }) {
    const cleanupBatchId = randomUUID();
    await connection.execute(
      "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind, status, expectedCount, deletedCount, failedCount)"
        + " VALUES (?, ?, ?, 'casting_candidate_cleanup', 'pending', 2, 0, 0)",
      [cleanupBatchId, input.userId, randomUUID()],
    );
    for (const storageKey of [input.maskKey, input.contentKey]) {
      await connection.execute(
        "INSERT INTO storage_cleanup_items (batchId, storageKey, storageBackend, status, attempts) VALUES (?, ?, 'public_r2', 'pending', 0)",
        [cleanupBatchId, storageKey],
      );
    }
    const recorded = await segments.recordEditPatchSegments({
      userId: input.userId,
      variantId: input.variantId,
      cleanupBatchId,
      verdict: input.verdict ?? null,
      patches: [{
        facet: input.facet ?? "marks",
        region: input.region ?? "face skin",
        maskKey: input.maskKey,
        contentKey: input.contentKey,
        geometry: input.geometry ?? geometry,
      }],
    });
    return { recorded, cleanupBatchId };
  }

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`segment-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  /** A whole lineage — session, roll, candidate, variant — as the product makes it. */
  async function newFace(userId: number): Promise<{ candidateId: number; variantId: number }> {
    const [session] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
      [randomUUID(), userId],
    );
    const [roll] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
        + " VALUES (?, ?, ?, 0, 'a wiry cyclist in her 20s', 'complete', ?, 640)",
      [randomUUID(), session.insertId, userId, randomUUID()],
    );
    const [candidate] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
        + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
      [randomUUID(), roll.insertId, session.insertId, userId, `faces/${randomUUID()}.png`, `faces/${randomUUID()}-thumb.png`],
    );
    const [variant] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId)"
        + " VALUES (?, ?, ?, ?, 'ready', ?, ?)",
      [randomUUID(), candidate.insertId, session.insertId, userId, JSON.stringify(["give her freckles"]), randomUUID()],
    );
    return { candidateId: candidate.insertId, variantId: variant.insertId };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM casting_segments LIKE 'provenance'");
    if (columns.length !== 1) throw new Error("Disposable database must have the segment-store migration applied");

    owner = await newUser("Segment Owner");
    stranger = await newUser("Segment Stranger");
    segments = await import("./db/castingV2Segments");
    retention = await import("./castingV2/candidateRetention");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_segments");
  });

  it("files a kept edit's pixels against the candidate its variant belongs to", async () => {
    const face = await newFace(owner);
    const { recorded, cleanupBatchId } = await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: `segments/${randomUUID()}-mask.png`,
      contentKey: `segments/${randomUUID()}-content.png`,
      verdict: "delivered",
    });

    // The candidate id is the one the variant row carries, never a caller's.
    expect(recorded[0].candidateId).toBe(face.candidateId);
    expect(recorded[0].version).toBe(1);
    expect(recorded[0].retired).toBe(0);

    // And the manifest holding the objects is discharged by the same
    // transaction that made them referenced — or the worker deletes pixels the
    // compositor is about to paste.
    const [batches] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE id = ?",
      [cleanupBatchId],
    );
    expect(batches[0].n).toBe(0);
    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE batchId = ?",
      [cleanupBatchId],
    );
    expect(items[0].n).toBe(0);

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live).toHaveLength(1);
    expect(live[0].facet).toBe("marks");
    expect(live[0].provenance).toBe("edit_patch");
    expect(live[0].variantId).toBe(face.variantId);
    expect(live[0].geometry).toEqual(geometry);
  });

  it("refuses a segment filed against someone else's variant, and writes nothing", async () => {
    const face = await newFace(owner);
    await expect(fileSegment({
      userId: stranger,
      variantId: face.variantId,
      maskKey: "segments/thief-mask.png",
      contentKey: "segments/thief-content.png",
    })).rejects.toThrow(/variant not available/);

    const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM casting_segments");
    expect(rows[0].n).toBe(0);
  });

  it("retires the predecessor when one facet is asked again — one facet, one live segment", async () => {
    const face = await newFace(owner);
    const base = { userId: owner, variantId: face.variantId };
    await fileSegment({
      ...base,
      maskKey: "segments/v1-mask.png",
      contentKey: "segments/v1-content.png",
    });
    const { recorded: heavier } = await fileSegment({
      ...base,
      maskKey: "segments/v2-mask.png",
      contentKey: "segments/v2-content.png",
    });

    expect(heavier[0].version).toBe(2);
    expect(heavier[0].retired).toBe(1);

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live).toHaveLength(1);
    expect(live[0].contentKey).toBe("segments/v2-content.png");

    // The predecessor is out of the composite but still on the record (§7).
    const history = await segments.listSegmentHistory({ userId: owner, candidateId: face.candidateId });
    expect(history).toHaveLength(2);
    expect(history.map((row) => row.version).sort()).toEqual([1, 2]);
    expect(history.find((row) => row.version === 1)?.retiredAt).toBeInstanceOf(Date);
  });

  it("keeps two facets side by side — retirement is per facet, not per face", async () => {
    const face = await newFace(owner);
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/marks-mask.png",
      contentKey: "segments/marks-content.png",
    });
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "hair.colour",
      region: "hair",
      maskKey: "segments/hair-mask.png",
      contentKey: "segments/hair-content.png",
    });

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live.map((row) => row.facet).sort()).toEqual(["hair.colour", "marks"]);
  });

  it("shows a stranger nothing, even holding the right candidate id", async () => {
    const face = await newFace(owner);
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/owner-mask.png",
      contentKey: "segments/owner-content.png",
    });

    const seen = await segments.listLiveSegments({ userId: stranger, candidateId: face.candidateId });
    expect(seen).toEqual([]);
  });

  it("refuses to file segments whose manifest something else already claimed", async () => {
    const face = await newFace(owner);
    await expect(segments.recordEditPatchSegments({
      userId: owner,
      variantId: face.variantId,
      // A batch id nothing reserved: the objects these rows would point at are
      // held by nobody, so committing would file segments whose bytes are
      // already scheduled to die — or were never registered at all.
      cleanupBatchId: randomUUID(),
      patches: [{
        facet: "marks",
        region: "face skin",
        maskKey: "segments/claimed-mask.png",
        contentKey: "segments/claimed-content.png",
        geometry,
      }],
    })).rejects.toThrow(/segment not available/);

    const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM casting_segments");
    // And the rollback is real: the insert above is undone with the discharge.
    expect(rows[0].n).toBe(0);
  });

  it("refuses a box measured against a different frame", async () => {
    const face = await newFace(owner);
    await expect(fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/bad-mask.png",
      contentKey: "segments/bad-content.png",
      geometry: { bbox: { x: 900, y: 0, width: 200, height: 50 }, frame: { width: 1024, height: 1536 } },
    })).rejects.toThrow(/outside its own frame/);
  });

  /**
   * The founder's condition, proved on the artifact rather than on the design.
   */
  it("purges a segment's rows AND hands its objects to the cleanup worker with the candidate", async () => {
    const face = await newFace(owner);
    const maskKey = `segments/${randomUUID()}-mask.png`;
    const contentKey = `segments/${randomUUID()}-content.png`;
    await fileSegment({ userId: owner, variantId: face.variantId, maskKey, contentKey });

    // Make the candidate purgeable the way the product does: discarded, expired.
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );

    const result = await retention.runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_segments WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(remaining[0].n).toBe(0);

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey IN (?, ?)",
      [maskKey, contentKey],
    );
    // Both objects, on the candidate's own manifest — not a second schedule.
    expect(queued.map((row) => row.storageKey).sort()).toEqual([contentKey, maskKey].sort());
  });

  it("retires a facet for its owner, and for nobody else", async () => {
    const face = await newFace(owner);
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/undo-mask.png",
      contentKey: "segments/undo-content.png",
    });

    // A stranger holding the right candidate id and the right facet name.
    expect(await segments.retireSegmentFacet({
      userId: stranger,
      candidateId: face.candidateId,
      facet: "marks",
    })).toBe(0);
    expect(await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId }))
      .toHaveLength(1);

    expect(await segments.retireSegmentFacet({
      userId: owner,
      candidateId: face.candidateId,
      facet: "marks",
    })).toBe(1);
    expect(await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId }))
      .toEqual([]);
    // Out of the composite, still on the record — the bytes survive for redo.
    expect(await segments.listSegmentHistory({ userId: owner, candidateId: face.candidateId }))
      .toHaveLength(1);
  });

  it("will not retire something she was born wearing", async () => {
    /*
      The born-versus-added line, drawn in SQL. Dropping a `detected_born` row
      would take a fact about her face out of the catalogue while leaving the
      thing itself in the picture: the glasses she was rolled wearing come off
      with a render into the skin behind them, never with a row change.
    */
    const face = await newFace(owner);
    await connection.execute(
      "INSERT INTO casting_segments (publicId, userId, candidateId, provenance, facet, region, version,"
        + " maskKey, contentKey, bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight, detector)"
        + " VALUES (?, ?, ?, 'detected_born', 'glasses', 'glasses', 1, ?, ?, 40, 120, 200, 90, 1024, 1536, 'test-detector')",
      [randomUUID(), owner, face.candidateId, "segments/born-mask.png", "segments/born-content.png"],
    );

    expect(await segments.retireSegmentFacet({
      userId: owner,
      candidateId: face.candidateId,
      facet: "glasses",
    })).toBe(0);
    expect(await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId }))
      .toHaveLength(1);
  });

  /* ------------------------------------------- the born-worn catalogue */

  /** The catalogue's write, with its manifest — never a shortcut around it. */
  async function fileDetection(input: {
    userId: number;
    candidateId: number;
    facet?: string;
    region?: string;
    maskKey: string;
    contentKey: string;
    detector?: string;
  }) {
    const cleanupBatchId = randomUUID();
    await connection.execute(
      "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind, status, expectedCount, deletedCount, failedCount)"
        + " VALUES (?, ?, ?, 'casting_candidate_cleanup', 'pending', 2, 0, 0)",
      [cleanupBatchId, input.userId, randomUUID()],
    );
    for (const storageKey of [input.maskKey, input.contentKey]) {
      await connection.execute(
        "INSERT INTO storage_cleanup_items (batchId, storageKey, storageBackend, status, attempts) VALUES (?, ?, 'public_r2', 'pending', 0)",
        [cleanupBatchId, storageKey],
      );
    }
    const recorded = await segments.recordDetectedSegments({
      userId: input.userId,
      candidateId: input.candidateId,
      detector: input.detector ?? "sam3-coverage@1",
      cleanupBatchId,
      detections: [{
        facet: input.facet ?? "glasses",
        region: input.region ?? "glasses",
        maskKey: input.maskKey,
        contentKey: input.contentKey,
        geometry,
      }],
    });
    return { recorded, cleanupBatchId };
  }

  it("files what the master already had as a FACT — no variant, no verdict", async () => {
    const face = await newFace(owner);
    const { recorded, cleanupBatchId } = await fileDetection({
      userId: owner,
      candidateId: face.candidateId,
      maskKey: "segments/detected-mask.png",
      contentKey: "segments/detected-content.png",
    });

    expect(recorded).toHaveLength(1);
    const [row] = await connection.query<RowDataPacket[]>(
      "SELECT provenance, variantId, verdict, verifiedAt, detector FROM casting_segments WHERE id = ?",
      [recorded[0].id],
    ).then(([rows]) => rows as RowDataPacket[]);
    /*
      Nothing delivered these pixels and nothing promised them, so the columns
      that record a delivery are NULL — in the database, not merely in a caller
      that remembered to pass nulls. This is the line that keeps the catalogue
      out of every delivery denominator.
    */
    expect(row.provenance).toBe("detected_born");
    expect(row.variantId).toBeNull();
    expect(row.verdict).toBeNull();
    expect(row.verifiedAt).toBeNull();
    expect(row.detector).toBe("sam3-coverage@1");

    /* The manifest is discharged, or the worker deletes what the row points at. */
    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM storage_cleanup_items WHERE batchId = ?",
      [cleanupBatchId],
    );
    expect(items).toHaveLength(0);
  });

  it("refuses to file a fact against a stranger's candidate", async () => {
    const face = await newFace(owner);
    await expect(fileDetection({
      userId: stranger,
      candidateId: face.candidateId,
      maskKey: "segments/stranger-mask.png",
      contentKey: "segments/stranger-content.png",
    })).rejects.toThrow(/candidate not available/);
    expect(await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId }))
      .toEqual([]);
  });

  it("keeps ONE live row when a better detector re-reads the same master", async () => {
    const face = await newFace(owner);
    await fileDetection({
      userId: owner,
      candidateId: face.candidateId,
      maskKey: "segments/v1-mask.png",
      contentKey: "segments/v1-content.png",
      detector: "sam3-coverage@1",
    });
    const second = await fileDetection({
      userId: owner,
      candidateId: face.candidateId,
      maskKey: "segments/v2-mask.png",
      contentKey: "segments/v2-content.png",
      detector: "sam3-coverage@2",
    });

    expect(second.recorded[0].version).toBe(2);
    expect(second.recorded[0].retired).toBe(1);
    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live).toHaveLength(1);
    expect(live[0].detector).toBe("sam3-coverage@2");
    /* What the worse detector believed stays readable, with its bytes. */
    expect(await segments.listSegmentHistory({ userId: owner, candidateId: face.candidateId }))
      .toHaveLength(2);
  });

  /*
    THE RETIRE IS SCOPED BY PROVENANCE — a fact and a patch never supersede
    each other. The vocabularies are disjoint today, so this is defence in
    depth; it is proved on MySQL because that is where the predicate runs.
  */
  it("does not let a patch retire a fact that shares its identity", async () => {
    const face = await newFace(owner);
    await fileDetection({
      userId: owner,
      candidateId: face.candidateId,
      facet: "glasses",
      region: "glasses",
      maskKey: "segments/fact-mask.png",
      contentKey: "segments/fact-content.png",
    });
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "glasses",
      region: "glasses",
      maskKey: "segments/patch-mask.png",
      contentKey: "segments/patch-content.png",
    });

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live.map((row) => row.provenance).sort()).toEqual(["detected_born", "edit_patch"]);
    /* Different version numbers, because the unique index knows nothing about
       provenance and two rows on one identity must not collide. */
    expect(new Set(live.map((row) => row.version)).size).toBe(2);
  });

  it("carries a fact's objects onto the candidate's own cleanup manifest", async () => {
    const face = await newFace(owner);
    await fileDetection({
      userId: owner,
      candidateId: face.candidateId,
      maskKey: "segments/purge-fact-mask.png",
      contentKey: "segments/purge-fact-content.png",
    });

    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    await retention.runCandidateRetentionSweep();

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey LIKE 'segments/purge-fact-%'",
    );
    expect(queued).toHaveLength(2);
    expect(await segments.listSegmentHistory({ userId: owner, candidateId: face.candidateId }))
      .toEqual([]);
  });

  /**
   * THE REAL ABSENCE, not a hand-written one.
   *
   * The first version of the tolerance read `code` off the top-level error and
   * passed a test that invented that shape; production wraps the driver error
   * in a `DrizzleQueryError` and the sweep threw on its first pass. So the
   * absence is produced here by actually taking the table away — the only
   * specimen that cannot be wrong about what the driver sends.
   */
  it("tolerates a genuinely absent table while disarmed, and refuses it once armed", async () => {
    const face = await newFace(owner);
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    await connection.query("RENAME TABLE casting_segments TO casting_segments_hidden");
    const previous = process.env.CASTING_SEGMENTS_SCOPE;
    try {
      delete process.env.CASTING_SEGMENTS_SCOPE;
      const result = await retention.runCandidateRetentionSweep();
      // Disarmed: nothing can have been written, so nothing is left behind and
      // the candidate purge is not taken down by the absence.
      expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

      const second = await newFace(owner);
      await connection.execute(
        "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
        [second.candidateId],
      );
      process.env.CASTING_SEGMENTS_SCOPE = "users:1";
      // Armed and missing is a real fault, and a warning would bury it.
      await expect(retention.runCandidateRetentionSweep()).rejects.toThrow(/casting_segments/);
    } finally {
      if (previous === undefined) delete process.env.CASTING_SEGMENTS_SCOPE;
      else process.env.CASTING_SEGMENTS_SCOPE = previous;
      await connection.query("RENAME TABLE casting_segments_hidden TO casting_segments");
    }
  });

  it("purges a RETIRED segment's objects too — the bytes nothing else would collect", async () => {
    const face = await newFace(owner);
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/retired-mask.png",
      contentKey: "segments/retired-content.png",
    });
    await fileSegment({
      userId: owner,
      variantId: face.variantId,
      maskKey: "segments/live-mask.png",
      contentKey: "segments/live-content.png",
    });

    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    await retention.runCandidateRetentionSweep();

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey LIKE 'segments/retired-%'",
    );
    expect(queued).toHaveLength(2);
  });
});
