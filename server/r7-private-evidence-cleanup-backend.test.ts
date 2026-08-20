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
      // The born-worn catalogue (slice 1) writes a mask and a crop of a thing
      // the master already had — the same pieces of a person's face, at the
      // same permanently public keys, registered before they exist.
      "server/castingV2/bornWornCatalogue.ts",
      // Casting V2 candidate retention (M4). It names `public_r2` explicitly
      // for every item, which is what this pin is here to require: candidate
      // images live in the public bucket, evidence does not, and a manifest
      // that left the backend implicit could delete from the wrong one.
      "server/castingV2/candidateRetention.ts",
      // The plate mint (migration 0037) registers the plate's key BEFORE the
      // engine's bytes are stored and names `public_r2` for it. A plate is what
      // an engine is shown on every later render, so bytes at a permanently
      // public key with no row pointing at them would be a drawing of somebody's
      // tattoo that nothing can find and nothing will ever collect.
      // The crop road's cutter registers the carrier's key BEFORE the composed
      // bytes are stored and names `public_r2` for it. The carrier pictures no
      // person — the head is flat-filled and unrecoverable — but it is cut from
      // a photograph of one, and it is the only caller here that means its bytes
      // to be COLLECTED rather than kept: nothing discharges the manifest, so
      // the worker takes the carrier once the render that bought it has loaded
      // it.
      "server/castingV2/hairReferenceCutter.ts",
      "server/castingV2/inkPlateMint.ts",
      // The kept face scan (migration 0032) registers one stencil per feature
      // before any of them exists, and names `public_r2` for each: a stencil is
      // the SHAPE of a feature on a person's face at a permanently public key,
      // and without the manifest a crash between the object writes and the row
      // insert would leave bytes nothing points at — the sweep only collects
      // what a row names.
      // The ink studio's upload (migration 0034) registers the design's key
      // BEFORE the bytes are stored and names `public_r2` for it. This one is a
      // picture a CUSTOMER supplied, which is the only artifact class here that
      // was never ours — bytes at a permanently public key with no row pointing
      // at them would be somebody's photograph nobody would ever go looking for.
      "server/castingV2/inkUploadService.ts",
      "server/castingV2/keptFaceScan.ts",
      // The attach door (migration 0043) registers the picture's key BEFORE the
      // bytes are stored and names `public_r2` for it. It is the SECOND caller
      // whose artifact was never ours — a whole photograph a customer handed us,
      // uncut, at a permanently public key. Bytes there with no row pointing at
      // them would be a picture of a person that nothing can find and nothing
      // will ever collect, which is the sharpest form of the defect this pin
      // exists for.
      "server/castingV2/referenceAttachService.ts",
      // The reference library's mint (migration 0028) registers a crop of a
      // feature and its mask before either exists, and names `public_r2` for
      // both: a library crop is a piece of a person's face at a permanently
      // public key, and the manifest is what collects it if the write fails
      // anywhere before the row commits.
      "server/castingV2/referenceMint.ts",
      // The Sign ceremony (M7) registers its anchor copy for deletion BEFORE it
      // makes the copy, and names `public_r2` for it — a Cast's images live in
      // the public bucket, evidence does not, and a manifest that left the
      // backend implicit could delete from the wrong one.
      // Refine (M8) does the same for the variant image it is about to write:
      // the key is registered before the bytes exist, so a crash between the
      // put and the landing cannot strand a paid picture of a person at a
      // permanent public URL with no row left that knows it exists.
      "server/castingV2/refineService.ts",
      // Segment permanence (slice 1) registers a kept edit's mask and crop the
      // same way, and for the same reason: those objects are pieces of a
      // person's face at permanently public keys, and they are handed to the
      // cleanup worker before they exist so a crash cannot strand them.
      "server/castingV2/segmentPersistence.ts",
      "server/castingV2/signService.ts",
      // The kept scan's ROW-FILING statement, and it is the second manifest on
      // that road rather than a duplicate of the one above. `keepScan` registers
      // the NEW stencils before they exist; this one registers the stencils of
      // the reading it is REPLACING, at the moment nothing references them any
      // more. Without it an upsert orphaned the previous reading's objects
      // permanently — the candidate purge only ever sees the CURRENT row's
      // geometry, so nothing would have collected them. Both name `public_r2`,
      // because a stencil is the shape of a feature on a person's face and it
      // lives in the public bucket.
      "server/db/accountDeletion.ts",
      "server/db/castingV2FaceScans.ts",
      "server/db/castingV2InkDesignRemoval.ts",
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
