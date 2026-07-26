import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import {
  EvidenceIngestScopeConfigurationError,
  EvidenceIngestAdapterConfigurationError,
  EvidenceIngestRuntimeNotReadyError,
  EvidenceIngestWorkerConfigurationError,
  evidenceIngestEnabledForUser,
  parseEvidenceIngestScope,
  validateEvidenceIngestEnvironment,
} from "./casting/evidence/evidenceIngestScope";
import { appRouter } from "./routers";
import {
  evidenceDeliveryConfigured,
  getEvidenceDeliveryAdapter,
} from "./casting/evidence/evidenceDeliveryRuntime";

function context(userId = 77): TrpcContext {
  return {
    user: {
      id: userId,
      suspendedAt: null,
      lockedUntil: null,
    } as User,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    correlationId: "r7-7c4-capability",
  };
}

describe("R7-7C4 evidence capability", () => {
  it("uses a strict fail-closed server-owned scope grammar", () => {
    expect(parseEvidenceIngestScope(undefined)).toEqual({ kind: "off" });
    expect(parseEvidenceIngestScope("")).toEqual({ kind: "off" });
    expect(parseEvidenceIngestScope("off")).toEqual({ kind: "off" });
    expect(parseEvidenceIngestScope("all")).toEqual({ kind: "all" });
    expect(parseEvidenceIngestScope("users:9,2")).toEqual({
      kind: "users",
      userIds: [2, 9],
    });
    for (const invalid of [
      "OFF", "off ", "users:", "users:0", "users:01", "users:1,1",
      "users:1, 2", "users:-1", "users:1.0", "anything",
    ]) {
      expect(() => parseEvidenceIngestScope(invalid)).toThrow(
        EvidenceIngestScopeConfigurationError,
      );
    }
    expect(evidenceIngestEnabledForUser(parseEvidenceIngestScope("users:2"), 2))
      .toBe(true);
    expect(evidenceIngestEnabledForUser(parseEvidenceIngestScope("users:2"), 3))
      .toBe(false);
    expect(() => validateEvidenceIngestEnvironment({
      scope: "users:2",
      cleanupWorker: undefined,
    })).toThrowError(
      new EvidenceIngestWorkerConfigurationError(),
    );
    expect(() => validateEvidenceIngestEnvironment({
      scope: "users:2",
      cleanupWorker: "true",
    })).toThrowError(new EvidenceIngestAdapterConfigurationError());
    expect(() => validateEvidenceIngestEnvironment({
      scope: "users:2",
      cleanupWorker: "true",
      adapterConfigured: true,
    })).toThrowError(new EvidenceIngestRuntimeNotReadyError());
    expect(validateEvidenceIngestEnvironment({
      scope: "users:2",
      cleanupWorker: "true",
      adapterConfigured: true,
      productReady: true,
    })).toEqual({ kind: "users", userIds: [2] });
    expect(validateEvidenceIngestEnvironment({
      scope: "off",
      cleanupWorker: undefined,
      adapterConfigured: false,
      productReady: false,
    })).toEqual({ kind: "off" });
  });

  it("reports false and refuses both mutations while scope is off", async () => {
    const previous = process.env.R7_EVIDENCE_INGEST_SCOPE;
    delete process.env.R7_EVIDENCE_INGEST_SCOPE;
    try {
      const caller = appRouter.createCaller(context());
      await expect(caller.evidence.capability()).resolves.toEqual({
        referencePlateIngestion: false,
      });
      await expect(caller.evidence.stageReferencePlate({
        modelId: 1,
        clientRequestId: "11111111-1111-4111-8111-111111111111",
        imageDataUrl: "not-even-parsed",
      })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(caller.evidence.discardReferencePlate({
        plateId: "22222222-2222-4222-8222-222222222222",
        clientRequestId: "33333333-3333-4333-8333-333333333333",
      })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(caller.evidence.stageReferencePlate({
        modelId: 1,
        clientRequestId: "11111111-1111-4111-8111-111111111111",
        imageDataUrl: "x",
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    } finally {
      if (previous === undefined) delete process.env.R7_EVIDENCE_INGEST_SCOPE;
      else process.env.R7_EVIDENCE_INGEST_SCOPE = previous;
    }
  });

  it("keeps the C5B adapter unreachable from product routes and the wire strict", async () => {
    expect(getEvidenceDeliveryAdapter()).toBeNull();
    expect(evidenceDeliveryConfigured()).toBe(false);
    const runtime = await readFile(
      new URL("./casting/evidence/evidenceDeliveryRuntime.ts", import.meta.url),
      "utf8",
    );
    expect(runtime).toContain("return null");
    expect(runtime).toContain("EVIDENCE_PRODUCT_DELIVERY_READY = false");
    expect(runtime).not.toMatch(/storagePut|R2_|S3Client|resolveOwnerDelivery\s*:/);

    const route = await readFile(
      new URL("./routes/evidence.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("protectedProcedure");
    expect(route.match(/\.strict\(\)/g)).toHaveLength(2);
    expect(route).not.toMatch(/publicProcedure|userId:\s*z\.|storageKey:\s*z\.|contentHash:\s*z\./);
    expect(route).toContain("evidenceDeliveryConfigured()");
    expect(route).toContain("checkUserRateLimit");

    const env = await readFile(new URL("./_core/env.ts", import.meta.url), "utf8");
    expect(env).toContain("validateEvidenceIngestEnvironment");
    expect(env).toContain("process.env.ENABLE_STORAGE_CLEANUP_WORKER");
    expect(env).toContain("privateEvidenceAdapterConfigured()");
    expect(env).toContain("EVIDENCE_PRODUCT_DELIVERY_READY");

    const boot = await readFile(new URL("./_core/index.ts", import.meta.url), "utf8");
    expect(boot.indexOf("await assertPrivateEvidenceCleanupSchema()"))
      .toBeLessThan(boot.indexOf("const app = express()"));
  });

  it("pins claimed-only evidence operations and atomic product finalization", async () => {
    const service = await readFile(
      new URL("./casting/evidence/evidenceOperations.ts", import.meta.url),
      "utf8",
    );
    expect(service).toContain('kind: "evidence_plate_ingest"');
    expect(service).toContain('kind: "evidence_plate_discard"');
    expect(service).toContain("resumeClaimedEvidence: true");
    expect(service).not.toMatch(
      /markGenerationOperationRunning|startOperationHeartbeat|deductPoints|Gemini|storagePut|modelAssets/,
    );

    const persistence = await readFile(
      new URL("./db/evidenceOperations.ts", import.meta.url),
      "utf8",
    );
    expect(persistence).toContain("finalizeClaimedGenerationOperationSuccessIn");
    expect(persistence).toContain("createStorageCleanupManifestIn");
    expect(persistence).toContain("modelEvidenceCrops");
    expect(persistence).not.toMatch(/deleteExact|storageDelete|deductPoints|Gemini|modelAssets/);
  });
});
