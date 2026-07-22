import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { modelAssets, models } from "../drizzle/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7A3 atomic snapshot transitions (disposable DB)", () => {
  let connection: Connection;
  let operations: typeof import("./db/generationOperations");
  let bootstrapModelSnapshot: typeof import("./casting/snapshotBootstrap").bootstrapModelSnapshot;
  let commitModelSnapshotTransition: typeof import("./casting/snapshotTransitions").commitModelSnapshotTransition;
  let commitDocumentCompactionSnapshot: typeof import("./casting/snapshotTransitions").commitDocumentCompactionSnapshot;
  let commitRestoredSlotSnapshot: typeof import("./casting/snapshotTransitions").commitRestoredSlotSnapshot;
  let commitImageRefineSnapshot: typeof import("./casting/snapshotTransitions").commitImageRefineSnapshot;
  let commitIteratedIdentitySnapshot: typeof import("./casting/snapshotTransitions").commitIteratedIdentitySnapshot;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.slice(1).startsWith("drape_r7_7a2_disposable_")) {
      throw new Error("R7-7A3 DB tests require the guarded snapshot disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    operations = await import("./db/generationOperations");
    ({ bootstrapModelSnapshot } = await import("./casting/snapshotBootstrap"));
    ({
      commitModelSnapshotTransition,
      commitDocumentCompactionSnapshot,
      commitRestoredSlotSnapshot,
      commitImageRefineSnapshot,
      commitIteratedIdentitySnapshot,
    } = await import("./casting/snapshotTransitions"));
  });

  beforeEach(async () => {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "generation_operation_locks",
      "generation_operations",
      "model_package_snapshot_slots",
      "model_package_snapshots",
      "model_identity_snapshots",
      "model_assets",
      "models",
      "users",
    ]) await connection.query(`TRUNCATE TABLE \`${table}\``);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    delete process.env.DATABASE_URL;
  });

  async function createUser(): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Transition test', 1, 1)",
      [`r7-7a3-${randomUUID()}`],
    );
    return inserted.insertId;
  }

  async function createModel(userId: number, status = "draft"): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO models
        (userId, name, masterPrompt, technicalSchema, preferences, status)
       VALUES (?, 'Transition Cast', 'identity-v1', JSON_OBJECT('hair', 'brown'),
         JSON_OBJECT('hairColor', 'Brown'), ?)`,
      [userId, status],
    );
    return inserted.insertId;
  }

  async function addAsset(input: {
    modelId: number;
    viewAngle: "frontClose" | "sideClose" | "backFull";
    role?: "anchor" | "display";
    revisionId?: string;
    url?: string;
  }): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO model_assets (modelId, viewType, storageUrl, pointsCost, provenance)
       VALUES (?, ?, ?, 0, ?)`,
      [
        input.modelId,
        input.viewAngle,
        input.url ?? `https://example.invalid/${randomUUID()}.png`,
        JSON.stringify({
          ...(input.role ? { identityRole: input.role } : {}),
          ...(input.revisionId ? { identityRevisionId: input.revisionId } : {}),
        }),
      ],
    );
    return inserted.insertId;
  }

  async function one(sql: string, params: unknown[] = []): Promise<RowDataPacket> {
    const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
    if (!rows[0]) throw new Error("Expected one row");
    return rows[0];
  }

  async function count(table: string, where = "1=1", params: unknown[] = []): Promise<number> {
    const row = await one(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`, params);
    return Number(row.count);
  }

  async function startModelOperation(
    userId: number,
    modelId: number,
    kind: "casting.iterate" | "casting.compact" | "casting.mint" | "casting.restore" = "casting.iterate",
  ): Promise<string> {
    const claimed = await operations.claimGenerationOperation({
      userId,
      clientRequestId: randomUUID(),
      kind,
      modelId,
      payload: { modelId, feedback: "snapshot transition test" },
    });
    if (claimed.type !== "claimed") throw new Error("operation claim failed");
    const lockKey = `model:${modelId}`;
    const locked = await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind,
      lockKey,
    });
    if (locked.type !== "acquired") throw new Error("operation lock failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId,
      plannedCredits: 0,
      requiredLockKey: lockKey,
      phase: "finalizing",
    });
    return claimed.operationId;
  }

  async function createBootstrappedModel(userId: number): Promise<{
    modelId: number;
    anchorAssetId: number;
    sideAssetId: number;
    identitySnapshotId: string;
    packageSnapshotId: string;
  }> {
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "anchor" });
    const sideAssetId = await addAsset({ modelId, viewAngle: "sideClose" });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    return {
      modelId,
      anchorAssetId,
      sideAssetId,
      identitySnapshotId: head.identitySnapshotId,
      packageSnapshotId: head.packageSnapshotId,
    };
  }

  it("appends a package state, copies unchanged slots and advances the head once", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);

    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        const [inserted] = await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "sideClose",
          resolution: "1K",
          storageUrl: `https://example.invalid/side-refine-${randomUUID()}.png`,
          pointsCost: 0,
        }).$returningId();
        if (!inserted?.id) throw new Error("refined asset insert failed");
        return {
          result: { assetId: inserted.id },
          transition: {
            packageReason: "image_refine" as const,
            slotChanges: [{
              viewAngle: "sideClose" as const,
              selectedAssetId: inserted.id,
              compatibility: "current" as const,
              selectionReason: "generated" as const,
            }],
          },
        };
      },
    });

    expect(committed).toMatchObject({
      modelId: base.modelId,
      identitySnapshotId: base.identitySnapshotId,
      stateVersion: 2,
      selectedSlotCount: 2,
    });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(2);
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    expect(slots).toHaveLength(2);
    expect(slots.find((slot) => slot.viewAngle === "frontClose")).toMatchObject({
      selectedAssetId: base.anchorAssetId,
      compatibility: "current",
      selectionReason: "carried",
    });
    expect(slots.find((slot) => slot.viewAngle === "sideClose")).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    expect(slots.every((slot) => typeof slot.sourceSelectionId === "string")).toBe(true);

    let replayCallbackInvoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        replayCallbackInvoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({
      name: "SnapshotTransitionAlreadyCommittedError",
      packageSnapshotId: committed.packageSnapshotId,
    });
    expect(replayCallbackInvoked).toBe(false);
  }, 60_000);

  it("copy-forwards a compatible historical slot and selects it atomically", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({
      modelId,
      viewAngle: "frontClose",
      role: "anchor",
      revisionId: "genesis",
    });
    const sourceAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-old.png",
    });
    const currentSideAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-current.png",
    });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const previousSideSlot = await one(
      `SELECT id FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [head.packageSnapshotId],
    );
    const operationId = await startModelOperation(userId, modelId, "casting.restore");

    const committed = await commitRestoredSlotSnapshot({
      userId,
      modelId,
      operationId,
      angle: "sideClose",
      assetId: sourceAssetId,
    });

    expect(committed.result.url).toBe("https://example.invalid/side-old.png");
    expect(committed.result.version).toBe(3);
    expect(committed.result.assetId).not.toBe(sourceAssetId);
    expect(committed.result.assetId).not.toBe(currentSideAssetId);
    const restoredAsset = await one("SELECT * FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(restoredAsset.storageUrl).toBe("https://example.invalid/side-old.png");
    expect(Number(restoredAsset.pointsCost)).toBe(0);
    expect(Number(restoredAsset.pinned)).toBe(0);
    const restoredProvenance = typeof restoredAsset.provenance === "string"
      ? JSON.parse(restoredAsset.provenance)
      : restoredAsset.provenance;
    expect(restoredProvenance).toMatchObject({
      restoredFromAssetId: sourceAssetId,
      identityRole: "display",
      identityRevisionId: "genesis",
    });
    const selectedSide = await one(
      `SELECT selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selectedSide.selectedAssetId)).toBe(committed.result.assetId);
    expect(selectedSide.compatibility).toBe("current");
    expect(selectedSide.selectionReason).toBe("restored");
    expect(selectedSide.sourceSelectionId).toBe(previousSideSlot.id);
    const selectedHead = await one(
      `SELECT selectedAssetId, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'frontClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selectedHead.selectedAssetId)).toBe(anchorAssetId);
    expect(selectedHead.selectionReason).toBe("carried");
    expect(await count("model_identity_snapshots", "modelId = ?", [modelId])).toBe(1);
  }, 60_000);

  it("commits an image-only refinement as one display asset and package selection", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.iterate");

    const committed = await commitImageRefineSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      candidate: {
        targetAssetId: base.sideAssetId,
        storageUrl: "https://example.invalid/side-refined.png",
        storageKey: "models/side-refined.png",
        engine: "test",
        pointsCost: 350,
      },
      imageOnlyCategories: ["image.lighting"],
    });

    const asset = await one("SELECT * FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(asset).toMatchObject({
      modelId: base.modelId,
      viewType: "sideClose",
      storageUrl: "https://example.invalid/side-refined.png",
      storageKey: "models/side-refined.png",
      pointsCost: 350,
    });
    const provenance = typeof asset.provenance === "string" ? JSON.parse(asset.provenance) : asset.provenance;
    expect(provenance).toMatchObject({
      identityRole: "display",
      identityRevisionId: "genesis",
      engine: "test",
      imageOnlyCategories: ["image.lighting"],
    });
    const selected = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(selected).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    expect(await one("SELECT reason, identitySnapshotId FROM model_package_snapshots WHERE id = ?", [committed.packageSnapshotId]))
      .toEqual({ reason: "image_refine", identitySnapshotId: base.identitySnapshotId });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await one("SELECT masterPrompt, identityRevisionId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ masterPrompt: "identity-v1", identityRevisionId: null });
  }, 60_000);

  it("commits a typed identity iteration with a paired head and stale carried siblings", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.iterate");

    const committed = await commitIteratedIdentitySnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      patch: {
        source: "text",
        edits: [{
          kind: "leaf",
          leaf: "person.hair.color",
          operation: "modify",
          value: { base: "Hot Pink", override: "" },
        }],
      },
      candidate: {
        targetAssetId: base.anchorAssetId,
        storageUrl: "https://example.invalid/head-pink.png",
        storageKey: "models/head-pink.png",
        engine: "test",
        pointsCost: 350,
      },
    });

    const model = await one(
      "SELECT masterPrompt, preferences, identityRevisionId, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(model.masterPrompt).toContain("Hot Pink");
    const preferences = typeof model.preferences === "string" ? JSON.parse(model.preferences) : model.preferences;
    expect(preferences.hairColor).toBe("Hot Pink");
    expect(String(model.identityRevisionId)).toMatch(/^rev-/);
    expect(model).toMatchObject({ stateVersion: 2, currentPackageSnapshotId: committed.packageSnapshotId });
    expect(committed.result).toMatchObject({
      assetId: expect.any(Number),
      identityRevisionId: model.identityRevisionId,
      releasedDependents: [],
    });
    const anchor = await one("SELECT viewType, storageKey, pointsCost, status, provenance FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(anchor).toMatchObject({ viewType: "frontClose", storageKey: "models/head-pink.png", pointsCost: 350 });
    const anchorProvenance = typeof anchor.provenance === "string" ? JSON.parse(anchor.provenance) : anchor.provenance;
    expect(anchorProvenance).toMatchObject({
      identityRole: "anchor",
      identityRevisionId: model.identityRevisionId,
      identityEditSource: "text",
    });
    const sideAsset = await one("SELECT status FROM model_assets WHERE id = ?", [base.sideAssetId]);
    const sideStatus = typeof sideAsset.status === "string" ? JSON.parse(sideAsset.status) : sideAsset.status;
    expect(sideStatus).toMatchObject({ state: "stale" });
    const selectedHead = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'frontClose'`,
      [committed.packageSnapshotId],
    );
    expect(selectedHead).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    const selectedSide = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(selectedSide).toMatchObject({
      selectedAssetId: base.sideAssetId,
      compatibility: "stale",
      selectionReason: "carried",
    });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(2);
    expect(await one("SELECT reason, anchorAssetId, createdByOperationId FROM model_identity_snapshots WHERE id = ?", [committed.identitySnapshotId]))
      .toMatchObject({ reason: "identity_edit", anchorAssetId: committed.result.assetId, createdByOperationId: operationId });
  }, 60_000);

  it("pairs an identity append with a package append and stales every carried sibling", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);

    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        await tx.update(models).set({
          masterPrompt: "identity-v2 pink hair",
          technicalSchema: { hair: "pink" },
          preferences: { hairColor: "Hot Pink" },
          identityRevisionId: "revision-v2",
        }).where(eq(models.id, base.modelId));
        const [inserted] = await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "frontClose",
          resolution: "1K",
          storageUrl: `https://example.invalid/new-anchor-${randomUUID()}.png`,
          pointsCost: 0,
        }).$returningId();
        if (!inserted?.id) throw new Error("new anchor insert failed");
        return {
          result: { assetId: inserted.id },
          transition: {
            packageReason: "identity_change" as const,
            identity: {
              reason: "identity_edit" as const,
              anchorAssetId: inserted.id,
              recipeVersion: "r7-identity-edit-v1",
            },
            slotChanges: [{
              viewAngle: "frontClose" as const,
              selectedAssetId: inserted.id,
              compatibility: "current" as const,
              selectionReason: "generated" as const,
            }],
          },
        };
      },
    });

    expect(committed.identitySnapshotId).not.toBe(base.identitySnapshotId);
    const identity = await one(
      "SELECT parentSnapshotId, reason, masterPrompt, anchorAssetId, createdByOperationId FROM model_identity_snapshots WHERE id = ?",
      [committed.identitySnapshotId],
    );
    expect(identity).toMatchObject({
      parentSnapshotId: base.identitySnapshotId,
      reason: "identity_edit",
      masterPrompt: "identity-v2 pink hair",
      anchorAssetId: committed.result.assetId,
      createdByOperationId: operationId,
    });
    const side = await one(
      `SELECT compatibility, selectionReason, selectedAssetId
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(side).toMatchObject({
      compatibility: "stale",
      selectionReason: "carried",
      selectedAssetId: base.sideAssetId,
    });
    expect(await one("SELECT stateVersion, currentPackageSnapshotId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ stateVersion: 2, currentPackageSnapshotId: committed.packageSnapshotId });
  }, 60_000);

  it("compacts documents while preserving the separate anchor, displayed headshot and compatibility", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "anchor" });
    const displayedAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "display" });
    const sideAssetId = await addAsset({ modelId, viewAngle: "sideClose" });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const operationId = await startModelOperation(userId, modelId, "casting.compact");

    const committed = await commitDocumentCompactionSnapshot({
      userId,
      modelId,
      operationId,
      compactedMasterPrompt: "identity-v1 compacted",
    });

    const identity = await one(
      "SELECT anchorAssetId, masterPrompt, reason FROM model_identity_snapshots WHERE id = ?",
      [committed.identitySnapshotId],
    );
    expect(identity).toEqual({
      anchorAssetId,
      masterPrompt: "identity-v1 compacted",
      reason: "document_compact",
    });
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    expect(slots).toEqual([
      {
        viewAngle: "frontClose",
        selectedAssetId: displayedAssetId,
        compatibility: "current",
        selectionReason: "carried",
      },
      {
        viewAngle: "sideClose",
        selectedAssetId: sideAssetId,
        compatibility: "current",
        selectionReason: "carried",
      },
    ]);
  }, 60_000);

  it("seals the exact mint package after the existing lifecycle transition succeeds", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.mint");
    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.mint",
      mutate: async (tx) => {
        await tx.update(models).set({ status: "active", mintedAt: new Date() }).where(eq(models.id, base.modelId));
        return {
          result: { minted: true },
          transition: { packageReason: "mint" as const, seal: true },
        };
      },
    });
    expect(await one(
      `SELECT status, stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    )).toEqual({
      status: "active",
      stateVersion: 2,
      currentPackageSnapshotId: committed.packageSnapshotId,
      sealedIdentitySnapshotId: base.identitySnapshotId,
      sealedPackageSnapshotId: committed.packageSnapshotId,
    });
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId,
      result: { minted: true },
      chargedCredits: 0,
      refundedCredits: 0,
    });

    // Post-mint cosmetic/image-only refinement may advance the package, but
    // it must keep pointing at the exact sealed identity snapshot. The mint
    // package itself remains the immutable seal evidence.
    const refineOperationId = await startModelOperation(userId, base.modelId, "casting.iterate");
    const refined = await commitImageRefineSnapshot({
      userId,
      modelId: base.modelId,
      operationId: refineOperationId,
      candidate: {
        targetAssetId: base.sideAssetId,
        storageUrl: "https://example.invalid/minted-side-refined.png",
        storageKey: "models/minted-side-refined.png",
        pointsCost: 350,
      },
      imageOnlyCategories: ["image.lighting"],
    });
    expect(await one(
      `SELECT stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    )).toEqual({
      stateVersion: 3,
      currentPackageSnapshotId: refined.packageSnapshotId,
      sealedIdentitySnapshotId: base.identitySnapshotId,
      sealedPackageSnapshotId: committed.packageSnapshotId,
    });
    expect(await one(
      "SELECT identitySnapshotId, reason FROM model_package_snapshots WHERE id = ?",
      [refined.packageSnapshotId],
    )).toEqual({ identitySnapshotId: base.identitySnapshotId, reason: "image_refine" });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("rolls legacy writes back when a package-only transition changes identity documents", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    const assetsBefore = await count("model_assets", "modelId = ?", [base.modelId]);

    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        await tx.update(models).set({ masterPrompt: "silently changed" }).where(eq(models.id, base.modelId));
        await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "backFull",
          resolution: "1K",
          storageUrl: `https://example.invalid/rolled-back-${randomUUID()}.png`,
          pointsCost: 0,
        });
        return { result: null, transition: { packageReason: "slot_generate" as const } };
      },
    })).rejects.toThrow("package-only transition cannot change identity documents");

    expect(await count("model_assets", "modelId = ?", [base.modelId])).toBe(assetsBefore);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await one("SELECT masterPrompt, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ masterPrompt: "identity-v1", stateVersion: 1, currentPackageSnapshotId: base.packageSnapshotId });
  }, 60_000);

  it("refuses a stale receipt before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    await connection.execute("UPDATE models SET stateVersion = stateVersion + 1 WHERE id = ?", [base.modelId]);
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("refuses a stale legacy identity revision before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    await connection.execute(
      "UPDATE models SET identityRevisionId = 'revision-outside-operation' WHERE id = ?",
      [base.modelId],
    );
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("refuses an operation-kind mismatch before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.compact",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "identity_change" as const } };
      },
    })).rejects.toThrow("running snapshot operation was not found");
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);
});
