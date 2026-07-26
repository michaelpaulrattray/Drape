import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  EvidenceDeliveryError,
  buildEvidenceCropStorageKey,
  buildReferencePlateStorageKey,
  parseEvidenceStorageKey,
  resolveEvidenceOwnerDelivery,
  type EvidenceDeliveryAdapter,
} from "./evidenceDelivery";
import {
  canonicalizeEvidenceImage,
  type CanonicalEvidenceImage,
} from "./imageValidation";
import {
  stageCanonicalReferencePlate,
  type EvidenceModelHead,
  type ReferencePlateIngestionPersistence,
} from "./referencePlateIngestion";

const operationId = "10000000-0000-4000-8000-000000000001";
const ingestionId = "10000000-0000-4000-8000-000000000002";
const plateId = "10000000-0000-4000-8000-000000000003";
const cropId = "10000000-0000-4000-8000-000000000004";
const head: EvidenceModelHead = {
  stateVersion: 7,
  currentPackageSnapshotId: "snapshot-head",
  identityRevisionId: "identity-head",
};
let image: CanonicalEvidenceImage;

function fakePersistence(events: string[]): ReferencePlateIngestionPersistence {
  return {
    planReferencePlate: vi.fn(async () => {
      events.push("plan:start");
      await Promise.resolve();
      events.push("plan:commit");
      return head;
    }),
    markReferencePlateStored: vi.fn(async () => {
      events.push("stored:start");
      await Promise.resolve();
      events.push("stored:commit");
    }),
    attachReferencePlate: vi.fn(async (input) => {
      events.push("attach:start");
      expect(input.expectedHead).toEqual(head);
      await Promise.resolve();
      events.push("attach:commit");
    }),
  };
}

function fakeDelivery(
  events: string[],
  overrides: Partial<EvidenceDeliveryAdapter> = {},
): EvidenceDeliveryAdapter {
  return {
    putCanonical: vi.fn(async (key, bytes, mime) => {
      events.push("put");
      expect(bytes).toEqual(image.bytes);
      expect(mime).toBe("image/webp");
      return { key };
    }),
    resolveOwnerDelivery: vi.fn(async (_userId, key) => {
      events.push("resolve");
      return `disposable-owner://${key}`;
    }),
    deleteExact: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("R7-7C2 posture-neutral evidence delivery", () => {
  beforeAll(async () => {
    const source = await sharp({
      create: {
        width: 512,
        height: 768,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    }).png().toBuffer();
    image = await canonicalizeEvidenceImage({
      bytes: source,
      declaredMime: "image/png",
    });
  });

  it("builds and parses only exact single-owner evidence keys", () => {
    const plateKey = buildReferencePlateStorageKey({ userId: 12, modelId: 34, plateId });
    const cropKey = buildEvidenceCropStorageKey({ userId: 12, modelId: 34, cropId });
    expect(plateKey).toBe(
      `users/12/models/34/evidence/plates/${plateId}.webp`,
    );
    expect(parseEvidenceStorageKey(plateKey)).toEqual({
      userId: 12,
      modelId: 34,
      kind: "plate",
      entityId: plateId,
    });
    expect(parseEvidenceStorageKey(cropKey)).toMatchObject({
      userId: 12,
      modelId: 34,
      kind: "crop",
      entityId: cropId,
    });
    for (const invalid of [
      `users/12/models/34/evidence/plates/${plateId}.jpg`,
      `users/12/models/34/evidence/plates/../${plateId}.webp`,
      `users/012/models/34/evidence/plates/${plateId}.webp`,
      `users/12/models/034/evidence/plates/${plateId}.webp`,
      `users/12/models/34/evidence/other/${plateId}.webp`,
      `models/34/users/12/evidence/plates/${plateId}.webp`,
    ]) {
      expect(() => parseEvidenceStorageKey(invalid)).toThrow(EvidenceDeliveryError);
    }
  });

  it("refuses owner-delivery prefix mismatch before invoking the adapter", async () => {
    const key = buildReferencePlateStorageKey({ userId: 1, modelId: 4, plateId });
    const resolveOwnerDelivery = vi.fn();
    await expect(resolveEvidenceOwnerDelivery(
      fakeDelivery([], { resolveOwnerDelivery }),
      { userId: 2, key },
    )).rejects.toMatchObject({ code: "owner_mismatch" });
    expect(resolveOwnerDelivery).not.toHaveBeenCalled();
  });

  it("runs plan commit, exact-key put, stored commit and attachment in order", async () => {
    const events: string[] = [];
    const generated = [ingestionId, plateId];
    const result = await stageCanonicalReferencePlate({
      persistence: fakePersistence(events),
      delivery: fakeDelivery(events),
      generateId: () => generated.shift()!,
    }, {
      userId: 1,
      modelId: 4,
      operationId,
      image,
    });
    expect(events).toEqual([
      "plan:start",
      "plan:commit",
      "put",
      "stored:start",
      "stored:commit",
      "attach:start",
      "attach:commit",
      "resolve",
    ]);
    expect(result).toEqual({
      plateId,
      mime: "image/webp",
      width: 512,
      height: 768,
      byteSize: image.byteSize,
      contentHash: image.contentHash,
      delivery: `disposable-owner://users/1/models/4/evidence/plates/${plateId}.webp`,
    });
  });

  it("leaves the durable plan as the last step when storage fails", async () => {
    const events: string[] = [];
    const generated = [ingestionId, plateId];
    await expect(stageCanonicalReferencePlate({
      persistence: fakePersistence(events),
      delivery: fakeDelivery(events, {
        putCanonical: vi.fn(async () => {
          events.push("put:failed");
          throw new Error("disposable store failed");
        }),
      }),
      generateId: () => generated.shift()!,
    }, {
      userId: 1,
      modelId: 4,
      operationId,
      image,
    })).rejects.toThrow("disposable store failed");
    expect(events).toEqual(["plan:start", "plan:commit", "put:failed"]);
  });

  it("refuses a returned-key mismatch before stored or attached state", async () => {
    const events: string[] = [];
    const generated = [ingestionId, plateId];
    await expect(stageCanonicalReferencePlate({
      persistence: fakePersistence(events),
      delivery: fakeDelivery(events, {
        putCanonical: vi.fn(async () => {
          events.push("put:mismatch");
          return { key: `users/1/models/4/evidence/plates/${cropId}.webp` };
        }),
      }),
      generateId: () => generated.shift()!,
    }, {
      userId: 1,
      modelId: 4,
      operationId,
      image,
    })).rejects.toMatchObject({ code: "returned_key_mismatch" });
    expect(events).toEqual(["plan:start", "plan:commit", "put:mismatch"]);
  });

  it("re-proves canonical bytes and metadata before creating a durable plan", async () => {
    const events: string[] = [];
    const persistence = fakePersistence(events);
    await expect(stageCanonicalReferencePlate({
      persistence,
      delivery: fakeDelivery(events),
    }, {
      userId: 1,
      modelId: 4,
      operationId,
      image: { ...image, contentHash: "b".repeat(64) },
    })).rejects.toMatchObject({ code: "decode_failed" });
    expect(events).toEqual([]);
    expect(persistence.planReferencePlate).not.toHaveBeenCalled();
  });
});
