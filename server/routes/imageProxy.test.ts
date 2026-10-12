import express from "express";
import { baseUrlOf, listenOnFetchablePort } from "../testing/fetchablePort";
import { SessionRejectedError } from "../_core/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImageProxyRouter,
  isAllowedUrl,
} from "./imageProxy";
import { PRODUCT_NAME } from "@shared/brand";

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
    dependencies.authenticateRequest.mockRejectedValueOnce(new SessionRejectedError("Invalid session cookie"));

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

  it("names a download after the product when the source URL carries no usable filename (#1992)", async () => {
    // The fallback is the one Content-Disposition name the server composes
    // itself; driven at the wire because a reader of the header line cannot
    // see inside safeDownloadFilename.
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    const imageUrl = "https://pub-test.r2.dev/casting/";

    await withImageProxy(dependencies, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/image-proxy?download=1&url=${encodeURIComponent(imageUrl)}`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition"))
        .toBe(`attachment; filename="${PRODUCT_NAME.toLowerCase()}-image.png"`);
      expect(response.headers.get("content-disposition")).not.toMatch(/drape/i);
    });
  });

  it("names the file what the app asked for, because this header beats the anchor's download attribute (#2407)", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    const imageUrl = "https://pub-test.r2.dev/casting/3ece7528-d1ea-4525-b2da-ef48048640cf.png";

    await withImageProxy(dependencies, async (baseUrl) => {
      const asked = await fetch(
        `${baseUrl}/api/image-proxy?download=1&filename=klieg-Hallvard-master.png&url=${encodeURIComponent(imageUrl)}`,
      );
      expect(asked.status).toBe(200);
      expect(asked.headers.get("content-disposition"))
        .toBe('attachment; filename="klieg-Hallvard-master.png"');

      // Negative control: no name asked, the storage key stands as before.
      const unasked = await fetch(
        `${baseUrl}/api/image-proxy?download=1&url=${encodeURIComponent(imageUrl)}`,
      );
      expect(unasked.headers.get("content-disposition"))
        .toBe('attachment; filename="3ece7528-d1ea-4525-b2da-ef48048640cf.png"');
    });
  });

  it("makes a requested name safe: ASCII stem only, no path or header characters, the verified bytes' extension", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const dependencies = allowedDependencies();
    const imageUrl = "https://pub-test.r2.dev/casting/key.png";
    const ask = async (baseUrl: string, filename: string) => (await fetch(
      `${baseUrl}/api/image-proxy?download=1&filename=${encodeURIComponent(filename)}&url=${encodeURIComponent(imageUrl)}`,
    )).headers.get("content-disposition");

    await withImageProxy(dependencies, async (baseUrl) => {
      // Path separators, quotes and CR/LF can neither escape the folder nor split the header.
      expect(await ask(baseUrl, '../../etc/x"; y\r\nSet-Cookie: a=b.png'))
        .toBe('attachment; filename="etc_x___y__Set-Cookie__a_b.png"');
      // The caller cannot relabel the bytes: the extension is the one the PNG carries.
      expect(await ask(baseUrl, "Hallvard.html")).toBe('attachment; filename="Hallvard.html.png"');
      expect(await ask(baseUrl, "Hallvard.jpg")).toBe('attachment; filename="Hallvard.png"');
      // Non-ASCII becomes `_`; a name with nothing usable left falls back to the storage key.
      expect(await ask(baseUrl, "Zoë")).toBe('attachment; filename="Zo_.png"');
      expect(await ask(baseUrl, "...")).toBe('attachment; filename="key.png"');
      expect(await ask(baseUrl, "")).toBe('attachment; filename="key.png"');
    });
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
