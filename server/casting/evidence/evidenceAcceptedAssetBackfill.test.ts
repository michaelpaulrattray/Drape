import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseEvidenceAcceptedAssetBackfillArgs } from "./evidenceAcceptedAssetBackfill";

const base = [
  "--database-url", "mysql://user:pass@example.test:3306/railway",
  "--app-id", "drape-local",
  "--user-id", "1",
  "--model-id", "35",
  "--expected-model-count", "1",
  "--expected-version-count", "1",
  "--expected-backfill-count", "1",
];

describe("evidence accepted-asset backfill ceremony", () => {
  it("defaults to a bounded read-only plan", () => {
    expect(parseEvidenceAcceptedAssetBackfillArgs(base)).toMatchObject({
      apply: false,
      userId: 1,
      modelIds: [35],
      expectedModelCount: 1,
      expectedVersionCount: 1,
      expectedBackfillCount: 1,
    });
  });

  it("refuses full-database planning and loose integer syntax", () => {
    expect(() => parseEvidenceAcceptedAssetBackfillArgs(
      base.filter((_, index) => ![4, 5, 6, 7].includes(index)),
    )).toThrow("full-database backfill is refused");
    expect(() => parseEvidenceAcceptedAssetBackfillArgs([
      ...base.slice(0, -1),
      "01",
    ])).toThrow("--expected-backfill-count");
  });

  it("requires the complete write ceremony for apply", () => {
    expect(() => parseEvidenceAcceptedAssetBackfillArgs([
      ...base,
      "--apply",
    ])).toThrow("--allow-evidence-link-backfill-write");
    expect(parseEvidenceAcceptedAssetBackfillArgs([
      ...base,
      "--apply",
      "--allow-evidence-link-backfill-write",
      "--confirm-app-id", "drape-local",
      "--confirm-host", "example.test:3306",
      "--confirm-database", "railway",
    ])).toMatchObject({ apply: true, allowWrite: true });
  });

  it("adds a separate production gate and rejects write flags in plan mode", () => {
    const production = base.map((value) =>
      value === "drape-local" ? "drape-production" : value
    );
    expect(() => parseEvidenceAcceptedAssetBackfillArgs(production))
      .toThrow("--allow-production-read-only");
    expect(() => parseEvidenceAcceptedAssetBackfillArgs([
      ...base,
      "--allow-evidence-link-backfill-write",
    ])).toThrow("valid only with --apply");
    expect(() => parseEvidenceAcceptedAssetBackfillArgs([
      ...production,
      "--apply",
      "--allow-evidence-link-backfill-write",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "example.test:3306",
      "--confirm-database", "railway",
    ])).toThrow("--allow-production-evidence-link-backfill");
  });

  it("stays private and limits the service to the one reviewed update", async () => {
    const [service, script, packageJson] = await Promise.all([
      readFile(new URL("./evidenceAcceptedAssetBackfill.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../../scripts/backfill-evidence-accepted-assets.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    ]);
    expect(service.match(/\.update\(modelIdentityFeatureVersions\)/g))
      .toHaveLength(1);
    expect(service).not.toMatch(/\.(?:insert|delete)\(/);
    expect(script).toContain("planEvidenceAcceptedAssetBackfill");
    expect(script).toContain("applyEvidenceAcceptedAssetBackfill");
    expect(packageJson).not.toContain("backfill-evidence-accepted-assets");
  });
});
