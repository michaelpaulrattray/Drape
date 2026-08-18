/**
 * The plate store against a real database (migration 0037).
 *
 * The doors are proved in `castingV2/inkPlateDoor.test.ts` and the order in
 * `castingV2/inkPlateMint.test.ts`. This file proves the **statements** — that a
 * stranger's design cannot be plated however good the ids are, that "one plate
 * per design per engine" is a fact about the table rather than a number in a
 * comment, that the manifest holding the bytes is released by the row that
 * claims them, and that a plate dies with the Cast it was drawn for.
 *
 * That last one cannot be proved by mocking, and here it is sharper than it is
 * for a design: a plate row carries NO `candidateId`. The only path from a Cast
 * to its plates runs through the design row, so the sweep's delete ORDER is part
 * of the contract — get it wrong and every plate becomes an orphan nothing can
 * find, with its bytes left at a permanently public URL forever. A mocked
 * ordering assertion is a claim about call order; this is MySQL saying the rows
 * are gone and the keys are queued.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --suite server/castingV2-ink-plate-db.test.ts
 * which creates one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

const GPT = "fal:openai/gpt-image-2/edit";
const NBP = "fal:fal-ai/nano-banana-pro";

describeWithDatabase("the ink plate store (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let plates: typeof import("./db/castingV2InkPlates");
  let designs: typeof import("./db/castingV2InkDesigns");
  let retention: typeof import("./castingV2/candidateRetention");
  let cleanup: typeof import("./db/storageCleanup");
  let db: typeof import("./db/connection");

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`plate-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  /** A whole lineage — session, roll, candidate — as the product makes it. */
  async function newCast(userId: number): Promise<{ candidateId: number; publicId: string }> {
    const [session] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
      [randomUUID(), userId],
    );
    const [roll] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
        + " VALUES (?, ?, ?, 0, 'a tattooed drummer in her 30s', 'complete', ?, 640)",
      [randomUUID(), session.insertId, userId, randomUUID()],
    );
    const publicId = randomUUID();
    const [candidate] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
        + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
      [publicId, roll.insertId, session.insertId, userId, `faces/${randomUUID()}.png`, `faces/${randomUUID()}-thumb.png`],
    );
    return { candidateId: candidate.insertId, publicId };
  }

  /** A design on that Cast, since a plate cannot exist without one. */
  async function newDesign(candidatePublicId: string, userId: number): Promise<string> {
    const recorded = await designs.recordInkDesign({
      userId,
      candidatePublicId,
      placement: "upperArm",
      side: "left",
      provenance: "consented",
      intents: ["tattoo"],
      storageKey: `casting-v2/ink/${randomUUID()}.png`,
      digest: randomUUID().replace(/-/g, "").repeat(2).slice(0, 64),
      mime: "image/png",
      byteSize: 40_137,
      width: 900,
      height: 1200,
    });
    return recorded.publicId;
  }

  function plate(designPublicId: string, userId: number, storageKey: string, engine = GPT) {
    return {
      userId,
      designPublicId,
      engine,
      templateKind: "arm" as const,
      templateDigest: "ab4f00a14732c4300bd2b0fe4225a75595dde3d73e6baf90a83f1432ceaca8d5",
      storageKey,
      digest: randomUUID().replace(/-/g, "").repeat(2).slice(0, 64),
      mime: "image/png",
      byteSize: 512_000,
      width: 1536,
      height: 1024,
    };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_ink_plates LIKE 'engine'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0037 applied");

    owner = await newUser("Plate Owner");
    stranger = await newUser("Plate Stranger");
    plates = await import("./db/castingV2InkPlates");
    designs = await import("./db/castingV2InkDesigns");
    retention = await import("./castingV2/candidateRetention");
    cleanup = await import("./db/storageCleanup");
    db = await import("./db/connection");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_ink_plates");
    await connection.query("DELETE FROM casting_ink_designs");
  });

  it("files a plate against the design it names, and reads it back", async () => {
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    const key = `casting-v2/ink/plates/${randomUUID()}.png`;

    const recorded = await plates.recordInkPlate(plate(designId, owner, key));
    expect(recorded.engine).toBe(GPT);

    const listed = await plates.listInkPlatesForDesign({ userId: owner, designPublicId: designId });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      engine: GPT,
      templateKind: "arm",
      storageKey: key,
      width: 1536,
      height: 1024,
    });
    /* The founder's approval, on the row rather than only in the suite. */
    expect(listed[0]!.templateDigest).toBe(
      "ab4f00a14732c4300bd2b0fe4225a75595dde3d73e6baf90a83f1432ceaca8d5",
    );
  });

  it("refuses to plate a design that is not this account's", async () => {
    /*
      Invariant 1, with the id in hand. The stranger knows the design's public id
      — that is the whole threat model — and the ownership lives in the statement
      that writes rather than in a check beside it.
    */
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);

    await expect(plates.recordInkPlate(
      plate(designId, stranger, `casting-v2/ink/plates/${randomUUID()}.png`),
    )).rejects.toBeInstanceOf(plates.InkPlateOwnershipError);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_plates",
    );
    expect(rows[0].n, "nothing was written for the stranger").toBe(0);
  });

  it("answers a stranger's read the way it answers a missing design — with nothing", async () => {
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    await plates.recordInkPlate(plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`));

    expect(await plates.listInkPlatesForDesign({ userId: stranger, designPublicId: designId }))
      .toEqual([]);
    /* The control: the same read, by the owner, is not empty — so the emptiness
       above is a refusal rather than a broken query. */
    expect(await plates.listInkPlatesForDesign({ userId: owner, designPublicId: designId }))
      .toHaveLength(1);
  });

  it("plates a design ONCE per engine, and says so rather than writing twice", async () => {
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    await plates.recordInkPlate(plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`));

    await expect(plates.recordInkPlate(
      plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`),
    )).rejects.toBeInstanceOf(plates.InkPlateAlreadyMintedError);
  });

  it("has the unique key underneath, so a race cannot beat the count", async () => {
    /*
      The helper's own check runs under a lock on the design row, which is the
      mechanism. This is the BACKSTOP, and it is asserted separately because a
      lock that was quietly dropped in a refactor would leave the count exact
      only when nobody clicks twice. Driven straight at MySQL, past the helper.
    */
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    await plates.recordInkPlate(plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`));

    const [row] = await connection.query<RowDataPacket[]>(
      "SELECT designId FROM casting_ink_plates LIMIT 1",
    );
    await expect(connection.execute(
      "INSERT INTO casting_ink_plates (publicId, userId, designId, engine, templateKind, templateDigest,"
        + " storageKey, digest, mime, byteSize, width, height)"
        + " VALUES (?, ?, ?, ?, 'arm', ?, ?, ?, 'image/png', 1, 1, 1)",
      [randomUUID(), owner, row[0].designId, GPT, "a".repeat(64), "k", "d".repeat(64)],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });

  it("holds TWO plates of one design when the engines differ — that is the court", async () => {
    /*
      fable-936 §4: one design plated by both engines, speed and cost from the
      census and quality by the founder's eye. A unique key on `designId` alone
      would have made that comparison unbuildable.
    */
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    await plates.recordInkPlate(plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`, GPT));
    await plates.recordInkPlate(plate(designId, owner, `casting-v2/ink/plates/${randomUUID()}.png`, NBP));

    const listed = await plates.listInkPlatesForDesign({ userId: owner, designPublicId: designId });
    expect(listed.map((one) => one.engine)).toEqual([GPT, NBP]);
  });

  it("discharges the manifest that was holding the bytes", async () => {
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    const key = `casting-v2/ink/plates/${randomUUID()}.png`;
    const batchId = randomUUID();
    await db.withTransaction((tx) => cleanup.createStorageCleanupManifestIn(tx, {
      id: batchId,
      userId: owner,
      operationId: randomUUID(),
      heldUntil: cleanup.storageCleanupManifestHeldUntil(),
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: key, storageBackend: "public_r2" as const }],
    }));

    await plates.recordInkPlate({ ...plate(designId, owner, key), cleanupBatchId: batchId });

    const [batches] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE id = ?",
      [batchId],
    );
    expect(batches[0].n, "the hold is gone, so the plate is not scheduled for deletion").toBe(0);
  });

  it("keeps the bytes scheduled when the row it was written for is refused", async () => {
    /*
      A refusal after the bytes have landed must NOT discharge the manifest —
      that is the litter path, and it is the reason the discharge lives inside
      the same transaction as the insert rather than beside it.
    */
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    const key = `casting-v2/ink/plates/${randomUUID()}.png`;
    const batchId = randomUUID();
    await db.withTransaction((tx) => cleanup.createStorageCleanupManifestIn(tx, {
      id: batchId,
      userId: owner,
      operationId: randomUUID(),
      heldUntil: cleanup.storageCleanupManifestHeldUntil(),
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: key, storageBackend: "public_r2" as const }],
    }));

    await expect(plates.recordInkPlate({
      ...plate(designId, stranger, key),
      cleanupBatchId: batchId,
    })).rejects.toBeInstanceOf(plates.InkPlateOwnershipError);

    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE batchId = ?",
      [batchId],
    );
    expect(items[0].n, "the worker still has the key, so nothing is stranded").toBe(1);
  });

  /**
   * THE ORDER, PROVED BY MYSQL RATHER THAN BY CALL COUNTING.
   *
   * A plate has no `candidateId`. Delete the designs first and this test finds
   * an orphan row and an unqueued key — which is exactly what would happen in
   * production, silently, forever.
   */
  it("purges a plate's row AND hands its bytes to the cleanup worker with the Cast", async () => {
    const cast = await newCast(owner);
    const designId = await newDesign(cast.publicId, owner);
    const plateKey = `casting-v2/ink/plates/${randomUUID()}.png`;
    await plates.recordInkPlate(plate(designId, owner, plateKey));

    // Make the candidate purgeable the way the product does: discarded, expired.
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [cast.candidateId],
    );

    const result = await retention.runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_plates",
    );
    expect(remaining[0].n, "the plate died with the Cast it was drawn for").toBe(0);

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE storageKey = ?",
      [plateKey],
    );
    expect(queued[0].n, "and the worker was handed its bytes").toBe(1);
  });
});
