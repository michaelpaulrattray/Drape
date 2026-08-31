/**
 * THE RITE'S EYE-FRAME CHECK CAN FAIL, ON THE REAL INCIDENT'S SHAPE (#320).
 *
 * On 2026-08-31 the founder's card `queue-titles-285-frames` drew broken-image
 * glyphs. Everything the team checks was green — the briefing parsed, the
 * serving allowlist named both keys, the deploy was SUCCESS — because the only
 * wrong thing was WHICH BUCKET held the bytes. It had happened once before, the
 * same way, and both were repaired by hand.
 *
 * These arms drive `scripts/lib/eyeFramePresence.mts`, the judge the rite calls
 * before the push. Working law 2: a guard gets a negative control and a positive
 * control before its verdicts count for anything, and every negative arm here
 * asserts its OWN reason — a refusal for some other cause must not print PROVEN
 * over this one.
 *
 * The one thing these arms cannot prove is that the real bucket answers the way
 * the module assumes. That was measured at the live bucket instead, on the day
 * (a deployed frame → 200, a UUID that cannot exist → 404), and the injected
 * `head` models exactly those two answers.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { eyeFrameKeysOf, judgeEyeFramePresence } from "../scripts/lib/eyeFramePresence.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realBriefing = readFileSync(path.join(repoRoot, "server/crew/crew-briefing.json"), "utf8");
const BASE = "https://pub-example.r2.dev";

/** Every frame present — the bucket the founder's browser asks. */
const allPresent = async () => 200;

describe("eyeFrameKeysOf", () => {
  it("reads every distinct key the real committed briefing names", () => {
    const keys = eyeFrameKeysOf(realBriefing);
    expect(keys).not.toBeNull();
    expect(keys!.length).toBeGreaterThan(0);
    /* Deduped: the follow-court anchor appears under two items, and a key
       checked twice is one fact, not two. */
    expect(new Set(keys!).size).toBe(keys!.length);
    for (const key of keys!) expect(key).toMatch(/^crew-eye\//);
  });

  it("refuses bytes it cannot read rather than reporting an empty population", () => {
    expect(eyeFrameKeysOf("{ not json")).toBeNull();
    expect(eyeFrameKeysOf(JSON.stringify({ edition: 1 }))).toBeNull();
    expect(eyeFrameKeysOf(JSON.stringify({ eyeItems: [{ id: "a" }] }))).toBeNull();
    expect(eyeFrameKeysOf(JSON.stringify({ eyeItems: [{ id: "a", frames: [{ caption: "x" }] }] }))).toBeNull();
  });
});

describe("judgeEyeFramePresence", () => {
  it("PASSES the real briefing when every frame is in the bucket (positive control)", async () => {
    const verdict = await judgeEyeFramePresence(eyeFrameKeysOf(realBriefing), BASE, allPresent);
    expect(verdict.ok).toBe(true);
    expect(verdict.checked).toBeGreaterThan(0);
    expect(verdict.missing).toEqual([]);
    expect(verdict.unread).toEqual([]);
  });

  it("REFUSES when one frame is absent — the incident's own shape", async () => {
    const keys = eyeFrameKeysOf(realBriefing)!;
    const orphan = keys[0]!;
    const verdict = await judgeEyeFramePresence(
      keys,
      BASE,
      async (url) => (url.endsWith(orphan) ? 404 : 200),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual([orphan]);
    expect(verdict.why).toContain("NOT in the production bucket");
    expect(verdict.why).toContain(orphan);
  });

  it("counts a 403 as absent — a bucket that will not serve it draws the same broken glyph", async () => {
    const verdict = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, async () => 403);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(["crew-eye/a.png"]);
  });

  it("REFUSES with no R2_PUBLIC_URL rather than falling back to the ambient .env", async () => {
    for (const base of [undefined, null, ""]) {
      const verdict = await judgeEyeFramePresence(["crew-eye/a.png"], base, async () => {
        throw new Error("the bucket must not be read at all when the base is unknown");
      });
      expect(verdict.ok).toBe(false);
      expect(verdict.why).toContain("R2_PUBLIC_URL");
      expect(verdict.why).toContain("dev bucket");
    }
  });

  it("calls UNREAD unread and refuses — it is a different fact from missing", async () => {
    const threw = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, async () => {
      throw new Error("ENOTFOUND");
    });
    expect(threw.ok).toBe(false);
    expect(threw.unread).toEqual(["crew-eye/a.png"]);
    expect(threw.missing).toEqual([]);
    expect(threw.why).toContain("UNREAD");

    const fiveHundred = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, async () => 500);
    expect(fiveHundred.ok).toBe(false);
    expect(fiveHundred.unread).toEqual(["crew-eye/a.png"]);
  });

  it("refuses an unreadable briefing rather than passing it as 'no frames'", async () => {
    const verdict = await judgeEyeFramePresence(null, BASE, allPresent);
    expect(verdict.ok).toBe(false);
    expect(verdict.checked).toBe(0);
  });

  it("passes an edition that names no frames at all", async () => {
    const verdict = await judgeEyeFramePresence([], BASE, allPresent);
    expect(verdict.ok).toBe(true);
    expect(verdict.why).toContain("no eye frames");
  });

  it("tolerates a trailing slash on the base rather than asking for //", async () => {
    const seen: string[] = [];
    await judgeEyeFramePresence(["crew-eye/a.png"], `${BASE}/`, async (url) => {
      seen.push(url);
      return 200;
    });
    expect(seen).toEqual([`${BASE}/crew-eye/a.png`]);
  });
});

describe("the rite actually calls it (invariant 7)", () => {
  const rite = readFileSync(path.join(repoRoot, "scripts/deploy-rite.mts"), "utf8");

  it("imports the judge and refuses the push on its verdict", () => {
    expect(rite).toContain('from "./lib/eyeFramePresence.mts"');
    expect(rite).toContain("judgeEyeFramePresence(");
    expect(rite).toContain("eyeFrameKeysOf(");
    /* Not a warning: the refusal is `die`, gated only by --dry. */
    expect(rite).toMatch(/if \(!frames\.ok && !DRY\) \{\s*\n\s*die\(/);
  });

  it("reads R2_PUBLIC_URL off the SERVICE, never off process.env", () => {
    const block = rite.slice(rite.indexOf("AND THE EYE FRAMES IT NAMES"), rite.indexOf("AND THE SCRIPT GUARDS"));
    expect(block).toContain('"variables", "--service", SERVICE');
    expect(block).toContain('"R2_PUBLIC_URL"');
    expect(block).not.toContain("process.env");
  });

  it("judges the briefing at the COMMIT being pushed, not the working tree", () => {
    const block = rite.slice(rite.indexOf("AND THE EYE FRAMES IT NAMES"), rite.indexOf("AND THE SCRIPT GUARDS"));
    expect(block).toContain("`${sha}:${BRIEFING_PATH}`");
  });
});

describe("the upload script cannot silently write to the wrong bucket (#320 fix 2)", () => {
  const upload = readFileSync(path.join(repoRoot, "scripts/crew-upload-eye-frame.mts"), "utf8");

  it("requires --bucket and refuses a mismatch before any byte moves", () => {
    expect(upload).toContain("--bucket is required");
    expect(upload).toContain("resolvedBucket !== expectedBucket");
    /* The refusal must come BEFORE the write, or it is a report of a mistake
       already made. */
    expect(upload.indexOf("resolvedBucket !== expectedBucket")).toBeLessThan(upload.indexOf("await storagePut("));
  });

  it("prints the bucket it resolved, in capitals", () => {
    expect(upload).toContain("WRITING TO BUCKET:");
  });
});
