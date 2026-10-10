/**
 * THE ONE EYE-FRAME HEAD, AND THE REPAIR READ OFF THE VERDICT (#2232).
 *
 * The rite refused a record push with 365 of 365 eye frames UNREAD on a network
 * blip, while `check-eye-frames.mts` on the same tree two minutes later answered
 * "every key answered first time". The checker had #1177's pause-retry and the
 * rite did not; and the rite's printed repair said "re-upload the frames" for a
 * verdict that only ever meant "the bucket did not answer".
 *
 * These arms drive `scripts/lib/eyeFrameHead.mts` against a REAL local HTTP
 * server — the real `fetch`, the real cleared timeout, the real pause — and the
 * incident's shape is modelled as a blackout: every connection dropped for a
 * window after the first ask, then answers. Each positive arm sits beside a
 * negative control that proves the fixture CAN fail (working law 2): the same
 * blackout with the pause removed is refused UNREAD.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  createEyeFrameHead,
  EYE_FRAME_HEAD_RETRY_PAUSE_MS,
  EYE_FRAME_HEAD_TIMEOUT_MS,
} from "../scripts/lib/eyeFrameHead.mts";
import { eyeFrameRefusalRepair, judgeEyeFramePresence } from "../scripts/lib/eyeFramePresence.mts";
import { baseUrlOf, listenOnFetchablePort } from "./testing/fetchablePort";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string): string => readFileSync(path.join(repoRoot, relative), "utf8");

/* ── a real bucket stand-in ─────────────────────────────────────────────── */

type Bucket = { base: string; asks: Map<string, number>; close: () => Promise<void> };
let open: Bucket[] = [];
afterEach(async () => {
  await Promise.all(open.map((bucket) => bucket.close()));
  open = [];
});

/**
 * `blackoutMs` — every request in that window after the FIRST request is dropped
 * (socket destroyed, no status: what a blip looks like to `fetch`). After it,
 * keys in `present` answer 200 and everything else 404.
 */
