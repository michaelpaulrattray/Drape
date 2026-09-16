/**
 * The refusal loop's slice 1 (#129): a refused roll's sent words are kept,
 * privately, for 30 days, and nowhere a staff surface or a public bucket can
 * reach.
 *
 * Driven directly, never through a render: the reservation, the writer and the
 * scope are all injected, so every arm below can fail on its own.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  REFUSAL_LOOP_KEY_PREFIX,
  REFUSAL_LOOP_RETENTION_MS,
  captureRollWords,
  refusalLoopKey,
  slicesToKeep,
  type RollSliceWords,
} from "./refusalLoopCapture";
import { isAccountDiagnosticKey } from "../db/accountDeletion";
import { storageCleanupBatchIsHeld } from "../db/storageCleanup";

const IN_SCOPE: NodeJS.ProcessEnv = {
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE: "users:1",
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_EVIDENCE_BUCKET: "private-evidence",
  R2_EVIDENCE_ACCESS_KEY_ID: "private-key",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "private-secret",
  ENABLE_STORAGE_CLEANUP_WORKER: "true",
};

const NOW = new Date("2026-09-16T09:00:00.000Z");

const slice = (
  candidatePublicId: string,
  outcome: string,
  failureClass?: string,
): RollSliceWords => ({
  candidatePublicId,
  prompt: `the words sent for ${candidatePublicId}`,
  outcome,
  ...(failureClass ? { failureClass } : {}),
});

/** A roll with every kind of settlement, so each exclusion has something to exclude. */
const MIXED_ROLL: RollSliceWords[] = [
  slice("c-refused-1", "failed", "content_policy"),
  slice("c-ready-1", "ready"),
  slice("c-transport", "failed", "transport"),
  slice("c-cancelled", "skipped"),
  slice("c-expired", "expired"),
  slice("c-refused-2", "failed", "content_policy"),
];

function recorder() {
  const events: string[] = [];
  const reservations: { userId: number; storageKeys: readonly string[]; heldUntil: Date }[] = [];
  const writes: { key: string; body: Record<string, unknown> }[] = [];
  return {
    events,
    reservations,
    writes,
    reserve: async (input: { userId: number; storageKeys: readonly string[]; heldUntil: Date }) => {
      events.push("reserve");
      reservations.push(input);
    },
    writer: async ({ key, bytes }: { key: string; bytes: Buffer }) => {
      events.push(`write ${key}`);
      writes.push({ key, body: JSON.parse(bytes.toString("utf8")) });
    },
  };
}

describe("which slices are kept", () => {
  it("keeps nothing from a roll with no refusal — a transport failure is not one", () => {
    expect(slicesToKeep([slice("a", "ready"), slice("b", "failed", "transport")])).toEqual([]);
  });

  it("keeps a Retry's PASS on words refused before — and only then", () => {
    expect(slicesToKeep([slice("r", "ready")], true).map((entry) => entry.kept)).toEqual(["passed"]);
    expect(slicesToKeep([slice("r", "ready")], false)).toEqual([]);
    /* A retry that failed for another reason is still not a pass. */
    expect(slicesToKeep([slice("r", "failed", "transport")], true)).toEqual([]);
  });

  it("drops a slice with no words rather than keeping an empty sentence", () => {
    expect(slicesToKeep([{ ...slice("a", "failed", "content_policy"), prompt: "" }])).toEqual([]);
  });

  it("keeps each refused slice and each delivered one, and nothing else", () => {
    const kept = slicesToKeep(MIXED_ROLL).map((entry) => [entry.candidatePublicId, entry.kept]);
    expect(kept).toEqual([
      ["c-refused-1", "refused"],
      ["c-ready-1", "passed"],
      ["c-refused-2", "refused"],
    ]);
  });
});

