import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTrustedImage,
  TrustedImageFetchError,
} from "./trustedImageFetch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);

describe("fetchTrustedImage", () => {
  it("validates, refuses redirects, and verifies the returned image bytes", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn(async () => new Response(PNG_BYTES, {
      status: 200,
      headers: { "content-type": "image/png" },
    }));

    const image = await fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(image.mime).toBe("image/png");
    expect(image.bytes).toEqual(Buffer.from(PNG_BYTES));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://pub-test.r2.dev/casting/head.png",
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("refuses an untrusted URL before any network request and never echoes it", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn();
    const secretUrl = "https://attacker.example/private-token";

    const error = await fetchTrustedImage(secretUrl, {
      fetchImpl: fetchImpl as typeof fetch,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(TrustedImageFetchError);
    expect((error as Error).message).not.toContain(secretUrl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("turns a refused redirect into the same opaque error", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      throw new TypeError("redirect mode is set to error");
    });

    await expect(fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      { fetchImpl: fetchImpl as typeof fetch },
    )).rejects.toBeInstanceOf(TrustedImageFetchError);
  });

  it("enforces the streamed cap even when content-length understates the body", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn(async () => new Response(PNG_BYTES, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": "1",
      },
    }));

    await expect(fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      {
        fetchImpl: fetchImpl as typeof fetch,
        maxBytes: PNG_BYTES.byteLength - 1,
      },
    )).rejects.toBeInstanceOf(TrustedImageFetchError);
  });

  it("aborts an upstream request that exceeds the timeout", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      })
    ));

    await expect(fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      {
        fetchImpl: fetchImpl as typeof fetch,
        timeoutMs: 5,
      },
    )).rejects.toBeInstanceOf(TrustedImageFetchError);
  });

  it("keeps the timeout active while a response body stalls", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (
      new Response(new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("aborted", "AbortError"));
          }, { once: true });
        },
      }), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    ));

    await expect(fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      {
        fetchImpl: fetchImpl as typeof fetch,
        timeoutMs: 5,
      },
    )).rejects.toBeInstanceOf(TrustedImageFetchError);
  });

  it.each([
    ["non-image content", { "content-type": "text/html" }, PNG_BYTES],
    ["invalid declared length", { "content-type": "image/png", "content-length": "unknown" }, PNG_BYTES],
    ["unsupported bytes", { "content-type": "image/svg+xml" }, new TextEncoder().encode("<svg/>")],
  ])("fails closed for %s", async (_name, headers, bytes) => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchImpl = vi.fn(async () => new Response(bytes, {
      status: 200,
      headers,
    }));

    await expect(fetchTrustedImage(
      "https://pub-test.r2.dev/casting/head.png",
      { fetchImpl: fetchImpl as typeof fetch },
    )).rejects.toBeInstanceOf(TrustedImageFetchError);
  });
});
