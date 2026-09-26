/**
 * THE GUARD THAT PUTS THE GUARD BACK ON THE ROAD (#1330).
 *
 * `eyeFramePresence.mts` was already driven — `server/eyeFramePresence.test.ts`
 * covers every arm of the judge. What no suite could see is the thing that
 * actually broke: it had **one caller, the deploy rite**, and editions stopped
 * taking the rite at #1249. So the arms that matter most here are not about
 * judging presence at all. They are:
 *
 *   1. THE CALL SITE EXISTS — `gate.yml` runs the checker, in the required job,
 *      passing the diff. Invariant 7 is the whole subject of this card, and a
 *      fix for a guard with no caller that does not itself guard the caller is
 *      the same defect wearing a repair's clothes.
 *   2. THE BUCKET CANNOT SILENTLY BECOME THE DEV ONE — the negative control is
 *      derived from `shared/const.ts`'s own dev base rather than pasted, so the
 *      arm still means something after either value moves.
 *   3. AN UNREADABLE DIFF CHECKS RATHER THAN SKIPS — the one direction in which
 *      this fix could re-create the silence it repairs.
 *
 * Every read here is of a FIXED path and uses a bare `readFileSync` on purpose:
 * nothing is walked, and a missing subject must THROW rather than let an arm
 * pass over a file it could not open.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  cspImgSrcTokens,
  eyeFrameGateShouldRun,
  judgeBucketBaseAgainstCsp,
  PRODUCTION_ORIGIN,
  PRODUCTION_PUBLIC_BUCKET_BASE,
} from "../scripts/lib/eyeFrameGate.mts";
import { BRIEFING_PATH } from "../scripts/lib/quietEdition.mts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), "utf8");

/*
  PRODUCTION'S OWN ANSWER, read at the service 2026-09-26 with `curl -I` and
  pasted verbatim. It is a FIXTURE and not a live read: a unit suite that fetched
  production would be red on somebody's aeroplane wifi, and the live read is the
  gate step's job, which is exactly where it belongs.
*/
const REAL_PRODUCTION_CSP =
  "default-src 'self'; script-src 'self' https://js.stripe.com; "
  + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
  + "img-src 'self' data: blob: https://pub-990e39d8d995468eb61aced83162123a.r2.dev https://*.amazonaws.com "
  + "https://images.unsplash.com https://files.manuscdn.com https://*.cloudfront.net; "
  + "media-src 'self' blob: https://*.amazonaws.com; connect-src 'self' https://api.stripe.com; "
  + "frame-src 'self' https://js.stripe.com https://hooks.stripe.com; object-src 'none'";

describe("cspImgSrcTokens", () => {
  it("POSITIVE — reads the bucket out of production's real header", () => {
    const tokens = cspImgSrcTokens(REAL_PRODUCTION_CSP);
    expect(tokens).not.toBeNull();
    expect(tokens).toContain(PRODUCTION_PUBLIC_BUCKET_BASE);
    /* And it stops at the directive: a token from `media-src` must not leak in. */
    expect(tokens).not.toContain("media-src");
    expect(tokens!.every((token) => !token.includes(";"))).toBe(true);
  });

  it("answers null — not an empty list — when there is no img-src to read", () => {
    /* The two are different facts and the caller treats them differently: null
       means "this was not the response we think we are reading". */
    expect(cspImgSrcTokens("default-src 'self'; object-src 'none'")).toBeNull();
    expect(cspImgSrcTokens("")).toBeNull();
    expect(cspImgSrcTokens("   ")).toBeNull();
    expect(cspImgSrcTokens(null)).toBeNull();
    expect(cspImgSrcTokens(undefined)).toBeNull();
  });

  it("reads a directive name however it is cased, and however it is spaced", () => {
    expect(cspImgSrcTokens("IMG-SRC 'self' https://a.example")).toEqual(["'self'", "https://a.example"]);
    expect(cspImgSrcTokens("default-src 'self';   img-src    'self'   https://a.example  "))
      .toEqual(["'self'", "https://a.example"]);
  });

  it("a directive that allows nothing is an empty list, which is an answer", () => {
    expect(cspImgSrcTokens("img-src")).toEqual([]);
  });
});

