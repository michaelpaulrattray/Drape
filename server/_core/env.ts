import { parseSnapshotReadScope } from "../casting/snapshotReadScope";
import {
  EVIDENCE_INGEST_SCOPE_ENV,
  validateEvidenceIngestEnvironment,
} from "../casting/evidence/evidenceIngestScope";
import {
  EVIDENCE_PRODUCT_DELIVERY_READY,
  privateEvidenceAdapterConfigured,
} from "../casting/evidence/evidenceDeliveryRuntime";
import {
  EVIDENCE_CANDIDATE_WORKER_ENV,
  EVIDENCE_COMPOSER_RECIPE_ENV,
  EVIDENCE_COMPOSER_SCOPE_ENV,
  INK_ADD_PRODUCT_READY,
  validateEvidenceComposerEnvironment,
} from "../casting/evidence/evidenceComposerScope";
import { assertDiagnosticCaptureConfigured } from "../castingV2/diagnosticCapture";
import {
  EVIDENCE_PACKAGE_SCOPE_ENV,
  validateEvidencePackageEnvironment,
} from "../casting/evidence/evidencePackageScope";
import {
  SNAPSHOT_RESTORE_SCOPE_ENV,
  validateSnapshotRestoreEnvironment,
} from "../casting/snapshotRestoreScope";
import {
  CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
  CASTING_SEGMENTS_DELIVERED_SCOPE_ENV,
  CASTING_SEGMENTS_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  validateCastingReferenceLibraryEnvironment,
  validateCastingSegmentsDeliveredEnvironment,
  validateCastingSegmentsEnvironment,
  validateCastingV2Environment,
} from "../castingV2/castingV2Scope";

/**
 * Vars the server cannot run without. Each entry explains what breaks when
 * it is missing, because several of these fail silently at request time
 * rather than at boot (e.g. an empty VITE_APP_ID makes verifySession reject
 * every login with no error surfaced to the user).
 */
const REQUIRED_VARS: Record<string, string> = {
  DATABASE_URL: "all database access",
  JWT_SECRET: "session cookies cannot be signed or verified",
  VITE_APP_ID:
    "session JWTs are issued with an empty appId and verifySession silently rejects every login",
  GEMINI_API_KEY: "all image generation",
  STRIPE_SECRET_KEY: "billing",
  STRIPE_WEBHOOK_SECRET: "Stripe webhook signature verification",
  R2_ENDPOINT: "file storage (generated images, garments, avatars)",
  R2_BUCKET: "file storage (generated images, garments, avatars)",
  R2_PUBLIC_URL: "served image URLs cannot be built",
  R2_ACCESS_KEY_ID: "file storage uploads/deletes",
  R2_SECRET_ACCESS_KEY: "file storage uploads/deletes",
};

/** Optional vars that degrade a feature when absent — warn, don't exit. */
const OPTIONAL_VARS: Record<string, string> = {
  RESEND_API_KEY: "signup verification emails cannot be sent",
  GOOGLE_CLIENT_ID: "Google OAuth login is unavailable",
  GOOGLE_CLIENT_SECRET: "Google OAuth login is unavailable",
  VITE_STRIPE_PUBLISHABLE_KEY: "client-side Stripe checkout is unavailable",
};

/**
 * Fail loudly at boot if a required env var is missing.
 * Called from server/_core/index.ts before anything else starts.
 */
export function validateEnv(): void {
  const missing = Object.entries(REQUIRED_VARS).filter(
    ([key]) => !process.env[key]
  );

  if (missing.length > 0) {
    const details = missing
      .map(([key, consequence]) => `  - ${key}: ${consequence}`)
      .join("\n");
    throw new Error(
      `Missing required environment variable(s):\n${details}\n` +
        `Set them in .env at the repo root (see CLAUDE.md for the full list).`
    );
  }

  // R7-7B is off by default. A malformed rollout scope must stop startup
  // rather than partially or ambiguously enabling snapshot reads.
  parseSnapshotReadScope(process.env.R7_SNAPSHOT_READ_SCOPE);
  validateSnapshotRestoreEnvironment({
    restoreScope: process.env[SNAPSHOT_RESTORE_SCOPE_ENV],
    snapshotScope: process.env.R7_SNAPSHOT_READ_SCOPE,
  });
  validateEvidenceIngestEnvironment({
    scope: process.env[EVIDENCE_INGEST_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
    adapterConfigured: privateEvidenceAdapterConfigured(),
    productReady: EVIDENCE_PRODUCT_DELIVERY_READY,
  });
  validateEvidenceComposerEnvironment({
    scope: process.env[EVIDENCE_COMPOSER_SCOPE_ENV],
    recipe: process.env[EVIDENCE_COMPOSER_RECIPE_ENV],
    candidateWorker: process.env[EVIDENCE_CANDIDATE_WORKER_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
    snapshotScope: process.env.R7_SNAPSHOT_READ_SCOPE,
    ingestScope: process.env[EVIDENCE_INGEST_SCOPE_ENV],
    adapterConfigured: privateEvidenceAdapterConfigured(),
    productReady: EVIDENCE_PRODUCT_DELIVERY_READY && INK_ADD_PRODUCT_READY,
  });
  validateEvidencePackageEnvironment({
    scope: process.env[EVIDENCE_PACKAGE_SCOPE_ENV],
    composerScope: process.env[EVIDENCE_COMPOSER_SCOPE_ENV],
  });
  /*
    Casting diagnostics: its OWN flag, so turning on "keep the picture when a
    render is refused" never arms the R7 ingest guards above it — the ones that
    crash-looped production on 2026-07-31. Absent means off and asserts nothing.
  */
  assertDiagnosticCaptureConfigured(process.env);
  // Casting V2 is off by default and cannot be switched on without the three
  // things it silently depends on: a configured image transport (or every paid
  // roll fails at dispatch), the cleanup worker (or candidate objects outlive
  // the sheets that promised to purge them), and — since Sign (M7) — the
  // view-conformance validator, without which every signed package would fail
  // closed on all six views and refund itself.
  validateCastingV2Environment({
    scope: process.env[CASTING_V2_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
    transportConfigured: Boolean(process.env.FAL_KEY),
    validatorConfigured: Boolean(process.env.OPENROUTER_API_KEY),
  });
  /*
    Segment permanence: its own sub-flag, checked against the flag above it.

    Absent means off and asserts nothing — the 2026-07-31 posture. Set, it must
    name users the casting scope already covers and it must have the cleanup
    worker, because a segment writes objects the same transaction promises to
    purge.
  */
  validateCastingSegmentsEnvironment({
    scope: process.env[CASTING_SEGMENTS_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
  });
  /*
    And how those segments are CUT — the delivered-anchored silhouette change,
    one flag deeper again, checked against the segment scope for the same
    reason that one is checked against the casting scope: a switch that reaches
    past its parent is inert or wrong, and the two look the same from outside.
  */
  validateCastingSegmentsDeliveredEnvironment({
    scope: process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV],
    segmentsScope: process.env[CASTING_SEGMENTS_SCOPE_ENV],
  });
  /*
    The reference library (migration 0028): a new table on the paid path, so the
    ceremony lands it and the flag is flipped afterwards. Checked against the
    casting scope rather than the segment scope — the library is not built from
    the segment store and never reads it.
  */
  validateCastingReferenceLibraryEnvironment({
    scope: process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
  });

  for (const [key, consequence] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      console.warn(`[Env] ${key} is not set — ${consequence}`);
    }
  }
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Cloudflare R2 storage (S3-compatible)
  r2Endpoint: process.env.R2_ENDPOINT ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "",
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Stripe configuration
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
};
