import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function runtimeSources(root: string): Promise<Array<{ file: string; source: string }>> {
  const found: Array<{ file: string; source: string }> = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...await runtimeSources(absolute));
    } else if (
      entry.isFile()
      && entry.name.endsWith(".ts")
      && !entry.name.endsWith(".test.ts")
    ) {
      found.push({
        file: path.relative(process.cwd(), absolute).replaceAll("\\", "/"),
        source: await readFile(absolute, "utf8"),
      });
    }
  }
  return found;
}

describe("R7-7C5A private evidence cleanup backend", () => {
  it("uses an additive column then atomically replaces the batch-scoped unique fence", async () => {
    const migration = await readFile(
      new URL("../drizzle/0012_r7_private_evidence_cleanup_backend.sql", import.meta.url),
      "utf8",
    );
    const statements = migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(
      /ADD `storageBackend` enum\('public_r2','private_evidence_r2'\) DEFAULT 'public_r2' NOT NULL/i,
    );
    expect(statements[1]).toMatch(
      /DROP INDEX `uq_storage_cleanup_items_batch_key`,\s*ADD CONSTRAINT `uq_storage_cleanup_items_batch_key` UNIQUE\(`batchId`,`storageBackend`,`storageKey`\)/is,
    );
    expect(migration).not.toMatch(/\b(DELETE|TRUNCATE|RENAME TABLE)\b/i);
  });

  it("changes the 0011 snapshot only by the backend column and tuple index", async () => {
    const before = JSON.parse(await readFile(
      new URL("../drizzle/meta/0011_snapshot.json", import.meta.url),
      "utf8",
    ));
    const after = JSON.parse(await readFile(
      new URL("../drizzle/meta/0012_snapshot.json", import.meta.url),
      "utf8",
    ));
    expect(after.prevId).toBe(before.id);
    expect(after.tables.storage_cleanup_items.columns.storageBackend).toMatchObject({
      name: "storageBackend",
      type: "enum('public_r2','private_evidence_r2')",
      primaryKey: false,
      notNull: true,
      default: "'public_r2'",
    });
    expect(after.tables.storage_cleanup_items.indexes.uq_storage_cleanup_items_batch_key)
      .toEqual({
        name: "uq_storage_cleanup_items_batch_key",
        columns: ["batchId", "storageBackend", "storageKey"],
        isUnique: true,
      });

    const expected = structuredClone(before);
    expected.id = after.id;
    expected.prevId = before.id;
    expected.tables.storage_cleanup_items.columns.storageBackend =
      after.tables.storage_cleanup_items.columns.storageBackend;
    expected.tables.storage_cleanup_items.indexes.uq_storage_cleanup_items_batch_key =
      after.tables.storage_cleanup_items.indexes.uq_storage_cleanup_items_batch_key;
    expect(after).toEqual(expected);
  });

  it("requires every runtime manifest caller to name item backends explicitly", async () => {
    const sources = await runtimeSources(path.resolve(process.cwd(), "server"));
    const callers = sources
      .filter(({ file, source }) =>
        file !== "server/db/storageCleanup.ts"
        && source.includes("createStorageCleanupManifestIn(")
      )
      .map(({ file }) => file)
      .sort();
    expect(callers).toEqual([
      "server/casting/evidence/evidenceFork.ts",
      "server/casting/finalCastDeletion.ts",
      // Casting V2 candidate retention (M4). It names `public_r2` explicitly
      // for every item, which is what this pin is here to require: candidate
      // images live in the public bucket, evidence does not, and a manifest
      // that left the backend implicit could delete from the wrong one.
      "server/castingV2/candidateRetention.ts",
      "server/db/accountDeletion.ts",
      "server/db/evidenceCandidates.ts",
      "server/db/evidenceOperations.ts",
      "server/db/evidenceRecovery.ts",
      "server/db/inkAddAcceptance.ts",
      "server/db/inkAddCancellation.ts",
      "server/db/inkAddCandidates.ts",
      "server/db/inkAddRecovery.ts",
    ]);
    for (const file of callers) {
      const source = sources.find((candidate) => candidate.file === file)!.source;
      expect(source, file).toMatch(
        /createStorageCleanupManifestIn\(tx,\s*\{[\s\S]{0,800}?storageItems(?:\s*:|\s*,)/,
      );
      expect(source, file).not.toMatch(
        /createStorageCleanupManifestIn\(tx,\s*\{[\s\S]{0,800}?storageKeys:/,
      );
    }

    const persistence = sources.find(
      ({ file }) => file === "server/db/storageCleanup.ts",
    )!.source;
    expect(persistence).toContain("storageBackend: item.storageBackend");
    expect(persistence).toContain(
      'eq(storageCleanupItems.storageBackend, "private_evidence_r2")',
    );
    expect(persistence).toContain(
      "const privateEvidenceFence = () => input.privateEvidenceAvailable",
    );
    expect(persistence.match(/privateEvidenceFence\(\)/g)).toHaveLength(2);
    expect(persistence).not.toMatch(
      /insert\(storageCleanupItems\)[\s\S]*?storageKey,\s*status:/,
    );
  });

  it("pins the disposable driver to migration 0012 and an exact scratch database", async () => {
    const driver = await readFile(
      new URL("../scripts/drive-r7-private-evidence-cleanup-disposable.mts", import.meta.url),
      "utf8",
    );
    expect(driver).toContain('const PREFIX = "drape_r7_7c5a_disposable_"');
    expect(driver).toContain('process.env.VITE_APP_ID !== "drape-local"');
    expect(driver).toContain('sourceUrl.pathname.replace(/^\\//, "") !== "railway"');
    expect(driver).toContain("migrationNumber > 12");
    expect(driver).toContain("R7-7C5A driver refuses migrations after 0012");
    expect(driver).toContain("stale disposable databases require review");
    expect(driver).toContain("if (!safeName.test(databaseName))");
    expect(driver).toContain("DROP DATABASE IF EXISTS");
    expect(driver).toContain("TEST_DATABASE_URL: testUrl.toString()");
    expect(driver).toContain('process.argv.includes("--focused-lifecycle")');
    expect(driver).toContain('process.argv.includes("--focused-delivery")');
    expect(driver).toContain("Focused disposable modes are mutually exclusive");
    expect(driver).not.toContain("railway up");
    expect(driver).not.toContain("railway variables");
  });
});
