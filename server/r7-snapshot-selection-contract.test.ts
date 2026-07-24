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

  it("allows snapshot authority only inside the bounded A2/A3 services and the private A4 shadow reader", async () => {
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
      "server/casting/effectiveCastState.ts",
      "server/casting/snapshotBootstrap.ts",
      "server/casting/finalCastDeletion.ts",
      "server/casting/snapshotShadow.ts",
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

    const shadowReader = await readFile(new URL("./casting/snapshotShadow.ts", import.meta.url), "utf8");
    expect(shadowReader).not.toMatch(/\btx\s*\.\s*(insert|update|delete)\s*\(/);
    expect(shadowReader).not.toMatch(/deductPoints|withAtomicCredits|storage(Put|Delete)|Gemini|generateContent/);
  });

  it("keeps the B1 effective resolver private, read-only and scope-server-owned", async () => {
    const effectiveCallers: string[] = [];
    const scopeCallers: string[] = [];
    for (const file of await runtimeSources("server")) {
      const normalized = file.replaceAll("\\", "/");
      const content = await readFile(file, "utf8");
      if (
        !normalized.endsWith("/casting/effectiveCastState.ts")
        && content.includes("effectiveCastState")
      ) {
        effectiveCallers.push(normalized);
      }
      if (
        !normalized.endsWith("/casting/snapshotReadScope.ts")
        && content.includes("snapshotReadScope")
      ) {
        scopeCallers.push(normalized);
      }
    }
    expect(effectiveCallers).toEqual([
      "server/casting/effectiveCastRead.ts",
      "server/casting/mintPackage.ts",
    ]);
    expect(scopeCallers).toEqual([
      "server/casting/mintPackage.ts",
      "server/casting/refreshSlots.ts",
      "server/casting/snapshotTransitions.ts",
      "server/routes/generation/castingExport.ts",
      "server/_core/env.ts",
    ]);

    const resolver = await readFile(
      new URL("./casting/effectiveCastState.ts", import.meta.url),
      "utf8",
    );
    const scope = await readFile(
      new URL("./casting/snapshotReadScope.ts", import.meta.url),
      "utf8",
    );
    expect(resolver).not.toMatch(/\btx\s*\.\s*(insert|update|delete)\s*\(/);
    expect(resolver).not.toMatch(
      /deductPoints|withAtomicCredits|storage(Put|Delete|List)|Gemini|generateContent|Slack/i,
    );
    expect(scope).not.toMatch(/client|localStorage|sessionStorage|window\./);
    expect(scope).toContain('process.env[SNAPSHOT_READ_SCOPE_ENV]');
    expect(scope).not.toMatch(/currentPackageSnapshotId|selectedAssetId|stateVersion/);

    const driver = await readFile(
      new URL("../scripts/drive-r7-7b1-effective-reader-disposable.mts", import.meta.url),
      "utf8",
    );
    expect(driver).toContain('const PREFIX = "drape_r7_7b1_disposable_"');
    expect(driver).toContain("Refusing disposable database work under a production app id");
    expect(driver).toContain("configured development URL must target the railway MySQL database");
    expect(driver).toContain("DROP DATABASE IF EXISTS");
    expect(driver).not.toMatch(/storage(Put|Delete|List)|deductPoints|withAtomicCredits|Gemini|generateContent/i);
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

  it("keeps the A4 shadow audit private, read-only and caller-bounded", async () => {
    const serverCallers: string[] = [];
    for (const file of await runtimeSources("server")) {
      const normalized = file.replaceAll("\\", "/");
      if (normalized.endsWith("/casting/snapshotShadow.ts")) continue;
      if ((await readFile(file, "utf8")).includes("snapshotShadow")) serverCallers.push(normalized);
    }
    expect(serverCallers).toEqual([
      "server/casting/snapshotConsumerShadow.ts",
      "server/casting/snapshotConvergence.ts",
      "server/casting/snapshotShadowAudit.ts",
    ]);

    const scriptCallers: string[] = [];
    for (const file of await runtimeSources("scripts")) {
      if ((await readFile(file, "utf8")).includes("snapshotShadow")) {
        scriptCallers.push(file.replaceAll("\\", "/"));
      }
    }
    expect(scriptCallers).toEqual(["scripts/audit-cast-snapshot-parity.ts"]);
    const script = await readFile(new URL("../scripts/audit-cast-snapshot-parity.ts", import.meta.url), "utf8");
    const auditContract = await readFile(new URL("./casting/snapshotShadowAudit.ts", import.meta.url), "utf8");
    const consumerShadow = await readFile(new URL("./casting/snapshotConsumerShadow.ts", import.meta.url), "utf8");
    const convergence = await readFile(new URL("./casting/snapshotConvergence.ts", import.meta.url), "utf8");
    expect(script).not.toMatch(/storage(Put|Delete|List)|deductPoints|withAtomicCredits|Gemini|generateContent/);
    expect(consumerShadow).not.toMatch(
      /\b(?:tx|db)\.(insert|update|delete)\(|for\s+update|storage(Put|Delete|List)|deductPoints|withAtomicCredits|getAiClient|generateContent|with(?:Image|Text)Queue/i,
    );
    expect(convergence).not.toMatch(
      /\b(?:tx|db)\.(insert|update|delete)\(|for\s+update|storage(Put|Delete|List)|deductPoints|withAtomicCredits|getAiClient|generateContent|with(?:Image|Text)Queue/i,
    );
    expect(convergence).toContain("bootstrapModelSnapshot({");
    expect(script).not.toMatch(/(?:^|\s)--all(?:\s|$)/m);
    expect(auditContract).toContain("full-database scans are refused");

    const convergenceScripts: string[] = [];
    for (const file of await runtimeSources("scripts")) {
      if ((await readFile(file, "utf8")).includes("snapshotConvergence")) {
        convergenceScripts.push(file.replaceAll("\\", "/"));
      }
    }
    expect(convergenceScripts).toEqual(["scripts/converge-cast-snapshots.ts"]);
    const convergenceScript = await readFile(
      new URL("../scripts/converge-cast-snapshots.ts", import.meta.url),
      "utf8",
    );
    expect(convergenceScript).not.toMatch(/(?:^|\s)--all(?:\s|$)/m);
    expect(convergenceScript).not.toMatch(
      /storage(Put|Delete|List)|deductPoints|withAtomicCredits|getAiClient|generateContent|with(?:Image|Text)Queue/i,
    );

    const transitionDriver = await readFile(
      new URL("../scripts/drive-r7-snapshot-bootstrap-disposable.mts", import.meta.url),
      "utf8",
    );
    expect(transitionDriver).toContain('"--focused-b3"');
    expect(transitionDriver).toContain('"--testNamePattern=snapshot.*ledger"');
  });

  it("keeps snapshot PDF image authority server-only and caller-bounded", async () => {
    const callers: string[] = [];
    for (const file of await runtimeSources("server")) {
      const normalized = file.replaceAll("\\", "/");
      if (normalized.endsWith("/casting/snapshotPdfImages.ts")) continue;
      const content = await readFile(file, "utf8");
      if (content.includes("snapshotPdfImages")) callers.push(normalized);
    }
    expect(callers).toEqual(["server/routes/generation/castingExport.ts"]);

    const source = await readFile(
      new URL("./casting/snapshotPdfImages.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('redirect: "error"');
    expect(source).toContain("validateProxyUrl");
    expect(source).not.toMatch(
      /deductPoints|withAtomicCredits|storage(Put|Get|Delete|List)|Gemini|generateContent|tx\s*\.\s*(insert|update|delete)/i,
    );
  });

  it("allows only the reviewed compact, restore, refresh, Add Views/mint, iterate, headshot and Canvas-recast runtime adopters", async () => {
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
    const mintPackage = await readFile(new URL("./casting/mintPackage.ts", import.meta.url), "utf8");
    expect(mintPackage).toContain("commitGeneratedPackageSnapshot");
    expect(mintPackage).not.toContain("mintModelAtomically");
    expect(mintPackage).not.toContain("export async function generatePackageSlot(");
  });
});
