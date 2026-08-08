/**
 * KEEP THE PICTURE WHEN THE RENDER IS REFUSED.
 *
 * # The bill this pays
 *
 * Run-6 produced two renders nobody can diagnose. "Give her freckles" was
 * delivered torn, and "remove her glasses" was refused twice and refunded
 * correctly — and for both, the frame the painter actually returned and the
 * mask we cut it with are gone. Production stores the composite on SUCCESS and
 * nothing at all on failure, so a refusal is a receipt with no evidence behind
 * it: we cannot tell whether the glasses were really still there, whether our
 * own composite put them back, or whether the reader was simply wrong.
 *
 * Each of those costs a fresh paid render to reproduce, and some do not
 * reproduce at all — the painter is stochastic, and the torn-frame repro in
 * `scripts/calibration/torn-frame.mts` reproduced the MECHANISM and not the
 * severity.
 *
 * Founder-approved 2026-08-08, narrowly: **user 1 only, refused and faulted
 * renders only, the PRIVATE evidence bucket, under the cleanup worker's
 * existing purge promise.**
 *
 * # Its own flag, deliberately
 *
 * `R7_EVIDENCE_INGEST_SCOPE` already exists and governs a different feature
 * with its own boot guards — the ones that crash-looped production on
 * 2026-07-31. Turning on casting diagnostics must not arm those, and one flag
 * meaning two things is how that happens. So this is its own scope, parsed by
 * the SAME parser as every other spendable-surface flag: `off` / `all` /
 * `users:<ids>`. A second scope grammar would be a mirror (law 4).
 *
 * # Its own key space, sharing the bucket
 *
 * The private evidence ADAPTER is R7-shaped: its keys are
 * `users/<id>/models/<id>/…` and its canonical mime is WebP. Diagnostics are
 * neither — there is no model, and a lossy re-encode of the frame under
 * investigation would destroy the very boundary this evidence exists to show.
 * So this shares the bucket, the credentials and the cleanup routing, and owns
 * its own keys and its own validation. Sharing infrastructure is reuse;
 * pretending a diagnostic is an R7 evidence plate would be a mirror.
 *
 * # It can never break a render
 *
 * Every path returns rather than throws. This runs at the moment a user is
 * already being refused and refunded; a capture failure that turned that into
 * a different error would make the diagnostics worse than useless. Failures are
 * logged and dropped.
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { createModuleLogger } from "../logging/logger";
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import { reserveStorageCleanupItemForOperation } from "../db/storageCleanup";
import {
  parsePrivateEvidenceStorageConfig,
  type PrivateEvidenceStorageConfig,
} from "../casting/evidence/privateEvidenceStorage";

const log = createModuleLogger("castingV2/diagnosticCapture");

export const CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV = "CASTING_DIAGNOSTIC_CAPTURE_SCOPE";
export const STORAGE_CLEANUP_WORKER_ENV = "ENABLE_STORAGE_CLEANUP_WORKER";

/** Keys live under this prefix and nowhere else. */
export const DIAGNOSTIC_KEY_PREFIX = "casting-v2/diagnostics";

/**
 * Per-frame cap. A 1024x1536 PNG is ~3MB; this leaves room without letting a
 * runaway frame fill a bucket nobody is watching.
 */
export const MAX_DIAGNOSTIC_BYTES = 12 * 1024 * 1024;

export class DiagnosticCaptureConfigurationError extends Error {
  constructor(reason: string) {
    super(
      `${CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV} cannot be enabled unless ${reason}`,
    );
    this.name = "DiagnosticCaptureConfigurationError";
  }
}

export type DiagnosticFrame = {
  /** `painted`, `composite`, `applied` — becomes the key's last segment. */
  name: string;
  bytes: Buffer;
};

export type CapturedDiagnostic = {
  captured: boolean;
  keys: string[];
  reason?: string;
};

/**
 * Is capture live for this user? Off means off for everyone.
 *
 * Same shape as `maskedEditingEnabledFor`, deliberately: an unattributed render
 * never opts in.
 */
export function diagnosticCaptureEnabledFor(
  userId: number | undefined,
  raw = process.env[CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV],
): boolean {
  const scope = parseCastingV2Scope(raw);
  if (scope.kind === "off") return false;
  if (scope.kind === "all") return true;
  return userId !== undefined && castingV2EnabledForUser(scope, userId);
}

/**
 * THE BOOT GUARD, and it refuses rather than degrading.
 *
 * A capture scope that is on while the bucket is unconfigured would write
 * nothing and say nothing — the invoked-but-inert class, which is what
 * invariant 7 exists for. And a scope that is on while the cleanup worker is
 * off would accumulate frames of a person's face that nothing ever purges,
 * which is the half the founder's approval actually turns on.
 *
 * Called at startup so a misconfiguration is a boot failure rather than a
 * silent gap — with the 2026-07-31 crash-loop firmly in mind, which is why the
 * default (absent, `off`) asserts nothing at all.
 */
export function assertDiagnosticCaptureConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const scope = parseCastingV2Scope(env[CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV]);
  if (scope.kind === "off") return;
  if (env[STORAGE_CLEANUP_WORKER_ENV] !== "true") {
    throw new DiagnosticCaptureConfigurationError(
      `${STORAGE_CLEANUP_WORKER_ENV} is exactly "true" — captured frames must be purgeable`,
    );
  }
  const config = parsePrivateEvidenceStorageConfig(env);
  if (!config) {
    throw new DiagnosticCaptureConfigurationError(
      "the private evidence bucket and its dedicated credentials are configured "
      + "— diagnostics never go to the public bucket",
    );
  }
}

