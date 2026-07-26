import { describe, expect, it, vi } from "vitest";
import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import {
  buildOwnerPrivateEvidenceEtag,
  evidenceEtagMatches,
  prepareEvidenceHttpRead,
} from "./evidenceDeliveryHttp";

const entityId = "10000000-0000-4000-8000-000000000001";
const storageKey =
  `users/1/models/4/evidence/plates/${entityId}.webp`;
const contentHash = "a".repeat(64);

function adapter(readCanonical = vi.fn()): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(),
    readCanonical,
    resolveOwnerDelivery: vi.fn(),
    deleteExact: vi.fn(),
    listCanonicalKeys: vi.fn(),
  } as PrivateEvidenceStorageAdapter;
}

const evidence = {
  ownerId: 1,
  modelId: 4,
  kind: "plate" as const,
  entityId,
  storageKey,
  byteSize: 12,
  contentHash,
};

describe("R7-7C5B owner-private evidence cache authority", () => {
  it("binds the opaque ETag to owner, entity and immutable content", () => {
    const first = buildOwnerPrivateEvidenceEtag({
      jwtSecret: "server-only-secret",
      ownerId: 1,
      kind: "plate",
      entityId,
      contentHash,
    });
    const second = buildOwnerPrivateEvidenceEtag({
      jwtSecret: "server-only-secret",
      ownerId: 2,
      kind: "plate",
      entityId,
      contentHash,
    });
    expect(first).toMatch(/^"ev1\.[A-Za-z0-9_-]{43}"$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain(contentHash);
    expect(evidenceEtagMatches(`"old", W/${first}, "other"`, first)).toBe(true);
    expect(evidenceEtagMatches("*", first)).toBe(true);
    expect(evidenceEtagMatches("\"different\"", first)).toBe(false);
  });

  it("returns 304 authority before any private-bucket read", async () => {
    const readCanonical = vi.fn();
    const privateAdapter = adapter(readCanonical);
    const etag = buildOwnerPrivateEvidenceEtag({
      jwtSecret: "server-only-secret",
      ownerId: evidence.ownerId,
      kind: evidence.kind,
      entityId: evidence.entityId,
      contentHash: evidence.contentHash,
    });
    await expect(prepareEvidenceHttpRead({
      adapter: privateAdapter,
      evidence,
      jwtSecret: "server-only-secret",
      ifNoneMatch: `W/${etag}`,
    })).resolves.toEqual({ status: "not_modified", etag });
    expect(readCanonical).not.toHaveBeenCalled();
  });

  it("reads only after the stored key re-proves the authorized owner tuple", async () => {
    const object = {
      key: storageKey,
      mime: "image/webp" as const,
      byteSize: 12,
      body: {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array(12);
        },
      },
      abort: vi.fn(),
    };
    const readCanonical = vi.fn(async () => object);
    await expect(prepareEvidenceHttpRead({
      adapter: adapter(readCanonical),
      evidence,
      jwtSecret: "server-only-secret",
      ifNoneMatch: "\"different\"",
    })).resolves.toMatchObject({
      status: "read",
      object,
    });
    expect(readCanonical).toHaveBeenCalledWith({
      key: storageKey,
      expectedByteSize: 12,
    });

    await expect(prepareEvidenceHttpRead({
      adapter: adapter(readCanonical),
      evidence: { ...evidence, ownerId: 2 },
      jwtSecret: "server-only-secret",
    })).rejects.toMatchObject({ code: "owner_mismatch" });
    expect(readCanonical).toHaveBeenCalledTimes(1);
  });
});
