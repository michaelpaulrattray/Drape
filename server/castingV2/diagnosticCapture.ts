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
 * ⚠ **AND FOR THIRTEEN MONTHS IT KEPT THE FRAME FOR UP TO SIXTY SECONDS —
 * #1492, read at the production rows rather than argued.** Seven frames
 * written, seven deleted, zero surviving, all time; its sibling under the same
 * flag, 112 items, all alive. The purge promise was kept and the DIAGNOSTIC was
 * not: a manifest born unheld is claimable the moment its operation leaves
 * `running`, and a refusal is exactly that moment. See
 * `DIAGNOSTIC_RETENTION_MS`. The bill below was never actually paid.
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
import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { createModuleLogger } from "../logging/logger";
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  parsePrivateEvidenceStorageConfig,
  type PrivateEvidenceStorageConfig,
} from "../casting/evidence/privateEvidenceStorage";

const log = createModuleLogger("castingV2/diagnosticCapture");

export const CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV = "CASTING_DIAGNOSTIC_CAPTURE_SCOPE";
const STORAGE_CLEANUP_WORKER_ENV = "ENABLE_STORAGE_CLEANUP_WORKER";

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
 * HOW LONG A KEPT FRAME IS KEPT — and until #1492 the answer was one minute.
 *
 * The reservation below was written to stop frames accumulating forever, and it
 * did that. What nobody asked afterwards is how long they last, and the answer
 * was read at the production rows before this constant existed:
 *
 * - **Zero frames under `casting-v2/diagnostics/` survive, all time.** Six
 *   batches from 2026-08-08 to 2026-08-13 carry `deletedCount` 2+1+1+1+1+1 —
 *   **seven frames written, seven deleted, none ever looked at.**
 * - Its sibling under the same flag and the same bucket, the refusal loop's
 *   words, has **112 items, every one still pending**.
 *
 * The difference is one argument. A manifest born without a hold is `pending`,
 * and the worker's only fence (`claimNextStorageCleanupBatch`) holds a batch
 * while its operation is `claimed` or `running` — which a refusal is precisely
 * the end of. The worker sweeps every 60 seconds, so the frame behind a refusal
 * outlived the refusal by up to one minute.
 *
 * So this is a RETENTION, and it is the window the sibling already chose for the
 * same class of artefact under the same founder approval: 30 days, on the
 * worker's own state machine, no new rule and no new sweeper. The hold IS the
 * retention — a held batch is unclaimable until it lapses, and then the worker
 * collects object and row together exactly as it does today.
 *
 * ⚠ **It is declared here rather than beside the words** because two 30-day
 * constants for one flag's retention policy is the second list working law 4 is
 * about: `REFUSAL_LOOP_RETENTION_MS` now derives from this.
 */
export const DIAGNOSTIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The instant a capture's manifest stops holding itself. */
export function diagnosticHeldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + DIAGNOSTIC_RETENTION_MS);
}

/**
 * Reserve this capture's keys for deletion. Injected so a test can drive the
 * failure.
 *
 * The founder's approval had a condition attached — *under the cleanup
 * worker's purge promise* — and until this existed the code did not keep it:
 * `captureRefusedRender` wrote objects and registered nothing, so the frames
 * would have accumulated forever. The boot guard could not catch it, because it
 * asks whether the worker is ENABLED and the worker was; it simply had no
 * instructions naming these keys. A control that checks the wrong thing and
 * passes is the quietest way to lose an invariant.
 *
 * ⚠ **IT TAKES EVERY KEY AT ONCE NOW, UNDER ONE HELD MANIFEST WITH A SYNTHETIC
 * OPERATION ID — #1492, and the shape is not invented here.** It is the one
 * `refusalLoopCapture` already uses, whose own comment names both reasons this
 * writer needed it:
 *
 * 1. **The hold.** Per-key reservation went through
 *    `reserveStorageCleanupItemForOperation`, which creates an unheld batch —
 *    see `DIAGNOSTIC_RETENTION_MS` above for what that cost.
 * 2. ⚠ **`storage_cleanup_batches.operationId` is UNIQUELY INDEXED, so a batch
 *    under the render's own operation id squats the one row that operation may
 *    ever have** — *"using the roll's id would collide with any manifest that
 *    operation ever needs for itself"*, and the refine road creates one for its
 *    landing two stages later. The frames' keys already carry the operation, so
 *    the column was never the thing that answered "whose refusal was this".
 *
 * The register-before-write guarantee is not weakened by batching the keys; it
 * is strengthened. One committed transaction now covers every key in the
 * capture, so there is no window in which frame two exists unregistered because
 * frame one's reservation was the only one that had committed.
 */
