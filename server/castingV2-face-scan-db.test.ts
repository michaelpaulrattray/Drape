/**
 * The kept face scan against a real database (migration 0032).
 *
 * The unit tests prove the decisions. This file proves the **statements** —
 * that one face-version can hold exactly one row however many times it is
 * written, that a stranger's id cannot read an owner's scan, and that the
 * candidate sweep deletes the rows AND hands their stencils to the cleanup
 * worker on the candidate's own manifest, inside the same transaction.
 *
 * The last of those is the founder's condition on this table — *"as long as it
 * wont clog up storage"* — and it is the one that cannot be proved by mocking:
 * a purge is a claim until MySQL has actually deleted the row and the manifest
 * actually holds the key.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --suite server/castingV2-face-scan-db.test.ts
 * which creates one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("the kept face scan (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let scans: typeof import("./db/castingV2FaceScans");
  let retention: typeof import("./castingV2/candidateRetention");

  const geometryWith = (maskKeys: readonly string[]) => ({
    slots: maskKeys.map((maskKey, at) => ({
      slot: `feature-${at}`,
      box: { x: 10 * at, y: 20, width: 30, height: 40 },
      maskKey,
    })),
    words: [["skin", ["a warm even tan"]]] as ReadonlyArray<readonly [string, readonly string[]]>,
    sides: "eye:LR brow:LR ear:LR horns:-- earring:--",
    asked: 12,
    found: maskKeys.length,
    empty: [] as readonly string[],
  });

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`scan-${randomUUID()}`, name],
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
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_face_scans LIKE 'versionKey'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have the scan-table migration applied");

    owner = await newUser("Scan Owner");
    stranger = await newUser("Scan Stranger");
    scans = await import("./db/castingV2FaceScans");
    retention = await import("./castingV2/candidateRetention");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_face_scans");
  });

  it("keeps one row per face-version, and reads back what was written", async () => {
    const face = await newFace(owner);
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v1.png",
      geometry: geometryWith(["scans/eye.png"]),
      stencilBytes: 8360,
    });

    const kept = await scans.readKeptFaceScan({
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
    });
    expect(kept?.frameKey).toBe("faces/v1.png");
    expect(kept?.stencilBytes).toBe(8360);
    expect(kept?.geometry.slots[0]?.maskKey).toBe("scans/eye.png");
  });

  /**
   * THE FOUNDER'S BOUND, PROVED AT THE KEY RATHER THAN AT THE CALLER.
   *
   * One row per (candidate, version) is what makes the growth curve bounded by
   * the product's own shape instead of by how often anyone looks. A caller that
   * remembered to delete first would satisfy the bound on the days it
   * remembered; the unique index satisfies it on every other day too.
   */
  it("replaces rather than accumulates when the same version is scanned again", async () => {
    const face = await newFace(owner);
    for (const [frameKey, bytes] of [["faces/v1.png", 8360], ["faces/v2.png", 9044]] as const) {
      await scans.keepFaceScan({
        publicId: randomUUID(),
        userId: owner,
        candidateId: face.candidateId,
        variantId: face.variantId,
        frameKey,
        geometry: geometryWith(["scans/eye.png"]),
        stencilBytes: bytes,
      });
    }

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_face_scans WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(rows[0].n).toBe(1);
    const kept = await scans.readKeptFaceScan({
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
    });
    expect(kept?.frameKey, "the newer reading won").toBe("faces/v2.png");
    expect(kept?.stencilBytes).toBe(9044);
  });

  /**
   * AND THE MASTER FRAME IS ITS OWN VERSION.
   *
   * `variantId` null is the candidate's own frame, and it travels as the string
   * `master` precisely so the unique index can hold it: MySQL lets NULLs repeat
   * inside a unique index, so a nullable key column would admit unlimited
   * master rows per cast. This is that defect's negative control.
   */
  it("holds the master frame and a variant as two rows, and no more than one each", async () => {
    const face = await newFace(owner);
    for (const variantId of [null, face.variantId, null, face.variantId]) {
      await scans.keepFaceScan({
        publicId: randomUUID(),
        userId: owner,
        candidateId: face.candidateId,
        variantId,
        frameKey: variantId === null ? "faces/master.png" : "faces/v1.png",
        geometry: geometryWith(["scans/eye.png"]),
        stencilBytes: 8360,
      });
    }

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT versionKey FROM casting_face_scans WHERE candidateId = ? ORDER BY versionKey",
      [face.candidateId],
    );
    expect(rows.map((row) => String(row.versionKey))).toEqual([String(face.variantId), "master"]);
  });

  it("does not hand one account's scan to another", async () => {
    const face = await newFace(owner);
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v1.png",
      geometry: geometryWith(["scans/eye.png"]),
      stencilBytes: 8360,
    });

    /* A stranger holding the right candidate id and the right version — the
       only thing standing between them and her face is the owner in the WHERE. */
    expect(await scans.readKeptFaceScan({
      userId: stranger,
      candidateId: face.candidateId,
      variantId: face.variantId,
    })).toBeNull();
  });

  /**
   * The founder's storage condition, proved on the artifact rather than on the
   * design.
   */
  it("purges a scan's row AND hands its stencils to the cleanup worker with the candidate", async () => {
    const face = await newFace(owner);
    const maskKeys = [`scans/${randomUUID()}-eye.png`, `scans/${randomUUID()}-hair.png`];
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v1.png",
      geometry: geometryWith(maskKeys),
      stencilBytes: 8360,
    });

    // Make the candidate purgeable the way the product does: discarded, expired.
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );

    const result = await retention.runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_face_scans WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(remaining[0].n, "the row died with its cast").toBe(0);

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey IN (?, ?)",
      maskKeys,
    );
    /* Both stencils, on the candidate's own manifest — not a second schedule
       that could fall behind and leave pieces of a face at public URLs. */
    expect(queued.map((row) => String(row.storageKey)).sort()).toEqual([...maskKeys].sort());
  });

  /**
   * ⚠ THE RENDER'S OWN ROW — carried geometry, written UNGATED (fable-1445 §2).
   *
   * The scan table's flag gates PAID READS on a look; the render writes here
   * without it, because the read it files was bought by a render the customer
   * already paid for. So rows now exist for accounts outside
   * `CASTING_SCAN_TABLE_SCOPE` — which is a fact about the PURGE PATH, and
   * fable-1445 condition 1 refused to take *"I believe it holds"* for an
   * answer. This is the deletion, driven, with the flag proved off first.
   */
  it("purges a CARRIED-ONLY row for an account outside the scan flags", async () => {
    const scope = await import("./castingV2/castingV2Scope");
    /* The condition's own premise, asserted rather than assumed: this account
       could not write a scan row, and its row is here anyway. */
    expect(scope.captureCastingScanTableEnabled(owner), "the scan flag must be OFF for this arm to mean anything").toBe(false);

    const face = await newFace(owner);
    const kept = await scans.keepCarriedGeometry({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v219.png",
      carried: [{ slot: "open:horns@right", box: { x: 62, y: 24, width: 18, height: 21, frame: { width: 100, height: 100 } } }],
    });
    expect(kept.written).toBe(true);

    /* It reads back on its own frame, and not on another's. */
    const read = await scans.readCarriedGeometry({
      userId: owner, candidateId: face.candidateId, variantId: face.variantId, frameKey: "faces/v219.png",
    });
    expect(read.get("open:horns@right")).toMatchObject({ x: 62, y: 24 });
    expect((await scans.readCarriedGeometry({
      userId: owner, candidateId: face.candidateId, variantId: face.variantId, frameKey: "faces/v220.png",
    })).size, "a row about different bytes is not served").toBe(0);

    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    const result = await retention.runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_face_scans WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(remaining[0].n, "an ungated row dies with its cast exactly as a scan row does").toBe(0);
  });

  /**
   * A SCAN LANDING ON TOP OF THE RENDER'S ROW KEEPS BOTH HALVES.
   *
   * A version's row is born at its render and looked at afterwards, so this is
   * the ordinary order rather than an edge. A scan that replaced the column
   * wholesale would drop every carried box the moment somebody opened the
   * panel — the defect healing itself and then quietly coming back.
   */
  it("a scan preserves the render's carried geometry on the same frame, and drops it on a different one", async () => {
    const face = await newFace(owner);
    const carried = [{ slot: "hair", box: { x: 1, y: 2, width: 3, height: 4, frame: { width: 10, height: 10 } } }];
    const write = async () => scans.keepCarriedGeometry({
      publicId: randomUUID(), userId: owner, candidateId: face.candidateId,
      variantId: face.variantId, frameKey: "faces/v219.png", carried,
    });
    await write();

    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v219.png",
      geometry: geometryWith([`scans/${randomUUID()}.png`]),
      stencilBytes: 4180,
    });

    const kept = await scans.readKeptFaceScan({
      userId: owner, candidateId: face.candidateId, variantId: face.variantId,
    });
    expect(kept?.geometry.slots, "the paid reading is untouched").toHaveLength(1);
    expect(kept?.geometry.carried, "and the render's half survived it").toEqual(carried);
    expect(kept?.geometry.scanned, "the row is a reading now").toBe(true);

    /* And the other way: a scan of DIFFERENT bytes drops the carried boxes
       rather than attaching this frame's rectangles to that one. */
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v220.png",
      geometry: geometryWith([]),
      stencilBytes: 0,
    });
    const moved = await scans.readKeptFaceScan({
      userId: owner, candidateId: face.candidateId, variantId: face.variantId,
    });
    expect(moved?.geometry.carried).toBeUndefined();
  });

  /** The render standing down rather than writing onto a row about other bytes. */
  it("refuses to file carried geometry onto a row whose frame has moved", async () => {
    const face = await newFace(owner);
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v1.png",
      geometry: geometryWith([]),
      stencilBytes: 0,
    });

    const kept = await scans.keepCarriedGeometry({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: face.variantId,
      frameKey: "faces/v2.png",
      carried: [{ slot: "hair", box: { x: 9, y: 9, width: 9, height: 9, frame: { width: 10, height: 10 } } }],
    });
    expect(kept).toEqual({ written: false, reason: "frame-moved" });

    const untouched = await scans.readKeptFaceScan({
      userId: owner, candidateId: face.candidateId, variantId: face.variantId,
    });
    expect(untouched?.frameKey, "the row it declined to touch is exactly as it was").toBe("faces/v1.png");
    expect(untouched?.geometry.carried).toBeUndefined();
  });

  /**
   * THE SCAN THAT FOUND NOTHING still has a row, and the row still dies.
   *
   * A list filtered to rows-with-objects would come back empty here, the delete
   * would be skipped, and the row would outlive its cast while every count read
   * zero. Same shape as the library's words-only row, arrived at by a third
   * door.
   */
  it("purges a scan that owns no objects at all", async () => {
    const face = await newFace(owner);
    await scans.keepFaceScan({
      publicId: randomUUID(),
      userId: owner,
      candidateId: face.candidateId,
      variantId: null,
      frameKey: "faces/master.png",
      geometry: geometryWith([]),
      stencilBytes: 0,
    });
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );

    await retention.runCandidateRetentionSweep();

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_face_scans WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(remaining[0].n).toBe(0);
  });
});
