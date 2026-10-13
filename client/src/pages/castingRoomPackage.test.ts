/**
 * The character's package downloads as ONE zip (#2463) — driven at the wire.
 *
 * His word, 2026-10-13: "when downloading the images it should be a package
 * not 5 individual downloads". These arms drive the real builder with a
 * recording `fetch` and read the archive back with JSZip, so what is asserted
 * is what went out on the request and what came out in the file.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { PRODUCT_NAME, productFilename } from "@shared/brand";
import {
  PACKAGE_DOWNLOAD_FAILED,
  buildPackageZip,
  packageFiles,
  packageZipFilename,
} from "./castingRoomPackage";

const ORIGIN = "https://app.example.test";
const STORED = "https://pub-bucket.r2.dev/cast/abc/master.png";
const STORED_VIEW = "https://pub-bucket.r2.dev/cast/abc/profile.png";

const FRAMES = [
  { url: STORED, downloadName: "Nine-master" },
  { url: STORED_VIEW, downloadName: "Nine-profile" },
];

type Answer = { status?: number; body?: string; disposition?: string };

function recordingFetch(answer: (url: string) => Answer) {
  const calls: { url: string; credentials: RequestCredentials | undefined }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, credentials: init?.credentials });
    const a = answer(url);
    const headers = new Headers();
    if (a.disposition) headers.set("content-disposition", `attachment; filename="${a.disposition}"`);
    return new Response(a.body ?? `bytes of ${url}`, { status: a.status ?? 200, headers });
  }) as typeof fetch;
  return { impl, calls };
}

describe("one press, one zip (#2463)", () => {
  it("fetches the sheet first and every view, each through the same-origin road, with the session cookie", async () => {
    const { impl, calls } = recordingFetch(() => ({}));
    await buildPackageZip(packageFiles(FRAMES, "KI-1"), ORIGIN, impl);
    expect(calls.map((c) => c.url)).toHaveLength(3);
    // The sheet is already same-origin and goes as it is.
    expect(calls[0].url).toBe("/api/cast/KI-1/sheet");
    // Every stored picture goes through the authenticated proxy, never raw.
    for (const call of calls.slice(1)) {
      const parsed = new URL(call.url, ORIGIN);
      expect(parsed.pathname).toBe("/api/image-proxy");
      expect([STORED, STORED_VIEW]).toContain(parsed.searchParams.get("url"));
    }
    expect(calls.every((c) => c.credentials === "same-origin")).toBe(true);
    expect(calls.some((c) => c.url.startsWith("https://pub-bucket"))).toBe(false);
  });

  it("the archive holds every file under the name the server gave it, sheet first", async () => {
    const { impl } = recordingFetch((url) =>
      url.startsWith("/api/cast/")
        ? { disposition: "Nine-character-sheet.jpg", body: "SHEET" }
        : { disposition: new URL(url, ORIGIN).searchParams.get("filename")!, body: "VIEW" });
    const built = await buildPackageZip(packageFiles(FRAMES, "KI-1"), ORIGIN, impl);
    const zip = await JSZip.loadAsync(built.bytes);
    const names = Object.keys(zip.files);
    expect(names).toEqual([
      "Nine-character-sheet.jpg",
      productFilename("Nine-master.png"),
      productFilename("Nine-profile.png"),
    ]);
    expect(built.names).toEqual(names);
    expect(await zip.file("Nine-character-sheet.jpg")!.async("string")).toBe("SHEET");
  });

  it("falls back to the asked-for name when the server names nothing, and never lets two files collide", async () => {
    const { impl } = recordingFetch(() => ({}));
    const built = await buildPackageZip(
      [
        { url: "/api/cast/KI-1/sheet", name: "a.png" },
        { url: "/api/cast/KI-1/other", name: "a.png" },
      ],
      ORIGIN,
      impl,
    );
    expect(Object.keys((await JSZip.loadAsync(built.bytes)).files)).toEqual(["a.png", "a-2.png"]);
  });

  it("ALL OR NOTHING — one failed file (or an empty one) and the build throws, so nothing is saved", async () => {
    const failing = recordingFetch((url) => (url.includes("profile") ? { status: 502 } : {}));
    await expect(buildPackageZip(packageFiles(FRAMES, "KI-1"), ORIGIN, failing.impl)).rejects.toThrow();
    const empty = recordingFetch((url) => (url.startsWith("/api/cast/") ? { body: "" } : {}));
    await expect(buildPackageZip(packageFiles(FRAMES, "KI-1"), ORIGIN, empty.impl)).rejects.toThrow();
    // The sentence the room shows says nothing was saved.
    expect(PACKAGE_DOWNLOAD_FAILED).toMatch(/nothing was saved/);
  });
});

describe("the zip is named after the character", () => {
  const prefix = `${PRODUCT_NAME.toLowerCase()}-`;
  it("carries the product's prefix and the character's own name", () => {
    expect(packageZipFilename("Nine")).toBe(`${prefix}Nine.zip`);
    expect(packageZipFilename("Zoë Vale")).toBe(`${prefix}Zoë Vale.zip`);
  });
  it("takes out only what a desktop refuses, and falls back when nothing is left", () => {
    expect(packageZipFilename('a/b\\c:d*"e')).toBe(`${prefix}a-b-c-d-e.zip`);
    expect(packageZipFilename("  ")).toBe(`${prefix}character.zip`);
    expect(packageZipFilename(null)).toBe(`${prefix}character.zip`);
    expect(packageZipFilename("...")).toBe(`${prefix}character.zip`);
  });
});

describe("the room wires the package, not the old per-file links", () => {
  it("CastingRoom saves one blob through the builder and shows the sentence on failure", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const room = await readFile(join(__dirname, "CastingRoom.tsx"), "utf8");
    const start = room.indexOf("async function downloadPackage(");
    const body = room.slice(start, room.indexOf("export function roomDeleteFailureSentence"));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('new Blob([new Uint8Array(built.bytes)], { type: "application/zip" })');
    expect(body).toContain("link.download = packageZipFilename(castName);");
    // The old burst of one link per file is gone.
    expect(body).not.toContain("files.forEach");
    expect(room).toContain("if (!saved) toast.error(PACKAGE_DOWNLOAD_FAILED);");
    expect(room).toContain("{packaging ? PACKAGE_DOWNLOAD_WORKING : \"Download\"}");
  });
});