export type DiagnosticReserver = (input: {
  userId: number;
  storageKeys: readonly string[];
  heldUntil: Date;
}) => Promise<void>;

/**
 * The manifest one capture registers — composed here rather than inline in the
 * reserver, so the two decisions that carry the whole repair can be DRIVEN
 * rather than read: the operation id is synthetic, and the batch is born held.
 *
 * Neither is assertable through `defaultReserver`, which reaches a database no
 * unit test has; and a text guard over that function's source would prove only
 * that somebody typed the words.
 */
export function diagnosticManifestInput(input: {
  userId: number;
  storageKeys: readonly string[];
  heldUntil: Date;
}): {
  userId: number;
  operationId: string;
  heldUntil: Date;
  kind: "casting_diagnostic_cleanup";
  storageItems: Array<{ storageKey: string; storageBackend: "private_evidence_r2" }>;
} {
  return {
    userId: input.userId,
    /* Synthetic, for reason 2 above. The render's own operation is in every
       key, so nothing is lost by not putting it in the uniquely indexed
       column. */
    operationId: randomUUID(),
    heldUntil: input.heldUntil,
    kind: "casting_diagnostic_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "private_evidence_r2" as const,
    })),
  };
}

const defaultReserver: DiagnosticReserver = async (input) => {
  await withTransaction((tx) => createStorageCleanupManifestIn(
    tx,
    diagnosticManifestInput(input),
  ));
};

/**
 * The private bucket's writer. Exported for the refusal loop
 * (`refusalLoopCapture.ts`), which keeps a slice's sent words on this same
 * bucket and purge path and differs only in what the object is.
 */
export function privateEvidenceWriter(
  config: PrivateEvidenceStorageConfig,
  contentType = "image/png",
): DiagnosticWriter {
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
      ContentType: contentType,
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
  /** Injected by tests; production reserves a real held manifest. */
  reserve?: DiagnosticReserver;
  env?: NodeJS.ProcessEnv;
  now?: Date;
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
    writer = privateEvidenceWriter(config);
  }

  /* Sized first, so a frame this capture is never going to write does not
     appear in the reservation as a key the worker will hunt for and not find. */
  const sized = input.frames.filter((frame) => {
    if (frame.bytes.byteLength === 0 || frame.bytes.byteLength > MAX_DIAGNOSTIC_BYTES) {
      log.warn(
        { operationId: input.operationId, frame: frame.name, bytes: frame.bytes.byteLength },
        "[diagnosticCapture] frame outside the size bounds — skipped",
      );
      return false;
    }
    return true;
  });
  if (sized.length === 0) return { captured: false, keys: [], reason: "no frame within bounds" };

  const planned = sized.map((frame) => ({
    frame,
    key: diagnosticKey({
      userId: input.userId,
      operationId: input.operationId,
      name: frame.name,
    }),
  }));

  /*
    RESERVED BEFORE THEY ARE WRITTEN, and the order is the whole guarantee.

    Register-then-write means an object can never exist without something
    instructed to delete it: if the reservation fails, no bytes are put. The
    inverse ordering would leave a window — and a crash inside it — where a face
    sits in a bucket nobody will ever sweep.

    The other direction is harmless by design: a reservation whose object was
    never written is a key the worker tries to delete and finds absent, which
    every cleanup path already tolerates. Given a choice between an orphaned
    instruction and an orphaned face, this campaign takes the instruction.

    ⚠ **ALL OF THEM, IN ONE TRANSACTION** (#1492). Per-key reservation could not
    carry a hold — see `DiagnosticReserver` — and it also meant frame two could
    exist unregistered while only frame one's reservation had committed. One
    commit for the whole capture closes both.
  */
  try {
    await (input.reserve ?? defaultReserver)({
      userId: input.userId,
      storageKeys: planned.map((row) => row.key),
      heldUntil: diagnosticHeldUntil(input.now),
    });
  } catch (error) {
    /* Capture is a diagnostic, so it never breaks a render — but it does not
       get to keep the frames either. Inert is the correct failure. */
    log.warn(
      { err: error, operationId: input.operationId, frames: planned.map((row) => row.frame.name) },
      "[diagnosticCapture] could not reserve the frames for cleanup — NOT storing them",
    );
    return { captured: false, keys: [], reason: "not reserved" };
  }

  const keys: string[] = [];
  for (const { frame, key } of planned) {
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
