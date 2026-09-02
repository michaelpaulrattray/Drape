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
  CASTING_RETRY_SCOPE_ENV,
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
  CASTING_BRIEF_FIDELITY_SCOPE_ENV,
  CASTING_CREATIVE_REGISTER_SCOPE_ENV,
  validateCastingBriefFidelityEnvironment,
  validateCastingCreativeRegisterEnvironment,
  CASTING_CONCEPT_UPLOAD_SCOPE_ENV,
  validateCastingConceptUploadEnvironment,
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
  validateCastingRetryEnvironment,
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
 * EVERY NUMERIC ENVIRONMENT VARIABLE, WITH THE VALUE IT TAKES WHEN NOBODY SETS
 * IT — one declaration, read by the boot check and by each consumer.
 *
 * ⚠ THIS EXISTS BECAUSE `?? "default"` IN FRONT OF `parseInt` DOES NOT CATCH
 * THE EMPTY STRING, AND AN EMPTY STRING IS EXACTLY WHAT A RAILWAY VARIABLE
 * CREATED WITH NO VALUE HOLDS. `??` answers to `null` and `undefined` and
 * nothing else, so `parseInt("", 10)` is `NaN` and every comparison against it
 * is `false`. Four sites were written that way, and each turned that blank
 * variable into a SILENT OUTAGE:
 *
 *   DAILY_GENERATION_LIMIT   `used < NaN` is false, so the quota refused
 *                            EVERY generation at zero used, telling the
 *                            customer "Daily generation limit reached (NaN
 *                            per day)" — an outage wearing a quota message,
 *                            at six call sites
 *   GEMINI_IMAGE_CONCURRENCY a NaN concurrency admits nothing, so the queue
 *   GEMINI_TEXT_CONCURRENCY  holds every call forever
 *   GEMINI_MAX_QUEUE_DEPTH   a NaN depth makes the overflow test meaningless
 *
 * A blank variable is one careless click, and none of those four fails in a
 * way anyone could read. So the failure moves to BOOT, where the deploy rite's
 * health check catches it and the operator reads the variable's NAME instead
 * of the customer reading a lie.
 *
 * ⚠ THE FAL ALLOWANCES ARE DELIBERATELY NOT HERE. `ROLL_IMAGE_CONCURRENCY`,
 * `SIGN_VIEW_CONCURRENCY`, `REFINE_EDIT_CONCURRENCY`, `FAL_CONCURRENCY`,
 * `INK_PLATE_CONCURRENCY` and `FAL_ACCOUNT_CEILING` are governed by
 * `FAL_ALLOWANCES` and `assertFalBudget()`, which already refuses to boot
 * naming the offending variable — `Number("")` is 0 there, not NaN, and a path
 * with no slots is precisely what that check exists to refuse. Two owners for
 * one variable would be worse than the defect this table fixes.
 *
 * `PORT` is also not here and is also clear: it reads `|| "3000"`, which DOES
 * catch the empty string, and a non-numeric value makes `findAvailablePort`
 * throw `No available port found starting from NaN` before the server listens.
 */
export const NUMERIC_ENV_VARS = {
  DAILY_GENERATION_LIMIT: 50,
  GEMINI_IMAGE_CONCURRENCY: 5,
  GEMINI_TEXT_CONCURRENCY: 5,
  GEMINI_MAX_QUEUE_DEPTH: 50,
  ROLL_IMAGE_MAX_QUEUE_DEPTH: 64,
  SIGN_VIEW_MAX_QUEUE_DEPTH: 24,
} as const;

export type NumericEnvVar = keyof typeof NUMERIC_ENV_VARS;

