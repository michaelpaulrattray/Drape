import { describe, expect, it } from "vitest";
import {
  assertFounderEvidenceScope,
  assertFounderEvidenceSettledState,
  assertFounderEvidenceStageBaseline,
  assertFounderEvidenceStagedState,
  founderEvidenceSafeError,
  parseFounderEvidenceCeremonyArgs,
} from "./founderEvidenceCeremony";

const COMMON = [
  "--database-url",
  "mysql://user:password@founder-proof.proxy.rlwy.net:23456/railway",
  "--app-id",
  "drape-production",
  "--confirm-app-id",
  "drape-production",
  "--confirm-host",
  "founder-proof.proxy.rlwy.net:23456",
  "--confirm-database",
  "railway",
  "--confirm-evidence-bucket",
  "product-production-evidence-private",
  "--user-id",
  "1",
  "--confirm-user-id",
  "1",
  "--confirm-user-email",
  "founder@example.com",
  "--model-id",
  "4",
  "--confirm-model-id",
  "4",
  "--confirm-model-name",
  "Founder draft",
  "--allow-production-founder-evidence-ceremony",
] as const;

describe("founder evidence ceremony", () => {
  it("parses an exact stage target and refuses authority drift", () => {
    expect(parseFounderEvidenceCeremonyArgs(["--stage", ...COMMON])).toMatchObject({
      mode: "stage",
      appId: "drape-production",
      host: "founder-proof.proxy.rlwy.net:23456",
      database: "railway",
      userId: 1,
      modelId: 4,
    });
    expect(() => parseFounderEvidenceCeremonyArgs([
      "--stage",
      ...COMMON.filter((value) =>
        value !== "--allow-production-founder-evidence-ceremony"),
    ])).toThrow(/refused/);
    expect(() => parseFounderEvidenceCeremonyArgs([
      "--stage",
      ...COMMON,
      "--confirm-user-id",
      "2",
    ])).toThrow(/Duplicate/);
  });

  it("requires the discard evidence returned by the stage phase", () => {
    const parsed = parseFounderEvidenceCeremonyArgs([
      "--discard",
      ...COMMON,
      "--plate-id",
      "11111111-1111-4111-8111-111111111111",
      "--ingest-client-request-id",
      "22222222-2222-4222-8222-222222222222",
      "--expected-content-hash",
      "a".repeat(64),
      "--expected-byte-size",
      "1024",
    ]);
    expect(parsed).toMatchObject({
      mode: "discard",
      plateId: "11111111-1111-4111-8111-111111111111",
      ingestClientRequestId: "22222222-2222-4222-8222-222222222222",
      expectedByteSize: 1024,
    });
    expect(() => parseFounderEvidenceCeremonyArgs([
      "--stage",
      ...COMMON,
      "--plate-id",
      "11111111-1111-4111-8111-111111111111",
    ])).toThrow(/only with --discard/);
  });

  it("requires an exact one-user process scope", () => {
    expect(() => assertFounderEvidenceScope("users:1", 1)).not.toThrow();
    for (const scope of [undefined, "off", "all", "users:1,2", "users:2"]) {
      expect(() => assertFounderEvidenceScope(scope, 1)).toThrow(/one-user/);
    }
  });

  it("pins the truthful baseline, staged, and settled residue", () => {
    expect(() => assertFounderEvidenceStageBaseline({
      objects: 0,
      receipts: 0,
      plates: 0,
      crops: 0,
      evidenceOperations: 0,
      evidenceOperationLocks: 0,
      cleanupBatches: 0,
      cleanupItems: 0,
    })).not.toThrow();
    expect(() => assertFounderEvidenceStagedState({
      objects: 1,
      receipts: 1,
      plates: 1,
      crops: 0,
      evidenceOperations: 1,
      evidenceOperationLocks: 0,
      cleanupBatches: 0,
      cleanupItems: 0,
    })).not.toThrow();
    expect(() => assertFounderEvidenceSettledState({
      objects: 0,
      receipts: 1,
      plates: 0,
      crops: 0,
      evidenceOperations: 2,
      evidenceOperationLocks: 0,
      cleanupBatches: 1,
      cleanupItems: 0,
    })).not.toThrow();
    expect(() => assertFounderEvidenceSettledState({
      objects: 0,
      receipts: 0,
      plates: 0,
      crops: 0,
      evidenceOperations: 2,
      evidenceOperationLocks: 0,
      cleanupBatches: 1,
      cleanupItems: 0,
    })).toThrow(/receipts_count_mismatch/);
    expect(() => assertFounderEvidenceSettledState({
      objects: 0,
      receipts: 1,
      plates: 0,
      crops: 0,
      evidenceOperations: 2,
      evidenceOperationLocks: 1,
      cleanupBatches: 1,
      cleanupItems: 0,
    })).toThrow(/evidence_operation_locks_count_mismatch/);
  });

  it("allows only closed ceremony tokens into failure output", () => {
    expect(founderEvidenceSafeError(
      new Error("founder_evidence_private_read_hash_mismatch"),
    )).toBe("founder_evidence_private_read_hash_mismatch");
    expect(founderEvidenceSafeError(
      new Error("connect ECONNREFUSED mysql://user:secret@example.test"),
    )).toBe("founder_evidence_ceremony_failed");
    expect(founderEvidenceSafeError("raw upstream error")).toBe(
      "founder_evidence_ceremony_failed",
    );
  });
});
