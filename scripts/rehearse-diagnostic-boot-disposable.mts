/**
 * Rehearse the diagnostic-capture boot guards against production's exact shape.
 *
 * 2026-07-31 is why this exists: an evidence scope flag crash-looped
 * production. The rule since is that a scope is never flipped until its guards
 * have been driven locally with the same variable shape the founder is about to
 * paste — including the failure cases, because a guard that cannot refuse is
 * not a guard.
 */
import {
  assertDiagnosticCaptureConfigured,
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV,
} from "../server/castingV2/diagnosticCapture.js";

/* Production's real shape, verified by NAME on 2026-08-08 (never by value). */
const PRODUCTION = {
  ENABLE_STORAGE_CLEANUP_WORKER: "true",
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_EVIDENCE_BUCKET: "bucket",
  R2_EVIDENCE_ACCESS_KEY_ID: "key",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "secret",
} as NodeJS.ProcessEnv;

const run = (label: string, env: NodeJS.ProcessEnv): boolean => {
  try {
    assertDiagnosticCaptureConfigured(env);
    console.log(`BOOTS    ${label}`);
    return true;
  } catch (error) {
    console.log(`REFUSES  ${label}\n           ${(error as Error).message}`);
    return false;
  }
};

const results = {
  absentBoots: run("absent — today's production", { ...PRODUCTION }),
  offBoots: run("off", { ...PRODUCTION, [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "off" }),
  askBoots: run("users:1, fully configured — THE ASK", {
    ...PRODUCTION,
    [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
  }),
  workerOffRefuses: !run("users:1 with the cleanup worker OFF", {
    ...PRODUCTION,
    ENABLE_STORAGE_CLEANUP_WORKER: "false",
    [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
  }),
  noBucketRefuses: !run("users:1 with no private bucket", {
    ...PRODUCTION,
    R2_EVIDENCE_BUCKET: undefined,
    [CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]: "users:1",
  }),
};

const failures = Object.entries(results).filter(([, ok]) => !ok).map(([name]) => name);
console.log("");
if (failures.length > 0) {
  console.error(`REHEARSAL FAILED: ${failures.join(", ")}. Do not hand the founder anything.`);
  process.exit(1);
}
console.log("Rehearsal clean: it boots on the ask, and refuses both ways it must.");