describe("judgeBucketBaseAgainstCsp", () => {
  it("POSITIVE — production naming the bucket is a pass, and says which bucket", () => {
    const verdict = judgeBucketBaseAgainstCsp(PRODUCTION_PUBLIC_BUCKET_BASE, REAL_PRODUCTION_CSP);
    expect(verdict.ok).toBe(true);
    expect(verdict.why).toContain(PRODUCTION_PUBLIC_BUCKET_BASE);
  });

  it("⚠ THE DEFECT ITSELF — a header naming only the DEV bucket REFUSES", () => {
    /*
      The whole of #320: a frame uploaded from a local shell lands in the dev
      bucket, and every call site succeeds identically. A check that read the dev
      bucket would find the frame and PASS the broken case. The dev base is read
      out of `shared/const.ts` rather than pasted, so this arm cannot rot into
      comparing one stale string with another.
    */
    const devBase = /DEV_ASSETS_BASE_URL\s*=\s*'([^']+)'/.exec(read("shared/const.ts"))?.[1];
    expect(devBase, "shared/const.ts no longer declares DEV_ASSETS_BASE_URL — re-aim this arm").toBeTruthy();
    const devOrigin = new URL(devBase!).origin;
    expect(devOrigin, "the dev bucket must not BE the production one, or this arm proves nothing")
      .not.toBe(PRODUCTION_PUBLIC_BUCKET_BASE);

    const verdict = judgeBucketBaseAgainstCsp(
      PRODUCTION_PUBLIC_BUCKET_BASE,
      `default-src 'self'; img-src 'self' data: blob: ${devOrigin}`,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain(PRODUCTION_PUBLIC_BUCKET_BASE);
    expect(verdict.why, "the refusal names what production DID say, so it can be acted on")
      .toContain(devOrigin);
  });

  it("an unread header REFUSES, and says it will not fall back to .env", () => {
    /* A failed fetch hands in null. Unread is not a pass — the same rule the
       judge applies to a key it could not ask about (invariant 7). */
    const verdict = judgeBucketBaseAgainstCsp(PRODUCTION_PUBLIC_BUCKET_BASE, null);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain(PRODUCTION_ORIGIN);
    expect(verdict.why).toMatch(/\.env/);
  });

  it("⚠ takes NO value from the environment — an R2_PUBLIC_URL in scope changes nothing", () => {
    /*
      The bar this card sets in its own words: *the check must never fall back to
      the ambient .env*. On a shift's machine that variable is set and it names
      DEV, so the arm sets it and proves the judgement is unmoved.
    */
    const before = process.env.R2_PUBLIC_URL;
    try {
      process.env.R2_PUBLIC_URL = "https://pub-0000000000000000000000000000000a.r2.dev";
      const stale = judgeBucketBaseAgainstCsp(
        PRODUCTION_PUBLIC_BUCKET_BASE,
        `img-src 'self' ${process.env.R2_PUBLIC_URL}`,
      );
      expect(stale.ok, "the env value is not the production bucket, so this must still refuse").toBe(false);
      expect(judgeBucketBaseAgainstCsp(PRODUCTION_PUBLIC_BUCKET_BASE, REAL_PRODUCTION_CSP).ok).toBe(true);
    } finally {
      if (before === undefined) delete process.env.R2_PUBLIC_URL;
      else process.env.R2_PUBLIC_URL = before;
    }
  });

  it("a trailing slash on either side is the same bucket", () => {
    expect(judgeBucketBaseAgainstCsp(`${PRODUCTION_PUBLIC_BUCKET_BASE}/`, REAL_PRODUCTION_CSP).ok).toBe(true);
    expect(judgeBucketBaseAgainstCsp(
      PRODUCTION_PUBLIC_BUCKET_BASE,
      `img-src 'self' ${PRODUCTION_PUBLIC_BUCKET_BASE}/`,
    ).ok).toBe(true);
  });

  it("a bucket that merely CONTAINS the name is not the bucket", () => {
    /* Substring matching is how an allowlist becomes a suggestion. */
    const verdict = judgeBucketBaseAgainstCsp(
      PRODUCTION_PUBLIC_BUCKET_BASE,
      `img-src 'self' ${PRODUCTION_PUBLIC_BUCKET_BASE}.evil.example`,
    );
    expect(verdict.ok).toBe(false);
  });
});

