import { describe, expect, it, vi } from "vitest";
import {
  EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE,
  MAX_RENDERABLE_EVIDENCE_IMAGES,
} from "../shared/evidenceDelivery";
import {
  loadPrivateEvidenceImage,
} from "../client/src/features/casting/evidence/privateEvidenceImageLoader";

const webp = new Blob([
  Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]),
], { type: "image/webp" });

function imageResponse(): Response {
  return new Response(webp, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(webp.size),
    },
  });
}

describe("R7-7C5C evidence image retry UX", () => {
  it("keeps four request opportunities per maximum mounted evidence set", () => {
    expect(EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE).toBeGreaterThanOrEqual(240);
    expect(EVIDENCE_DELIVERY_REQUESTS_PER_MINUTE)
      .toBeGreaterThanOrEqual(4 * MAX_RENDERABLE_EVIDENCE_IMAGES);
  });

  it("honors Retry-After before recovering from a 429", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 429,
        headers: { "Retry-After": "2" },
      }))
      .mockResolvedValueOnce(imageResponse());
    const sleep = vi.fn(async () => undefined);
    const result = await loadPrivateEvidenceImage({
      src: "/api/evidence/plate/id",
      fetchImpl,
      sleep,
      random: () => 0.5,
    });
    expect(result.status).toBe("loaded");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000, undefined);
  });

  it.each([
    ["503", () => Promise.resolve(new Response(null, { status: 503 }))],
    ["network error", () => Promise.reject(new TypeError("offline"))],
    ["truncated stream", () => Promise.resolve(new Response(new Blob(["x"]), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(webp.size),
      },
    }))],
  ])("retries a transient %s without exposing partial bytes", async (_name, first) => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(first)
      .mockResolvedValueOnce(imageResponse());
    const result = await loadPrivateEvidenceImage({
      src: "/api/evidence/crop/id",
      fetchImpl,
      sleep: async () => undefined,
      random: () => 0.5,
    });
    expect(result.status).toBe("loaded");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops after the bounded attempts and returns an intentional placeholder state", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const result = await loadPrivateEvidenceImage({
      src: "/api/evidence/plate/id",
      fetchImpl,
      sleep: async () => undefined,
      maxAttempts: 3,
      random: () => 0.5,
    });
    expect(result).toEqual({ status: "unavailable", reason: "exhausted" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry an owner-safe missing response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(loadPrivateEvidenceImage({
      src: "/api/evidence/plate/id",
      fetchImpl,
      sleep: async () => undefined,
    })).resolves.toEqual({ status: "unavailable", reason: "not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