/** The key for one frame. Owner-scoped so a listing is answerable per user. */
export function diagnosticKey(input: {
  userId: number;
  operationId: string;
  name: string;
}): string {
  return `${DIAGNOSTIC_KEY_PREFIX}/${input.userId}/${input.operationId}/${input.name}.png`;
}

export type DiagnosticWriter = (input: {
  key: string;
  bytes: Buffer;
}) => Promise<void>;

/**
 * Reserve one key for deletion. Injected so a test can drive the failure.
 *
 * The founder's approval had a condition attached — *under the cleanup
 * worker's purge promise* — and until this existed the code did not keep it:
 * `captureRefusedRender` wrote objects and registered nothing, so the frames
 * would have accumulated forever. The boot guard could not catch it, because it
 * asks whether the worker is ENABLED and the worker was; it simply had no
 * instructions naming these keys. A control that checks the wrong thing and
 * passes is the quietest way to lose an invariant.
 */
export type DiagnosticReserver = (input: {
  userId: number;
  operationId: string;
  storageKey: string;
}) => Promise<string>;

const defaultReserver: DiagnosticReserver = async (input) =>
  reserveStorageCleanupItemForOperation({
    userId: input.userId,
    operationId: input.operationId,
    kind: "casting_diagnostic_cleanup",
    storageKey: input.storageKey,
    storageBackend: "private_evidence_r2",
  });

function s3Writer(config: PrivateEvidenceStorageConfig): DiagnosticWriter {
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return async ({ key, bytes }) => {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: "image/png",
      ContentLength: bytes.byteLength,
    }));
  };
}

/**
 * Write the frames behind a refusal, if capture is live for this user.
 *
 * Returns what happened rather than throwing, because the caller is already in
 * a failure path and the user is already being refunded. `captured: false` with
 * a reason is the normal, uninteresting outcome on every account but one.
 */
export async function captureRefusedRender(input: {
  userId: number;
  operationId: string;
  /** `composite_fault`, `facts_missing`, … — for the log line only. */
  reason: string;
  frames: ReadonlyArray<DiagnosticFrame>;
  /** Injected by tests; production builds one from the private bucket config. */
  writer?: DiagnosticWriter;
  /** Injected by tests; production reserves a real cleanup item. */
  reserve?: DiagnosticReserver;
  env?: NodeJS.ProcessEnv;
}): Promise<CapturedDiagnostic> {
  const env = input.env ?? process.env;
  if (!diagnosticCaptureEnabledFor(input.userId, env[CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV])) {
    return { captured: false, keys: [], reason: "not in scope" };
  }

  let writer = input.writer;
  if (!writer) {
    const config = parsePrivateEvidenceStorageConfig(env);
    if (!config) {
      /* The boot guard should have stopped this, so it is worth a loud line
         rather than a quiet return — a guard that can be reached past is a
         guard that is not there. */
      log.error(
        { operationId: input.operationId },
        "[diagnosticCapture] in scope with no private bucket — the boot guard was bypassed",
      );
      return { captured: false, keys: [], reason: "unconfigured" };
    }
    writer = s3Writer(config);
  }

  const keys: string[] = [];
  for (const frame of input.frames) {
    if (frame.bytes.byteLength === 0 || frame.bytes.byteLength > MAX_DIAGNOSTIC_BYTES) {
      log.warn(
        { operationId: input.operationId, frame: frame.name, bytes: frame.bytes.byteLength },
        "[diagnosticCapture] frame outside the size bounds — skipped",
      );
      continue;
    }
    const key = diagnosticKey({
      userId: input.userId,
      operationId: input.operationId,
      name: frame.name,
    });
    /*
      RESERVED BEFORE IT IS WRITTEN, and the order is the whole guarantee.

      Register-then-write means an object can never exist without something
      instructed to delete it: if the reservation fails, the bytes are never
      put. The inverse ordering would leave a window — and a crash inside it —
      where a face sits in a bucket nobody will ever sweep.

      The other direction is harmless by design: a reservation whose object was
      never written is a key the worker tries to delete and finds absent, which
      every cleanup path already tolerates. Given a choice between an orphaned
      instruction and an orphaned face, this campaign takes the instruction.
    */
    try {
      await (input.reserve ?? defaultReserver)({
        userId: input.userId,
        operationId: input.operationId,
        storageKey: key,
      });
    } catch (error) {
      /* Capture is a diagnostic, so it never breaks a render — but it does not
         get to keep the frame either. Inert is the correct failure. */
      log.warn(
        { err: error, operationId: input.operationId, frame: frame.name },
        "[diagnosticCapture] could not reserve the frame for cleanup — NOT storing it",
      );
      continue;
    }
    try {
      await writer({ key, bytes: frame.bytes });
      keys.push(key);
    } catch (error) {
      /* Never break a render. The user is already being refunded; a capture
         failure that became a different error would make the diagnostics worse
         than useless. */
      log.warn(
        { err: error, operationId: input.operationId, frame: frame.name },
        "[diagnosticCapture] could not store the frame — dropping it",
      );
    }
  }

  if (keys.length > 0) {
    log.info(
      { operationId: input.operationId, reason: input.reason, keys },
      "[diagnosticCapture] kept the frames behind a refusal",
    );
  }
  return { captured: keys.length > 0, keys };
}
