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
import { assertFalBudget } from "../castingV2/falBudget";
import {
  EVIDENCE_PACKAGE_SCOPE_ENV,
  validateEvidencePackageEnvironment,
} from "../casting/evidence/evidencePackageScope";
import {
  SNAPSHOT_RESTORE_SCOPE_ENV,
  validateSnapshotRestoreEnvironment,
} from "../casting/snapshotRestoreScope";
import {
  CASTING_FACE_SCAN_SCOPE_ENV,
  CASTING_INK_CUT_SCOPE_ENV,
  CASTING_INK_TRANSFORM_SCOPE_ENV,
  CASTING_INK_REGION_CROP_SCOPE_ENV,
  CASTING_INK_STUDIO_SCOPE_ENV,
  CASTING_OPEN_LANE_SCOPE_ENV,
  CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
  CASTING_REFINE_DISPATCH_SCOPE_ENV,
  CASTING_REPAINT_SCOPE_ENV,
  CASTING_SIDE_PHRASING_SCOPE_ENV,
  CASTING_SEGMENTS_DELIVERED_SCOPE_ENV,
  CASTING_SEGMENTS_SCOPE_ENV,
  CASTING_SCAN_TABLE_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  validateCastingFaceScanEnvironment,
  validateCastingInkCutEnvironment,
  validateCastingInkTransformEnvironment,
  validateCastingInkWordsEnvironment,
  CASTING_INK_WORDS_SCOPE_ENV,
  validateCastingBornInkEnvironment,
  CASTING_BORN_INK_SCOPE_ENV,
  CASTING_TWO_PATHS_SCOPE_ENV,
  validateCastingTwoPathsEnvironment,
  CASTING_FRAMING_TRIM_SCOPE_ENV,
  validateCastingFramingTrimEnvironment,
  validateCastingInkRegionCropEnvironment,
  validateCastingInkStudioEnvironment,
  validateCastingHairReferenceEnvironment,
  validateCastingReferenceAttachEnvironment,
  CASTING_HAIR_REFERENCE_SCOPE_ENV,
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
  validateCastingInkReferenceEnvironment,
  CASTING_INK_REFERENCE_SCOPE_ENV,
  validateCastingOpenLaneEnvironment,
  validateCastingReferenceLibraryEnvironment,
  validateCastingRefineDispatchEnvironment,
  validateCastingRepaintEnvironment,
  validateCastingSidePhrasingEnvironment,
  validateCastingScanTableEnvironment,
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
  /*
    The compositor swap (D-241): checked against the LIBRARY scope rather than
    the casting scope, and the difference matters. A repaint pastes nothing —
    a feature survives the next render because the library holds a crop of it
    and the recipe carries that crop. Armed without a library, the same switch
    would quietly turn every paid refine into one that forgets her features.
  */
  validateCastingRepaintEnvironment({
    scope: process.env[CASTING_REPAINT_SCOPE_ENV],
    libraryScope: process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
  });
  /*
    Saying which side twice — her anatomy and the half of the picture it is on.
    Checked against the REPAINT scope because the clause is written by the
    repaint recipe and nothing else says it.
  */
  validateCastingSidePhrasingEnvironment({
    scope: process.env[CASTING_SIDE_PHRASING_SCOPE_ENV],
    repaintScope: process.env[CASTING_REPAINT_SCOPE_ENV],
  });
  /*
    The auto-scan: reading a face nobody has edited so the panel is not a
    column of empty slots. Checked against the LIBRARY scope because the panel
    is its only consumer — a scan whose answer nothing renders is a paid read
    into the dark, and inert looks the same as mistaken from outside.
  */
  validateCastingFaceScanEnvironment({
    scope: process.env[CASTING_FACE_SCAN_SCOPE_ENV],
    libraryScope: process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
  });
  /*
    And whether a finished scan is KEPT (migration 0032). Checked against the
    scan scope — a user who produces no scans has nothing to write down — and
    against the cleanup worker, because a kept scan owns one stencil object per
    feature and a persisted artifact class without a running purge is exactly
    what the founder's storage condition forbids.
  */
  validateCastingScanTableEnvironment({
    scope: process.env[CASTING_SCAN_TABLE_SCOPE_ENV],
    scanScope: process.env[CASTING_FACE_SCAN_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
  });
  /*
    Whether an ask nobody catalogued may name its own kind. Checked against the
    REPAINT scope rather than the casting scope, and the difference is the
    finding that bought this flag: the paste road composes its prompt from
    wall (d)'s re-read, which drops `open` by construction, so a paste-road user
    would be charged for a render whose prompt never said what they asked for.
  */
  validateCastingOpenLaneEnvironment({
    scope: process.env[CASTING_OPEN_LANE_SCOPE_ENV],
    repaintScope: process.env[CASTING_REPAINT_SCOPE_ENV],
  });
  /*
    The ink studio's door. Checked against the REPAINT scope for the open lane's
    reason one step further on: a design reaches a photograph as a cropped
    reference carried by the repaint recipe, and the paste road carries none —
    so an upload armed there could never appear on her. And against the cleanup
    worker, because an uploaded design is bytes we keep under the candidate's
    purge path.
  */
  validateCastingInkStudioEnvironment({
    scope: process.env[CASTING_INK_STUDIO_SCOPE_ENV],
    repaintScope: process.env[CASTING_REPAINT_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
  });
  /*
    THE ATTACH DOOR — its own flag rather than the studio's, because the studio's
    is already `users:1` in production and landing this behind it would open a
    new store on a live account on the deploy that shipped it. What that store
    keeps is a full photograph of whoever is in the picture, so it earns its own
    switch. Same two parents as the studio, and for the same two reasons: the
    repaint recipe is what carries a cropped reference into a render, and the
    cleanup worker is what eventually deletes the bytes.
  */
  validateCastingReferenceAttachEnvironment({
    scope: process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV],
    repaintScope: process.env[CASTING_REPAINT_SCOPE_ENV],
    cleanupWorker: process.env.ENABLE_STORAGE_CLEANUP_WORKER,
  });
  /*
    Whether the paid half of a refine stops holding the request. Checked against
    the CASTING scope rather than the repaint one, and that is the road question
    answered: the swap changes WHEN the answer arrives and never what is
    painted, so a paste-road customer is a legitimate subject — what it cannot
    be armed over is a user with no refine to dispatch.
  */
  validateCastingRefineDispatchEnvironment({
    scope: process.env[CASTING_REFINE_DISPATCH_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });
  /*
    TAKING HER HAIR FROM AN ATTACHED PICTURE. Its parent is the ATTACH door and
    nothing else: the handle a hair take travels with is minted there, so armed
    without it a customer would be asked a question about a reference she has no
    way to supply. The repaint and cleanup-worker parents ride in through the
    attach flag's own check rather than being restated here.
  */
  validateCastingHairReferenceEnvironment({
    scope: process.env[CASTING_HAIR_REFERENCE_SCOPE_ENV],
    attachScope: process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV],
  });
  /*
    A TATTOO DOCUMENTED BY HER OWN PICTURE. The same parent for the same reason,
    plus one of its own: this arm changes the INK DOCUMENT GATE, and that gate
    fires on a LIVE road today (`CASTING_V2_SCOPE` is `all`). Without a flag, the
    first customer to attach a picture and say "tattoo" would meet behaviour
    nobody flipped a switch for.
  */
  validateCastingInkReferenceEnvironment({
    scope: process.env[CASTING_INK_REFERENCE_SCOPE_ENV],
    attachScope: process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV],
  });
  /*
    WHETHER AN UPLOADED DESIGN IS CUT BEFORE IT IS STORED. Its parent is the
    STUDIO door and nothing else: the cut happens inside that door, so a user
    who cannot upload has nothing to cut. The transport it needs is guaranteed
    by the chain rather than re-checked here — `CASTING_V2_SCOPE` at the top of
    this function already refuses to boot without FAL_KEY, and a second check of
    one fact is the mirror that drifts (the reasoning is in the flag's docblock,
    and the fact itself is an arm of the boot rehearsal).
  */
  validateCastingInkCutEnvironment({
    scope: process.env[CASTING_INK_CUT_SCOPE_ENV],
    studioScope: process.env[CASTING_INK_STUDIO_SCOPE_ENV],
  });
  /*
    WHETHER THE CUT IS THE SURFACE RATHER THAN THE PATCH INSIDE IT. Its parent is
    the CUT door and nothing else: the region road is reached only after the
    routing has decided to cut, so a user whose uploads are stored whole has no
    road to escalate. Every other parent rides in through that flag's own check.
  */
  validateCastingInkRegionCropEnvironment({
    scope: process.env[CASTING_INK_REGION_CROP_SCOPE_ENV],
    cutScope: process.env[CASTING_INK_CUT_SCOPE_ENV],
  });
  /*
    WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS. Its parent is the STUDIO
    door and nothing else: a transform's whole content is a picture of a tattoo
    this product already delivered, so a user outside that door has no subject
    for it. Every other parent rides in through the studio flag's own check.
  */
  validateCastingInkTransformEnvironment({
    scope: process.env[CASTING_INK_TRANSFORM_SCOPE_ENV],
    studioScope: process.env[CASTING_INK_STUDIO_SCOPE_ENV],
  });
  /*
    WHETHER A WORDS-BORN TATTOO MAY LAND BEYOND HER NECK. Its parent is
    `CASTING_V2_SCOPE` and nothing narrower: this road needs no design row and
    no uploaded picture — crop #1 is a delivery with `designId` NULL — so
    hanging it off the studio door would gate a lane whose subject does not
    require it.
  */
  validateCastingInkWordsEnvironment({
    scope: process.env[CASTING_INK_WORDS_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });
  /*
    WHETHER A CAST MAY BE BORN WITH TATTOOS THE PRODUCT KNOWS ABOUT. Its parent
    is `CASTING_V2_SCOPE` and nothing narrower for the same reason the words
    road's is: the BRIEF is the document, so this lane needs no studio door, no
    design row and no repaint. What it does need is a roll — the row is minted
    when a candidate lands — and that is exactly what the casting scope gates.
  */
  validateCastingBornInkEnvironment({
    scope: process.env[CASTING_BORN_INK_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });
  /*
    WHETHER A CUSTOMER CHOOSES HOW HER CAST IS BORN. Its parent is
    `CASTING_V2_SCOPE` and — alone among this road's sub-flags — NOT the repaint
    scope: every other one gates something a refine does, while this gates THE
    ROLL, which is already spendable surface at `all`. Hanging it off the
    repaint scope would refuse the path to accounts that can already buy the
    thing being pathed.
  */
  validateCastingTwoPathsEnvironment({
    scope: process.env[CASTING_TWO_PATHS_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });

  /*
    THE FRAMING TRIM, on the same reasoning as the two paths above: it gates THE
    ROLL — the render size, the framing sentence, and a trim on the delivered
    bytes — so its parent is the casting scope and nothing narrower. A user
    outside casting has no roll to trim.
  */
  validateCastingFramingTrimEnvironment({
    scope: process.env[CASTING_FRAMING_TRIM_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });

  /*
    THE ACCOUNT'S CONCURRENCY, SHARED OUT AND PROVED TO FIT (fable-511).

    Four paths spend one twenty-request allowance — rolls, sign views, refine
    edits and the region reader — and until this check nothing enforced the
    arithmetic. What that cost is on the record: the founder's fresh casts came
    back missing eyes, brows and ears because the reads over the line were
    refused, and a refused courtesy read shows up as a feature the customer is
    told she does not have.
  */
  const budget = assertFalBudget();
  console.info(`[Env] fal concurrency budget: ${budget.line}`);

  for (const [key, consequence] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      console.warn(`[Env] ${key} is not set — ${consequence}`);
    }
  }
}

/**
 * WHICH WORLD THIS PROCESS IS — derived, never configured (L6).
 *
 * Development and production share ONE Stripe account (the secret keys are
 * byte-identical) and that account has exactly ONE registered webhook
 * endpoint, pointing at production. So every checkout completed on a
 * developer laptop is delivered to production, verifies against production's
 * own secret, and is fulfilled against the production database. The tag is
 * what lets the receiving process tell those apart; it is stamped into the
 * metadata of every Stripe object we create and re-proved on the way in.
 *
 * Read fresh from the environment rather than frozen into ENV, so a test can
 * drive both worlds in one process.
 *
 * `RAILWAY_ENVIRONMENT_NAME` is injected by the platform and cannot be set by
 * accident on a laptop. Absent, this reads `local` — which REFUSES production
 * events rather than mis-processing them, the safe direction to fail.
 */
export function deploymentTag(): string {
  const railway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT;
  if (railway) return `railway:${railway}`;
  if (process.env.NODE_ENV === "production") return "node:production";
  return "local";
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
