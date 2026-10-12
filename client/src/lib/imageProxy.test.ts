/**
 * A DOWNLOAD SAVES A FILE AND THE TAB STAYS ON KLIEG — #2369 (and #2407's name).
 *
 * A browser ignores `download` on a link to another origin, so a press on the
 * character page's Download navigated the tab to a bare picture on the storage
 * host and saved nothing; the viewer's button opened a new tab instead. The cure
 * is the same-origin image proxy, carrying the name the file should be saved
 * under (its `Content-Disposition` beats the anchor's attribute).
 *
 * The driven proof — one press, seven files in the downloads folder, the tab
 * still on the cast's page — is in the PR; these arms hold the two things that
 * proof rests on: the builder's answer, and that both sites still go through it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../../../server/testing/contendedTestTimeout";
import { sourcesUnder } from "../../../server/testing/sourceTree";
import { imageProxyUrl, sameOriginDownloadHref } from "./imageProxy";

/* The class arm reads every client source off the real tree, which puts this
   suite in #741's population (`testing/sourceTree.ts`, one hop). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const ORIGIN = "http://localhost:3001";
const STORED = "https://pub-test.r2.dev/casting-v2/casts/x/anchor/3ece7528.png";
const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("sameOriginDownloadHref", () => {
  it("sends a picture on another origin through the proxy, with download and the name to save it under", () => {
    const href = sameOriginDownloadHref(STORED, ORIGIN, "klieg-Hallvard-master.png");
    const parsed = new URL(href, ORIGIN);
    expect(parsed.origin).toBe(ORIGIN);
    expect(parsed.pathname).toBe("/api/image-proxy");
    expect(parsed.searchParams.get("url")).toBe(STORED);
    expect(parsed.searchParams.get("download")).toBe("1");
    expect(parsed.searchParams.get("filename")).toBe("klieg-Hallvard-master.png");
  });

  it("leaves a same-origin route alone — the character sheet is not a stored picture and the proxy would refuse it", () => {
    expect(sameOriginDownloadHref("/api/cast/KI-1/sheet", ORIGIN, "x.jpg")).toBe("/api/cast/KI-1/sheet");
    expect(sameOriginDownloadHref(`${ORIGIN}/api/cast/KI-1/sheet`, ORIGIN, "x.jpg"))
      .toBe(`${ORIGIN}/api/cast/KI-1/sheet`);
  });

  it("the plain proxy URL (copy to clipboard) carries neither download nor a name", () => {
    const parsed = new URL(imageProxyUrl(STORED, { filename: "ignored.png" }), ORIGIN);
    expect(parsed.searchParams.get("download")).toBeNull();
    expect(parsed.searchParams.get("filename")).toBeNull();
  });
});

describe("both character-page download sites go through the same-origin road", () => {
  it("the CHARACTER SHEET row's package download proxies every file it saves", () => {
    const src = read("client/src/pages/CastingRoom.tsx");
    const start = src.indexOf("function downloadPackage(");
    const end = src.indexOf("export default function CastingRoom(");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain("link.href = sameOriginDownloadHref(file.url, window.location.origin, file.name);");
    expect(body).not.toMatch(/link\.href\s*=\s*file\.url/);
  });

  it("the viewer's download button proxies its picture and no longer opens a new tab", () => {
    const src = read("client/src/features/castingV2/components/CandidateViewer.tsx");
    const start = src.indexOf('className="dp-btn--onmedia dpc-viewer__download"');
    expect(start).toBeGreaterThan(-1);
    const tag = src.slice(start, src.indexOf(">", start));
    expect(tag).toMatch(/href=\{sameOriginDownloadHref\(frame\.url, window\.location\.origin, /);
    expect(tag).not.toContain('target="_blank"');
  });

  it("no anchor in the client with a download attribute points at a raw URL (the class)", () => {
    const offenders: string[] = [];
    let population = 0;
    for (const { relative: file, source: text } of sourcesUnder(join(ROOT, "client", "src"), { tests: "exclude" })) {
      if (!file.endsWith(".tsx")) continue;
      for (const match of text.matchAll(/<a\b[^>]*?\sdownload=/g)) {
        population += 1;
        const tag = text.slice(match.index!, text.indexOf(">", match.index! + match[0].length));
        if (!/href=\{sameOriginDownloadHref\(/.test(tag)) offenders.push(`${file}: ${tag.slice(0, 120)}`);
      }
    }
    expect(population).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
