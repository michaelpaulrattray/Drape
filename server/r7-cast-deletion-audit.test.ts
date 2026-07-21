import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertReadOnlyAuditSql,
  classifyStorageReference,
  collectHttpReferences,
  hasForbiddenDeletedSubjectMetadata,
  normalizeOwnedStorageKey,
  parseCastDeletionAuditArgs,
  readCastProvenance,
} from "./casting/deletionAudit";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("R7-5A audit target guard", () => {
  const base = [
    "--database-url", "mysql://reader:secret@example.test:3306/drape",
    "--app-id", "drape-local",
    "--r2-public-url", "https://pub-current.r2.dev",
  ];

  it("requires an explicit database URL, app id, and current public origin", () => {
    expect(() => parseCastDeletionAuditArgs([])).toThrow(/--database-url/);
    expect(() => parseCastDeletionAuditArgs(base.slice(0, 2))).toThrow(/--app-id/);
    expect(() => parseCastDeletionAuditArgs(base.slice(0, 4))).toThrow(/--r2-public-url/);
  });

  it("refuses production by default and permits only the explicit read-only override", () => {
    const production = [...base];
    production[3] = "drape-production";
    expect(() => parseCastDeletionAuditArgs(production)).toThrow(/Production audit refused/);
    expect(parseCastDeletionAuditArgs([...production, "--allow-production-read-only"]))
      .toMatchObject({ appId: "drape-production", allowProductionReadOnly: true });
  });

  it("rejects ambient or ambiguous targets and validates an optional model id", () => {
    expect(() => parseCastDeletionAuditArgs([
      "--database-url", "postgres://example.test/drape",
      "--app-id", "drape-local",
      "--r2-public-url", "https://pub-current.r2.dev",
    ])).toThrow(/mysql:\/\//);
    expect(() => parseCastDeletionAuditArgs([...base, "--model-id", "0"])).toThrow(/positive integer/);
    expect(parseCastDeletionAuditArgs([...base, "--model-id", "42"])).toMatchObject({ modelId: 42 });
  });
});

describe("R7-5A SQL read-only tripwire", () => {
  it("accepts the audit statement vocabulary", () => {
    expect(() => assertReadOnlyAuditSql("SELECT COUNT(*) AS count FROM models")).not.toThrow();
    expect(() => assertReadOnlyAuditSql("START TRANSACTION READ ONLY")).not.toThrow();
    expect(() => assertReadOnlyAuditSql("ROLLBACK")).not.toThrow();
    expect(() => assertReadOnlyAuditSql("WITH ids AS (SELECT id FROM models) SELECT * FROM ids")).not.toThrow();
  });

  it.each([
    "UPDATE models SET status = 'archived'",
    "DELETE FROM models",
    "INSERT INTO models (userId) VALUES (1)",
    "DROP TABLE models",
    "SELECT 1; DELETE FROM models",
  ])("rejects mutating or multi-statement SQL: %s", (statement) => {
    expect(() => assertReadOnlyAuditSql(statement)).toThrow(/read-only|multiple SQL/);
  });
});

describe("R7-5 exact-owned storage evidence law", () => {
  const currentPublicUrl = "https://pub-current.r2.dev";

  it("prefers a valid explicit key and normalizes a current-origin URL", () => {
    expect(classifyStorageReference({
      storageKey: "42-models/head.png",
      url: "https://unrelated.example/head.png",
      currentPublicUrl,
    })).toEqual({ kind: "explicit_key", key: "42-models/head.png" });
    expect(classifyStorageReference({
      url: "https://pub-current.r2.dev/42-models/head.png?cache=1",
      currentPublicUrl,
    })).toEqual({
      kind: "current_origin_url",
      key: "42-models/head.png",
      origin: currentPublicUrl,
    });
  });

  it("never turns another host, legacy CDN, or malformed path into owned authority", () => {
    expect(classifyStorageReference({
      url: "https://files.manuscdn.com/42-models/head.png",
      currentPublicUrl,
    }).kind).toBe("external_url");
    expect(classifyStorageReference({
      url: "https://pub-other.r2.dev/42-models/head.png",
      currentPublicUrl,
    }).kind).toBe("external_url");
    expect(classifyStorageReference({
      url: "https://pub-current.r2.dev/42-models/%2e%2e/secret",
      currentPublicUrl,
    }).kind).toBe("invalid");
    expect(classifyStorageReference({
      url: "https://pub-current.r2.dev/42-models/../secret",
      currentPublicUrl,
    }).kind).toBe("invalid");
    expect(normalizeOwnedStorageKey("../secret")).toBeNull();
    expect(normalizeOwnedStorageKey("folder\\secret")).toBeNull();
  });

  it("finds nested URL evidence without treating prose or base64 as a URL", () => {
    expect(collectHttpReferences({
      input: { url: "https://pub-current.r2.dev/input.png" },
      children: [
        "not a url",
        "data:image/png;base64,abc",
        "https://external.example/ref.png",
        "Failed while reading https://external.example/embedded.png. Try again.",
      ],
    })).toEqual([
      "https://pub-current.r2.dev/input.png",
      "https://external.example/ref.png",
      "https://external.example/embedded.png",
    ]);
  });

  it("detects D-64-forbidden identity fields without exposing their values", () => {
    expect(hasForbiddenDeletedSubjectMetadata({ modelName: "hidden" })).toBe(true);
    expect(hasForbiddenDeletedSubjectMetadata({ nested: { agencyId: "hidden" } })).toBe(true);
    expect(hasForbiddenDeletedSubjectMetadata({ status: "draft", deletedAssetCount: 6 })).toBe(false);
  });
});

describe("R7-5 Cast dependency and writer coverage", () => {
  it("recognizes only typed Cast provenance with a positive model id", () => {
    expect(readCastProvenance({ provenance: { type: "cast_view", modelId: 7 } }))
      .toEqual({ type: "cast_view", modelId: 7 });
    expect(readCastProvenance({ type: "library_cast", modelId: 8 }))
      .toEqual({ type: "library_cast", modelId: 8 });
    expect(readCastProvenance({ provenance: { type: "text2img", modelId: 7 } })).toBeNull();
    expect(readCastProvenance({ provenance: { type: "cast_root", modelId: -1 } })).toBeNull();
  });

  it("keeps the executable audit structurally read-only and storage-free", () => {
    const audit = source("scripts/audit-cast-deletion.ts");
    expect(audit).not.toContain("process.env.DATABASE_URL");
    expect(audit).not.toMatch(/from\s+["'][^"']*(?:storage|accountDeletion|deleteUserData)["']/);
    expect(audit).not.toContain("storageDelete");
    expect(audit.match(/connection\.query/g)).toHaveLength(1);
    expect(audit).toContain("assertReadOnlyAuditSql(statement)");
    expect(audit).toContain("START TRANSACTION READ ONLY");
    expect(audit).toContain("ROLLBACK");
  });

  it("classifies every schema model-link column and the direct Canvas link", () => {
    const schema = source("drizzle/schema.ts");
    const inventory = source("docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md");
    for (const table of [
      "model_assets.modelId",
      "generations.modelId",
      "generation_operations.modelId",
      "wardrobe_sessions.modelId",
      "wardrobe_looks.modelId",
      "bug_reports.modelId",
      "board_items.sourceModelId",
      "`audit_logs`",
    ]) {
      expect(inventory, `missing inventory row for ${table}`).toContain(table);
    }
    expect(schema.match(/modelId:\s*int\("modelId"\)/g)).toHaveLength(6);
    expect(schema).toContain('sourceModelId: int("sourceModelId")');
  });

  it("records every currently reachable unchecked writer as an R7-5C fence", () => {
    const inventory = source("docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md");
    for (const writer of [
      "`models.update`",
      "`wardrobe.sessions.create`",
      "`wardrobe.looks.save`",
      "`boards.addItem` / `boards.addItems`",
      "`boardOps.createNode`",
      "`boards.updateItem`",
      "`bugReports.submit`",
      "`generation_operations` claim",
      "`MODEL_DELETED` audit event",
    ]) {
      expect(inventory, `missing fence finding for ${writer}`).toContain(writer);
    }
    expect(inventory.match(/\*\*FENCE REQUIRED:\*\*/g)).toHaveLength(8);
    expect(inventory).toContain("**CONTENT CORRECTION REQUIRED:**");
    expect(source("scripts/audit-cast-deletion.ts")).toContain("auditLogsWithForbiddenIdentityMetadata");
  });
});