describe("eyeFrameGateShouldRun", () => {
  it("runs when the briefing is in the diff, and names the file", () => {
    const decision = eyeFrameGateShouldRun(["client/src/App.tsx", BRIEFING_PATH]);
    expect(decision.run).toBe(true);
    expect(decision.why).toContain(BRIEFING_PATH);
  });

  it("skips a diff that does not touch the briefing", () => {
    const decision = eyeFrameGateShouldRun(["server/routers.ts", "docs/architecture/annotations.yaml"]);
    expect(decision.run).toBe(false);
  });

  it("⚠ AN UNREADABLE DIFF CHECKS — the one direction that would rebuild the silence", () => {
    /*
      `null` is not "nothing changed". A failed `git diff` read as a skip would be
      this card's own defect one layer up: a guard on the road that quietly is
      not asked. Checking costs seconds; skipping costs him a broken card.
    */
    expect(eyeFrameGateShouldRun(null).run).toBe(true);
    expect(eyeFrameGateShouldRun(null).why).toMatch(/could not be read/);
  });

  it("an empty diff is a real answer and skips", () => {
    expect(eyeFrameGateShouldRun([]).run).toBe(false);
  });

  it("reads a Windows-shaped path as the same file", () => {
    expect(eyeFrameGateShouldRun([BRIEFING_PATH.replace(/\//g, "\\")]).run).toBe(true);
  });

  it("the path it filters on has a real subject in the tree", () => {
    /* The filter is DERIVED from `quietEdition.mts` rather than spelled again,
       so a briefing that moves takes the filter with it. This arm is the other
       half: the derived value must still name a file that exists. */
    expect(() => read(BRIEFING_PATH)).not.toThrow();
  });
});

describe("⚠ THE CALL SITE — a guard with no caller does not exist (invariant 7)", () => {
  const gate = read(".github/workflows/gate.yml");

  it("the gate runs the checker, passing the diff it should read", () => {
    expect(gate).toContain("scripts/check-eye-frames.mts");
    expect(gate, "without --base-ref it would check every PR, including ones that cannot fix it")
      .toMatch(/check-eye-frames\.mts --base-ref/);
  });

  it("it runs inside gate-checks — the job the merge tool actually reads", () => {
    /*
      `scripts/pr-merge-in-order.mts` stops on a red `gate-checks`,
      `static-shapes` and `bundle-budget` by name. A step in a job nothing reads
      is a red check nobody is stopped by, which for this card would be the same
      death in a new place.
    */
    const startOfGateChecks = gate.indexOf("\n  gate-checks:");
    const startOfNextJob = gate.indexOf("\n  founder-gate:");
    const step = gate.indexOf("scripts/check-eye-frames.mts");
    expect(startOfGateChecks).toBeGreaterThan(-1);
    expect(startOfNextJob).toBeGreaterThan(startOfGateChecks);
    expect(step).toBeGreaterThan(startOfGateChecks);
    expect(step).toBeLessThan(startOfNextJob);
  });

  it("the checker calls the JUDGE, not a second copy of it", () => {
    /*
      The failure this forbids is working law 4: a gate-side reimplementation of
      presence, free to drift from the judge the rite calls and from the suite
      that drives it. One judge, two callers.
    */
    const checker = read("scripts/check-eye-frames.mts");
    expect(checker).toContain('from "./lib/eyeFramePresence.mts"');
    expect(checker).toContain("judgeEyeFramePresence(");
    expect(checker).toContain("eyeFrameKeysOf(");
  });

  it("the rite is still a caller too — this adds a road, it does not move one", () => {
    /* Both roads exist: the rite still pushes `main` for a doc-only ride, and
       that push is not a pull request. Removing its call would swap one silence
       for another. */
    const rite = read("scripts/deploy-rite.mts");
    expect(rite).toContain('from "./lib/eyeFramePresence.mts"');
    expect(rite).toContain("judgeEyeFramePresence(");
  });
});
