import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("R7-7C5C evidence delivery contract", () => {
  it("registers the authenticated route before tRPC and static fallback", async () => {
    const index = await source("server/_core/index.ts");
    const route = index.indexOf("app.use(evidenceDeliveryRouter)");
    expect(route).toBeGreaterThan(0);
    expect(route).toBeLessThan(index.indexOf('"/api/trpc"'));
    expect(route).toBeLessThan(index.indexOf("serveStatic(app)"));
  });

  it("pins authentication, owner lookup, private cache headers and opaque errors", async () => {
    const route = await source("server/routes/evidenceDelivery.ts");
    expect(route.indexOf("dependencies.authenticate(req)"))
      .toBeLessThan(route.indexOf("dependencies.rateLimit(user.id)"));
    expect(route).toContain(
      "sdk.authenticateRequest(req, { recordActivity: false })",
    );
    expect(route.indexOf("dependencies.rateLimit(user.id)"))
      .toBeLessThan(route.indexOf("dependencies.load({"));
    expect(route).toContain("readOwnedEvidenceDelivery");
    expect(route).toContain('"Cache-Control", "private, no-cache"');
    expect(route).toContain('"Cross-Origin-Resource-Policy", "same-origin"');
    expect(route).toContain('"X-Content-Type-Options", "nosniff"');
    expect(route).toContain('"Evidence image not found"');
    expect(route).toContain('"Evidence image is temporarily unavailable"');
    expect(route).not.toMatch(/storageKey|bucket|providerMessage/);
  });

  it("anchors both child kinds to a live owned Cast in the database statement", async () => {
    const db = await source("server/db/evidenceDelivery.ts");
    expect(db.match(/eq\(models\.userId, input\.userId\)/g)).toHaveLength(2);
    expect(db.match(/eq\(modelReferencePlates\.userId, input\.userId\)/g))
      .toHaveLength(1);
    expect(db.match(/eq\(modelEvidenceCrops\.userId, input\.userId\)/g))
      .toHaveLength(1);
    expect(db.match(/isNull\(models\.deletedAt\)/g)).toHaveLength(2);
    expect(db.match(/ne\(models\.status, "archived"\)/g)).toHaveLength(2);
  });

  it("keeps retryable failures behind the shared placeholder component", async () => {
    const component = await source(
      "client/src/features/casting/evidence/PrivateEvidenceImage.tsx",
    );
    const loader = await source(
      "client/src/features/casting/evidence/privateEvidenceImageLoader.ts",
    );
    expect(component).toContain("loadPrivateEvidenceImage");
    expect(component).toContain("URL.createObjectURL(result.blob)");
    expect(component).toContain("Try image again");
    expect(component).not.toContain("<img\n        src={src}");
    expect(loader).toContain("response.status !== 429 && response.status !== 503");
    expect(loader).toContain("blob.size !== declaredSize");
    expect(loader).toContain("EVIDENCE_IMAGE_MAX_ATTEMPTS");
  });

  it("dispatches cleanup by stored backend and warns on pending private work", async () => {
    const worker = await source("server/casting/storageCleanupWorker.ts");
    expect(worker).toContain('item.storageBackend === "private_evidence_r2"');
    expect(worker).toContain("configuredPrivateAdapter.deleteExact(storageKey)");
    expect(worker).toContain("privateEvidenceAvailable: deletePrivateObject !== null");
    expect(worker).toContain("health.pendingPrivateBatches");
    expect(worker).toContain("storageCleanupHealthRequiresAttention(health)");
  });
});
