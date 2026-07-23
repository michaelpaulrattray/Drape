import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_SNAPSHOT_REASONS,
  PACKAGE_SLOT_COMPATIBILITY,
  PACKAGE_SLOT_SELECTION_REASONS,
  PACKAGE_SNAPSHOT_REASONS,
} from "../drizzle/schema";

describe("R7-7A1 snapshot-selection schema contract", () => {
  async function runtimeSources(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return runtimeSources(path);
      if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.(?:test|integration\.test)\.(?:ts|tsx)$/.test(entry.name)) {
        return [];
      }
      return [path];
    }));
    return nested.flat();
  }

  it("keeps the closed vocabularies explicit and code-reviewable", () => {
    expect(IDENTITY_SNAPSHOT_REASONS).toEqual([
      "bootstrap", "create", "identity_edit", "anchor_reroll", "document_compact",
      "evidence_accept", "evidence_remove", "restore", "fork_bootstrap",
    ]);
    expect(PACKAGE_SNAPSHOT_REASONS).toEqual([
      "bootstrap", "create", "identity_change", "image_refine", "slot_generate",
      "slot_refresh", "slot_restore", "add_views", "whole_restore", "mint", "late_view",
    ]);
    expect(PACKAGE_SLOT_COMPATIBILITY).toEqual(["current", "stale", "unverified"]);
    expect(PACKAGE_SLOT_SELECTION_REASONS).toEqual([
      "generated", "carried", "refreshed", "restored", "late_view", "bootstrap",
    ]);
  });

  it("is additive and contains only the approved three tables, seven columns and six indexes", async () => {
    const sql = await readFile(new URL("../drizzle/0010_r7_snapshot_selection.sql", import.meta.url), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
    expect(statements).toHaveLength(16);
    expect(statements.filter((statement) => /^CREATE TABLE/i.test(statement))).toHaveLength(3);
    expect(statements.filter((statement) => /^ALTER TABLE.+ ADD /is.test(statement))).toHaveLength(7);
    expect(statements.filter((statement) => /^CREATE INDEX/i.test(statement))).toHaveLength(6);
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME)\b/i);
    expect(sql).toContain("ALTER TABLE `models` ADD `stateVersion` int DEFAULT 0 NOT NULL");
    expect(sql).toContain("ALTER TABLE `generation_operations` ADD `expectedStateVersion` int");
    expect(sql).toContain("CONSTRAINT `uq_model_package_slots_snapshot_angle` UNIQUE(`packageSnapshotId`,`viewAngle`)");
    expect(sql).toContain("CONSTRAINT `uq_model_package_slots_snapshot_asset` UNIQUE(`packageSnapshotId`,`selectedAssetId`)");
  });

  it("changes the 0009 snapshot only by the ratified R7-7A1 footprint", async () => {
    const before = JSON.parse(await readFile(
      new URL("../drizzle/meta/0009_snapshot.json", import.meta.url), "utf8",
    ));
    const after = JSON.parse(await readFile(
      new URL("../drizzle/meta/0010_snapshot.json", import.meta.url), "utf8",
    ));
    expect(after.prevId).toBe(before.id);

    const expected = structuredClone(before);
    expected.id = after.id;
    expected.prevId = before.id;
    for (const column of [
      "currentPackageSnapshotId", "stateVersion", "sealedIdentitySnapshotId", "sealedPackageSnapshotId",
    ]) {
      expected.tables.models.columns[column] = after.tables.models.columns[column];
    }
    expected.tables.models.indexes.idx_models_current_package_snapshot =
      after.tables.models.indexes.idx_models_current_package_snapshot;
    for (const column of [
      "expectedStateVersion", "expectedIdentitySnapshotId", "expectedPackageSnapshotId",
    ]) {
      expected.tables.generation_operations.columns[column] =
        after.tables.generation_operations.columns[column];
    }
    expected.tables.model_identity_snapshots = after.tables.model_identity_snapshots;
    expected.tables.model_package_snapshots = after.tables.model_package_snapshots;
    expected.tables.model_package_snapshot_slots = after.tables.model_package_snapshot_slots;
    expect(after).toEqual(expected);
  });

  it("allows snapshot authority only inside the bounded A2/A3 foundation services", async () => {
    const files = (await Promise.all([
      runtimeSources("server"),
      runtimeSources("client/src"),
      runtimeSources("shared"),
    ])).flat();
    const forbidden = [
      "modelIdentitySnapshots",
      "modelPackageSnapshots",
      "modelPackageSnapshotSlots",
      "currentPackageSnapshotId",
      "sealedIdentitySnapshotId",
      "sealedPackageSnapshotId",
      "expectedStateVersion",
      "expectedIdentitySnapshotId",
      "expectedPackageSnapshotId",
    ];
    const allowedAuthority = new Set([
      "server/casting/snapshotBootstrap.ts",
      "server/casting/finalCastDeletion.ts",
      "server/casting/snapshotTransitions.ts",
      "server/db/accountDeletion.ts",
      "server/db/generationOperations.ts",
    ]);
    const hits: string[] = [];
    for (const file of files) {
      if (allowedAuthority.has(file.replaceAll("\\", "/"))) continue;
      const content = await readFile(file, "utf8");
      for (const token of forbidden) {
        if (content.includes(token)) hits.push(`${file}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("captures receipt expectations and removes snapshot rows at both erasure boundaries", async () => {
    const operations = await readFile(new URL("./db/generationOperations.ts", import.meta.url), "utf8");
    expect(operations).toContain("expectedStateVersion,");
    expect(operations).toContain("expectedIdentitySnapshotId,");
    expect(operations).toContain("expectedPackageSnapshotId,");
    expect(operations).toContain("Generation operation model snapshot head is invalid");

    const modelDeletion = await readFile(new URL("./casting/finalCastDeletion.ts", import.meta.url), "utf8");
    const accountDeletion = await readFile(new URL("./db/accountDeletion.ts", import.meta.url), "utf8");
    for (const source of [modelDeletion, accountDeletion]) {
      expect(source).toContain("delete(modelPackageSnapshotSlots)");
      expect(source).toContain("delete(modelPackageSnapshots)");
      expect(source).toContain("delete(modelIdentitySnapshots)");
    }
    expect(modelDeletion.indexOf("delete(modelPackageSnapshotSlots)"))
      .toBeLessThan(modelDeletion.indexOf("delete(modelPackageSnapshots)"));
    expect(modelDeletion.indexOf("delete(modelPackageSnapshots)"))
      .toBeLessThan(modelDeletion.indexOf("delete(modelIdentitySnapshots)"));
    expect(modelDeletion.indexOf("delete(modelIdentitySnapshots)"))
      .toBeLessThan(modelDeletion.indexOf("delete(modelAssets)"));
  });

  it("allows only the reviewed compact, restore, refresh, iterate, headshot and Canvas-recast runtime adopters", async () => {
    const files = (await runtimeSources("server"))
      .filter((file) => !file.endsWith("snapshotTransitions.ts"));
    const callers: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (content.includes("snapshotTransitions")) callers.push(file.replaceAll("\\", "/"));
    }
    expect(callers).toEqual([
      "server/casting/mintPackage.ts",
      "server/casting/refreshSlots.ts",
      "server/lib/boardOps.ts",
      "server/routes/generation/castingImaging.ts",
      "server/routes/generation/castingRefinement.ts",
    ]);
  });
});
