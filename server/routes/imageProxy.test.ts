import express from "express";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImageProxyRouter,
  isAllowedUrl,
} from "./imageProxy";

const originalR2PublicUrl = process.env.R2_PUBLIC_URL;
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);

afterEach(() => {
  if (originalR2PublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
  else process.env.R2_PUBLIC_URL = originalR2PublicUrl;
});

async function withImageProxy(
  dependencies: Parameters<typeof createImageProxyRouter>[0],
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(createImageProxyRouter(dependencies));
  const server = await listenOnFetchablePort((port) => app.listen(port, "127.0.0.1"));
  try {
    await run(baseUrlOf(server));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }
}

function allowedDependencies() {
  return {
    authenticateRequest: vi.fn().mockResolvedValue({
      id: 7,
      suspendedAt: null,
      lockedUntil: null,
    }),
    fetchImage: vi.fn().mockResolvedValue({
      bytes: PNG_BYTES,
      mime: "image/png" as const,
    }),
    rateLimit: vi.fn().mockReturnValue({
      allowed: true,
      remaining: 59,
      resetIn: 60_000,
    }),
  };
}

describe("image proxy request boundary", () => {
  it("rejects an unauthenticated request before rate limiting or fetch", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    dependencies.authenticateRequest.mockRejectedValueOnce(new Error("no session"));

    await withImageProxy(dependencies, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/image-proxy?url=${encodeURIComponent("https://pub-test.r2.dev/casting/head.png")}`,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Authentication required" });
    });

    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(dependencies.fetchImage).not.toHaveBeenCalled();
  });

  it("serves only the verified image returned by the shared fetch authority", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    const imageUrl = "https://pub-test.r2.dev/casting/editorial%22head.png";

    await withImageProxy(dependencies, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/image-proxy?download=1&url=${encodeURIComponent(imageUrl)}`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("content-disposition"))
        .toBe('attachment; filename="editorial_head.png"');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG_BYTES);
    });

    expect(dependencies.fetchImage).toHaveBeenCalledWith(imageUrl);
  });

  it("returns a real 429 before fetch when the authenticated user is limited", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    dependencies.rateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetIn: 2_500,
    });

    await withImageProxy(dependencies, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/image-proxy?url=${encodeURIComponent("https://pub-test.r2.dev/casting/head.png")}`,
      );
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("3");
      expect(await response.json()).toEqual({
        error: "Too many requests. Please try again in 3 seconds.",
      });
    });

    expect(dependencies.fetchImage).not.toHaveBeenCalled();
  });

  it("refuses suspended and currently locked accounts before fetch", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    for (const accountState of [
      { suspendedAt: new Date(), lockedUntil: null },
      { suspendedAt: null, lockedUntil: new Date(Date.now() + 60_000) },
    ]) {
      const dependencies = allowedDependencies();
      dependencies.authenticateRequest.mockResolvedValueOnce({ id: 7, ...accountState });
      await withImageProxy(dependencies, async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/image-proxy?url=${encodeURIComponent("https://pub-test.r2.dev/casting/head.png")}`,
        );
        expect(response.status).toBe(403);
      });
      expect(dependencies.fetchImage).not.toHaveBeenCalled();
    }
  });
});

describe("imageProxy isAllowedUrl", () => {
  it("allows S3 bucket URLs", () => {
    expect(
      isAllowedUrl("https://manus-storage.s3.us-east-1.amazonaws.com/key/img.png")
    ).toBe(true);
    expect(isAllowedUrl("https://s3.amazonaws.com/bucket/img.png")).toBe(true);
  });

  it("allows only the configured public R2 bucket host", () => {
    process.env.R2_PUBLIC_URL = "https://pub-owned-bucket.r2.dev";
    expect(isAllowedUrl("https://pub-owned-bucket.r2.dev/casting/img.png")).toBe(true);
    expect(isAllowedUrl("https://pub-someone-else.r2.dev/casting/img.png")).toBe(false);
    expect(isAllowedUrl("https://account.r2.cloudflarestorage.com/bucket/img.png")).toBe(false);
  });

  it("blocks suffix-spoofing hostnames", () => {
    expect(isAllowedUrl("https://s3.amazonaws.com.attacker.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://evil.com/.amazonaws.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://xamazonaws.com/img.png")).toBe(false);
    expect(isAllowedUrl("https://manus-storage-fake.evil.com/img.png")).toBe(false);
  });

  it("blocks internal, arbitrary and non-https URLs", () => {
    expect(isAllowedUrl("https://localhost/admin")).toBe(false);
    expect(isAllowedUrl("https://127.0.0.1/latest/meta-data")).toBe(false);
    expect(isAllowedUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedUrl("https://example.com/img.png")).toBe(false);
    expect(isAllowedUrl("http://s3.amazonaws.com/bucket/img.png")).toBe(false);
    expect(isAllowedUrl("file:///etc/passwd")).toBe(false);
  });
});
