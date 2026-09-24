/**
 * THE PLATE TABLE'S ONE SURVIVING RULE: A PLATE DIES WITH THE CAST IT WAS
 * DRAWN FOR — against a real database.
 *
 * ⚠ **THIS FILE USED TO PROVE A WRITER AND THE WRITER IS GONE** (#1158 slice
 * 4e). His ruling of 2026-09-24 retired the ink studio; slice 2 deleted the
 * mint and this slice deleted `recordInkPlate`, the table's only statement,
 * with its two error classes, its two types and the studio's own per-design
 * read. **Eight of this file's nine arms went with it**, and that is the
 * correct outcome rather than a loss: an arm kept after its subject is deleted
 * is the `directory-population-loses-promoted-subject` shape — green, and
 * checking nothing.
 *
 * §8c's question was asked of each one first — *which of these were proving
 * LIVE code through the dead function?* — and exactly one answered yes: the
 * retention sweep. `candidateRetention` still runs `listPurgeableInkPlatesIn`
 * and `deleteInkPlateRowsIn` on **every sweep**, and its own suite drives them
 * through mocks, so this is their only proof that the statements work and that
 * the ORDER is right. It is re-pointed rather than deleted.
 *
 * **The fixture is a raw INSERT now, and that is deliberate rather than
 * convenient.** There is no helper left to build a plate row, and writing one
 * for a test would be a second writer of a table the product cannot write —
 * working law 4 wearing a fixture's clothes. The idiom is not invented here:
 * `castingV2-ink-design-db.test.ts`'s *"takes a design's plates with it"* has
 * built its plate exactly this way since before this slice, for the same
 * reason, against the other live caller.
 *
 * ⚠ **AND THE ORDER IS STILL WHAT THIS ARM IS ABOUT.** A plate row carries NO
 * `candidateId`. The only path from a Cast to its plates runs through the
 * design row, so deleting the designs first would leave an orphan row and an
 * unqueued key — silently, forever, at a permanently public URL. A mocked
 * ordering assertion is a claim about call order; this is MySQL saying the
 * rows are gone and the keys are queued.
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

describeWithDatabase("the ink plate store (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let designs: typeof import("./db/castingV2InkDesigns");
  let retention: typeof import("./castingV2/candidateRetention");

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

  /**
   * A design on that Cast, since a plate cannot exist without one — written
   * through the LIVE writer, because one still exists: `recordInkDesign` is
   * the reference road's, which he HELD rather than retired.
   */
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

  /** A sha256-shaped value; those columns are fixed-width and MySQL says so. */
  const digest = () => randomUUID().replace(/-/g, "").repeat(2).slice(0, 64);

  /**
   * A plate row, by raw INSERT — see the header. The `designId` is SELECTed
   * from the design's public id rather than passed in, so the fixture cannot
   * file a row against a design that does not exist.
   */
  async function insertPlate(designPublicId: string, userId: number, storageKey: string) {
    await connection.execute(
      "INSERT INTO casting_ink_plates (publicId, userId, designId, engine, templateKind, templateDigest,"
        + " promptDigest, storageKey, digest, mime, byteSize, width, height)"
        + " SELECT ?, ?, id, 'fal:openai/gpt-image-2/edit', 'arm', ?, ?, ?, ?, 'image/png', 512000, 1536, 1024"
        + " FROM casting_ink_designs WHERE publicId = ?",
      [randomUUID(), userId, digest(), digest(), storageKey, digest(), designPublicId],
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_plates WHERE storageKey = ?",
      [storageKey],
    );
    /* The fixture's own control: an INSERT … SELECT that matched nothing writes
       no row and reports success, so without this the arm below could pass by
       having had nothing to purge. */
    expect(rows[0].n, "the fixture really filed a plate row").toBe(1);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_ink_plates LIKE 'engine'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0037 applied");

    owner = await newUser("Plate Owner");
    designs = await import("./db/castingV2InkDesigns");
    retention = await import("./castingV2/candidateRetention");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_ink_plates");
    await connection.query("DELETE FROM casting_ink_designs");
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
    await insertPlate(designId, owner, plateKey);

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
