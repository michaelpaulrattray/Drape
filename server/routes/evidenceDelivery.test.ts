import express from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import type { PrivateEvidenceStorageAdapter } from "../casting/evidence/evidenceDelivery";
import { buildOwnerPrivateEvidenceEtag } from "../casting/evidence/evidenceDeliveryHttp";
import {
  createEvidenceDeliveryRouter,
  type EvidenceDeliveryRouteDependencies,
} from "./evidenceDelivery";

const entityId = "10000000-0000-4000-8000-000000000001";
const key = `users/7/models/4/evidence/plates/${entityId}.webp`;
const bytes = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);
const evidence = {
  ownerId: 7,
  modelId: 4,
  kind: "plate" as const,
  entityId,
  storageKey: key,
  byteSize: bytes.length,
  contentHash: "a".repeat(64),
};

function privateAdapter(readCanonical = vi.fn(async () => ({
  key,
  mime: "image/webp" as const,
  byteSize: bytes.length,
  body: {
    async *[Symbol.asyncIterator]() {
      yield bytes.subarray(0, 5);
      yield bytes.subarray(5);
    },
  },
  abort: vi.fn(),
}))): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(),
    readCanonical,
    resolveOwnerDelivery: vi.fn(),
    deleteExact: vi.fn(),
    listCanonicalKeys: vi.fn(),
  } as PrivateEvidenceStorageAdapter;
}

function dependencies(): EvidenceDeliveryRouteDependencies {
  return {
    authenticate: vi.fn(async () => ({
      id: 7,
      suspendedAt: null,
      lockedUntil: null,
    })),
    rateLimit: vi.fn(() => ({ allowed: true, resetIn: 60_000 })),
    load: vi.fn(async () => evidence),
    adapter: vi.fn(() => privateAdapter()),
    jwtSecret: () => "server-only-jwt-secret",
  };
}

async function withRoute(
  deps: EvidenceDeliveryRouteDependencies,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(createEvidenceDeliveryRouter(deps));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }
}

describe("R7-7C5C authenticated evidence delivery", () => {
  it("authenticates before rate limit, database authority, or storage", async () => {
    const deps = dependencies();
    vi.mocked(deps.authenticate).mockRejectedValueOnce(new Error("no session"));
    await withRoute(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/plate/${entityId}`);
      expect(response.status).toBe(401);
    });
    expect(deps.rateLimit).not.toHaveBeenCalled();
    expect(deps.load).not.toHaveBeenCalled();
    expect(deps.adapter).not.toHaveBeenCalled();
  });

  it("makes foreign, missing and malformed evidence indistinguishable", async () => {
    for (const target of [
      `/api/evidence/plate/${entityId}`,
      "/api/evidence/plate/not-a-uuid",
    ]) {
      const deps = dependencies();
      vi.mocked(deps.load).mockResolvedValueOnce(null);
      await withRoute(deps, async (baseUrl) => {
        const response = await fetch(`${baseUrl}${target}`);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "Evidence image not found" });
      });
      expect(deps.adapter).not.toHaveBeenCalled();
    }
  });

  it("routes candidate previews through the same authenticated boundary", async () => {
    const deps = dependencies();
    vi.mocked(deps.load).mockResolvedValueOnce({
      ...evidence,
      kind: "candidate",
      storageKind: "plate",
    });
    await withRoute(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/candidate/${entityId}`);
      expect(response.status).toBe(200);
    });
    expect(deps.load).toHaveBeenCalledWith({
      userId: 7,
      kind: "candidate",
      entityId,
    });
  });

  it("streams ordinary private image bytes with cache and sniffing protections", async () => {
    const deps = dependencies();
    await withRoute(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/plate/${entityId}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/webp");
      expect(response.headers.get("content-length")).toBe(String(bytes.length));
      expect(response.headers.get("cache-control")).toBe("private, no-cache");
      expect(response.headers.get("vary")).toContain("Cookie");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
      expect(response.headers.get("etag")).toMatch(/^"ev1\./);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    });
    expect(deps.load).toHaveBeenCalledWith({
      userId: 7,
      kind: "plate",
      entityId,
    });
  });

  it("returns authenticated 304 without reading the private bucket", async () => {
    const readCanonical = vi.fn();
    const etag = buildOwnerPrivateEvidenceEtag({
      jwtSecret: "server-only-jwt-secret",
      ownerId: 7,
      kind: "plate",
      entityId,
      contentHash: evidence.contentHash,
    });

    const secondDeps = dependencies();
    vi.mocked(secondDeps.adapter).mockReturnValue(privateAdapter(readCanonical));
    await withRoute(secondDeps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/plate/${entityId}`, {
        headers: { "If-None-Match": etag },
      });
      expect(response.status).toBe(304);
      expect(response.headers.get("cache-control")).toBe("private, no-cache");
    });
    expect(readCanonical).not.toHaveBeenCalled();
    expect(secondDeps.load).toHaveBeenCalledTimes(1);
  });

  it("refuses locked accounts and rate limits before database or storage", async () => {
    const locked = dependencies();
    vi.mocked(locked.authenticate).mockResolvedValueOnce({
      id: 7,
      suspendedAt: null,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    await withRoute(locked, async (baseUrl) => {
      expect((await fetch(`${baseUrl}/api/evidence/plate/${entityId}`)).status)
        .toBe(403);
    });
    expect(locked.load).not.toHaveBeenCalled();

    const limited = dependencies();
    vi.mocked(limited.rateLimit).mockReturnValueOnce({
      allowed: false,
      resetIn: 2_100,
    });
    await withRoute(limited, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/plate/${entityId}`);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("3");
    });
    expect(limited.load).not.toHaveBeenCalled();
  });

  it("turns database unavailability into fixed retryable copy", async () => {
    const deps = dependencies();
    vi.mocked(deps.load).mockRejectedValueOnce(
      new Error("mysql://server-only@private.internal/railway"),
    );
    await withRoute(deps, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/evidence/plate/${entityId}`);
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("2");
      expect(await response.json()).toEqual({
        error: "Evidence image is temporarily unavailable",
      });
    });
    expect(deps.adapter).not.toHaveBeenCalled();
  });
});
