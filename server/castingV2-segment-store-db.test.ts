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
    const recorded = await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: `segments/${randomUUID()}-mask.png`,
      contentKey: `segments/${randomUUID()}-content.png`,
      geometry,
      verdict: "delivered",
      verifiedAt: new Date(),
    });

    // The candidate id is the one the variant row carries, never a caller's.
    expect(recorded.candidateId).toBe(face.candidateId);
    expect(recorded.version).toBe(1);
    expect(recorded.retired).toBe(0);

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live).toHaveLength(1);
    expect(live[0].facet).toBe("marks");
    expect(live[0].provenance).toBe("edit_patch");
    expect(live[0].variantId).toBe(face.variantId);
    expect(live[0].geometry).toEqual(geometry);
  });

  it("refuses a segment filed against someone else's variant, and writes nothing", async () => {
    const face = await newFace(owner);
    await expect(segments.recordEditPatchSegment({
      userId: stranger,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: "segments/thief-mask.png",
      contentKey: "segments/thief-content.png",
      geometry,
    })).rejects.toThrow(/variant not available/);

    const [rows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM casting_segments");
    expect(rows[0].n).toBe(0);
  });

  it("retires the predecessor when one facet is asked again — one facet, one live segment", async () => {
    const face = await newFace(owner);
    const base = {
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      geometry,
    };
    await segments.recordEditPatchSegment({
      ...base,
      maskKey: "segments/v1-mask.png",
      contentKey: "segments/v1-content.png",
    });
    const heavier = await segments.recordEditPatchSegment({
      ...base,
      maskKey: "segments/v2-mask.png",
      contentKey: "segments/v2-content.png",
    });

    expect(heavier.version).toBe(2);
    expect(heavier.retired).toBe(1);

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
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: "segments/marks-mask.png",
      contentKey: "segments/marks-content.png",
      geometry,
    });
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "hair.colour",
      region: "hair",
      maskKey: "segments/hair-mask.png",
      contentKey: "segments/hair-content.png",
      geometry,
    });

    const live = await segments.listLiveSegments({ userId: owner, candidateId: face.candidateId });
    expect(live.map((row) => row.facet).sort()).toEqual(["hair.colour", "marks"]);
  });

  it("shows a stranger nothing, even holding the right candidate id", async () => {
    const face = await newFace(owner);
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: "segments/owner-mask.png",
      contentKey: "segments/owner-content.png",
      geometry,
    });

    const seen = await segments.listLiveSegments({ userId: stranger, candidateId: face.candidateId });
    expect(seen).toEqual([]);
  });

  it("refuses a box measured against a different frame", async () => {
    const face = await newFace(owner);
    await expect(segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
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
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey,
      contentKey,
      geometry,
    });

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

  it("purges a RETIRED segment's objects too — the bytes nothing else would collect", async () => {
    const face = await newFace(owner);
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: "segments/retired-mask.png",
      contentKey: "segments/retired-content.png",
      geometry,
    });
    await segments.recordEditPatchSegment({
      userId: owner,
      variantId: face.variantId,
      facet: "marks",
      region: "face skin",
      maskKey: "segments/live-mask.png",
      contentKey: "segments/live-content.png",
      geometry,
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
