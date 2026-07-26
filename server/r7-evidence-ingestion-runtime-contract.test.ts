import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("R7-7C2 evidence runtime contract", () => {
  it("keeps the internal primitive unreachable from routes, startup, workers and production storage", async () => {
    const callers: string[] = [];
    for (const file of await runtimeSources("server")) {
      const normalized = file.replaceAll("\\", "/");
      const source = await readFile(file, "utf8");
      if (
        source.includes("stageCanonicalReferencePlate")
        && normalized !== "server/casting/evidence/referencePlateIngestion.ts"
      ) {
        callers.push(normalized);
      }
    }
    expect(callers).toEqual([]);

    const evidenceSources = await Promise.all([
      "server/casting/evidence/imageValidation.ts",
      "server/casting/evidence/evidenceDelivery.ts",
      "server/casting/evidence/referencePlateIngestion.ts",
      "server/db/evidenceIngestion.ts",
    ].map((file) => readFile(file, "utf8")));
    const combined = evidenceSources.join("\n");
    expect(combined).not.toMatch(
      /from ["'][^"']*(?:routes|routers|storage)["']|storagePut|R2_|Gemini|deductPoints|creditTransactions|generation_operations/i,
    );
    expect(combined).not.toMatch(/process\.env|setInterval|setTimeout|createModuleLogger/);
  });

  it("pins strict canonicalization and exact-key ownership laws", async () => {
    const validation = await readFile(
      new URL("./casting/evidence/imageValidation.ts", import.meta.url),
      "utf8",
    );
    expect(validation).toContain("MAX_EVIDENCE_INPUT_BYTES = 10 * 1024 * 1024");
    expect(validation).toContain("MAX_EVIDENCE_CANONICAL_BYTES = 10 * 1024 * 1024");
    expect(validation).toContain("MAX_EVIDENCE_PIXELS = 40_000_000");
    expect(validation).toContain("animated: true");
    expect(validation).toContain('.webp({ lossless: true, effort: 2 })');
    expect(validation).toContain(".rotate()");
    expect(validation).toContain('createHash("sha256")');
    expect(validation).toContain("metadata.exif !== undefined");

    const delivery = await readFile(
      new URL("./casting/evidence/evidenceDelivery.ts", import.meta.url),
      "utf8",
    );
    expect(delivery).toContain(
      "^users/([1-9][0-9]*)/models/([1-9][0-9]*)/evidence/(plates|crops)/",
    );
    expect(delivery).toContain("if (stored.key !== input.key)");
    expect(delivery).toContain("if (parsed.userId !== input.userId)");
  });

  it("pins committed plan before put and stored truth before attachment", async () => {
    const orchestration = await readFile(
      new URL("./casting/evidence/referencePlateIngestion.ts", import.meta.url),
      "utf8",
    );
    const functionStart = orchestration.indexOf(
      "export async function stageCanonicalReferencePlate",
    );
    const functionSource = orchestration.slice(functionStart);
    const plan = functionSource.indexOf("persistence.planReferencePlate");
    const put = functionSource.indexOf("putCanonicalEvidence");
    const stored = functionSource.indexOf("persistence.markReferencePlateStored");
    const attached = functionSource.indexOf("persistence.attachReferencePlate");
    expect(plan).toBeGreaterThan(0);
    expect(plan).toBeLessThan(put);
    expect(put).toBeLessThan(stored);
    expect(stored).toBeLessThan(attached);

    const persistence = await readFile(
      new URL("./db/evidenceIngestion.ts", import.meta.url),
      "utf8",
    );
    expect(persistence).toContain("INSERT INTO casting_evidence_ingestions");
    expect(persistence).toContain("INSERT INTO model_reference_plates");
    expect(persistence.match(/FROM models/g)).toHaveLength(2);
    expect(persistence.match(/models\.userId =/g)).toHaveLength(2);
    expect(persistence.match(/models\.status = 'draft'/g)).toHaveLength(2);
    expect(persistence.match(/models\.deletedAt IS NULL/g)).toHaveLength(2);
    expect(persistence).toContain('eq(castingEvidenceIngestions.status, "planned")');
    expect(persistence).toContain('eq(castingEvidenceIngestions.status, "stored")');
  });
});
