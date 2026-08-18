/**
 * The ink design store against a real database (migration 0034).
 *
 * The doors are proved in `castingV2/inkUploadDoor.test.ts` and the order in
 * `castingV2/inkUploadService.test.ts`. This file proves the **statements** —
 * that a stranger's Cast cannot be written to however good the ids are, that
 * the cap is a fact about the table rather than a number in a comment, that the
 * manifest holding the bytes is released by the row that claims them, and that
 * a customer's own photograph dies with the Cast it was attached to.
 *
 * That last one is the promise the whole road rests on and the one thing that
 * cannot be proved by mocking: a purge is a claim until MySQL has deleted the
 * row and the manifest actually holds the key.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --suite server/castingV2-ink-design-db.test.ts
 * which creates one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("the ink design store (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let designs: typeof import("./db/castingV2InkDesigns");
  let retention: typeof import("./castingV2/candidateRetention");
  let cleanup: typeof import("./db/storageCleanup");
  let db: typeof import("./db/connection");

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`ink-${randomUUID()}`, name],
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

  function design(candidatePublicId: string, userId: number, storageKey: string) {
    return {
      userId,
      candidatePublicId,
      placement: "upperArm" as const,
      side: "left" as const,
      provenance: "consented" as const,
      intents: ["tattoo"] as const,
      storageKey,
      digest: randomUUID().replace(/-/g, "").repeat(2).slice(0, 64),
      mime: "image/png",
      byteSize: 40_137,
      width: 900,
      height: 1200,
    };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_ink_designs LIKE 'provenance'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0034 applied");

    owner = await newUser("Ink Owner");
    stranger = await newUser("Ink Stranger");
    designs = await import("./db/castingV2InkDesigns");
    retention = await import("./castingV2/candidateRetention");
    cleanup = await import("./db/storageCleanup");
    db = await import("./db/connection");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_ink_designs");
  });

  it("files a design against the Cast it names, and reads it back", async () => {
    const cast = await newCast(owner);
    const key = `casting-v2/ink/${randomUUID()}.png`;

    const recorded = await designs.recordInkDesign(design(cast.publicId, owner, key));
    expect(recorded.candidateId).toBe(cast.candidateId);

    const listed = await designs.listInkDesigns({ userId: owner, candidatePublicId: cast.publicId });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      placement: "upperArm",
      side: "left",
      provenance: "consented",
      storageKey: key,
      width: 900,
      height: 1200,
    });
    /* THE DECLARATION SURVIVES THE ROUND TRIP (migration 0035). A JSON column
       comes back parsed on one driver path and as text on another, so this is
       the assertion that would catch a reader handing a caller a string that
       merely looks like a list. */
    expect(listed[0]!.intents).toEqual(["tattoo"]);
  });

  it("keeps a multi-feature declaration as the set it was given", async () => {
    /* fable-937: multi-intent uploads run each declared form independently.
       Whether a form is BUILT is the door's question; the store keeps what was
       declared, in order, without collapsing it. */
    const cast = await newCast(owner);
    await designs.recordInkDesign({
      ...design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`),
      intents: ["tattoo", "hair"] as const,
    });

    const listed = await designs.listInkDesigns({ userId: owner, candidatePublicId: cast.publicId });
    expect(listed[0]!.intents).toEqual(["tattoo", "hair"]);
  });

  /**
   * INVARIANT 1, AT THE STATEMENT.
   *
   * The stranger here holds the owner's candidate `publicId` — a real uuid for
   * a real Cast. The only thing between them and writing a picture onto
   * somebody else's work is the `userId` in the same WHERE as the read, and
   * that is what this drives.
   */
  it("refuses to file a design against somebody else's Cast", async () => {
    const cast = await newCast(owner);

    await expect(designs.recordInkDesign(
      design(cast.publicId, stranger, `casting-v2/ink/${randomUUID()}.png`),
    )).rejects.toBeInstanceOf(designs.InkDesignOwnershipError);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
      [cast.candidateId],
    );
    expect(rows[0].n, "nothing was written on the way to the refusal").toBe(0);
  });

  it("does not hand one account's designs to another", async () => {
    const cast = await newCast(owner);
    await designs.recordInkDesign(design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`));

    expect(await designs.listInkDesigns({
      userId: stranger,
      candidatePublicId: cast.publicId,
    })).toEqual([]);
  });

  it("holds the cap at the table, and holds it per Cast rather than per account", async () => {
    const cast = await newCast(owner);
    const other = await newCast(owner);
    for (let at = 0; at < 8; at += 1) {
      await designs.recordInkDesign(design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`));
    }

    await expect(designs.recordInkDesign(
      design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`),
    )).rejects.toBeInstanceOf(designs.InkDesignCapError);

    /* The same account's OTHER Cast is unaffected — the cap is a bound on one
       face's storage, not a quota on a customer. */
    await expect(designs.recordInkDesign(
      design(other.publicId, owner, `casting-v2/ink/${randomUUID()}.png`),
    )).resolves.toMatchObject({ candidateId: other.candidateId });
  });

  /**
   * THE CAP SURVIVES TWO CLICKS AT ONCE — and this arm says exactly how much of
   * that it proves, because the obvious version proved nothing.
   *
   * Written first as *"fire two concurrent uploads at a Cast holding seven"*.
   * It passed. It ALSO passed with `.for("update")` deleted from
   * `recordInkDesign`, which means it was not testing the lock — the two
   * transactions do not reliably overlap on this path, because the second one
   * waits on a fresh pooled connection to a remote server while the first is
   * already committing.
   *
   * So the lock was measured where it can be, at the statements, by
   * `scripts/probe-ink-cap-race-disposable.mts` — both arms, two window widths,
   * on a disposable database:
   *
   *     [unlocked] window=0ms   outcomes=wrote/wrote    rows=9 (cap 8)
   *     [locked  ] window=0ms   outcomes=refused/wrote  rows=8 (cap 8)
   *     [unlocked] window=250ms outcomes=wrote/wrote    rows=9 (cap 8)
   *     [locked  ] window=250ms outcomes=refused/wrote  rows=8 (cap 8)
   *
   * The race is real, and the lock is the thing that stops it. What is left
   * here is the invariant — the table never holds nine, however the calls
   * arrive — plus the structural assertion below that the lock is still on the
   * statement, since that is the part this suite genuinely can hold.
   */
  it("never lets a Cast hold more than the cap, however the calls arrive", async () => {
    const cast = await newCast(owner);
    for (let at = 0; at < 7; at += 1) {
      await designs.recordInkDesign(design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`));
    }

    const outcomes = await Promise.allSettled([
      designs.recordInkDesign(design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`)),
      designs.recordInkDesign(design(cast.publicId, owner, `casting-v2/ink/${randomUUID()}.png`)),
    ]);

    /* Deliberately NOT "exactly one succeeded" — that is the assertion that
       passed against an unlocked writer. The bound is what matters. */
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
      [cast.candidateId],
    );
    expect(Number(rows[0].n)).toBeLessThanOrEqual(8);
    expect(outcomes.filter((one) => one.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
  });

  it("still selects the parent FOR UPDATE — the lock the measurement above bought", async () => {
    /* A structural assertion, on the file, because the behavioural one cannot
       discriminate here. `castLineagePurge.test.ts` holds its own lock the same
       way and for the same reason. */
    const source = await readFile("server/db/castingV2InkDesigns.ts", "utf8");
    expect(source).toContain('.for("update")');
  });

  /**
   * THE ROW RELEASES THE RECEIPT — and only a committed row does.
   */
  it("discharges the manifest that was holding the bytes", async () => {
    const cast = await newCast(owner);
    const key = `casting-v2/ink/${randomUUID()}.png`;
    const batchId = randomUUID();
    await db.withTransaction((tx) => cleanup.createStorageCleanupManifestIn(tx, {
      id: batchId,
      userId: owner,
      operationId: randomUUID(),
      heldUntil: cleanup.storageCleanupManifestHeldUntil(),
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: key, storageBackend: "public_r2" as const }],
    }));

    await designs.recordInkDesign({ ...design(cast.publicId, owner, key), cleanupBatchId: batchId });

    const [batches] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE id = ?",
      [batchId],
    );
    expect(batches[0].n, "the hold is gone, so the design is not scheduled for deletion").toBe(0);
    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE batchId = ?",
      [batchId],
    );
    expect(items[0].n).toBe(0);
  });

  it("keeps the bytes scheduled when the row it was written for is refused", async () => {
    /*
      A refusal after the bytes have landed must NOT discharge the manifest —
      that is the litter path, and it is the reason the discharge lives inside
      the same transaction as the insert rather than beside it.
    */
    const cast = await newCast(owner);
    const key = `casting-v2/ink/${randomUUID()}.png`;
    const batchId = randomUUID();
    await db.withTransaction((tx) => cleanup.createStorageCleanupManifestIn(tx, {
      id: batchId,
      userId: owner,
      operationId: randomUUID(),
      heldUntil: cleanup.storageCleanupManifestHeldUntil(),
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: key, storageBackend: "public_r2" as const }],
    }));

    await expect(designs.recordInkDesign({
      ...design(cast.publicId, stranger, key),
      cleanupBatchId: batchId,
    })).rejects.toBeInstanceOf(designs.InkDesignOwnershipError);

    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE batchId = ?",
      [batchId],
    );
    expect(items[0].n, "the worker still has the key, so nothing is stranded").toBe(1);
  });

  /**
   * THE PROMISE THE UPLOAD IS ALLOWED TO MAKE.
   *
   * Every other artifact the sweep collects is something this product made. A
   * design is a photograph a CUSTOMER handed us, kept at a permanently public
   * URL. "It leaves when your Cast does" is either true here or it is not true
   * anywhere.
   */
  it("purges a design's row AND hands its bytes to the cleanup worker with the Cast", async () => {
    const cast = await newCast(owner);
    const keys = [`casting-v2/ink/${randomUUID()}.png`, `casting-v2/ink/${randomUUID()}.jpg`];
    for (const key of keys) {
      await designs.recordInkDesign(design(cast.publicId, owner, key));
    }

    // Make the candidate purgeable the way the product does: discarded, expired.
    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', discardedAt = NOW(), expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [cast.candidateId],
    );

    const result = await retention.runCandidateRetentionSweep();
    expect(result.candidatesPurged).toBeGreaterThanOrEqual(1);

    const [remaining] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
      [cast.candidateId],
    );
    expect(remaining[0].n, "her picture died with her Cast").toBe(0);

    const [queued] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey IN (?, ?)",
      keys,
    );
    expect(queued.map((row) => String(row.storageKey)).sort()).toEqual([...keys].sort());
  });
});
