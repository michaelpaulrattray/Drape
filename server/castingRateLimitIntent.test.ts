/**
 * A HUMAN ACTION NEVER QUEUES BEHIND A POLLER.
 *
 * # The refusal this exists to make impossible
 *
 * 2026-08-10, production, user 1 — six 429s in one burst:
 *
 *     castingV2.selectVariant  mutation  "Too many requests. Please try again in 14 seconds."
 *     castingV2.getSession     query     … 11 / 12 / 8 / 4 / 1 seconds
 *
 * The founder was not rendering. He was reading a sheet from the previous day,
 * and his click to change which version of a face he was looking at was
 * refused — because the sheet's own background poll had already spent the
 * budget they shared. **The app refused him because it was busy talking to
 * itself.**
 *
 * One bucket (`castingPoll`, 60/min) held all eight casting procedures: two
 * pollers running at a fixed machine cadence, and six things a person does.
 * Nothing about the cap was wrong; the SHARING was. So the buckets are split
 * by intent — who is asking, not which module the procedure lives in — and
 * this file is the test that keeps them split.
 *
 * # Two tests, and neither can pass by accident
 *
 * The first DRIVES the limiter: it fills the polling bucket for real and then
 * asks the other two, which is the failure reproduced and then refused. Its
 * positive control is in the same test — the 61st poll must be refused, or the
 * bucket was never full and the rest of the assertion proves nothing (law 2:
 * verify the instrument before believing its finding).
 *
 * The second pins the MAPPING, because the defect was never in the limiter's
 * arithmetic — it was in which bucket a procedure was handed. A rule that
 * lives only in a reviewer's memory is the rule this program keeps rediscovering,
 * so the class ("no mutation may sit in the polling bucket") is asserted
 * mechanically alongside the instance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkRateLimit, RATE_LIMITS } from "./security/rateLimit";

const ROUTER = join(process.cwd(), "server", "routes", "castingV2.ts");

/** A user id per test, because the limiter's store is module-level and real. */
let nextUser = 900_000;
const freshUser = (): string => `user:${(nextUser += 1)}`;

describe("the casting rate-limit buckets are split by intent", () => {
  it("a FULL polling bucket does not refuse a click — the founder's own refusal, reproduced", () => {
    const identifier = freshUser();

    /* Fill the pollers' budget the way two tabs of a live roll would. */
    for (let request = 0; request < RATE_LIMITS.castingPoll.maxRequests; request += 1) {
      expect(checkRateLimit(identifier, RATE_LIMITS.castingPoll).allowed).toBe(true);
    }

    /*
      THE POSITIVE CONTROL, in the same test and before the finding.

      Without this line the assertions below pass on an EMPTY bucket and say
      nothing at all — a green test proving only that 60 requests is fewer than
      60. This is the instrument demonstrating it can fail.
    */
    expect(checkRateLimit(identifier, RATE_LIMITS.castingPoll).allowed).toBe(false);

    /* …and the two things a person does are untouched by it. */
    expect(checkRateLimit(identifier, RATE_LIMITS.castingSheet).allowed).toBe(true);
    expect(checkRateLimit(identifier, RATE_LIMITS.castingRead).allowed).toBe(true);
  });

  it("a full ACTION bucket does not refuse a read, and neither refuses the other", () => {
    const identifier = freshUser();
    for (let request = 0; request < RATE_LIMITS.castingSheet.maxRequests; request += 1) {
      expect(checkRateLimit(identifier, RATE_LIMITS.castingSheet).allowed).toBe(true);
    }
    expect(checkRateLimit(identifier, RATE_LIMITS.castingSheet).allowed).toBe(false);
    expect(checkRateLimit(identifier, RATE_LIMITS.castingRead).allowed).toBe(true);
    expect(checkRateLimit(identifier, RATE_LIMITS.castingPoll).allowed).toBe(true);
  });

  it("the three buckets are three keys — a shared prefix would silently re-merge them", () => {
    const prefixes = [
      RATE_LIMITS.castingPoll.keyPrefix,
      RATE_LIMITS.castingRead.keyPrefix,
      RATE_LIMITS.castingSheet.keyPrefix,
    ];
    expect(new Set(prefixes).size).toBe(3);
    /* An absent prefix falls back to the shared `rl:` bucket — the quietest
       possible way to undo this whole split. */
    for (const prefix of prefixes) expect(prefix).toBeTruthy();
  });
});

/** Every rate-limited casting procedure, as the router actually declares it. */
function declaredBuckets(): Array<{ name: string; kind: string; bucket: string }> {
  const source = readFileSync(ROUTER, "utf8");
  const declaration = /^ {2}([a-zA-Z][a-zA-Z0-9]*): (?:public|protected|onboarding)Procedure/gm;
  const found: Array<{ name: string; kind: string; bucket: string }> = [];
  const starts: Array<{ name: string; at: number }> = [];
  for (const match of source.matchAll(declaration)) {
    starts.push({ name: match[1], at: match.index ?? 0 });
  }
  for (let index = 0; index < starts.length; index += 1) {
    const body = source.slice(starts[index].at, starts[index + 1]?.at ?? source.length);
    const bucket = /enforceRateLimit\(ctx\.user\.id, RATE_LIMITS\.([a-zA-Z]+)\)/.exec(body);
    if (!bucket) continue;
    found.push({
      name: starts[index].name,
      kind: body.includes(".mutation(") ? "mutation" : "query",
      bucket: bucket[1],
    });
  }
  return found;
}

describe("which bucket each casting procedure was handed", () => {
  it("no MUTATION sits in the polling bucket — the class, not just selectVariant", () => {
    const offenders = declaredBuckets()
      .filter((procedure) => procedure.kind === "mutation" && procedure.bucket === "castingPoll")
      .map((procedure) => procedure.name);
    expect(offenders).toEqual([]);
  });

  it("only the two timer-driven queries are in the polling bucket", () => {
    const polling = declaredBuckets()
      .filter((procedure) => procedure.bucket === "castingPoll")
      .map((procedure) => procedure.name)
      .sort();
    /* `getSession` and `getRoll` are the only two the CLIENT asks on an
       interval. Anything else appearing here is a human action that has been
       put back behind them. */
    expect(polling).toEqual(["getRoll", "getSession"]);
  });

  it("the whole mapping is pinned, so a new procedure cannot pick a bucket unnoticed", () => {
    const table = Object.fromEntries(
      declaredBuckets().map((procedure) => [procedure.name, procedure.bucket]),
    );
    expect(table).toEqual({
      createSession: "modelCreate",
      openSessions: "castingRead",
      getSession: "castingPoll",
      createRoll: "generation",
      follow: "generation",
      getRoll: "castingPoll",
      keep: "castingSheet",
      discard: "castingSheet",
      undo: "castingSheet",
      abandonSession: "castingSheet",
      sign: "generation",
      refine: "generation",
      selectVariant: "castingSheet",
      variants: "castingRead",
      roster: "castingRead",
      renameCast: "castingSheet",
      deleteCast: "castingSheet",
      getCast: "castingRead",
      segmentsOnFace: "castingRead",
      /* Panel v2's read — a read, on the read bucket, like its v1 sibling. */
      facePanel: "castingRead",
      /* The auto-scan is a READ of a face, house-funded and idempotent per
         (candidate, version) — so it sits in the read bucket beside the panel
         it fills, not in a bucket that would let a refetch storm buy scans. */
      faceScan: "castingRead",
      cancel: "castingSheet",
    });
  });

  it("the parser found procedures at all — a mapping test that reads nothing passes forever", () => {
    expect(declaredBuckets().length).toBeGreaterThanOrEqual(20);
  });
});
