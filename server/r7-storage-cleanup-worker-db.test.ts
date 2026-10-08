/**
 * Disposable-MySQL proof for R7-5D. Storage is always an injected fake; this
 * suite can never contact R2 and TEST_DATABASE_URL never falls back to prod.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const DB_TEST_TIMEOUT = 60_000;

describeWithDatabase("R7-5D leased storage cleanup (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let cleanupDb: typeof import("./db/storageCleanup");
  let worker: typeof import("./casting/storageCleanupWorker");
  let accountDeletion: typeof import("./db/accountDeletion");
  let withTransaction: typeof import("./db/connection")["withTransaction"];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM storage_cleanup_batches LIKE 'leaseToken'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0009 applied");
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-5D Test', 1, 1)",
      [`r7-5d-${randomUUID()}`],
    );
    userId = inserted.insertId;
    cleanupDb = await import("./db/storageCleanup");
    worker = await import("./casting/storageCleanupWorker");
    accountDeletion = await import("./db/accountDeletion");
    ({ withTransaction } = await import("./db/connection"));
  }, DB_TEST_TIMEOUT);

  beforeEach(async () => {
    await connection.execute("DELETE FROM storage_cleanup_items");
    await connection.execute("DELETE FROM storage_cleanup_batches");
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM wardrobe_sessions WHERE userId = ?", [userId]);
    await connection.execute(
      "UPDATE users SET avatarUrl = NULL, avatarKey = NULL, bannerUrl = NULL, bannerKey = NULL WHERE id = ?",
      [userId],
    );
  }, DB_TEST_TIMEOUT);

  afterAll(async () => {
    if (!connection) return;
    await connection.execute("DELETE FROM storage_cleanup_items");
    await connection.execute("DELETE FROM storage_cleanup_batches");
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM wardrobe_sessions WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  }, DB_TEST_TIMEOUT);

  async function manifest(keys: string[]) {
    const operationId = randomUUID();
    return withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId,
      kind: "model_delete",
      storageItems: keys.map((storageKey) => ({
        storageKey,
        storageBackend: "public_r2" as const,
      })),
    }));
  }

  async function batchById(id: string) {
    const [[row]] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM storage_cleanup_batches WHERE id = ?",
      [id],
    );
    return row;
  }

  it("deletes each exact manifest key once, purges keys and conserves counts", async () => {
    const created = await manifest(["models/a/head.png", "models/a/back.png", "models/a/head.png"]);
    const calls: string[] = [];
    const result = await worker.processNextStorageCleanupBatch({
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(result).toMatchObject({ claimed: true, batchId: created.id, deleted: 2, status: "succeeded" });
    expect(calls).toEqual(["models/a/back.png", "models/a/head.png"]);
    const stored = await batchById(created.id);
    expect(stored).toMatchObject({ status: "succeeded", expectedCount: 2, deletedCount: 2, failedCount: 0 });
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  it("skips private and mixed batches without attempt burn while public cleanup continues", async () => {
    const privateBatch = await withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId: randomUUID(),
      kind: "evidence_cleanup",
      storageItems: [{
        storageKey: "users/1/models/999999999/evidence/plates/11111111-1111-4111-8111-111111111111.webp",
        storageBackend: "private_evidence_r2",
      }],
    }));
    const publicBatch = await manifest(["models/public/still-flows.png"]);
    const calls: string[] = [];
    await expect(worker.processNextStorageCleanupBatch({
      deleteObject: async (key) => {
        calls.push(key);
        return { success: true };
      },
    })).resolves.toMatchObject({
      claimed: true,
      batchId: publicBatch.id,
      status: "succeeded",
    });
    expect(calls).toEqual(["models/public/still-flows.png"]);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(privateBatch.id)).resolves.toMatchObject([
      {
        storageBackend: "private_evidence_r2",
        status: "pending",
        attempts: 0,
      },
    ]);
    await expect(worker.processNextStorageCleanupBatch({
      deleteObject: async () => {
        throw new Error("private item must not reach the public delete client");
      },
    })).resolves.toMatchObject({ claimed: false });
  }, DB_TEST_TIMEOUT);

  it("routes each explicit backend through its one exact delete authority", async () => {
    const privateKey =
      "users/1/models/999999999/evidence/plates/11111111-1111-4111-8111-111111111111.webp";
    const mixed = await withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId: randomUUID(),
      kind: "model_delete",
      storageItems: [
        { storageKey: "models/mixed/public.png", storageBackend: "public_r2" },
        { storageKey: privateKey, storageBackend: "private_evidence_r2" },
      ],
    }));
    const publicCalls: string[] = [];
    const privateCalls: string[] = [];
    await expect(worker.processNextStorageCleanupBatch({
      deleteObject: async (storageKey) => {
        publicCalls.push(storageKey);
        return { success: true };
      },
      deletePrivateObject: async (storageKey) => {
        privateCalls.push(storageKey);
        return { success: true };
      },
    })).resolves.toMatchObject({
      claimed: true,
      batchId: mixed.id,
      deleted: 2,
      status: "succeeded",
    });
    expect(publicCalls).toEqual(["models/mixed/public.png"]);
    expect(privateCalls).toEqual([privateKey]);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(mixed.id))
      .resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  /*
    THE PURGE PROMISE THE FOUNDER WAS ASKED TO TRUST (migration 0024).

    `captureRefusedRender` reserves before it writes, so a diagnostic frame
    cannot exist unregistered — but "registered" only means something if the
    worker actually sweeps a batch of THIS kind. The worker is kind-agnostic by
    design and routes on `storageBackend`; this proves that generality holds
    for the new value rather than assuming it, which is the difference between
    a promise and a mechanism.
  */
  it("sweeps a refused-render diagnostic batch through the PRIVATE authority", async () => {
    const frameKey = "casting-v2/diagnostics/1/11111111-1111-4111-8111-111111111111/painted.png";
    const batch = await withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId: randomUUID(),
      kind: "casting_diagnostic_cleanup",
      storageItems: [{ storageKey: frameKey, storageBackend: "private_evidence_r2" }],
    }));
    const privateCalls: string[] = [];
    await expect(worker.processNextStorageCleanupBatch({
      deleteObject: async () => {
        throw new Error("a face must never go to the public delete authority");
      },
      deletePrivateObject: async (storageKey) => {
        privateCalls.push(storageKey);
        return { success: true };
      },
    })).resolves.toMatchObject({
      claimed: true,
      batchId: batch.id,
      deleted: 1,
      status: "succeeded",
    });
    expect(privateCalls, "the frame is deleted, from the private bucket").toEqual([frameKey]);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(batch.id)).resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  it("recovers a crash after object deletion by replaying the idempotent delete", async () => {
    const created = await manifest(["models/crash/head.png"]);
    const now = new Date("2026-07-21T00:00:00.000Z");
    const leaseToken = randomUUID();
    const claimed = await cleanupDb.claimNextStorageCleanupBatch({
      leaseToken,
      now,
      leaseExpiresAt: new Date(now.getTime() + 1_000),
    });
    expect(claimed?.batch.id).toBe(created.id);
    const item = await cleanupDb.claimNextStorageCleanupItem({ batchId: created.id, leaseToken, now });
    expect(item?.storageKey).toBe("models/crash/head.png");
    // Simulate: R2 accepted DeleteObject, then the process died before DB settlement.
    await connection.execute(
      "UPDATE storage_cleanup_batches SET leaseExpiresAt = '2020-01-01 00:00:00' WHERE id = ?",
      [created.id],
    );
    const calls: string[] = [];
    const replay = await worker.processNextStorageCleanupBatch({
      now: new Date("2030-07-21T00:00:00.000Z"),
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(replay.status).toBe("succeeded");
    expect(calls).toEqual(["models/crash/head.png"]);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  it("backs off transient failure, does not repeat early, then succeeds", async () => {
    const created = await manifest(["models/retry/head.png"]);
    const now = new Date("2026-07-21T01:00:00.000Z");
    const first = await worker.processNextStorageCleanupBatch({
      now,
      deleteObject: async () => ({ success: false, retryable: true, errorCode: "SlowDown" }),
    });
    expect(first).toMatchObject({ status: "processing", retried: 1 });
    await expect(worker.processNextStorageCleanupBatch({
      now: new Date(now.getTime() + 30_000),
      deleteObject: async () => ({ success: true }),
    })).resolves.toMatchObject({ claimed: false });
    const calls: string[] = [];
    const second = await worker.processNextStorageCleanupBatch({
      now: new Date(now.getTime() + 61_000),
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(second.status).toBe("succeeded");
    expect(calls).toEqual(["models/retry/head.png"]);
    expect((await batchById(created.id)).deletedCount).toBe(1);
  }, DB_TEST_TIMEOUT);

  it("retains only permanent failures for explicit support repair", async () => {
    const created = await manifest(["models/partial/good.png", "models/partial/forbidden.png"]);
    const first = await worker.processNextStorageCleanupBatch({
      deleteObject: async (key) => key.endsWith("good.png")
        ? { success: true }
        : { success: false, retryable: false, errorCode: "AccessDenied" },
    });
    expect(first.status).toBe("partial");
    expect(await batchById(created.id)).toMatchObject({ expectedCount: 2, deletedCount: 1, failedCount: 1 });
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toMatchObject([
      { storageKey: "models/partial/forbidden.png", status: "failed", lastErrorCode: "AccessDenied" },
    ]);
    await expect(cleanupDb.requeueFailedStorageCleanupBatch({ batchId: created.id })).resolves.toBe(1);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toMatchObject([
      {
        storageKey: "models/partial/forbidden.png",
        status: "pending",
        attempts: 0,
        lastErrorCode: "AccessDenied",
      },
    ]);
    const repaired = await worker.processNextStorageCleanupBatch({
      deleteObject: async () => ({ success: true }),
    });
    expect(repaired.status).toBe("succeeded");
    expect(await batchById(created.id)).toMatchObject({ expectedCount: 2, deletedCount: 2, failedCount: 0 });
  }, DB_TEST_TIMEOUT);

  it("seals an empty manifest without storage calls", async () => {
    const created = await manifest([]);
    let calls = 0;
    const result = await worker.processNextStorageCleanupBatch({
      deleteObject: async () => { calls += 1; return { success: true }; },
    });
    expect(result).toMatchObject({ batchId: created.id, status: "succeeded", deleted: 0 });
    expect(calls).toBe(0);
  }, DB_TEST_TIMEOUT);

  it("account discovery includes model-less owned outputs and rejects external URLs", async () => {
    await connection.execute(
      "UPDATE users SET avatarKey = 'users/test/avatar.png', bannerUrl = 'https://external.example/banner.png' WHERE id = ?",
      [userId],
    );
    await connection.execute(
      "INSERT INTO generations (userId, modelId, type, status, pointsCost, resultUrl) VALUES (?, NULL, 'wardrobeVTO', 'completed', 1, ?), (?, NULL, 'wardrobeVTO', 'completed', 1, ?)",
      [userId, "https://owned.example/vto/result.png", userId, "https://external.example/vto/result.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history) VALUES (?, NULL, ?, JSON_ARRAY(?, ?))",
      [userId, "https://owned.example/uploads/model.png", "https://owned.example/vto/history.png", "https://external.example/vto/shared.png"],
    );
    const items = await withTransaction((tx) => accountDeletion.collectAccountOwnedStorageItemsIn(
      tx,
      userId,
      "https://owned.example",
    ));
    expect(items).toEqual([
      { storageKey: "users/test/avatar.png", storageBackend: "public_r2" },
      { storageKey: "vto/history.png", storageBackend: "public_r2" },
      { storageKey: "vto/result.png", storageBackend: "public_r2" },
    ]);
    expect(items.some((item) => item.storageKey.includes("external"))).toBe(false);
  }, DB_TEST_TIMEOUT);

  it("account deletion erases every Wardrobe/Canvas source row whose owned key is queued", async () => {
    const [insertedUser] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified, avatarKey) VALUES (?, 'Erase Me', 1, 1, 'users/delete/avatar.png')",
      [`r7-5d-delete-${randomUUID()}`],
    );
    const deletingUserId = insertedUser.insertId;
    const [insertedModel] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'test', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [deletingUserId],
    );
    const modelId = insertedModel.insertId;
    const [insertedAsset] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, storageUrl, pointsCost) VALUES (?, 'frontClose', ?, 0)",
      [modelId, "https://owned.example/models/account-anchor.png"],
    );
    const identitySnapshotId = randomUUID();
    const packageSnapshotId = randomUUID();
    await connection.execute(
      `INSERT INTO model_identity_snapshots
        (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences,
         identityText, identityTextHash, anchorAssetId, recipeVersion)
       VALUES (?, ?, 1, 'bootstrap', 'test', JSON_OBJECT(), JSON_OBJECT(), 'test', ?, ?, 'r7-test')`,
      [identitySnapshotId, modelId, "b".repeat(64), insertedAsset.insertId],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason)
       VALUES (?, ?, ?, 1, 'bootstrap')`,
      [packageSnapshotId, modelId, identitySnapshotId],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshot_slots
        (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason)
       VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap')`,
      [randomUUID(), packageSnapshotId, insertedAsset.insertId],
    );
    await connection.execute(
      "UPDATE models SET currentPackageSnapshotId = ?, stateVersion = 1 WHERE id = ?",
      [packageSnapshotId, modelId],
    );
    const [insertedGarment] = await connection.execute<ResultSetHeader>(
      "INSERT INTO wardrobe_garments (userId, slotType, originalImageUrl, originalImageKey) VALUES (?, 'tops', ?, 'garments/original.png')",
      [deletingUserId, "https://owned.example/garments/original.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_outfits (userId, name, garmentIds, resultThumbUrl, resultThumbKey) VALUES (?, 'Outfit', JSON_ARRAY(?), ?, 'outfits/result.png')",
      [deletingUserId, insertedGarment.insertId, "https://owned.example/outfits/result.png"],
    );
    const [insertedSession] = await connection.execute<ResultSetHeader>(
      "INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history) VALUES (?, ?, ?, JSON_ARRAY(?))",
      [deletingUserId, modelId, "https://owned.example/shared/input.png", "https://owned.example/sessions/generated.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_looks (userId, sessionId, modelId, imageUrl, name) VALUES (?, ?, ?, ?, 'Saved look')",
      [deletingUserId, insertedSession.insertId, modelId, "https://owned.example/looks/saved.png"],
    );
    const [insertedBoard] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, startedWith, thumbnailUrl, thumbnailKey) VALUES (?, 'Delete board', 'blank', ?, 'boards/thumb.png')",
      [deletingUserId, "https://owned.example/boards/thumb.png"],
    );
    const boardId = insertedBoard.insertId;
    const [firstItem] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label, imageUrl, imageKey) VALUES (?, 'reference', 'image', 'Owned', ?, 'boards/item.png')",
      [boardId, "https://owned.example/boards/item.png"],
    );
    const [secondItem] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label) VALUES (?, 'note', 'note', 'Note')",
      [boardId],
    );
    await connection.execute(
      "INSERT INTO board_item_versions (itemId, version, imageUrl) VALUES (?, 1, ?)",
      [firstItem.insertId, "https://owned.example/boards/history.png"],
    );
    await connection.execute(
      "INSERT INTO board_edges (boardId, sourceItemId, targetItemId, relation) VALUES (?, ?, ?, 'reference_for')",
      [boardId, firstItem.insertId, secondItem.insertId],
    );

    const previousPublicUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://owned.example";
    let result!: Awaited<ReturnType<typeof accountDeletion.deleteUserAccount>>;
    try {
      result = await accountDeletion.deleteUserAccount(deletingUserId);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
      else process.env.R2_PUBLIC_URL = previousPublicUrl;
    }

    expect(result).toMatchObject({
      success: true,
      cleanupObjects: 8,
      deletedCounts: {
        boardEdges: 1,
        boardItemVersions: 1,
        boardItems: 2,
        boards: 1,
        wardrobeLooks: 1,
        wardrobeSessions: 1,
        wardrobeOutfits: 1,
        wardrobeGarments: 1,
        modelPackageSnapshotSlots: 1,
        modelPackageSnapshots: 1,
        modelIdentitySnapshots: 1,
        models: 1,
        user: 1,
      },
    });
    const expectedEmpty = [
      ["users", "id", deletingUserId],
      ["models", "userId", deletingUserId],
      ["model_package_snapshot_slots", "packageSnapshotId", packageSnapshotId],
      ["model_package_snapshots", "modelId", modelId],
      ["model_identity_snapshots", "modelId", modelId],
      ["wardrobe_garments", "userId", deletingUserId],
      ["wardrobe_outfits", "userId", deletingUserId],
      ["wardrobe_sessions", "userId", deletingUserId],
      ["wardrobe_looks", "userId", deletingUserId],
      ["boards", "userId", deletingUserId],
      ["board_items", "boardId", boardId],
      ["board_item_versions", "itemId", firstItem.insertId],
      ["board_edges", "boardId", boardId],
    ] as const;
    for (const [table, column, value] of expectedEmpty) {
      const [[row]] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` = ?`,
        [value],
      );
      expect(Number(row.n), `${table} should be erased`).toBe(0);
    }
    const cleanupItems = await cleanupDb.getStorageCleanupItemsForBatch(result.cleanupBatchId!);
    expect(cleanupItems.map((item) => item.storageKey).sort()).toEqual([
      "boards/item.png",
      "boards/thumb.png",
      "garments/original.png",
      "looks/saved.png",
      "models/account-anchor.png",
      "outfits/result.png",
      "sessions/generated.png",
      "users/delete/avatar.png",
    ]);
    expect(cleanupItems.some((item) => item.storageKey.includes("shared/input"))).toBe(false);
  }, DB_TEST_TIMEOUT);

  /**
   * THE WHOLE CASTING STUDIO GOES WITH THE ACCOUNT — #1935's done-when,
   * driven.
   *
   * The arm above proves wardrobe and canvas. Until #1935 the casting studio
   * had no arm at all here because it was not erased at all: a sheet, its
   * rolls, every candidate face, every refinement, the reference library, a
   * customer's own attached photograph and the tattoos cut out of it all
   * survived the deletion, with their objects left at permanently public R2
   * URLs that are designed never to expire.
   *
   * It builds the awkward cases on purpose, not the easy one:
   *
   *  - a **signed** candidate and a **kept** one, because the retention
   *    sweep's own delete refuses both and account erasure must not;
   *  - an **ink plate**, whose only path back to an account runs through its
   *    design row, so a wrong delete order orphans it forever;
   *  - the **two exemptions** as negative controls — a free-grant claim and a
   *    plan-change settlement, which must still be there afterwards.
   */
  it("erases the whole casting studio with the account, signed and kept rows included", async () => {
    const [insertedUser] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Casting Erase', 1, 1)",
      [`r7-5d-casting-${randomUUID()}`],
    );
    const castingUserId = insertedUser.insertId;

    const [sheet] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_sessions (publicId, userId, originType, status) VALUES (?, ?, 'roster', 'open')",
      [randomUUID(), castingUserId],
    );
    const sessionId = sheet.insertId;
    const [roll] = await connection.execute<ResultSetHeader>(
      `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId)
       VALUES (?, ?, ?, 0, 'a brief', 'complete', ?)`,
      [randomUUID(), sessionId, castingUserId, randomUUID()],
    );
    const rollId = roll.insertId;

    const candidateIds: number[] = [];
    /* position 0 becomes SIGNED, 1 becomes KEPT, 2 is an ordinary face. */
    for (const position of [0, 1, 2] as const) {
      const [candidate] = await connection.execute<ResultSetHeader>(
        `INSERT INTO casting_candidates
          (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey, sourceKey)
         VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
        [
          randomUUID(), rollId, sessionId, castingUserId, position,
          `casting-v2/candidates/c${position}.png`,
          `casting-v2/candidates/c${position}-thumb.png`,
          position === 0 ? `casting-v2/candidates/c0-source.png` : null,
        ],
      );
      candidateIds.push(candidate.insertId);
    }
    /* The two the retention sweep is forbidden to touch. */
    await connection.execute(
      "UPDATE casting_candidates SET signedCastId = ? WHERE id = ?",
      [castingUserId, candidateIds[0]],
    );
    await connection.execute(
      "UPDATE casting_candidates SET keptAt = NOW() WHERE id = ?",
      [candidateIds[1]],
    );

    const [variant] = await connection.execute<ResultSetHeader>(
      `INSERT INTO casting_candidate_variants
        (publicId, candidateId, sessionId, userId, status, instructions, operationId, imageKey, thumbKey)
       VALUES (?, ?, ?, ?, 'ready', JSON_ARRAY(), ?, ?, ?)`,
      [
        randomUUID(), candidateIds[0], sessionId, castingUserId, randomUUID(),
        "casting-v2/variants/v1.png", "casting-v2/variants/v1-thumb.png",
      ],
    );
    const variantId = variant.insertId;

    await connection.execute(
      `INSERT INTO casting_segments
        (publicId, userId, candidateId, provenance, facet, region, maskKey, contentKey,
         bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight)
       VALUES (?, ?, ?, 'detected_born', 'skin', 'neck', ?, ?, 0, 0, 8, 8, 64, 64)`,
      [randomUUID(), castingUserId, candidateIds[0], "casting-v2/segments/s1-mask.png", "casting-v2/segments/s1.png"],
    );
    await connection.execute(
      `INSERT INTO casting_reference_library
        (publicId, userId, candidateId, role, slot, tier, noun, words, storageKey, maskKey,
         refusedContentKey, refusedMaskKey)
       VALUES (?, ?, ?, 'anchor', 'ink:neck', 'item', 'tattoo', JSON_ARRAY(), ?, ?, ?, ?)`,
      [
        randomUUID(), castingUserId, candidateIds[0],
        "casting-v2/library/l1.png", "casting-v2/library/l1-mask.png",
        "casting-v2/library/l1-refused.png", "casting-v2/library/l1-refused-mask.png",
      ],
    );
    await connection.execute(
      `INSERT INTO casting_face_scans
        (publicId, userId, candidateId, versionKey, frameKey, geometry, stencilBytes)
       VALUES (?, ?, ?, 'master', ?, JSON_OBJECT('slots', JSON_ARRAY(JSON_OBJECT('maskKey', ?))), 128)`,
      [
        randomUUID(), castingUserId, candidateIds[0],
        /* `frameKey` POINTS AT the candidate's own frame — it is not a second
           object, and the manifest must not carry it twice. */
        "casting-v2/candidates/c0.png",
        "casting-v2/scans/stencil-1.png",
      ],
    );
    const [design] = await connection.execute<ResultSetHeader>(
      `INSERT INTO casting_ink_designs
        (publicId, userId, candidateId, placement, side, provenance, intents, storageKey,
         digest, mime, byteSize, width, height)
       VALUES (?, ?, ?, 'neck', 'centre', 'consented', JSON_ARRAY(), ?, ?, 'image/png', 10, 8, 8)`,
      [randomUUID(), castingUserId, candidateIds[0], "casting-v2/ink/design-1.png", "a".repeat(64)],
    );
    await connection.execute(
      `INSERT INTO casting_ink_plates
        (publicId, userId, designId, engine, templateKind, templateDigest, storageKey,
         digest, mime, byteSize, width, height)
       VALUES (?, ?, ?, 'test-engine', 'body', ?, ?, ?, 'image/png', 10, 8, 8)`,
      [
        randomUUID(), castingUserId, design.insertId, "b".repeat(64),
        "casting-v2/ink/plate-1.png", "c".repeat(64),
      ],
    );
    await connection.execute(
      `INSERT INTO casting_ink_delivery_crops
        (publicId, userId, candidateId, designId, variantId, slot, region, storageKey, digest,
         mime, byteSize, width, height, bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight,
         maskPixels, keptPixels)
       VALUES (?, ?, ?, ?, ?, 'ink:neck', 'tattooed skin', ?, ?, 'image/png', 10, 8, 8,
               0, 0, 8, 8, 64, 64, 32, 32)`,
      [
        randomUUID(), castingUserId, candidateIds[0], design.insertId, variantId,
        "casting-v2/ink/delivered-1.png", "d".repeat(64),
      ],
    );
    await connection.execute(
      `INSERT INTO casting_reference_crops
        (publicId, userId, candidateId, intent, source, provenance, region, storageKey, digest,
         mime, byteSize, width, height, guardKind, guardCoverage)
       VALUES (?, ?, ?, 'hair', 'uploadedReference', 'consented', 'hair', ?, ?, 'image/png',
               10, 8, 8, 'coverage', 50)`,
      [randomUUID(), castingUserId, candidateIds[0], "casting-v2/crops/crop-1.png", "e".repeat(64)],
    );
    await connection.execute(
      `INSERT INTO casting_reference_attachments
        (publicId, userId, candidateId, provenance, storageKey, digest, mime, byteSize, width, height)
       VALUES (?, ?, ?, 'consented', ?, ?, 'image/jpeg', 10, 8, 8)`,
      [randomUUID(), castingUserId, candidateIds[0], "casting-v2/attachments/her-photo.jpg", "f".repeat(64)],
    );

    /* An operation receipt and its lease — the lease has no `userId` of its own. */
    const operationId = randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations (id, userId, clientRequestId, kind, payloadHash, status)
       VALUES (?, ?, ?, 'castingV2.roll', ?, 'succeeded')`,
      [operationId, castingUserId, randomUUID(), "0".repeat(64)],
    );
    await connection.execute(
      `INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt)
       VALUES (?, ?, 'castingV2.roll', DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [`casting:${castingUserId}`, operationId],
    );

    /* Her words, and a day's house-money tally. */
    await connection.execute(
      "INSERT INTO bug_reports (userId, description, category) VALUES (?, 'the sheet froze', 'casting')",
      [castingUserId],
    );
    await connection.execute(
      "INSERT INTO face_scan_daily_usage (userId, day, scans) VALUES (?, '2026-10-08', 3)",
      [castingUserId],
    );

    /* THE TWO NEGATIVE CONTROLS — both must SURVIVE the deletion. */
    await connection.execute(
      "INSERT INTO free_grant_claims (deviceKey, ipAddress, userId) VALUES (?, '203.0.113.9', ?)",
      [`cookie:${randomUUID()}`, castingUserId],
    );
    const settledInvoice = `in_${randomUUID().replace(/-/g, "")}`;
    await connection.execute(
      `INSERT INTO plan_change_settlements
        (userId, stripeInvoiceId, direction, credits, description, status)
       VALUES (?, ?, 'grant', 1000, 'Upgrade to Pro', 'applied')`,
      [castingUserId, settledInvoice],
    );

    const previousPublicUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://owned.example";
    let result!: Awaited<ReturnType<typeof accountDeletion.deleteUserAccount>>;
    try {
      result = await accountDeletion.deleteUserAccount(castingUserId);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
      else process.env.R2_PUBLIC_URL = previousPublicUrl;
    }

    expect(result).toMatchObject({
      success: true,
      deletedCounts: {
        castingSessions: 1,
        castingRolls: 1,
        castingCandidates: 3,
        castingCandidateVariants: 1,
        castingSegments: 1,
        castingReferenceLibrary: 1,
        castingFaceScans: 1,
        castingInkDesigns: 1,
        castingInkPlates: 1,
        castingInkDeliveryCrops: 1,
        castingReferenceCrops: 1,
        castingReferenceAttachments: 1,
        generationOperations: 1,
        generationOperationLocks: 1,
        bugReports: 1,
        faceScanDailyUsage: 1,
        user: 1,
      },
    });

    for (const table of [
      "casting_sessions", "casting_rolls", "casting_candidates",
      "casting_candidate_variants", "casting_segments", "casting_reference_library",
      "casting_face_scans", "casting_ink_designs", "casting_ink_plates",
      "casting_ink_delivery_crops", "casting_reference_crops",
      "casting_reference_attachments", "generation_operations", "bug_reports",
      "face_scan_daily_usage",
    ]) {
      const [[row]] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM \`${table}\` WHERE userId = ?`,
        [castingUserId],
      );
      expect(Number(row.n), `${table} should be erased`).toBe(0);
    }
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [operationId],
    );
    expect(Number(lock.n), "the lease must not outlive its operation").toBe(0);

    /* The two exemptions, read back by name rather than counted. */
    const [[claims]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM free_grant_claims WHERE userId = ?",
      [castingUserId],
    );
    expect(Number(claims.n), "the free-grant fraud guard is exempt").toBe(1);
    const [[settlements]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM plan_change_settlements WHERE stripeInvoiceId = ?",
      [settledInvoice],
    );
    expect(Number(settlements.n), "the settlement ledger is exempt").toBe(1);
    await connection.execute("DELETE FROM free_grant_claims WHERE userId = ?", [castingUserId]);
    await connection.execute(
      "DELETE FROM plan_change_settlements WHERE stripeInvoiceId = ?",
      [settledInvoice],
    );

    /*
      EVERY OBJECT, EXACTLY ONCE. The scan's `frameKey` is the candidate's own
      `imageKey` and appears here once, not twice — which is the dedupe doing
      its job rather than a coincidence.
    */
    const cleanupItems = await cleanupDb.getStorageCleanupItemsForBatch(result.cleanupBatchId!);
    expect(cleanupItems.map((item) => item.storageKey).sort()).toEqual([
      "casting-v2/attachments/her-photo.jpg",
      "casting-v2/candidates/c0-source.png",
      "casting-v2/candidates/c0-thumb.png",
      "casting-v2/candidates/c0.png",
      "casting-v2/candidates/c1-thumb.png",
      "casting-v2/candidates/c1.png",
      "casting-v2/candidates/c2-thumb.png",
      "casting-v2/candidates/c2.png",
      "casting-v2/crops/crop-1.png",
      "casting-v2/ink/delivered-1.png",
      "casting-v2/ink/design-1.png",
      "casting-v2/ink/plate-1.png",
      "casting-v2/library/l1-mask.png",
      "casting-v2/library/l1-refused-mask.png",
      "casting-v2/library/l1-refused.png",
      "casting-v2/library/l1.png",
      "casting-v2/scans/stencil-1.png",
      "casting-v2/segments/s1-mask.png",
      "casting-v2/segments/s1.png",
      "casting-v2/variants/v1-thumb.png",
      "casting-v2/variants/v1.png",
    ]);
  }, DB_TEST_TIMEOUT);
});
