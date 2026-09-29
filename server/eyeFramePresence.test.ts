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

import {

  EYE_FRAME_RETRY_GIVE_UP_AFTER,
  eyeFrameKeysOf,
  judgeEyeFramePresence,
  judgeUploadedFrame,
} from "../scripts/lib/eyeFramePresence.mts";

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

/**
 * THE BURST AND THE RETRY (#1177).
 *
 * The rite refused a real push because four of 314 simultaneous HEADs came back
 * with no answer while all four frames were present in the bucket. These arms
 * drive the second ask, and the shape that matters is the one the card asked
 * for: a `head` that FAILS ONCE and then answers — the happy path passing
 * proves nothing about a retry that does not exist.
 *
 * ⚠ Every arm here also carries its negative control in the same describe, and
 * they are the reason the arms mean anything: a retry that turned `unread` into
 * a pass would satisfy "flake survives" while destroying the whole point of the
 * module, so "never answers" must still refuse, and "404 twice" must still be
 * missing.
 */
describe("a burst is asked twice before it counts (#1177)", () => {
  /** A `head` that gives no answer the first N times it is asked about a key. */
  const flakesThenAnswers = (flakes: number, answer = 200) => {
    const asked = new Map<string, number>();
    const head = async (url: string) => {
      const seen = (asked.get(url) ?? 0) + 1;
      asked.set(url, seen);
      return seen <= flakes ? null : answer;
    };
    return { head, asked };
  };

  it("PASSES a frame that answered nothing the first time and 200 the second", async () => {
    const { head, asked } = flakesThenAnswers(1);
    const verdict = await judgeEyeFramePresence(["crew-eye/a.png", "crew-eye/b.png"], BASE, head);
    expect(verdict.ok).toBe(true);
    expect(verdict.unread).toEqual([]);
    expect(verdict.missing).toEqual([]);
    /* Asked exactly twice each: once in the burst, once in the retry. */
    expect([...asked.values()]).toEqual([2, 2]);
  });

  it("REFUSES when the second ask is unanswered too — the negative control", async () => {
    const never = async () => null;
    const verdict = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, never);
    expect(verdict.ok).toBe(false);
    expect(verdict.unread).toEqual(["crew-eye/a.png"]);
    expect(verdict.why).toContain("UNREAD");
  });

  it("never retries a 404 — an answer is an answer, and re-asking only costs time", async () => {
    const asked = new Map<string, number>();
    const verdict = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, async (url) => {
      asked.set(url, (asked.get(url) ?? 0) + 1);
      return 404;
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(["crew-eye/a.png"]);
    expect([...asked.values()]).toEqual([1]);
  });

  it("lets the retry turn an unread into MISSING when the second ask says 404", async () => {
    const { head } = flakesThenAnswers(1, 404);
    const verdict = await judgeEyeFramePresence(["crew-eye/a.png"], BASE, head);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(["crew-eye/a.png"]);
    expect(verdict.unread).toEqual([]);
  });

  /**
   * ⚠ THIS ARM GUARDS THE ABSENCE OF A BOUND, WHICH IS THE OPPOSITE OF WHAT
   * #1177's CARD RECOMMENDED — AND THE MEASUREMENT IS WHY.
   *
   * A bounded pool was built first. Driven at the real bucket over the real 312
   * keys, cold: unbounded 1.4s / 0 unread, pool of 16 2.6s / 0 unread — so the
   * bound does not prevent a drop. Drops track sustained volume, not the burst
   * (three back-to-back sweeps go 0 -> 9-13 -> 312 unread, and pools of
   * 16/32/64 scatter 5/17/6 with no relationship to the bound). And with the
   * timeout in hand the bound inverts: a dead host aborts all 312 together for
   * one 10s wait, where a pool of 16 would be 20 waves and 200s.
   *
   * So a future shift reading the card alone would "fix" this by adding the
   * pool back. This arm is here to argue with them, in numbers.
   */
  it("asks every key in one pass — the bound the card asked for was measured and declined", async () => {
    const keys = Array.from({ length: 200 }, (_, index) => `crew-eye/${index}.png`);
    let inFlight = 0;
    let peak = 0;
    const verdict = await judgeEyeFramePresence(keys, BASE, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return 200;
    });
    expect(verdict.ok).toBe(true);
    expect(peak).toBe(keys.length);
  });

  it("stops retrying a bucket that will not answer, and still refuses every key", async () => {
    const keys = Array.from({ length: 200 }, (_, index) => `crew-eye/${index}.png`);
    let asks = 0;
    const verdict = await judgeEyeFramePresence(keys, BASE, async () => {
      asks += 1;
      return null;
    });
    expect(verdict.ok).toBe(false);
    /* Nothing is passed for not having been asked twice. */
    expect(verdict.unread).toEqual(keys);
    expect(verdict.checked).toBe(keys.length);
    expect(asks).toBe(keys.length + EYE_FRAME_RETRY_GIVE_UP_AFTER);
  });

  it("keeps retrying while the retries are answering — a run of flakes is not a dead bucket", async () => {
    const keys = Array.from({ length: 20 }, (_, index) => `crew-eye/${index}.png`);
    const { head } = flakesThenAnswers(1);
    const verdict = await judgeEyeFramePresence(keys, BASE, head);
    expect(verdict.ok).toBe(true);
    expect(verdict.unread).toEqual([]);
  });

  it("names the same keys every run — the refusal is read by a human and acted on", async () => {
    const keys = Array.from({ length: 40 }, (_, index) => `crew-eye/${index}.png`);
    const absent = new Set([keys[31]!, keys[7]!, keys[19]!]);
    const run = async () =>
      await judgeEyeFramePresence(keys, BASE, async (url) => {
        /* Answers arrive out of order, which is what a real network does and
           what made the old completion-ordered lists a lottery. */
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));
        return absent.has(url.slice(BASE.length + 1)) ? 404 : 200;
      });
    const first = await run();
    const second = await run();
    expect(first.missing).toEqual([keys[7], keys[19], keys[31]]);
    expect(second.missing).toEqual(first.missing);
    expect(first.why).toBe(second.why);
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

  /**
   * ⚠ THE BOUNDED POOL IS ONLY SAFE WITH THIS (#1177).
   *
   * A bare HEAD against a host that accepts the connection and never answers
   * takes 306.6s to reject (measured on node 24). Unbounded, all 314 keys pay
   * that once, together; bounded, they would pay it once per wave. The judge
   * owns no fetch policy, so the timeout has to live here — and if it is ever
   * removed, the bound it makes safe stays behind and the rite gets slower on
   * exactly the day it is already in trouble.
   */
  it("hands the judge a head that times out, which is what makes the bound safe", () => {
    const block = rite.slice(rite.indexOf("AND THE EYE FRAMES IT NAMES"), rite.indexOf("AND THE SCRIPT GUARDS"));
    expect(block).toContain("AbortSignal.timeout(");
    const timeout = block.match(/AbortSignal\.timeout\((\d[\d_]*)\)/);
    expect(timeout).not.toBeNull();
    const ms = Number(timeout![1]!.replaceAll("_", ""));
    /* Long enough that a real answer is never cut off, short enough that a
       dead bucket costs waves of seconds rather than waves of minutes. */
    expect(ms).toBeGreaterThanOrEqual(5_000);
    expect(ms).toBeLessThanOrEqual(30_000);
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

  /* #265 — the key is the LAST thing printed. Two shifts piped this through
     `| tail -1`, got the "Next:" sentence, re-ran with a grep, and left five
     orphans each in the production bucket. A source read suffices: the order of
     two `console.log` lines before `process.exit(0)` is the whole contract. */
  it("prints the key on its last line, after the Next: sentence, so `| tail -1` keeps it (#265)", () => {
    const keyLine = upload.indexOf("console.log(`key: ${result.key}`)");
    const nextLine = upload.indexOf('console.log("Next: ');
    const exit = upload.lastIndexOf("process.exit(0)");
    expect(keyLine).toBeGreaterThan(-1);
    expect(nextLine).toBeGreaterThan(-1);
    expect(keyLine).toBeGreaterThan(nextLine);
    /* Nothing prints between the key and the exit. */
    expect(upload.slice(keyLine, exit)).not.toMatch(/console\.(log|error|info)\([\s\S]*console\.(log|error|info)\(/);
  });
});

/*
  #1509 — THE SAME FACT, ASKED ON THE ROAD THE RITE CANNOT SEE.

  The rite's check above is real, and a builder seat never meets it: a seat
  proving working law 6 on a pull request uploads a frame, pastes the link and
  never ships an edition. PR #1508's law-6 comment carried six links and all
  six answered Not Found, over frames that existed only in that machine's
  %TEMP%, under a body saying they had been looked at.

  Working law 2 — every arm here has its own reason asserted, so a refusal for
  some other cause cannot print PROVEN over this one. The `head` is injected,
  so none of this touches a network.
*/
describe("an uploaded frame is read back before its link can be pasted (#1509)", () => {
  const KEY = "crew-eye/11111111-2222-3333-4444-555555555555.png";
  const URL = `${BASE}/${KEY}`;
  const present = async () => 200;
  const notFound = async () => 404;
  const unanswerable = async () => null;

  it("POSITIVE CONTROL — a frame the bucket serves passes, and says so", async () => {
    const verdict = await judgeUploadedFrame(KEY, URL, BASE, present);
    expect(verdict.ok).toBe(true);
    expect(verdict.checked).toEqual(1);
    expect(verdict.missing).toEqual([]);
    expect(verdict.unread).toEqual([]);
  });

  it("THE INCIDENT — a key the bucket answers 404 for REFUSES, and names the key", async () => {
    const verdict = await judgeUploadedFrame(KEY, URL, BASE, notFound);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual([KEY]);
    expect(verdict.why).toContain("NOT in the production bucket");
  });

  it("an unanswerable bucket is UNREAD, not present — it fails closed (invariant 7)", async () => {
    const verdict = await judgeUploadedFrame(KEY, URL, BASE, unanswerable);
    expect(verdict.ok).toBe(false);
    expect(verdict.unread).toEqual([KEY]);
    expect(verdict.why).toContain("UNREAD");
  });

  it("no R2_PUBLIC_URL REFUSES rather than skipping — an unchecked link is the defect", async () => {
    for (const base of [undefined, null, ""]) {
      const verdict = await judgeUploadedFrame(KEY, URL, base, present);
      expect(verdict.ok, String(base)).toBe(false);
      expect(verdict.why).toContain("R2_PUBLIC_URL");
    }
  });

  it("ASSERTS AT THE WIRE — it refuses to read an address the upload did not return", async () => {
    /*
      Invariant 5. The caller pastes `storagePut`'s URL; a check against a URL
      this module rebuilt would prove a different string. The arm that matters
      is the ENCODING one: `buildPublicUrl` percent-encodes each segment, so a
      rebuild that skipped it would pass while the posted link 404s.
    */
    const verdict = await judgeUploadedFrame(KEY, `${BASE}/crew-eye/something-else.png`, BASE, present);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("is not the URL the upload returned");
    /* And it agrees with `buildPublicUrl` on a key needing encoding. */
    const spaced = "crew-eye/a b.png";
    expect((await judgeUploadedFrame(spaced, `${BASE}/crew-eye/a%20b.png`, BASE, present)).ok).toBe(true);
    expect((await judgeUploadedFrame(spaced, `${BASE}/crew-eye/a b.png`, BASE, present)).ok).toBe(false);
  });

  it("a trailing slash on the base is not a different bucket", async () => {
    expect((await judgeUploadedFrame(KEY, URL, `${BASE}/`, present)).ok).toBe(true);
  });
});

describe("the upload script refuses a frame it cannot read back (#1509)", () => {
  const upload = readFileSync(path.join(repoRoot, "scripts/crew-upload-eye-frame.mts"), "utf8");

  /*
    THE REFUSAL BLOCK, READ TO ITS CLOSING BRACE RATHER THAN TO A SUBSTRING.
    Two arms here were first written slicing to `indexOf("process.exit(1)")`,
    and both were wrong in different ways: the script's argument parser exits
    that way EIGHT times above this block, and the block's own docblock now
    QUOTES `process.exit(1)` when naming the rite's identical hazard. A slice
    that ends at a mention rather than at a statement reads as coverage.
  */
  const refusalBlock = (() => {
    const start = upload.indexOf("if (!landed.ok) {");
    expect(start, "the refusal block is still there to read").toBeGreaterThan(-1);
    const end = upload.indexOf("\n}", start);
    return upload.slice(start, end);
  })();

  it("THE VERDICT IS WHAT GATES THE OUTPUT — not merely that the judge was called", () => {
    /*
      ⚠ THIS ARM EXISTS BECAUSE THE SABOTAGE CAMPAIGN FOUND ITS ABSENCE.
      The arm below asserts the judge is CALLED with the right arguments, and a
      mutation that left the call in place while feeding the branch a literal
      `{ ok: true }` passed all 37 arms. A call whose answer nothing reads is
      the same shape as invariant 7's control that is never invoked — it looks
      exactly like coverage from the source.

      So: the value the refusal branches on must BE the awaited judge call.
    */
    expect(upload).toMatch(/const landed = await judgeUploadedFrame\(/);
    expect(upload).toContain("if (!landed.ok) {");
  });

  it("calls the judge after the put, on the key and URL the put returned", () => {
    expect(upload).toContain("judgeUploadedFrame(");
    const call = upload.slice(upload.indexOf("judgeUploadedFrame("));
    expect(call).toContain("result.key");
    expect(call).toContain("result.url");
    expect(call).toContain("process.env.R2_PUBLIC_URL");
    /* The put must happen first — a check before the write proves nothing. */
    expect(upload.indexOf("await storagePut(")).toBeLessThan(upload.indexOf("judgeUploadedFrame("));
  });

  it("a refusal EXITS NONZERO and prints nothing key-shaped on the way out", () => {
    /* The exit is the block's LAST statement, so nothing runs after the refusal. */
    expect(refusalBlock.trimEnd().endsWith("process.exit(1);")).toBe(true);
    /*
      #265 read the other way. Callers pipe this through `| tail -1`, and a
      shell pipeline reports the LAST command's status — so a refusal whose
      final line looked like a key would be harvested with the failure masked.
    */
    expect(refusalBlock).not.toMatch(/console\.log\(/);
    expect(refusalBlock).not.toMatch(/`key: /);
  });

  it("names the on-disk path on BOTH roads, so a link is always traceable to its driver run", () => {
    expect(refusalBlock).toContain("on disk:");
    const success = upload.slice(upload.indexOf("READ BACK FROM THE BUCKET"));
    expect(success).toContain("on disk:");
    expect(success).toContain("resolvePath(filePath)");
  });

  it("hands the judge a head that times out, for the reason the rite's does (#1177)", () => {
    const call = upload.slice(upload.indexOf("judgeUploadedFrame("));
    /* Anchored on the abort itself, not on `setTimeout`, because the refusal
       road below has a timer of its own and a looser match would read it. */
    const abort = call.match(/setTimeout\(\(\) => controller\.abort\(\), (\d[\d_]*)\)/);
    expect(abort).not.toBeNull();
    const ms = Number(abort![1]!.replaceAll("_", ""));
    expect(ms).toBeGreaterThanOrEqual(5_000);
    expect(ms).toBeLessThanOrEqual(30_000);
    /* And the timer is cleared, which is why an explicit controller is used at
       all rather than the rite's terser `AbortSignal.timeout`. */
    expect(call).toContain("clearTimeout(timer)");
  });

  it("the refusal DRAINS before it exits, or node aborts instead of refusing", () => {
    /*
      MEASURED, not feared. `process.exit` while the sockets the HEAD opened are
      still closing aborts node on Windows — `Assertion failed: !(handle->flags
      & UV_HANDLE_CLOSING)` — and the process reports 3221226505 rather than 1,
      which a caller cannot tell from a bug. Deterministic: 3 of 3 runs of the
      real script against a host answering anything but 200.

      The condition is NOT observable from JS: `getActiveResourcesInfo()` calls
      the socket gone after 5ms and the crash still fired at that point. So a
      duration is the only instrument available, and this arm exists because the
      await looks exactly like something worth tidying away.
    */
    const drain = refusalBlock.match(/setTimeout\(resolve, (\d[\d_]*)\)/);
    expect(drain, "the refusal road waits before it exits").not.toBeNull();
    const ms = Number(drain![1]!.replaceAll("_", ""));
    /* 50ms was the shortest measured clean; 250 is the shipped margin. Below
       the floor the crash returns, and it returns silently. */
    expect(ms).toBeGreaterThanOrEqual(50);
    /* On the FAILURE road only — the success road must not pay it. */
    const success = upload.slice(upload.indexOf("READ BACK FROM THE BUCKET"));
    expect(success).not.toMatch(/setTimeout\(resolve/);
  });

  it("STILL prints the key last — the read-back did not move it (#265)", () => {
    const keyLine = upload.indexOf("console.log(`key: ${result.key}`)");
    for (const line of ["READ BACK FROM THE BUCKET", "on disk: ${resolvePath(filePath)}", "url: ${result.url}"]) {
      expect(upload.indexOf(line), line).toBeGreaterThan(-1);
      expect(upload.indexOf(line), `${line} prints before the key`).toBeLessThan(keyLine);
    }
  });
});