const startBucket = async (options: { blackoutMs: number; present: string[]; foreverDown?: boolean }): Promise<Bucket> => {
  const asks = new Map<string, number>();
  let blackoutUntil: number | null = null;
  const handler = (request: IncomingMessage, response: ServerResponse) => {
    const key = (request.url ?? "/").slice(1);
    asks.set(key, (asks.get(key) ?? 0) + 1);
    if (blackoutUntil === null) blackoutUntil = Date.now() + options.blackoutMs;
    if (options.foreverDown || Date.now() < blackoutUntil) {
      request.socket.destroy();
      return;
    }
    response.statusCode = options.present.includes(key) ? 200 : 404;
    response.end();
  };
  const server: Server = await listenOnFetchablePort((port) => createServer(handler).listen(port, "127.0.0.1"));
  const bucket: Bucket = {
    base: baseUrlOf(server),
    asks,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
  open.push(bucket);
  return bucket;
};

const KEYS = ["crew-eye/a.png", "crew-eye/b.png", "crew-eye/c.png", "crew-eye/d.png", "crew-eye/e.png"];

describe("the shared head re-asks an unanswered HEAD once, after a real pause (#1177 → #2232)", () => {
  it("POSITIVE — a blip that recovers after the pause is a PASS, through the judge, at a real server", async () => {
    const bucket = await startBucket({ blackoutMs: 250, present: KEYS });
    const eyeFrameHead = createEyeFrameHead();
    const verdict = await judgeEyeFramePresence(KEYS, bucket.base, eyeFrameHead.head);
    expect(verdict.unread).toEqual([]);
    expect(verdict.missing).toEqual([]);
    expect(verdict.ok).toBe(true);
    /* It was the head's re-ask that rescued it, not luck: every key was dropped once. */
    expect(eyeFrameHead.retried()).toBe(KEYS.length);
    for (const key of KEYS) expect(bucket.asks.get(key)).toBe(2);
  });

  it("NEGATIVE CONTROL — the same blip with the pause taken out is refused UNREAD (the rite's old head)", async () => {
    /* Proves the fixture can fail: the judge's own immediate serial retry is NOT
       enough, which is #1177's finding and the incident's shape. */
    const bucket = await startBucket({ blackoutMs: 250, present: KEYS });
    const verdict = await judgeEyeFramePresence(KEYS, bucket.base, createEyeFrameHead(undefined, 0).head);
    expect(verdict.ok).toBe(false);
    expect(verdict.unread.length).toBeGreaterThan(0);
    expect(verdict.missing).toEqual([]);
  });

  it("waits the declared pause between the two asks, on the real fetch", async () => {
    const bucket = await startBucket({ blackoutMs: 250, present: ["crew-eye/a.png"] });
    const began = Date.now();
    const status = await createEyeFrameHead().head(`${bucket.base}/crew-eye/a.png`);
    expect(status).toBe(200);
    /* setTimeout may fire a millisecond early on Windows. */
    expect(Date.now() - began).toBeGreaterThanOrEqual(EYE_FRAME_HEAD_RETRY_PAUSE_MS - 5);
  });

  it("a persistent failure is still UNREAD after the re-ask — it fails closed (invariant 7)", async () => {
    const bucket = await startBucket({ blackoutMs: 0, present: KEYS, foreverDown: true });
    const eyeFrameHead = createEyeFrameHead();
    expect(await eyeFrameHead.head(`${bucket.base}/crew-eye/a.png`)).toBeNull();
    expect(bucket.asks.get("crew-eye/a.png")).toBe(2);
    expect(eyeFrameHead.retried()).toBe(1);

    const verdict = await judgeEyeFramePresence(KEYS, bucket.base, eyeFrameHead.head);
    expect(verdict.ok).toBe(false);
    expect(verdict.unread.length).toBe(KEYS.length);
    expect(verdict.missing).toEqual([]);
    /* And what it prints is the RE-RUN repair, never the re-upload one. */
    const repair = eyeFrameRefusalRepair(verdict, "RE-UPLOAD-WORDING").join("\n");
    expect(repair).toMatch(/Re-run before changing anything/);
    expect(repair).not.toContain("RE-UPLOAD-WORDING");
  });

  it("a 404 is an answer — asked once, never re-asked", async () => {
    const bucket = await startBucket({ blackoutMs: 0, present: [] });
    const eyeFrameHead = createEyeFrameHead();
    expect(await eyeFrameHead.head(`${bucket.base}/crew-eye/gone.png`)).toBe(404);
    expect(bucket.asks.get("crew-eye/gone.png")).toBe(1);
    expect(eyeFrameHead.retried()).toBe(0);
  });

  it("an answer the first time is never re-asked", async () => {
    const bucket = await startBucket({ blackoutMs: 0, present: ["crew-eye/a.png"] });
    const eyeFrameHead = createEyeFrameHead();
    expect(await eyeFrameHead.head(`${bucket.base}/crew-eye/a.png`)).toBe(200);
    expect(bucket.asks.get("crew-eye/a.png")).toBe(1);
    expect(eyeFrameHead.retried()).toBe(0);
  });

  it("the timeout stays the bound #1177 measured — a dead host costs seconds, not minutes", () => {
    expect(EYE_FRAME_HEAD_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(EYE_FRAME_HEAD_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(EYE_FRAME_HEAD_RETRY_PAUSE_MS).toBeGreaterThan(0);
  });
});

describe("the repair is read off the verdict — UNREAD re-runs, MISSING re-uploads (#2232)", () => {
  const REUPLOAD = "re-upload the frame(s) and commit";

  it("UNREAD only — re-run, and NOT re-upload (the incident: 365 of 365 unread)", () => {
    const lines = eyeFrameRefusalRepair({ missing: [], unread: new Array(365).fill("crew-eye/x.png") }, REUPLOAD);
    const text = lines.join("\n");
    expect(text).toContain("UNREAD 365");
    expect(text).toMatch(/the bucket did not answer/);
    expect(text).toMatch(/Re-run before changing anything/);
    expect(text).not.toContain(REUPLOAD);
  });

  it("MISSING only — the re-upload repair, and no re-run line (#320's shape)", () => {
    const lines = eyeFrameRefusalRepair({ missing: ["crew-eye/gone.png"], unread: [] }, REUPLOAD);
    expect(lines).toEqual([`MISSING 1: ${REUPLOAD}`]);
  });

  it("both at once prints both, each with its own count", () => {
    const text = eyeFrameRefusalRepair({ missing: ["a", "b"], unread: ["c"] }, REUPLOAD).join("\n");
    expect(text).toContain("UNREAD 1");
    expect(text).toContain(`MISSING 2: ${REUPLOAD}`);
  });

  it("neither — a refusal before any ask — names no frame repair at all", () => {
    const text = eyeFrameRefusalRepair({ missing: [], unread: [] }, REUPLOAD).join("\n");
    expect(text).not.toContain(REUPLOAD);
    expect(text).not.toMatch(/Re-run before changing anything/);
    expect(text).toMatch(/no frame was found missing or unread/);
  });
});

describe("⚠ BOTH callers use the one head and the one repair — no copy (working law 4)", () => {
  const rite = read("scripts/deploy-rite.mts");
  const riteBlock = rite.slice(rite.indexOf("AND THE EYE FRAMES IT NAMES"), rite.indexOf("AND THE SCRIPT GUARDS"));
  const checker = read("scripts/check-eye-frames.mts");

  it("the slices are real — a missing anchor must not let the arms below pass over nothing", () => {
    expect(rite.indexOf("AND THE EYE FRAMES IT NAMES")).toBeGreaterThan(-1);
    expect(riteBlock).toContain("judgeEyeFramePresence(");
  });

  it("the rite hands the judge the shared head and rolls no HEAD of its own", () => {
    expect(rite).toContain('from "./lib/eyeFrameHead.mts"');
    expect(riteBlock).toContain("createEyeFrameHead().head");
    expect(riteBlock).not.toMatch(/method:\s*"HEAD"/);
  });

  it("the checker hands the judge the shared head and keeps no pause of its own", () => {
    expect(checker).toContain('from "./lib/eyeFrameHead.mts"');
    expect(checker).toMatch(/judgeEyeFramePresence\([^)]*eyeFrameHead\.head\)/);
    expect(checker).not.toContain("HEAD_RETRY_PAUSE_MS =");
    /* The one HEAD the checker may still make is the CSP read, at the app origin. */
    expect(checker.match(/method:\s*"HEAD"/g)?.length ?? 0).toBe(1);
    expect(checker).toMatch(/fetchWithClearedTimeout\(PRODUCTION_ORIGIN, \{ method: "HEAD" \}/);
  });

  it("the rite's refusal prints the verdict-chosen repair, inside the die", () => {
    const branch = riteBlock.indexOf("if (!frames.ok && !DRY) {");
    const die = riteBlock.indexOf("die(`", branch);
    const end = riteBlock.indexOf("say(`  eye frames:", branch);
    expect(branch).toBeGreaterThan(-1);
    expect(die).toBeGreaterThan(branch);
    const call = riteBlock.slice(die, end);
    expect(call).toContain("eyeFrameRefusalRepair(frames,");
    /* No fixed re-upload line left standing beside it as the only repair. */
    expect(call).not.toMatch(/\n\s*repair: re-upload/);
  });

  it("the checker's refusal prints the verdict-chosen repair", () => {
    const refusal = checker.slice(checker.indexOf("if (verdict.ok) {"));
    expect(refusal).toContain("eyeFrameRefusalRepair(verdict,");
    expect(refusal).not.toMatch(/\n\s*repair: re-upload/);
  });
});
