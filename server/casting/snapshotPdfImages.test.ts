import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveSnapshotPdfImages,
  SnapshotPdfImageError,
} from "./snapshotPdfImages";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveSnapshotPdfImages", () => {
  it("fetches only server-selected views and maps all angles to the PDF contract", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      const byte = value.includes("head") ? 1 : 2;
      return new Response(Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, byte,
      ]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSnapshotPdfImages([
      {
        angle: "frontClose",
        asset: { storageUrl: "https://pub-test.r2.dev/casting/head.png" },
      },
      {
        angle: "threeQuarter",
        asset: { storageUrl: "https://pub-test.r2.dev/casting/three-quarter.png" },
      },
    ]);

    expect(result).toEqual({
      headshot: "data:image/png;base64,iVBORw0KGgoB",
      threeQuarter: "data:image/png;base64,iVBORw0KGgoC",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => init?.redirect === "error")).toBe(true);
  });

  it("refuses a non-allowlisted URL before fetch and never echoes it", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const secretUrl = "https://attacker.example/private-token";

    const error = await resolveSnapshotPdfImages([
      { angle: "frontClose", asset: { storageUrl: secretUrl } },
    ]).catch((caught) => caught);

    expect(error).toBeInstanceOf(SnapshotPdfImageError);
    expect((error as Error).message).not.toContain(secretUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["non-image response", { "content-type": "text/html" }, Uint8Array.from([1])],
    ["declared oversized response", { "content-type": "image/png", "content-length": String(20 * 1024 * 1024 + 1) }, Uint8Array.from([1])],
    ["empty response", { "content-type": "image/png" }, new Uint8Array()],
    ["unsupported image bytes", { "content-type": "image/svg+xml" }, new TextEncoder().encode("<svg/>")],
  ])("fails closed for a %s", async (_name, headers, body) => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200, headers })));

    await expect(resolveSnapshotPdfImages([
      {
        angle: "frontClose",
        asset: { storageUrl: "https://pub-test.r2.dev/casting/head.png" },
      },
    ])).rejects.toBeInstanceOf(SnapshotPdfImageError);
  });

  it("turns a response-stream failure into the same static refusal", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const secret = "upstream-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error(secret));
        },
      }),
      { status: 200, headers: { "content-type": "image/png" } },
    )));

    const error = await resolveSnapshotPdfImages([{
      angle: "frontClose",
      asset: { storageUrl: "https://pub-test.r2.dev/casting/head.png" },
    }]).catch((caught) => caught);

    expect(error).toBeInstanceOf(SnapshotPdfImageError);
    expect((error as Error).message).not.toContain(secret);
  });
});
