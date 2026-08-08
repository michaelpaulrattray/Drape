import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertImageBytes,
  describeNonImageBytes,
  fetchTrustedImage,
  NotAnImageError,
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

/*
  THE CANONICAL SPECIMEN, pinned (fable-062).

  A bucket base that routes an unknown key to the app's own index answers HTTP
  200 with an HTML page. A sweep that checked `response.ok` and handed the body
  to a segmenter with `absentIsAnswer: true` read back "this face wears no
  glasses" — for thirty faces in a row. The reading never happened; the
  instrument completed on a document and produced a confident negative.

  So the rule is about the MEDIUM, not the status: bytes may only answer a
  question about pictures if they are provably a picture.
*/
const APP_INDEX_HTML = Buffer.from(
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <title>Drape</title>\n',
  "utf8",
);

describe("assertImageBytes — the medium is proven, never assumed", () => {
  it("refuses the app's own HTML index served at 200, and says so in words", () => {
    expect(() => assertImageBytes(APP_INDEX_HTML, 'asked "glasses"'))
      .toThrow(NotAnImageError);
    try {
      assertImageBytes(APP_INDEX_HTML, 'asked "glasses"');
    } catch (error) {
      /* The message has to name the specimen, or the next reader goes back to
         the network to find out what "not an image" meant. */
      expect((error as Error).message).toContain('asked "glasses"');
      expect((error as Error).message).toContain("an HTML page");
      expect((error as Error).message).toContain("<!DOCTYPE html>");
    }
  });

  it("refuses empty bytes and unrecognised binary, each described by what it is", () => {
    expect(describeNonImageBytes(Buffer.alloc(0))).toBe("0 bytes");
    expect(describeNonImageBytes(Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe, 0x00, 0x01])))
      .toContain("unrecognised binary (starts 1f 8b 08 00");
    expect(() => assertImageBytes(Buffer.alloc(0), "asked anything")).toThrow(NotAnImageError);
  });

  it("passes real pictures through, naming the medium it proved", () => {
    expect(assertImageBytes(Buffer.from(PNG_BYTES), "asked")).toBe("image/png");
    expect(assertImageBytes(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "asked")).toBe("image/jpeg");
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii"),
    ]);
    expect(assertImageBytes(webp, "asked")).toBe("image/webp");
  });
});
