import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertEvidenceComposerMigrationScopesOff,
  parseEvidenceComposerMigrationArgs,
} from "./casting/evidence/evidenceComposerDeploymentCeremony";

const databaseUrl =
  "mysql://user:secret@hayabusa.proxy.rlwy.net:23768/railway";
const common = [
  "--database-url", databaseUrl,
  "--app-id", "drape-production",
  "--confirm-app-id", "drape-production",
  "--confirm-host", "hayabusa.proxy.rlwy.net:23768",
  "--confirm-database", "railway",
] as const;

describe("R7-7D D6 disabled deployment ceremony", () => {
  it("requires explicit production authority and exact target confirmation", () => {
    expect(parseEvidenceComposerMigrationArgs([
      ...common,
      "--allow-production-evidence-composer-migration",
    ])).toMatchObject({
      appId: "drape-production",
      host: "hayabusa.proxy.rlwy.net:23768",
      database: "railway",
    });
    for (const args of [
      common,
      [...common, "--allow-production-evidence-composer-migration", "--unknown"],
      [
        ...common,
        "--confirm-host", "other.proxy.rlwy.net:23768",
        "--allow-production-evidence-composer-migration",
      ],
    ]) {
      expect(() => parseEvidenceComposerMigrationArgs(args)).toThrow();
    }
  });

  it("requires composer, recipe, candidate worker and ingestion to stay off", () => {
    expect(() => assertEvidenceComposerMigrationScopesOff({
      composerScope: "off",
      composerRecipe: "off",
      candidateWorker: "false",
      ingestScope: "off",
    })).not.toThrow();
    expect(() => assertEvidenceComposerMigrationScopesOff({
      composerScope: undefined,
      composerRecipe: "",
      candidateWorker: undefined,
      ingestScope: "off",
    })).not.toThrow();
    for (const enabled of [
      { composerScope: "users:1" },
      { composerRecipe: "ink.add.front_upper_torso.v1" },
      { candidateWorker: "true" },
      { ingestScope: "users:1" },
    ]) {
      expect(() => assertEvidenceComposerMigrationScopesOff({
        composerScope: "off",
        composerRecipe: "off",
        candidateWorker: "false",
        ingestScope: "off",
        ...enabled,
      })).toThrow();
    }
  });

  it("pins the sole-pending migration and full pre/post proof", async () => {
    const source = await readFile(
      "scripts/apply-ink-add-migration.mts",
      "utf8",
    );
    expect(source).toContain("0012_r7_private_evidence_cleanup_backend");
    expect(source).toContain("0013_r7_ink_add_candidates");
    expect(source).toContain("assertPrivateEvidenceCleanupSchemaWithClient");
    expect(source).toContain("assertEvidenceComposerSchemaWithClient");
    expect(source).toContain("newTableRows.length !== 0");
    expect(source).toContain("evidence_composer_existing_row_count_changed");
    expect(source).toContain("evidence_composer_new_table_not_empty");
    expect(source).not.toMatch(/console\.(log|error)/);
  });
});