describe("the capture", () => {
  it("does nothing out of scope — no reservation, no write", async () => {
    const r = recorder();
    const result = await captureRollWords({
      userId: 2, operationId: "op-1", rollPublicId: "roll-1", slices: MIXED_ROLL,
      reserve: r.reserve, writer: r.writer, env: IN_SCOPE, now: NOW,
    });
    expect(result).toMatchObject({ captured: 0, reason: "not in scope" });
    expect(r.events).toEqual([]);
  });

  it("does nothing on a roll with no refusal, even in scope", async () => {
    const r = recorder();
    const result = await captureRollWords({
      userId: 1, operationId: "op-1", rollPublicId: "roll-1",
      slices: [slice("a", "ready"), slice("b", "ready")],
      reserve: r.reserve, writer: r.writer, env: IN_SCOPE, now: NOW,
    });
    expect(result).toMatchObject({ captured: 0, reason: "no refusal" });
    expect(r.events).toEqual([]);
  });

  it("reserves every key under one 30-day hold BEFORE any word is written", async () => {
    const r = recorder();
    const result = await captureRollWords({
      userId: 1, operationId: "op-7", rollPublicId: "roll-7", slices: MIXED_ROLL,
      reserve: r.reserve, writer: r.writer, env: IN_SCOPE, now: NOW,
    });
    expect(result.captured).toBe(3);
    expect(r.events[0]).toBe("reserve");
    expect(r.events.filter((event) => event === "reserve")).toHaveLength(1);
    expect(r.reservations[0].userId).toBe(1);
    expect(r.reservations[0].heldUntil.getTime()).toBe(NOW.getTime() + REFUSAL_LOOP_RETENTION_MS);
    expect(REFUSAL_LOOP_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect([...r.reservations[0].storageKeys].sort()).toEqual([...result.keys].sort());
    expect(result.keys.sort()).toEqual([
      `${REFUSAL_LOOP_KEY_PREFIX}/1/op-7/c-ready-1.passed.json`,
      `${REFUSAL_LOOP_KEY_PREFIX}/1/op-7/c-refused-1.refused.json`,
      `${REFUSAL_LOOP_KEY_PREFIX}/1/op-7/c-refused-2.refused.json`,
    ]);
  });

  it("writes the exact words with their hash, length and class", async () => {
    const r = recorder();
    await captureRollWords({
      userId: 1, operationId: "op-7", rollPublicId: "roll-7", slices: MIXED_ROLL,
      reserve: r.reserve, writer: r.writer, env: IN_SCOPE, now: NOW,
    });
    const refused = r.writes.find((write) => write.key.endsWith("c-refused-1.refused.json"))!.body;
    const words = "the words sent for c-refused-1";
    expect(refused).toMatchObject({
      userId: 1,
      operationId: "op-7",
      rollPublicId: "roll-7",
      candidatePublicId: "c-refused-1",
      outcome: "refused",
      failureClass: "content_policy",
      prompt: words,
      promptLength: words.length,
      promptSha256: createHash("sha256").update(words, "utf8").digest("hex"),
      capturedAt: NOW.toISOString(),
    });
    const passed = r.writes.find((write) => write.key.endsWith("c-ready-1.passed.json"))!.body;
    expect(passed).toMatchObject({ outcome: "passed", failureClass: null });
  });

  it("writes nothing when the reservation fails — no object without its purge instruction", async () => {
    const r = recorder();
    const result = await captureRollWords({
      userId: 1, operationId: "op-7", rollPublicId: "roll-7", slices: MIXED_ROLL,
      reserve: async () => { throw new Error("database down"); },
      writer: r.writer, env: IN_SCOPE, now: NOW,
    });
    expect(result).toMatchObject({ captured: 0, reason: "unreserved" });
    expect(r.writes).toEqual([]);
  });

  it("never throws: a failing write drops that slice and keeps the rest", async () => {
    const r = recorder();
    const result = await captureRollWords({
      userId: 1, operationId: "op-7", rollPublicId: "roll-7", slices: MIXED_ROLL,
      reserve: r.reserve,
      writer: async (input) => {
        if (input.key.includes("c-ready-1")) throw new Error("bucket said no");
        return r.writer(input);
      },
      env: IN_SCOPE, now: NOW,
    });
    expect(result.captured).toBe(2);
  });

  it("refuses to run unconfigured rather than reaching for another bucket", async () => {
    const result = await captureRollWords({
      userId: 1, operationId: "op-7", rollPublicId: "roll-7", slices: MIXED_ROLL,
      reserve: async () => { throw new Error("must not be reached"); },
      env: { CASTING_DIAGNOSTIC_CAPTURE_SCOPE: "users:1" }, now: NOW,
    });
    expect(result).toMatchObject({ captured: 0, reason: "unconfigured" });
  });
});

describe("account deletion finds these keys", () => {
  it("claims this account's refusal-loop and diagnostic keys, and no one else's", () => {
    const key = refusalLoopKey({ userId: 1, operationId: "op", candidatePublicId: "c", outcome: "refused" });
    expect(isAccountDiagnosticKey(1, key)).toBe(true);
    expect(isAccountDiagnosticKey(1, "casting-v2/diagnostics/1/op/painted.png")).toBe(true);
    /* The prefix trap: user 1 must not claim user 12's words. */
    expect(isAccountDiagnosticKey(1, key.replace("/1/", "/12/"))).toBe(false);
    expect(isAccountDiagnosticKey(12, key)).toBe(false);
    expect(isAccountDiagnosticKey(1, "casting-v2/candidates/1/op/c.png")).toBe(false);
  });
});

describe("a 30-day hold is not a cleanup backlog", () => {
  const held = {
    status: "processing",
    leaseToken: null,
    attemptedAt: null,
    leaseExpiresAt: new Date(NOW.getTime() + REFUSAL_LOOP_RETENTION_MS),
  };

  it("reads a born-held, unclaimed, unlapsed batch as held", () => {
    expect(storageCleanupBatchIsHeld(held, NOW)).toBe(true);
  });

  it("stops reading it as held the moment the hold lapses, or anything has claimed it", () => {
    const after = new Date(held.leaseExpiresAt.getTime() + 1);
    expect(storageCleanupBatchIsHeld(held, after)).toBe(false);
    expect(storageCleanupBatchIsHeld({ ...held, leaseToken: "worker" }, NOW)).toBe(false);
    expect(storageCleanupBatchIsHeld({ ...held, attemptedAt: NOW }, NOW)).toBe(false);
    expect(storageCleanupBatchIsHeld({ ...held, status: "pending" }, NOW)).toBe(false);
  });
});

describe("where the capture is wired", () => {
  const roll = fs.readFileSync(path.join(__dirname, "rollService.ts"), "utf8");

  it("runs before BOTH early returns — all refused, and a partly abandoned dispatch", () => {
    const capture = roll.indexOf("dependencies.captureWords ?? captureRollWords");
    const abandoned = roll.indexOf("if (abandoned.length > 0) {");
    const allRefused = roll.indexOf("if (ready === 0) {");
    expect(capture, "the roll calls the capture").toBeGreaterThan(0);
    expect(abandoned, "the abandoned-dispatch return still exists").toBeGreaterThan(0);
    expect(allRefused, "the all-refused return still exists").toBeGreaterThan(0);
    expect(capture).toBeLessThan(abandoned);
    expect(capture).toBeLessThan(allRefused);
  });

  it("is called on the Retry road too, after the settlement and before its branches", () => {
    const retry = fs.readFileSync(path.join(__dirname, "retryService.ts"), "utf8");
    const settled = retry.indexOf("const settlement = value as Settlement;");
    const capture = retry.indexOf("dependencies.captureWords ?? captureRollWords");
    const readyBranch = retry.indexOf('if (settlement.outcome === "ready") {');
    expect(settled).toBeGreaterThan(0);
    expect(readyBranch).toBeGreaterThan(0);
    expect(capture).toBeGreaterThan(settled);
    expect(capture).toBeLessThan(readyBranch);
    expect(retry).toContain("refusedBefore: priorFailureClass === REFUSAL_FAILURE_CLASS");
  });

  it("hands over the prompt that was dispatched, not the brief", () => {
    const dispatched = "prompt: promptByPosition.get(candidate.position) ?? \"\"";
    expect(roll.split(dispatched).length - 1, "the dispatch and the capture read one map").toBe(2);
  });
});