/**
 * Read one numeric variable, or refuse by name.
 *
 * Unset and EMPTY both mean "nobody set it" and take the declared default —
 * the empty case stated first, because it is the one four sites got wrong.
 * Anything else must be a positive safe integer or this throws.
 *
 * Lifted 2026-08-25 from two byte-identical private copies in
 * `castingV2/rollEngine.ts` and `castingV2/signEngine.ts`, which had the shape
 * right and were the only two sites that did. Working law 4: the fallbacks
 * live in the table above rather than at each call, so a default cannot drift
 * from the boot check that validates it.
 */
export function envInt(name: NumericEnvVar): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return NUMERIC_ENV_VARS[name];
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive integer (got ${JSON.stringify(raw)}). ` +
        `Unset it to use the default of ${NUMERIC_ENV_VARS[name]}.`,
    );
  }
  return parsed;
}

/**
 * Read every numeric variable at boot so a bad one cannot wait for the module
 * that happens to consume it to be imported. Derived from the table — there is
 * no second list to fall behind it.
 */
export function assertNumericEnv(): void {
  for (const name of Object.keys(NUMERIC_ENV_VARS) as NumericEnvVar[]) envInt(name);
}

/**
 * Fail loudly at boot if a required env var is missing.
 * Called from server/_core/index.ts before anything else starts.
 */
export function validateEnv(): void {
  /*
   * FIRST, and deliberately before the missing-variable check: this validates
   * the SHAPE of values that ARE set, which is independent of whether anything
   * else is present. Two things follow, and the second is why it is here.
   *
   * A malformed number is refused even on a deployment that is also missing
   * something else, so the operator is not made to fix one problem to be shown
   * the next. And the guard becomes drivable by setting ONE variable —
   * `numericEnv.test.ts` proves the wire without touching any other, which
   * matters because `DATABASE_URL` is a required var and `vitest.setup.ts`
   * strips it ON PURPOSE so a unit test can never reach the live database. The
   * first version of that arm satisfied every missing variable by reading them
   * out of this function's own error message — elegant, derived, and it set
   * `DATABASE_URL`, reaching around the one safety mechanism in the suite that
   * exists to be unreachable. It perturbed a neighbouring suite, which is how
   * it was caught.
   */
  assertNumericEnv();

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
  // closed on all five views and refund itself in full.
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
    The Retry button (#122 shape 1). Parent is the CASTING scope alone: what a
    retry re-renders is a slice of a roll, so a user with no roll has nothing
    to retry, and nothing narrower is involved — the slice is painted by the
    roll road's own dispatcher.
  */
  validateCastingRetryEnvironment({
    scope: process.env[CASTING_RETRY_SCOPE_ENV],
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
    THE BRIEF FIDELITY BUILD, same parent and the same reason one step earlier
    in the road: it gates the COMPILE of a roll — the announced cap on
    `characterNotes`, the enforced bound on the reply, and the stated skin lane
    — so a user outside casting has no brief for it to read.
  */
  validateCastingBriefFidelityEnvironment({
    scope: process.env[CASTING_BRIEF_FIDELITY_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });

  /*
    THE CREATIVE REGISTER, same parent and the same reason as the two above: it
    gates the COMPILE of a roll — which register the eight slices are written
    in — so a user outside casting has no brief for it to route. Off, and absent
    means off, the compile is byte-identical to today's, which is the design's
    own §1a and the first thing its suite asserts.
  */
  validateCastingCreativeRegisterEnvironment({
    scope: process.env[CASTING_CREATIVE_REGISTER_SCOPE_ENV],
    castingScope: process.env[CASTING_V2_SCOPE_ENV],
  });

  /*
    UPLOAD A CONCEPT (#185), and its parent is the REGISTER rather than casting
    — the only sub-flag in this file whose parent is not `CASTING_V2_SCOPE`.
    What the description it produces must not contradict is the locked house
    block, and that block is appended by code on the author road alone, so a
    describer armed off that road would be writing against nothing.
  */
  validateCastingConceptUploadEnvironment({
    scope: process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV],
    registerScope: process.env[CASTING_CREATIVE_REGISTER_SCOPE_ENV],
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
