/**
 * Server-owned Casting V2 rollout scope.
 *
 * The flag ships in M4 rather than M5 (plan §K, amended 2026-07-31) because
 * M4's procedures are the first V2 surface that can *spend a customer's
 * credits*. Shipping spendable surface unflagged and promising to flag it a
 * milestone later is how dark code stops being dark.
 *
 * Mirrors `evidenceIngestScope.ts` deliberately: same grammar (`off` / `all` /
 * `users:<ids>`), same boot-validation posture (a malformed value stops
 * startup rather than ambiguously half-enabling a paid path), same shape of
 * fail-closed dependency checks. The client never supplies or influences this
 * value — it observes only the resulting boolean capability.
 */
export const CASTING_V2_SCOPE_ENV = "CASTING_V2_SCOPE";

export type CastingV2Scope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export class CastingV2ScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingV2ScopeConfigurationError";
  }
}

/**
 * A roll writes objects to storage that §G.6 promises will be purged. Without
 * the cleanup worker running, nothing ever deletes them — the promise silently
 * becomes false. Refusing to enable is the honest posture (invariant 7: a
 * control that is not invoked does not exist).
 */
export class CastingV2CleanupWorkerConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingV2CleanupWorkerConfigurationError";
  }
}

/**
 * The image transport must be configured before a paid roll is reachable.
 * Otherwise the user is charged and every candidate fails on a missing
 * credential — a full refund at best, and a support ticket regardless.
 */
export class CastingV2TransportConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless the casting image transport (FAL_KEY) is configured`,
    );
    this.name = "CastingV2TransportConfigurationError";
  }
}

/**
 * The Sign package cannot land a view without a second opinion.
 *
 * §I's fail-closed law: where no trustworthy verifier exists, the request
 * refuses BEFORE the spend. Without the judge transport, every Sign would
 * charge the promotion plus five views, fail all five conformance checks, and
 * refund the WHOLE 450 — a Cast with an empty package, every single time, and
 * the money technically correct throughout. Refusing to enable is the only
 * honest posture (invariant 7).
 *
 * ⚠ **THIS PARAGRAPH SAID "six views" AND "refund three hundred credits back",
 * AND ALL THREE NUMBERS IN IT WERE WRONG — corrected 2026-08-25 (opus-1272,
 * ruled fable-1654 §2).** The package is FIVE views (`CAST_PACKAGE_VIEWS`, and
 * `CASTING_V2_SIGN_PRICE_CREDITS` derives 450 = 200 + 5 × 50 from its length),
 * so the charge was never 500 and the checks were never six. The third is the
 * one that mattered: **a zero-of-N Sign does not keep the 200.** The founder
 * ruled on 2026-08-02 that the promotion goes back too — *"nobody came here to
 * buy the preservation of a face they had already paid for on the sheet"* — and
 * `packageOrchestrator` has refunded it ever since, logging *"TOTAL LOSS — not
 * one view landed; the whole Sign refunded, base included"*. So this docblock
 * described a product that keeps 200 credits of a customer's money during our
 * own outage, which is the thing the confession law forbids and the exact
 * behaviour that ruling removed. **A comment cannot be run, so nothing went
 * red for six months.**
 */
export class CastingV2ValidatorConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_V2_SCOPE_ENV} cannot be enabled unless the view-conformance validator (OPENROUTER_API_KEY) is configured`,
    );
    this.name = "CastingV2ValidatorConfigurationError";
  }
}

/**
 * The grammar, written once.
 *
 * Every rollout flag in this program shares it, and a second copy of a parser
 * is a second thing to keep in step — the one that falls behind accepts a value
 * the other rejects, on a switch that governs spending. The caller supplies its
 * own error so the message still names the variable the operator actually set.
 */
function parseScopeGrammar(raw: string | undefined, fail: () => never): CastingV2Scope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) fail();
  const members = raw.slice("users:".length).split(",");
  if (members.length === 0 || members.some((member) => !/^[1-9]\d*$/.test(member))) fail();
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    fail();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function parseCastingV2Scope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingV2ScopeConfigurationError();
  });
}

export function castingV2EnabledForUser(scope: CastingV2Scope, userId: number): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Casting V2 scope requires a positive integer user id");
  }
  return scope.kind === "all" || (scope.kind === "users" && scope.userIds.includes(userId));
}

/**
 * Read the live scope for one user.
 *
 * Evaluated per request rather than cached at boot so a scope change takes
 * effect on redeploy without a code path that could hold a stale `all`.
 */
export function captureCastingV2Enabled(userId: number): boolean {
  return castingV2EnabledForUser(parseCastingV2Scope(process.env[CASTING_V2_SCOPE_ENV]), userId);
}

/* ------------------------------------------------- the segment sub-flag */

/**
 * Segment permanence — its OWN switch, and the reason is not tidiness.
 *
 * `CASTING_V2_SCOPE` is already open in production — it read *"for the
 * founder's own dogfooding"* until 2026-08-24 and the position is `all`, so the
 * argument below holds for everyone rather than for one account, which is more
 * of the reason and not less. A store that shipped under that flag alone would
 * begin writing
 * segment rows into a database whose table does not exist yet the moment it
 * deployed, and would do it on the paid path. The sub-flag is what makes
 * "dark from the first commit" true rather than aspirational: absent means off,
 * off means no row is ever written and no composite ever reads one.
 *
 * It is also the ordering device for the production migration. The table lands
 * by ceremony; the flag is flipped afterwards. Neither step alone changes
 * behaviour, so neither step alone can break a live roll.
 */
export const CASTING_SEGMENTS_SCOPE_ENV = "CASTING_SEGMENTS_SCOPE";

export class CastingSegmentsScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_SEGMENTS_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingSegmentsScopeConfigurationError";
  }
}

/**
 * A segment belongs to a candidate, and only Casting V2 makes candidates. A
 * segment scope wider than the casting scope is either inert or a mistake, and
 * the two are indistinguishable from the outside — so it refuses instead of
 * quietly doing nothing (invariant 7).
 */
export class CastingSegmentsCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_SEGMENTS_SCOPE_ENV} ${detail}`);
    this.name = "CastingSegmentsCoverageError";
  }
}

/**
 * Segments write mask and crop objects to the public bucket. Without the
 * cleanup worker nothing ever deletes them, so the retention promise this
 * store makes in the same transaction as its writes would be false at the far
 * end. The same posture the roll flag takes, for the same reason.
 */
export class CastingSegmentsCleanupWorkerError extends Error {
  constructor() {
    super(
      `${CASTING_SEGMENTS_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingSegmentsCleanupWorkerError";
  }
}

export function parseCastingSegmentsScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingSegmentsScopeConfigurationError();
  });
}

/**
 * Whether this user's faces keep their segments.
 *
 * Deliberately an AND of both flags rather than a read of the sub-flag alone.
 * The boot check already refuses a segment scope that reaches past the casting
 * scope, and this is the same rule enforced a second time at the point of use —
 * the two ways a flag pair goes wrong are a bad value and a boot check that was
 * never invoked, and this closes the second.
 */
export function captureCastingSegmentsEnabled(userId: number): boolean {
  const segments = parseCastingSegmentsScope(process.env[CASTING_SEGMENTS_SCOPE_ENV]);
  if (!castingV2EnabledForUser(segments, userId)) return false;
  return captureCastingV2Enabled(userId);
}

/**
 * Whether the store is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one. Purging is deliberately NOT per-user:
 * the sweep must collect segments for every user who has any, including one
 * removed from the scope list after their rows were written. The narrower read
 * belongs on the write path; a retention path that narrows is how objects
 * outlive the sheet that promised to purge them.
 */
export function castingSegmentsArmed(): boolean {
  return parseCastingSegmentsScope(process.env[CASTING_SEGMENTS_SCOPE_ENV]).kind !== "off";
}

export function validateCastingSegmentsEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const segments = parseCastingSegmentsScope(input.scope);
  if (segments.kind === "off") return segments;

  if (input.cleanupWorker !== "true") throw new CastingSegmentsCleanupWorkerError();

  const casting = parseCastingV2Scope(input.castingScope);
  if (casting.kind === "off") {
    throw new CastingSegmentsCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — segments belong to candidates, and nothing can create one`,
    );
  }
  if (casting.kind === "all") return segments;
  if (segments.kind === "all") {
    throw new CastingSegmentsCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = segments.userIds.filter((userId) => !casting.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingSegmentsCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return segments;
}

/* ------------------------------------ the delivered-anchored sub-sub-flag */

/**
 * DELIVERED-ANCHORED SEGMENTS — the silhouette change, on its own switch.
 *
 * `CASTING_SEGMENTS_SCOPE` is already open for the founder, so a segment cut
 * differently under that flag alone would change what his very next paid render
 * keeps, on the day it deployed. This change is small in code and large in
 * consequence: it moves a segment's territory from *where the thing used to be*
 * to *where the thing now is*, which manufactures a boundary class no seam
 * instrument in this product has ever been calibrated against
 * (`CASTING_V2_DELIVERED_ANCHORED_SEGMENTS_DESIGN.md`, "The seam implication").
 *
 * The design's own prerequisite is that the coherence statistic be recorded
 * first. It IS recorded, on every render, beside amplitude — and the table held
 * **zero verdicts** on 2026-08-10 because nobody had rendered since. So the
 * mechanism is there and the specimens are not, and that is precisely a reason
 * for a switch rather than a reason to argue about a date.
 *
 * Absent means off. Off means `cutSegments` is handed no delivered map and
 * behaves byte-for-byte as it did before this existed.
 */
export const CASTING_SEGMENTS_DELIVERED_SCOPE_ENV = "CASTING_SEGMENTS_DELIVERED_SCOPE";

export class CastingSegmentsDeliveredScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_SEGMENTS_DELIVERED_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingSegmentsDeliveredScopeConfigurationError";
  }
}

/**
 * A delivered-anchored cut is a way of cutting a segment, so it is inert for a
 * user whose faces keep no segments at all. Inert and mistaken look identical
 * from outside, so it refuses rather than quietly doing nothing (invariant 7) —
 * the same rule the segment scope takes against the casting scope.
 */
export class CastingSegmentsDeliveredCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_SEGMENTS_DELIVERED_SCOPE_ENV} ${detail}`);
    this.name = "CastingSegmentsDeliveredCoverageError";
  }
}

export function parseCastingSegmentsDeliveredScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingSegmentsDeliveredScopeConfigurationError();
  });
}

/**
 * Whether this user's segments are cut from the DELIVERED thing's own extent.
 *
 * An AND of the whole chain, for `captureCastingSegmentsEnabled`'s reason: the
 * boot check already refuses a scope that reaches past its parent, and this is
 * the same rule enforced again where it is used, because a boot check that was
 * never invoked is the second way a flag pair goes wrong.
 */
export function deliveredAnchoredSegmentsEnabled(userId: number): boolean {
  const delivered = parseCastingSegmentsDeliveredScope(
    process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV],
  );
  if (!castingV2EnabledForUser(delivered, userId)) return false;
  return captureCastingSegmentsEnabled(userId);
}

export function validateCastingSegmentsDeliveredEnvironment(input: {
  scope: string | undefined;
  segmentsScope: string | undefined;
}): CastingV2Scope {
  const delivered = parseCastingSegmentsDeliveredScope(input.scope);
  if (delivered.kind === "off") return delivered;

  const segments = parseCastingSegmentsScope(input.segmentsScope);
  if (segments.kind === "off") {
    throw new CastingSegmentsDeliveredCoverageError(
      `cannot be enabled while ${CASTING_SEGMENTS_SCOPE_ENV} is off — there is no segment to cut differently`,
    );
  }
  if (segments.kind === "all") return delivered;
  if (delivered.kind === "all") {
    throw new CastingSegmentsDeliveredCoverageError(
      `cannot be "all" while ${CASTING_SEGMENTS_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = delivered.userIds.filter((userId) => !segments.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingSegmentsDeliveredCoverageError(
      `names users outside ${CASTING_SEGMENTS_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return delivered;
}

/* ---------------------------------------- the reference-library sub-flag */

/**
 * THE REFERENCE LIBRARY — its own switch, off everywhere until the ceremony,
 * and `all` in production since (the ceremony ran and the flag rode with the
 * repaint road, which carries features by crop and cannot work without it).
 *
 * The library is a NEW TABLE (migration 0028) on the same paid path
 * `CASTING_V2_SCOPE` already opens — for EVERY account (`all`); this said *"for
 * the founder"* until 2026-08-24, and this flag has since been widened to `all`
 * itself. A writer shipping under
 * that flag alone would INSERT into a table production does not have yet, on a
 * render somebody paid for. So the table lands by ceremony and the flag is
 * flipped afterwards; neither step alone changes behaviour, and neither alone
 * can break a live roll.
 *
 * It is deliberately NOT a child of `CASTING_SEGMENTS_SCOPE`. The library is
 * not built from the segment store and never reads it — the store seeds nothing
 * (fable-173/196), and the two answer different questions about a face. Its
 * parent is the casting scope, because its rows hang off a candidate.
 */
export const CASTING_REFERENCE_LIBRARY_SCOPE_ENV = "CASTING_REFERENCE_LIBRARY_SCOPE";

export class CastingReferenceLibraryScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingReferenceLibraryScopeConfigurationError";
  }
}

/**
 * A library row hangs off a candidate, and only Casting V2 makes candidates. A
 * library scope wider than the casting scope is either inert or a mistake, and
 * from outside those look identical — so it refuses (invariant 7).
 */
export class CastingReferenceLibraryCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} ${detail}`);
    this.name = "CastingReferenceLibraryCoverageError";
  }
}

/**
 * The library writes crops of a person's face to the public bucket. Without the
 * cleanup worker nothing ever deletes them, so the retention promise the write
 * transaction makes would be false at the far end — the same posture the
 * segment store takes, for the same reason.
 */
export class CastingReferenceLibraryCleanupWorkerError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingReferenceLibraryCleanupWorkerError";
  }
}

export function parseCastingReferenceLibraryScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingReferenceLibraryScopeConfigurationError();
  });
}

/** Whether this user's faces build a reference library. An AND of both flags,
 *  for `captureCastingSegmentsEnabled`'s reason: a boot check that was never
 *  invoked is the second way a flag pair goes wrong. */
export function captureCastingReferenceLibraryEnabled(userId: number): boolean {
  const library = parseCastingReferenceLibraryScope(
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
  );
  if (!castingV2EnabledForUser(library, userId)) return false;
  return captureCastingV2Enabled(userId);
}

/**
 * Whether the library is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable. Purging itself is never per-user and never flag-gated:
 * the sweep must collect crops for every user who has any, including one
 * removed from the scope list after their rows were written.
 */
export function castingReferenceLibraryArmed(): boolean {
  return parseCastingReferenceLibraryScope(
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
  ).kind !== "off";
}

export function validateCastingReferenceLibraryEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const library = parseCastingReferenceLibraryScope(input.scope);
  if (library.kind === "off") return library;

  if (input.cleanupWorker !== "true") throw new CastingReferenceLibraryCleanupWorkerError();

  const casting = parseCastingV2Scope(input.castingScope);
  if (casting.kind === "off") {
    throw new CastingReferenceLibraryCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a library hangs off a candidate, and nothing can create one`,
    );
  }
  if (casting.kind === "all") return library;
  if (library.kind === "all") {
    throw new CastingReferenceLibraryCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = library.userIds.filter((userId) => !casting.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingReferenceLibraryCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return library;
}

/* ------------------------------------------ the compositor-swap sub-flag */

/**
 * THE REPAINT — the new compositor, on its own switch (D-241, fable-277 §2).
 *
 * Off, this user's refines paint through the old road: full-frame engine call,
 * masked harvest, segments pasted back, seam blended. On, the same ask assembles
 * a recipe (`recipeAssembler`) and repaints the whole frame from the pristine
 * master plus a cropped reference of every delivered feature (`repaintRender`),
 * and the engine's own frame is the delivered frame — nothing is pasted.
 *
 * # Its parent is the LIBRARY scope, and that is the load-bearing choice
 *
 * Under the old road a feature survives the next render because the compositor
 * PASTES its kept segment back. Under the repaint nothing is pasted: a feature
 * survives because the library holds a crop of it and the recipe carries that
 * crop. So a user repainting without a library is a user whose face silently
 * loses every feature the paste was preserving, on the paid path — the exact
 * class D-244 exists to close, arriving through the flag pair instead of
 * through the code.
 *
 * An EMPTY library is a different thing entirely and is fine: that is the
 * degenerate case (fable-171 condition 1), the road every new cast travels, and
 * it assembles to the master alone plus words. Empty is not disabled.
 *
 * The transport is inherited rather than re-asserted here: the repaint engine is
 * the same fal-backed one the masked path already uses, and `CASTING_V2_SCOPE`
 * — which every scope below it must sit inside — already refuses to arm without
 * `FAL_KEY`.
 */
export const CASTING_REPAINT_SCOPE_ENV = "CASTING_REPAINT_SCOPE";

export class CastingRepaintScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REPAINT_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingRepaintScopeConfigurationError";
  }
}

/**
 * A repaint carries features by crop, and the crops are the library's. A repaint
 * scope reaching past the library scope is not merely inert — it is a paid path
 * that forgets features — so it refuses rather than arming (invariant 7).
 */
export class CastingRepaintCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REPAINT_SCOPE_ENV} ${detail}`);
    this.name = "CastingRepaintCoverageError";
  }
}

export function parseCastingRepaintScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingRepaintScopeConfigurationError();
  });
}

/**
 * Whether this user's refines go through the new compositor.
 *
 * An AND of the whole chain, for `captureCastingSegmentsEnabled`'s reason: the
 * boot check already refuses a scope that reaches past its parent, and this is
 * the same rule enforced again where it is used, because a boot check that was
 * never invoked is the second way a flag pair goes wrong.
 */
export function captureCastingRepaintEnabled(userId: number): boolean {
  const repaint = parseCastingRepaintScope(process.env[CASTING_REPAINT_SCOPE_ENV]);
  if (!castingV2EnabledForUser(repaint, userId)) return false;
  return captureCastingReferenceLibraryEnabled(userId);
}

export function validateCastingRepaintEnvironment(input: {
  scope: string | undefined;
  libraryScope: string | undefined;
}): CastingV2Scope {
  const repaint = parseCastingRepaintScope(input.scope);
  if (repaint.kind === "off") return repaint;

  const library = parseCastingReferenceLibraryScope(input.libraryScope);
  if (library.kind === "off") {
    throw new CastingRepaintCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} is off — a repaint carries features by crop, and without a library there are no crops to carry`,
    );
  }
  if (library.kind === "all") return repaint;
  if (repaint.kind === "all") {
    throw new CastingRepaintCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = repaint.userIds.filter((userId) => !library.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingRepaintCoverageError(
      `names users outside ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return repaint;
}

/* ---------------------------------------------- the auto-scan sub-flag */

/**
 * SAYING WHICH SIDE TWICE — her anatomy, and the half of the picture it is on.
 *
 * Off, a per-side ask is named once, exactly as it is today: *"Change only her
 * right eye: fiery red."* On, the clause also says where that side appears —
 * *"her right eye (on the left of the picture as you look at it)"*.
 *
 * It exists because a court found the engine paints by POSITION rather than by
 * anatomy. Twelve renders each way on her right eye: four painted the OTHER eye
 * without the clause, none with it (p≈0.09 — suggestive rather than proven,
 * never once worse, and free per render; `V4_SIDE_INFERENCE_COURT.md` §3b).
 *
 * The parent is the REPAINT scope rather than the library's, because the clause
 * is written by the repaint recipe and nothing else says it: a user named here
 * and not there would be armed for a sentence they cannot reach.
 *
 * Inert without it in the strongest sense — one parenthesis, in one clause, of
 * one sentence; every other byte of the prompt is identical.
 */
export const CASTING_SIDE_PHRASING_SCOPE_ENV = "CASTING_SIDE_PHRASING_SCOPE";

export class CastingSidePhrasingScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_SIDE_PHRASING_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingSidePhrasingScopeConfigurationError";
  }
}

export class CastingSidePhrasingCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_SIDE_PHRASING_SCOPE_ENV} ${detail}`);
    this.name = "CastingSidePhrasingCoverageError";
  }
}

export function parseCastingSidePhrasingScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingSidePhrasingScopeConfigurationError();
  });
}

/**
 * Whether this user's per-side asks say where the side is.
 *
 * An AND of the whole chain, for `captureCastingSegmentsEnabled`'s reason: the
 * boot check already refuses a scope that reaches past its parent, and this is
 * the same rule enforced again where it is used, because a boot check that was
 * never invoked is the second way a flag pair goes wrong.
 */
export function captureCastingSidePhrasingEnabled(userId: number): boolean {
  const child = parseCastingSidePhrasingScope(process.env[CASTING_SIDE_PHRASING_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingRepaintEnabled(userId);
}

export function validateCastingSidePhrasingEnvironment(input: {
  scope: string | undefined;
  repaintScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingSidePhrasingScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingRepaintScope(input.repaintScope);
  if (parent.kind === "off") {
    throw new CastingSidePhrasingCoverageError(
      `cannot be enabled while ${CASTING_REPAINT_SCOPE_ENV} is off — the recipe says the side once, exactly as it does today`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingSidePhrasingCoverageError(
      `cannot be "all" while ${CASTING_REPAINT_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingSidePhrasingCoverageError(
      `names users outside ${CASTING_REPAINT_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * THE AUTO-SCAN — reading a face nobody has edited, on its own switch.
 *
 * Off, the face panel is exactly what it is today: rows from the catalogue,
 * content from the library, and an untouched face showing a column of empty
 * slots (the founder's own screenshot, fable-352). On, the panel's first read
 * of a version also asks a segmenter where every feature is on that frame, and
 * fills the rows the library has nothing for.
 *
 * # Why it needs a switch of its own, given the panel already has one
 *
 * It SPENDS. Not a customer's credits — a scan is house money on a read the
 * user never asked to pay for — but **twelve questions costing twenty segmenter
 * calls per version looked at, $0.100** (⚠ this said *fourteen calls* until
 * 2026-08-24; the counted figure was taken through `scanFace` itself with a
 * recording reader, and its neighbour at the kept-scan flag has always said
 * twelve questions and about ten cents — one file, three numbers for one fact).
 * A switch is the difference between that starting when we choose and starting
 * the moment a deploy lands on whoever already has the panel.
 * `CASTING_REFERENCE_LIBRARY_SCOPE` is `all` in production — it read *"open for
 * the founder"* until the same day — so without this the scan would arrive on
 * EVERY account's next selection unannounced, which is more of the reason and
 * not less.
 *
 * # Its parent is the LIBRARY scope, because the panel is its only consumer
 *
 * The scan produces panel furniture and nothing else — no rows, no objects, no
 * manifest (fable-373 ruling 4a). The panel it fills is dark until the library
 * scope is on, so a scan scope reaching past it is a paid read whose answer
 * nobody can see: inert, and inert is indistinguishable from mistaken from
 * outside (invariant 7). The transport is inherited rather than re-asserted —
 * `CASTING_V2_SCOPE`, which every scope below it must sit inside, already
 * refuses to arm without `FAL_KEY`.
 */
export const CASTING_FACE_SCAN_SCOPE_ENV = "CASTING_FACE_SCAN_SCOPE";

export class CastingFaceScanScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_FACE_SCAN_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingFaceScanScopeConfigurationError";
  }
}

export class CastingFaceScanCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_FACE_SCAN_SCOPE_ENV} ${detail}`);
    this.name = "CastingFaceScanCoverageError";
  }
}

export function parseCastingFaceScanScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingFaceScanScopeConfigurationError();
  });
}

/**
 * Whether this user's untouched faces are read on selection.
 *
 * An AND of the whole chain, for `captureCastingSegmentsEnabled`'s reason: the
 * boot check already refuses a scope that reaches past its parent, and this is
 * the same rule enforced again where it is used, because a boot check that was
 * never invoked is the second way a flag pair goes wrong.
 */
export function captureCastingFaceScanEnabled(userId: number): boolean {
  const scan = parseCastingFaceScanScope(process.env[CASTING_FACE_SCAN_SCOPE_ENV]);
  if (!castingV2EnabledForUser(scan, userId)) return false;
  return captureCastingReferenceLibraryEnabled(userId);
}

export function validateCastingFaceScanEnvironment(input: {
  scope: string | undefined;
  libraryScope: string | undefined;
}): CastingV2Scope {
  const scan = parseCastingFaceScanScope(input.scope);
  if (scan.kind === "off") return scan;

  const library = parseCastingReferenceLibraryScope(input.libraryScope);
  if (library.kind === "off") {
    throw new CastingFaceScanCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} is off — the scan fills a panel that does not render`,
    );
  }
  if (library.kind === "all") return scan;
  if (scan.kind === "all") {
    throw new CastingFaceScanCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = scan.userIds.filter((userId) => !library.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingFaceScanCoverageError(
      `names users outside ${CASTING_REFERENCE_LIBRARY_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return scan;
}

export function validateCastingV2Environment(input: {
  scope: string | undefined;
  cleanupWorker: string | undefined;
  transportConfigured?: boolean;
  validatorConfigured?: boolean;
}): CastingV2Scope {
  const parsed = parseCastingV2Scope(input.scope);
  if (parsed.kind !== "off" && input.cleanupWorker !== "true") {
    throw new CastingV2CleanupWorkerConfigurationError();
  }
  if (parsed.kind !== "off" && input.transportConfigured !== true) {
    throw new CastingV2TransportConfigurationError();
  }
  if (parsed.kind !== "off" && input.validatorConfigured !== true) {
    throw new CastingV2ValidatorConfigurationError();
  }
  return parsed;
}

/**
 * THE KEPT SCAN (migration 0032) — whether a finished reading is written down.
 *
 * The scan itself is `CASTING_FACE_SCAN_SCOPE`'s business: twelve segmenter
 * questions about a face-version, about ten cents, held in memory for as long
 * as the process lives. This flag governs one thing on top of that — whether
 * the answer survives the process. Off, not a row is written and not a row is
 * read, and the panel behaves exactly as it does today.
 *
 * # Its parent is the SCAN scope, and that is the whole chain
 *
 * A kept scan is a scan that has already happened. A user outside
 * `CASTING_FACE_SCAN_SCOPE` produces no scans to keep, so a table scope
 * reaching past it could only ever write rows for readings that do not exist —
 * inert, and inert is indistinguishable from mistaken from outside
 * (invariant 7). The scan scope in turn sits inside the library scope, which
 * sits inside `CASTING_V2_SCOPE`, so naming a user here names them all the way
 * down.
 *
 * # And the cleanup worker, for the same reason segments needed it
 *
 * A kept scan owns OBJECTS: one stencil per feature found, under the
 * candidate's own path. A persisted artifact class without a running purge is
 * the thing the founder's storage condition forbids, so this refuses to boot
 * without the worker exactly as the segment store does.
 *
 * Purging is deliberately NOT gated on this flag — see {@link
 * castingScanTableArmed}.
 */
export const CASTING_SCAN_TABLE_SCOPE_ENV = "CASTING_SCAN_TABLE_SCOPE";

export class CastingScanTableScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_SCAN_TABLE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingScanTableScopeConfigurationError";
  }
}

export class CastingScanTableCleanupWorkerError extends Error {
  constructor() {
    super(
      `${CASTING_SCAN_TABLE_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "CastingScanTableCleanupWorkerError";
  }
}

export class CastingScanTableCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_SCAN_TABLE_SCOPE_ENV} ${detail}`);
    this.name = "CastingScanTableCoverageError";
  }
}

export function parseCastingScanTableScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingScanTableScopeConfigurationError();
  });
}

/** Whether this user's finished scans are written down and read back. */
export function captureCastingScanTableEnabled(userId: number): boolean {
  const table = parseCastingScanTableScope(process.env[CASTING_SCAN_TABLE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(table, userId)) return false;
  return captureCastingFaceScanEnabled(userId);
}

/**
 * Whether the store is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable. It never gates the purge itself: rows written while the
 * flag was on must be collected after it goes off, and a retention path that
 * narrows with a feature flag is how objects outlive the sheet that promised
 * to destroy them.
 */
export function castingScanTableArmed(): boolean {
  return parseCastingScanTableScope(process.env[CASTING_SCAN_TABLE_SCOPE_ENV]).kind !== "off";
}

export function validateCastingScanTableEnvironment(input: {
  scope: string | undefined;
  scanScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const table = parseCastingScanTableScope(input.scope);
  if (table.kind === "off") return table;

  if (input.cleanupWorker !== "true") throw new CastingScanTableCleanupWorkerError();

  const scan = parseCastingFaceScanScope(input.scanScope);
  if (scan.kind === "off") {
    throw new CastingScanTableCoverageError(
      `cannot be enabled while ${CASTING_FACE_SCAN_SCOPE_ENV} is off — there would be no reading to keep`,
    );
  }
  if (scan.kind === "all") return table;
  if (table.kind === "all") {
    throw new CastingScanTableCoverageError(
      `cannot be "all" while ${CASTING_FACE_SCAN_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = table.userIds.filter((userId) => !scan.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingScanTableCoverageError(
      `names users outside ${CASTING_FACE_SCAN_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return table;
}

/* --------------------------------------------- the open-lane sub-flag */

/**
 * THE OPEN LANE'S OWN SWITCH — the one flag this lane never had.
 *
 * Off, the interpreter is not told it may name a kind outside its vocabulary,
 * so its replies key onto the nearest closed subject and the acceptance door at
 * `refineInterpreter` is not consulted at all. On, the prompt carries the
 * last-resort clause and the door decides.
 *
 * # It was found missing, and the finding is the reason it exists
 *
 * The door (`openLaneAccept`, step 5a) shipped ungated, dark only because no
 * reply ever emitted an unknown subject key. With `CASTING_V2_SCOPE=all` in
 * production that made the clause a one-line prompt edit away from opening this
 * lane for every user of the product in a single deploy — and it also left the
 * door reachable, rarely, by a reply that named an unknown key of its own
 * accord. This closes both: the prompt AND the door are behind it.
 *
 * # Why the parent is the REPAINT scope and not the casting scope
 *
 * Because the two roads do not both carry an open kind, and the difference is
 * measured rather than assumed:
 *
 *  - the repaint road builds its recipe from the ask (`repaintAsksFor` reads
 *    `delta.open` and the composed state's), so the kind reaches the paint;
 *  - the paste road composes its prompt from `readDelta(variant.deltas)` —
 *    wall (d) — and that reader DROPS `open` by construction, because it is the
 *    strict reader guarding the boundary where a model's reply enters the
 *    record. A paste-road user would be charged for a render whose prompt never
 *    mentioned the thing they asked for.
 *
 * So a user armed here and not on the repaint road is armed for a lane that
 * cannot deliver their ask. Strictly stronger than the casting scope, which is
 * this one's grandparent by way of the library.
 */
export const CASTING_OPEN_LANE_SCOPE_ENV = "CASTING_OPEN_LANE_SCOPE";

export class CastingOpenLaneScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_OPEN_LANE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingOpenLaneScopeConfigurationError";
  }
}

export class CastingOpenLaneCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_OPEN_LANE_SCOPE_ENV} ${detail}`);
    this.name = "CastingOpenLaneCoverageError";
  }
}

export function parseCastingOpenLaneScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingOpenLaneScopeConfigurationError();
  });
}

/**
 * Whether this user's out-of-vocabulary asks may name a kind.
 *
 * An AND of the whole chain, for `captureCastingSidePhrasingEnabled`'s reason:
 * the boot check already refuses a scope reaching past its parent, and this is
 * that same rule enforced where it is used, because a boot check nobody invoked
 * is the second way a flag pair goes wrong.
 */
export function captureCastingOpenLaneEnabled(userId: number): boolean {
  const child = parseCastingOpenLaneScope(process.env[CASTING_OPEN_LANE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingRepaintEnabled(userId);
}

export function validateCastingOpenLaneEnvironment(input: {
  scope: string | undefined;
  repaintScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingOpenLaneScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingRepaintScope(input.repaintScope);
  if (parent.kind === "off") {
    throw new CastingOpenLaneCoverageError(
      `cannot be enabled while ${CASTING_REPAINT_SCOPE_ENV} is off — the paste road's wall-(d) re-read `
      + "drops an open kind, so the ask would be charged for and never said in the prompt",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingOpenLaneCoverageError(
      `cannot be "all" while ${CASTING_REPAINT_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingOpenLaneCoverageError(
      `names users outside ${CASTING_REPAINT_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * THE INK STUDIO — whether a customer may attach a tattoo design to a Cast.
 *
 * # What it gates, and what it deliberately does not
 *
 * On, the upload door exists: a design arrives, is stored under the candidate's
 * own purge path, and records the placement it is meant for from the closed
 * vocabulary (`shared/inkPlacementVocabulary.ts`). Off, and absent means off,
 * there is no door and not one row is written.
 *
 * It does **not** gate the words-rendered ink road. `inkPlacement.ts` decides
 * whether ink stated in a sentence can be rendered from words alone (D-133(a):
 * face and neck, today) and is untouched by this flag in either position.
 * Retiring that road removes a paid capability and is a founder-adjacent
 * decision, not a consequence of this one being switched on.
 *
 * # Why the parent is the REPAINT scope
 *
 * Same argument as the open lane's, and the same measurement underneath it. An
 * ink design reaches a photograph as a cropped reference carried by the repaint
 * recipe; the paste road composes its prompt from a reader that carries no such
 * thing. A user armed here and not on the repaint road would be offered a door
 * that opens onto a wall — an upload that can never appear on her.
 *
 * The library scope is the repaint scope's own parent, so requiring the repaint
 * road requires the library transitively. It is not re-asserted here: two
 * checks of one fact drift apart, and the boot chain already refuses a scope
 * reaching past its parent.
 *
 * # And the cleanup worker, for the reason every storage-writing flag has it
 *
 * An upload is bytes we keep. Without the worker running, nothing deletes them
 * when the Cast they belong to goes, and the promise that a customer's picture
 * leaves with her work becomes quietly false. Refusing to boot is the honest
 * posture (invariant 7).
 *
 * # WHAT REMAINS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * Nothing renders. The released-tuple table (`shared/inkReleasedPlacements.ts`)
 * is empty, so even with this flag on, no placement has yet earned a paid
 * drive — and the mannequin template the design is plated onto does not exist
 * until the founder's one-time taste gate is answered (D-138). This flag opens
 * the door to a room that is still being built, which is exactly why it is off.
 */
export const CASTING_INK_STUDIO_SCOPE_ENV = "CASTING_INK_STUDIO_SCOPE";

export class CastingInkStudioScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_STUDIO_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkStudioScopeConfigurationError";
  }
}

export class CastingInkStudioCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_STUDIO_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkStudioCoverageError";
  }
}

export function parseCastingInkStudioScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkStudioScopeConfigurationError();
  });
}

/**
 * Whether this user may attach an ink design.
 *
 * An AND of the whole chain at the point of use, for the reason its siblings
 * carry: the boot check refuses a scope that reaches past its parent, and a
 * boot check nobody invoked is the second way a flag pair goes wrong.
 */
export function captureCastingInkStudioEnabled(userId: number): boolean {
  const child = parseCastingInkStudioScope(process.env[CASTING_INK_STUDIO_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingRepaintEnabled(userId);
}

/**
 * Whether the studio is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable — production has not taken migration 0034 and sweeps every
 * pass. It never gates the purge itself: a design uploaded while the flag was
 * on must be collected after it goes off, and a retention path that narrows
 * with a feature flag is how a customer's own photograph outlives the Cast it
 * was promised to leave with.
 */
export function castingInkStudioArmed(): boolean {
  return parseCastingInkStudioScope(process.env[CASTING_INK_STUDIO_SCOPE_ENV]).kind !== "off";
}

export function validateCastingInkStudioEnvironment(input: {
  scope: string | undefined;
  repaintScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkStudioScope(input.scope);
  if (child.kind === "off") return child;

  if (input.cleanupWorker !== "true") {
    throw new CastingInkStudioCoverageError(
      "cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly \"true\" — an uploaded "
      + "design is bytes we keep, and nothing would ever delete them",
    );
  }

  const parent = parseCastingRepaintScope(input.repaintScope);
  if (parent.kind === "off") {
    throw new CastingInkStudioCoverageError(
      `cannot be enabled while ${CASTING_REPAINT_SCOPE_ENV} is off — a design is carried into a `
      + "render as a cropped reference by the repaint recipe, and the paste road carries none",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkStudioCoverageError(
      `cannot be "all" while ${CASTING_REPAINT_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkStudioCoverageError(
      `names users outside ${CASTING_REPAINT_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the attach sub-flag */

/**
 * THE ATTACH DOOR — whether a customer may hand a picture to a Cast at all
 * (build two, `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §2, countersigned
 * fable-1063 §1).
 *
 * The founder's complaint is the whole reason: *"you put a small link take
 * makeup from a photo???? this is stupid, you should be able to upload any image
 * like grok and use it as a reference for anything"*. On, there is one door —
 * she attaches, our copy lands under the candidate's own purge path, and she
 * gets a handle back. Off, and absent means off, `castingV2.reference.attach`
 * answers NOT_FOUND and not one row is written.
 *
 * # A THIRD FLAG RATHER THAN THE STUDIO'S, and the reason is what it keeps
 *
 * `CASTING_INK_STUDIO_SCOPE` is `users:1` in production. Landing this door
 * behind it would not be a dark landing at all — it would open a new store on
 * the founder's live account on the deploy that shipped it, and the thing that
 * store keeps is a FULL PHOTOGRAPH of whoever is in the picture. A road that
 * keeps people's photographs earns its own switch, off by default, so that
 * opening it is a decision somebody makes rather than a side effect of where the
 * code was put.
 *
 * # Why the parent is the REPAINT scope
 *
 * The ink studio's argument, unchanged, because the destination is the same: a
 * feature taken from an attached picture reaches a render as a CROPPED
 * REFERENCE carried by the repaint recipe, and the paste road carries none. A
 * user armed here and not on the repaint road would be offered a door that
 * opens onto a wall — she could attach a picture that could never appear on her.
 *
 * # And the cleanup worker, for the reason every storage-writing flag has it
 *
 * An attachment is bytes we keep, and the bytes are a person. Without the worker
 * running, nothing deletes them when the Cast they belong to goes, and the
 * promise that a customer's picture leaves with her work becomes quietly false.
 * Refusing to boot is the honest posture (invariant 7).
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No row, no object, no handle. The sweep clause for its table is live anyway
 * and is NOT gated on this flag — a picture attached while it was on must be
 * collected after it goes off, and a retention path that narrows with a feature
 * flag is how a customer's own photograph outlives the Cast it was promised to
 * leave with.
 */
export const CASTING_REFERENCE_ATTACH_SCOPE_ENV = "CASTING_REFERENCE_ATTACH_SCOPE";

export class CastingReferenceAttachScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFERENCE_ATTACH_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingReferenceAttachScopeConfigurationError";
  }
}

export class CastingReferenceAttachCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFERENCE_ATTACH_SCOPE_ENV} ${detail}`);
    this.name = "CastingReferenceAttachCoverageError";
  }
}

export function parseCastingReferenceAttachScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingReferenceAttachScopeConfigurationError();
  });
}

/**
 * Whether this user may attach a picture.
 *
 * An AND of the whole chain at the point of use, for the reason its siblings
 * carry: the boot check refuses a scope that reaches past its parent, and a boot
 * check nobody invoked is the second way a flag pair goes wrong.
 */
export function captureCastingReferenceAttachEnabled(userId: number): boolean {
  const child = parseCastingReferenceAttachScope(process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingRepaintEnabled(userId);
}

/**
 * Whether the attach door is armed AT ALL, regardless of user.
 *
 * The retention sweep reads this one, and only to decide whether a MISSING
 * TABLE is tolerable before migration 0043 lands. It never gates the purge
 * itself — see the header.
 */
export function castingReferenceAttachArmed(): boolean {
  return parseCastingReferenceAttachScope(process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV]).kind !== "off";
}

export function validateCastingReferenceAttachEnvironment(input: {
  scope: string | undefined;
  repaintScope: string | undefined;
  cleanupWorker: string | undefined;
}): CastingV2Scope {
  const child = parseCastingReferenceAttachScope(input.scope);
  if (child.kind === "off") return child;

  if (input.cleanupWorker !== "true") {
    throw new CastingReferenceAttachCoverageError(
      "cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly \"true\" — an attached "
      + "picture is bytes we keep, and nothing would ever delete them",
    );
  }

  const parent = parseCastingRepaintScope(input.repaintScope);
  if (parent.kind === "off") {
    throw new CastingReferenceAttachCoverageError(
      `cannot be enabled while ${CASTING_REPAINT_SCOPE_ENV} is off — a feature taken from an `
      + "attached picture is carried into a render as a cropped reference by the repaint recipe, "
      + "and the paste road carries none",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingReferenceAttachCoverageError(
      `cannot be "all" while ${CASTING_REPAINT_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingReferenceAttachCoverageError(
      `names users outside ${CASTING_REPAINT_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the hair-from-a-reference sub-flag */

/**
 * TAKING HER HAIR FROM A PICTURE — the first thing the attach door's handle is
 * actually FOR (founder ruling relayed fable-1047 §3, sequenced fable-1071 §5).
 *
 * His words: *"if i supply a reference image and say copy hair from reference it
 * asks color? style? or full look."*
 *
 * On, a `refine` may carry a `referenceId`, an ask that names hair without
 * saying which of the three is meant gets the question, and the answer routes to
 * the form his ruling gives it — colour as WORDS, style and the whole look as a
 * CROP. Off, and absent means off, `refine` refuses a `referenceId` free and no
 * question is ever composed.
 *
 * # THE FLAG IS WHAT KEEPS THE QUESTION HONEST, and that is not a formality
 *
 * D-180's condition on every question this product asks is that it **never dead
 * ends**. A chip whose road is not built is a dead end wearing a tap target, and
 * this road has three chips landing over more than one chunk. So the whole of it
 * stays behind one switch until every answer acts — which means the flag is not
 * protecting a risky feature, it is protecting a PROMISE.
 *
 * # Its parent is the ATTACH door, and there is no second candidate
 *
 * A hair take reads or cuts a picture the customer handed us, and the handle for
 * that picture is minted by `castingV2.reference.attach`. Armed here and not
 * there, a customer would meet a question about a reference she has no way to
 * supply. The attach flag in turn carries the repaint and cleanup-worker
 * parents, so this inherits both without restating them — a crop reaches a
 * render on the repaint recipe and nowhere else, and the bytes it is cut from
 * are deleted by the worker.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No question is composed, no reference is resolved, no picture is read, no
 * crop is cut and no row is written. A `referenceId` on a refine is refused with
 * a sentence and nothing is charged.
 */
export const CASTING_HAIR_REFERENCE_SCOPE_ENV = "CASTING_HAIR_REFERENCE_SCOPE";

export class CastingHairReferenceScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_HAIR_REFERENCE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingHairReferenceScopeConfigurationError";
  }
}

export class CastingHairReferenceCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_HAIR_REFERENCE_SCOPE_ENV} ${detail}`);
    this.name = "CastingHairReferenceCoverageError";
  }
}

export function parseCastingHairReferenceScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingHairReferenceScopeConfigurationError();
  });
}

/**
 * Whether this user may take hair from a reference.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingHairReferenceEnabled(userId: number): boolean {
  const child = parseCastingHairReferenceScope(process.env[CASTING_HAIR_REFERENCE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

export function validateCastingHairReferenceEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingHairReferenceScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingHairReferenceCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the handle a hair `
      + "take travels with is minted by the attach door, so the question would be asked about a "
      + "picture the customer has no way to supply",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingHairReferenceCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingHairReferenceCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the dispatch sub-flag */

/**
 * WHETHER THE PAID HALF STOPS HOLDING THE REQUEST (Landing C,
 * `CASTING_V2_REFINE_DISPATCH_DESIGN.md` §3; countersigned fable-973).
 *
 * Off — and absent means off — `castingV2.refine` awaits the entire render
 * before it answers, so the customer's exposure is the operation's own life:
 * median 121 s, p95 276 s, and 1.7% of them answered past the observed ~305 s
 * gateway wall, where the socket carrying the answer is gone before the answer
 * exists. On, the paid half returns a receipt the moment the work is genuinely
 * under way, and the outcome arrives on the surface like every other durable
 * fact — the rows, the sweep and the three lists that read them are all already
 * live, which is why this is a flag rather than a rebuild.
 *
 * # Its parent is the CASTING scope, and that choice is the road question
 *
 * Every other sub-flag on this road hangs off the repaint scope because it
 * changes what is PAINTED. This one changes only WHEN THE ANSWER ARRIVES: the
 * same render, the same recipe, the same bytes, on whichever road the user is
 * already travelling. A paste-road customer is a legitimate subject and gains
 * exactly what a repaint-road one gains. What it cannot be armed over is a user
 * with no refine to dispatch, so the parent is the scope that opens the door at
 * all.
 *
 * # What is NOT gated on it, deliberately
 *
 * The settled list (Landing A) is unconditional and already shipped: a terminal
 * refine failure reaches the surface whether or not the request was still
 * holding. That is the ordering this design turns on — take the socket away
 * before the surface can represent its own terminal outcome and the outcome
 * reaches nobody ALWAYS, which is strictly worse than the 1.7% being fixed.
 *
 * # Turning it on is its own recorded decision
 *
 * Off everywhere at landing. A dev walk comes before any thought of `users:1`,
 * and that step is a separate, written act rather than a consequence of this
 * code existing (fable-973 §3e).
 */
export const CASTING_REFINE_DISPATCH_SCOPE_ENV = "CASTING_REFINE_DISPATCH_SCOPE";

export class CastingRefineDispatchScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_REFINE_DISPATCH_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingRefineDispatchScopeConfigurationError";
  }
}

export class CastingRefineDispatchCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_REFINE_DISPATCH_SCOPE_ENV} ${detail}`);
    this.name = "CastingRefineDispatchCoverageError";
  }
}

export function parseCastingRefineDispatchScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingRefineDispatchScopeConfigurationError();
  });
}

/**
 * Whether this user's paid refine returns a receipt instead of a picture.
 *
 * An AND of the chain at the point of use, for its siblings' reason: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingRefineDispatchEnabled(userId: number): boolean {
  const child = parseCastingRefineDispatchScope(process.env[CASTING_REFINE_DISPATCH_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingRefineDispatchEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingRefineDispatchScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingRefineDispatchCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — there is no refine to dispatch`,
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingRefineDispatchCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingRefineDispatchCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------- the tattoo-from-a-reference sub-flag */

/**
 * A TATTOO TAKEN FROM A PICTURE — the gate's reference arm (founder rulings
 * relayed fable-1047 §2 and fable-1078, designed opus-822, ruled fable-1115/1116).
 *
 * His words, the second of the two:
 *
 * > *"no any tattoo request from a reference image must be respected regardless
 * > if u can see it or not, if the sleeve cuts off and you cant see the full
 * > finished product in the image refinement it should carry into the
 * > sign/angles as it will still have the reference + description"*
 *
 * On, an ask that POINTS AT AN ATTACHED PICTURE for a tattoo stops meeting the
 * ink document gate (D-137), because the picture is the document the gate was
 * always asking for. Off, and absent means off, the gate behaves exactly as it
 * has for a words ask.
 *
 * ⚠ **That used to read *"face and neck render from words, everything else
 * waits"*, and BOTH halves have moved since.** The face carve-out was RETIRED
 * ungated on 2026-08-21 (`2fdc382d`, fable-1296 §1) — a face ask passed this
 * gate and died one door later at the measured-placement door, so the gate's
 * list stopped naming a surface `INK_PLACEMENTS` does not hold. And what a
 * words ask reaches is `CASTING_INK_WORDS_SCOPE`'s business, which is `all`:
 * her neck, an upper arm and her upper chest, narrowed by what her outfit
 * covers. This flag governs the REFERENCE arm alone.
 *
 * # WHY THIS ONE NEEDED A FLAG WHEN THE RESOLVER DID NOT
 *
 * The ink document gate fires **on a live road today** — `CASTING_V2_SCOPE` is
 * `all`, and every refine passes through `refineDelta`. So unlike the rest of
 * this build, opening that arm is a behaviour change for people who did not ask
 * for one. **A live road's behaviour must never change on a flag nobody
 * flipped** (fable-1116 §3), and that is the whole reason this constant exists.
 *
 * # BOTH PARENTS, AND WHERE EACH IS ENFORCED
 *
 *   the ATTACH door     the handle. A tattoo take reads a picture the customer
 *                       handed us, and `castingV2.reference.attach` is what
 *                       mints the handle for it. Checked directly below.
 *   the REPAINT scope   the carrier. A design reaches a photograph as a cropped
 *                       reference carried by the repaint recipe, and the paste
 *                       road carries none. Enforced through the attach flag's
 *                       own coverage check rather than restated here — a second
 *                       copy of a coverage rule is the mirror law 4 forbids, and
 *                       it is the copy that drifts.
 *
 * # WHAT IS TRUE WHILE IT IS OFF, WHICH IS EVERYWHERE TODAY
 *
 * No placement is resolved out of anybody's sentence, no side is asked for, the
 * gate walls exactly as it did, and not one row is written.
 *
 * # AND WHAT IS TRUE WHILE IT IS ON, BEFORE THE CUTTER EXISTS
 *
 * The arm opens onto an ask that is **ANSWERED**, never onto a render. Until the
 * crop-from-photo cutter lands, a reference-documented tattoo ask reaches the
 * take and the side question and stops there. Opening the gate alone would turn
 * a wall into a tattoo rendered from words — D-137's exact forbidden render —
 * which is why the arm and the take ship in one commit (ruled fable-1116 §4).
 */
export const CASTING_INK_REFERENCE_SCOPE_ENV = "CASTING_INK_REFERENCE_SCOPE";

export class CastingInkReferenceScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_REFERENCE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkReferenceScopeConfigurationError";
  }
}

export class CastingInkReferenceCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_REFERENCE_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkReferenceCoverageError";
  }
}

export function parseCastingInkReferenceScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkReferenceScopeConfigurationError();
  });
}

/**
 * Whether this user's tattoo ask may be documented by her own picture.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingInkReferenceEnabled(userId: number): boolean {
  const child = parseCastingInkReferenceScope(process.env[CASTING_INK_REFERENCE_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingReferenceAttachEnabled(userId);
}

/**
 * Whether a design may reach a Cast AT ALL, by either road — the retention
 * sweep's question about the delivered-tattoo store (0049), and only ever
 * about whether a MISSING TABLE is tolerable.
 *
 * Two doors mint a design row and neither is the other's parent: the studio's
 * upload (`CASTING_INK_STUDIO_SCOPE`) and the take from an attached picture
 * (`CASTING_INK_REFERENCE_SCOPE`, whose parent is the attach door). A delivery
 * crop cannot exist without a design row, so this is the OR of the two rather
 * than a third list of conditions to keep in step (law 4).
 *
 * It never gates the purge itself. A crop cut while a flag was on must be
 * collected after it goes off, and a retention path that narrows with a feature
 * flag is how a picture of a real person's neck outlives the Cast it was
 * promised to leave with.
 */
export function castingInkDeliveryCropArmed(): boolean {
  return castingInkStudioArmed()
    || parseCastingInkReferenceScope(process.env[CASTING_INK_REFERENCE_SCOPE_ENV]).kind !== "off";
}

/*
  THE TAKE-BUILT GUARD IS GONE, AND THIS IS THE COMMIT ITS OWN MESSAGE NAMED.

  `INK_REFERENCE_TAKE_BUILT` stood here from `d93849b3` and refused any non-off
  `CASTING_INK_REFERENCE_SCOPE` while nothing read a placement out of her
  sentence — because an opened gate with no take behind it is a tattoo rendered
  from words (D-137). Its own thrown string said to delete it *"in the commit
  that lands the take, and not before"*, and this is that commit:
  `inkReferenceTake.ts` reads the placement and the side, `resolveInkPlacement`
  validates them, and `refineService` ANSWERS the ask before the claim and never
  dispatches it.

  Recorded here rather than simply removed, because a control that vanishes
  without a trace is indistinguishable from one that was never wired — which is
  the reading this campaign keeps having to repair.

  **What did not arrive with the take is the QUESTION**, and that is a ruling
  rather than a debt (fable-1120 §4): pre-cutter, every answer to *"which side?"*
  leads to *"we can't paint it yet"*, which is a dead end wearing a question. It
  lands with the cutter, when it has somewhere to lead.
*/

export function validateCastingInkReferenceEnvironment(input: {
  scope: string | undefined;
  attachScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkReferenceScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingReferenceAttachScope(input.attachScope);
  if (parent.kind === "off") {
    throw new CastingInkReferenceCoverageError(
      `cannot be enabled while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is off — the picture that `
      + "documents the tattoo is attached at that door, so the gate would open for an ask with "
      + "nothing to document it and render a design from words",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkReferenceCoverageError(
      `cannot be "all" while ${CASTING_REFERENCE_ATTACH_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkReferenceCoverageError(
      `names users outside ${CASTING_REFERENCE_ATTACH_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ------------------------------------------- the ink CUT sub-flag */

/**
 * WHETHER AN UPLOADED DESIGN IS CUT OUT OF ITS PICTURE BEFORE IT IS STORED —
 * build 3a.2's upload wire (`V3B_INK_AND_MARKS_DESIGN_NOTE.md` §7.12, ruled
 * fable-1130 §1 and fable-1133 §3a).
 *
 * Off, and absent means off, `uploadInkDesign` behaves exactly as it does today:
 * her photograph is stored unchanged, no segmenter is called, and not one thing
 * about the door moves. On, the same upload asks two measured questions of her
 * picture and what lands in `casting_ink_designs.storageKey` is **the design
 * alone, on transparency** — the bytes the plate mint reads, and the bytes every
 * later consumer inherits.
 *
 * # A FLAG RATHER THAN A STRAIGHT SWAP, and the reason is that the door is LIVE
 *
 * `CASTING_INK_STUDIO_SCOPE` is `users:1` in production — the founder's own
 * account, uploading his own designs. Cutting before storing changes what an
 * upload DOES: it spends two segmenter calls of house money, and it can refuse
 * a picture that succeeds today (a photographed person the reader could isolate
 * no design on). Landing that unflagged would change live behaviour on the
 * deploy that shipped it, which the standing autonomy grant forbids by name.
 *
 * # WHY THE PARENT IS THE STUDIO SCOPE AND NOTHING ELSE
 *
 * The cut happens INSIDE the upload door. A user who cannot upload has nothing
 * to cut, so arming this over them is arming a step of a road they cannot enter
 * — inert, and indistinguishable from mistaken. The repaint and cleanup-worker
 * parents ride in through the studio flag's own check rather than being
 * restated here; two checks of one fact drift apart.
 *
 * # `FAL_KEY` IS GUARANTEED BY THE CHAIN, AND THIS FILE DELIBERATELY DOES NOT
 * # RE-CHECK IT — a note, because its absence looks like an oversight
 *
 * The cutter refuses rather than storing a photograph when the reader does not
 * answer: the fence, and the right direction. But it means a deployment with no
 * segmenter transport would refuse **every** upload behind this flag, with a
 * sentence about her picture rather than about our configuration.
 *
 * A `FAL_KEY` check was written here for exactly that reason and then **deleted,
 * because it could never fire**. The parent chain is
 * `CASTING_INK_CUT_SCOPE` → `CASTING_INK_STUDIO_SCOPE` → `CASTING_REPAINT_SCOPE`
 * → `CASTING_REFERENCE_LIBRARY_SCOPE` → `CASTING_V2_SCOPE`, and the last of
 * those refuses to boot without the transport
 * (`CastingV2TransportConfigurationError`). So no configuration exists in which
 * this flag is armed and the key is missing.
 *
 * It was found by driving the guard through `validateEnv()` itself
 * (`scripts/rehearse-ink-cut-boot-disposable.mts`) and INSISTING THE ARM ASSERT
 * ITS OWN REASON: the arm refused, and refused on `CASTING_V2_SCOPE`'s message.
 * A looser regex would have printed PROVEN over a control that does nothing —
 * which is the shape half of `CLAUDE.md`'s inert-control list has. Law 4:
 * derive, never mirror; two checks of one fact drift apart, and the one that
 * cannot fire is the one that keeps its reputation.
 *
 * The rehearsal keeps the arm, aimed at the fact rather than at this file: with
 * the flag armed and no key, boot REFUSES, naming `CASTING_V2_SCOPE`.
 *
 * It declares no fal allowance of its own. The two questions ride the shared
 * `FAL_CONCURRENCY` courtesy pool that every region read already uses, so the
 * ceiling arithmetic `assertFalBudget` refuses to boot over is untouched.
 *
 * # WHAT IS STILL TRUE WITH IT ON
 *
 * **The widening tripwire stays armed.** Its retirement is verified at the wire
 * on the bytes handed to `fetchDesignBytes`, and that arm belongs to the build
 * that mints — which fable-1133 §1 folded into the mannequin resumption sitting,
 * beside the release door, D-138 and the fence court. A flag that can be off is
 * not a structural fact, and rows written before it was flipped still hold
 * photographs.
 */
export const CASTING_INK_CUT_SCOPE_ENV = "CASTING_INK_CUT_SCOPE";

export class CastingInkCutScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_CUT_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkCutScopeConfigurationError";
  }
}

export class CastingInkCutCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_CUT_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkCutCoverageError";
  }
}

export function parseCastingInkCutScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkCutScopeConfigurationError();
  });
}

/**
 * Whether this user's uploaded design is cut before it is stored.
 *
 * An AND of the whole chain at the point of use, like every sibling: the boot
 * check refuses a scope reaching past its parent, and a boot check nobody
 * invoked is the second way a flag pair goes wrong.
 */
export function captureCastingInkCutEnabled(userId: number): boolean {
  const child = parseCastingInkCutScope(process.env[CASTING_INK_CUT_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingInkStudioEnabled(userId);
}

/**
 * **WHETHER THE THING SHE POINTED AT IS THE SURFACE, NOT THE PATCH** — the
 * region-crop road (approved for design fable-1183 §2, countersigned in full
 * fable-1201).
 *
 * Off, and absent means off, an upload behaves exactly as `CASTING_INK_CUT_SCOPE`
 * describes: the named region NARROWS the ink mask and what is stored is the ink
 * inside it. On, the same upload may store the REGION ITSELF, face excluded —
 * because on a heavily tattooed person the ink mask is one patch of a patchwork
 * and the surface is the only picture that holds the sleeve she means.
 *
 * # The measurement that bought it
 *
 * ```
 * S1   tattooed skin   10,779 px   140x167      one piece of a thirty-piece body
 * S1   upper arm       38,079 px   183x353      the thing she is pointing at
 * ```
 *
 * Two rescue hypotheses died at the wire first (opus-876 §2): the reader is
 * exonerated — every ink read came back `masks 1`, so there was never a second
 * mask being discarded — and asking the ink question INSIDE the region's own
 * crop returns something smaller still (2,393 px). No word and no framing that
 * court tested returns the work the customer is pointing at. The surface does.
 *
 * # ⚠ IT IS INERT BY ARITHMETIC TODAY, AND THAT IS DECLARED RATHER THAN QUIET
 *
 * ```
 * S1 upper arm    183 short edge   S2 upper arm  229 short edge   REFUSED
 * S2 upper chest  720x390          the road's first real crop     CARRIED
 * INK_DESIGN_MIN_EDGE = 256
 * ```
 *
 * ⚠ **THE INERTNESS IS PER PLACEMENT, NOT PER ROAD, and this paragraph claimed
 * otherwise for one commit.** It read *"the road refuses both of its own
 * founder specimens"* — true of the ARM, measured; false of the CHEST, which
 * nobody had asked until the real reader was driven (opus-899). `upper chest`
 * on S2 answers a 720x390 surface, clears the floor comfortably, and produces
 * a crop of the whole chest piece. **So this flag is NOT inert: armed, a chest
 * placement changes what is stored today.** The arm placement stays
 * floor-blocked, and where it blocks the inertness is total rather than a
 * smaller cut — the scoped ink cut is `ink ∩ region` and therefore inside the
 * region, so a surface under the floor guarantees the fallback is under it too
 * and the picture refuses `cutTooSmall` with the flag either way
 * (`inkReferenceCutter.test.ts` asserts that as an equality).
 *
 * The floor is still a flip precondition, because the arm — the placement his
 * own ontology example names, *"copy his right arm sleeve"* — is the one it
 * blocks.
 *
 * ⚠ **THE FLOOR QUESTION IS ANSWERED, AND THE ANSWER IS NOT A NEW CONSTANT**
 * (the floor court, opus-903; ruled fable-1210 §1). Six paid frames, one
 * design, one placement, and the reference's pixel size as the only variable:
 *
 * ```
 *   reference     delivered ink        at the frames
 *   1200x1697     73,820 / 63,712 px   the design, fully drawn
 *    183x259      17,615 / 15,688 px   a sparse strand — THE DESIGN IS GONE
 *    732x1036     26,804 / 37,066 px   the design is back
 * ```
 *
 * Non-overlapping arms — the native smallest is 3.6x the small one's largest.
 * So 256 was RIGHT, for the reason its own docblock asserted without evidence,
 * and **the picture is made to meet it instead**: `inkReferenceUpscale.ts`
 * enlarges a cut under the floor through a faithful super-resolution model
 * (never a diffusion one — that would invent strokes the customer never drew),
 * bought only for a cut that would otherwise be refused, on the shared courtesy
 * pool. The enlarging is reached ONLY through this flag, and for a user inside
 * it, it rescues both roads' small cuts rather than the surface alone.
 *
 * **So the floor is no longer a flip precondition — it is a solved problem, and
 * the remaining two below are what stand.** No floor constant moved.
 *
 * # ITS FIRST REMAINING PRECONDITION IS A FOUNDER GATE THAT NO ARM CAN CLOSE
 *
 * This road sends more of a stranger's photograph to an engine than anything
 * before it: today a photographed person contributes at most one ink patch, and
 * this contributes a face-excluded SURFACE. fable-919 §3 is the gate — **a
 * face-bearing reference must produce a plate with zero person content, at the
 * frames, in front of him.**
 *
 * The face exclusion is armed at the bytes (`subtractMask`, `overlapPixels`, and
 * the S2 positive with its S1 negative), and that arm proves PIXELS ARE ABSENT.
 * It is not the gate. Law 9: only his eyes close it. Written here rather than
 * only in a report so the gate survives seat rotation, in the place the flip
 * will be argued.
 *
 * **It does not retire the widening tripwire either** — it enlarges what that
 * tripwire is about, which is the opposite.
 *
 * # AND ITS SECOND IS THE OFFER, which is also the containment test's backstop
 *
 * The customer is to be shown the crop that will ride (fable-1183 §2c) —
 * 3a.2(b)'s surface, the same prerequisite `CASTING_INK_CUT_SCOPE` carries. On
 * this road the offer is load-bearing in a second way that fable-1201 §3 ordered
 * written down: **region masks can overlap across adjacent surfaces in a
 * contorted frame, so a borderline containment pass is survivable ONLY because
 * she sees the crop before anything rides.** Nobody may relax the offer while
 * believing the containment test stands alone.
 *
 * ⚠ **AND THE SENTENCE ABOVE WAS IN THE PRESENT TENSE UNTIL 2026-08-24, WHICH
 * CLAIMED A SURFACE THAT DOES NOT EXIST.** 3a.2(b) is unbuilt — read at the
 * code rather than remembered: the only consumer of `inkDesignImagePath`
 * anywhere in `client/` is `shownCutSurface.test.ts`, a test asserting who owns
 * the spelling of the address. The route serves the bytes
 * (`routes/inkDesignDelivery.ts`); no room draws them. **This flag nevertheless
 * stands at `users:1` in production, and that is authorised rather than
 * accidental**: it rode with the cut pair on his own yes, because the object he
 * approved is the SURFACE cut and only this flag produces one (fable-1260 §2).
 * So the offer is a condition on WIDENING and on relaxing the containment test,
 * and it is not something a customer has today.
 *
 * # The parent is the CUT scope and nothing else
 *
 * The region road is an escalation of the `cut` route — it is reached only after
 * the routing has already decided to cut, so a user whose uploads are not cut
 * has no road to escalate. The studio, repaint, library and transport parents
 * ride in through that flag's own check rather than being restated here; two
 * checks of one fact drift apart.
 *
 * It declares no fal allowance of its own. One extra call (`face`) on the road
 * that already asks three, riding the shared `FAL_CONCURRENCY` courtesy pool, so
 * `assertFalBudget`'s ceiling arithmetic is untouched.
 */
export const CASTING_INK_REGION_CROP_SCOPE_ENV = "CASTING_INK_REGION_CROP_SCOPE";

export class CastingInkRegionCropScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_REGION_CROP_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkRegionCropScopeConfigurationError";
  }
}

export class CastingInkRegionCropCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_REGION_CROP_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkRegionCropCoverageError";
  }
}

export function parseCastingInkRegionCropScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkRegionCropScopeConfigurationError();
  });
}

/** Whether this user's cut may be the SURFACE rather than the ink inside it. */
export function captureCastingInkRegionCropEnabled(userId: number): boolean {
  const child = parseCastingInkRegionCropScope(process.env[CASTING_INK_REGION_CROP_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingInkCutEnabled(userId);
}

export function validateCastingInkRegionCropEnvironment(input: {
  scope: string | undefined;
  cutScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkRegionCropScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingInkCutScope(input.cutScope);
  if (parent.kind === "off") {
    throw new CastingInkRegionCropCoverageError(
      `cannot be enabled while ${CASTING_INK_CUT_SCOPE_ENV} is off — the region road is an escalation of `
      + "the cut, so a user whose uploads are stored whole has no road to escalate",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkRegionCropCoverageError(
      `cannot be "all" while ${CASTING_INK_CUT_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkRegionCropCoverageError(
      `names users outside ${CASTING_INK_CUT_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

export function validateCastingInkCutEnvironment(input: {
  scope: string | undefined;
  studioScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkCutScope(input.scope);
  if (child.kind === "off") return child;

  /* No `FAL_KEY` check here, and its absence is a decision rather than a gap —
     see the docblock above. The chain up to `CASTING_V2_SCOPE` already refuses
     to boot without the transport, so a check here could never fire. */
  const parent = parseCastingInkStudioScope(input.studioScope);
  if (parent.kind === "off") {
    throw new CastingInkCutCoverageError(
      `cannot be enabled while ${CASTING_INK_STUDIO_SCOPE_ENV} is off — the cut happens inside the `
      + "upload door, so a user who cannot upload has nothing to cut",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkCutCoverageError(
      `cannot be "all" while ${CASTING_INK_STUDIO_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkCutCoverageError(
      `names users outside ${CASTING_INK_STUDIO_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * **WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS** — the transform road
 * (founder-ordered fable-1269 §2, designed opus-940, countersigned fable-1274).
 *
 * His own words, the hour his tattoo card went live: *"Can i actually make
 * edits to the upper chest tattoo? like make it bigger or somthing now it has
 * a bounding box?"*
 *
 * # What it gates, and what it deliberately does not
 *
 * Off, and absent means off, *"make his chest tattoo bigger"* travels the road
 * it travels today: the ink facet is read, a placement is resolved out of the
 * word *"chest"*, and the render paints **a fresh design invented from her
 * prose** on a master that has no ink. That is charged and it is wrong, and it
 * is nevertheless what off must mean — a dark landing changes nothing on the
 * deploy that ships it.
 *
 * On, the same ask carries her own DELIVERED CROP as the source with one clause
 * of the instruction changed (`inkAsDelivered`), so the tattoo on the wire is
 * the tattoo on her rather than a reinvention of it.
 *
 * **Two of the road's three arms are OUTSIDE this flag and that is deliberate**
 * (granted fable-1274 §4): an ask about ink she does not have, and an ask
 * naming two changes at once, are both answered free before the claim with an
 * honest sentence. Gating an apology is how the apology stays wrong for
 * everyone outside the flag.
 *
 * # WHY THE PARENT IS THE STUDIO SCOPE
 *
 * A transform's whole content is a picture of a tattoo this product already
 * delivered, and the studio door is the road that makes a tattoo deliverable at
 * all. Armed over a user outside it, the flag would guard a lane whose subject
 * cannot exist — inert, and indistinguishable from mistaken. The repaint,
 * library and cleanup-worker parents ride in through the studio flag's own
 * check rather than being restated here; two checks of one fact drift apart.
 *
 * # It spends nothing new
 *
 * No engine call, no segmenter call, no text call. The picture already exists
 * (migration `0049`), her words are already hers, and the change is a clause
 * swap read out of her own sentence by code (`inkPriorAsk`). `assertFalBudget`
 * is untouched, and there is no new stored byte anywhere, which is why this
 * flag needs no table and no migration.
 */
/**
 * WHETHER A TATTOO INVENTED FROM WORDS MAY LAND SOMEWHERE THE ANCHOR BARELY
 * SHOWS — the words road's second step (founder ruling fable-1290, design
 * opus-955, countersigned fable-1296).
 *
 * His words: *"word invented tattoos are fine as long as the engine can find
 * and crop them to be references moving foward into other edits"*. The
 * condition is his and it is load-bearing — the road opens only where the
 * delivery mint can capture the landing, so a tattoo we cannot carry is never
 * painted in the first place.
 *
 * # What it gates, and what it deliberately does not
 *
 * Off, and absent means off, `WORDS_ROAD_PLACEMENTS` is `neck` alone — the one
 * placement proven end to end, by crop #1, minted from a delivered frame with
 * no design row anywhere. An ask naming an upper arm or an upper chest walls at
 * D-137's gate exactly as it does today, free, before the claim.
 *
 * On, those two placements join it and the same ask renders and mints.
 *
 * **It does NOT gate the face retirement, and that is the shape of step 1**
 * (fable-1296 §1): a face ask stopped passing the gate and dying one door later
 * with *"I need to know where it goes"* for EVERYBODY, ungated, because that was
 * a sentence fix rather than a capability and gating an apology keeps it wrong
 * for everyone. This flag governs only what OPENS.
 *
 * # ⚠ ITS SHAPE WAS NOT FINISHED WHEN THIS WAS WRITTEN — AND THE COURT HAS
 * # SINCE REPORTED, THE FOUNDER HAS JUDGED IT, AND THE FLAG IS `all`
 *
 * The flag was armed ahead of its own court because the court cannot drive a
 * walled road without it, and proving the road in a locally-widened
 * configuration that has never existed is the harness-supplied-argument trap
 * with money attached (rejected fable-1298 §3). That is history now: the court
 * RAN (opus-960, ratified fable-1301 §1), he judged the frames and the thirteen
 * glossary styles himself (fable-1398), and **the flip to `all` went through
 * his own hand** (fable-1400) — the first capability this program has taken
 * from `users:1` to `all`. The paragraphs below record what the court was for
 * and what it decided; they are not a live instruction.
 *
 * What the court decides (fable-1296 §2) is whether this flag also has to carry
 * an OCCLUSION REFUSAL. The house line dresses her in a crew-neck tee, so the
 * ordinary master's chest is covered — `inkSurfaceCoverage.ts` is where that
 * fact now lives and is asked (item 7a; it used to be `dependsOnGarment` frozen
 * onto the placement itself, which was the crew tee's answer wearing the
 * clothes of an anatomical one) —
 * and there are three possible outcomes rather than the two a paragraph
 * predicts. Production has shown the third: on the reference road the engine
 * SCOOPED THE NECKLINE and delivered onto bare skin, which the founder saw and
 * accepted. If the words road scoops too, no refusal is needed. If it does not,
 * one belongs here.
 *
 * ⚠ **THIS PARAGRAPH ENDED *"So do not widen this flag on the strength of this
 * docblock — it is armed for a court"* UNTIL 2026-08-24, AND IT WAS A LIVE
 * PROHIBITION AGAINST SOMETHING ALREADY DONE.** It was the FIFTH surface of that
 * sentence: `CLAUDE.md`, `POST_SIGN_ROADMAP.md`, the positions table's own
 * header — which quotes it as the specimen of this exact class — and that
 * table's `why` field were each corrected before this one, because a correction
 * tracks readership rather than authority and nobody re-opens a flag's docblock
 * to read about a flip. What survives of it is narrower and still true: **the
 * occlusion question above is open**, and the chest's answer today comes from
 * `inkSurfaceCoverage.ts` (her outfit) rather than from this flag.
 *
 * # Why the parent is `CASTING_V2_SCOPE` and nothing narrower
 *
 * A words-born tattoo needs no design row, no uploaded picture and no studio
 * door — that is the whole point of the road, and crop #1 is a delivery with
 * `designId` NULL. Hanging this off the studio flag would gate a lane whose
 * subject does not require it, which is a check that reads as a rule and is
 * really a mistake.
 *
 * # It spends nothing new
 *
 * No new engine call, no segmenter call, no text call, no table and no
 * migration. A render on this road is the refine that would have happened
 * anyway, and the mint it fires is the one every delivering ink render already
 * fires. `assertFalBudget` is untouched.
 */
export const CASTING_INK_WORDS_SCOPE_ENV = "CASTING_INK_WORDS_SCOPE";

export class CastingInkWordsScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_WORDS_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkWordsScopeConfigurationError";
  }
}

export class CastingInkWordsCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_WORDS_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkWordsCoverageError";
  }
}

export function parseCastingInkWordsScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkWordsScopeConfigurationError();
  });
}

/** Whether a words-born tattoo may land beyond her neck. */
export function captureCastingInkWordsEnabled(userId: number): boolean {
  const child = parseCastingInkWordsScope(process.env[CASTING_INK_WORDS_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingInkWordsEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkWordsScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingInkWordsCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a words-born tattoo is painted by a `
      + "refine, and a user outside casting has no refine to paint it",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkWordsCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkWordsCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}


/**
 * WHETHER A CAST MAY BE BORN WITH TATTOOS THE PRODUCT KNOWS ABOUT — 7b(a)
 * (design opus-1031/1040/1042, countersigned fable-1381 ruling 3 and
 * fable-1399; the write site and its three judgement calls endorsed
 * fable-1412).
 *
 * Off, and **absent means off**, the product behaves exactly as it does today:
 * the interpreter is not asked about ink at all, so an unflagged roll's prompt
 * is BYTE-IDENTICAL to today's, `statedInk` is null on every roll, and no
 * `bornInk:` row has ever been written. On, a brief that describes tattoos
 * files one words-only library row per described region, minted at the landing
 * of each candidate it produced.
 *
 * # The population is real, and it is two rolls
 *
 * Production has 207 rolls. TWO name ink, fifteen minutes apart, the same
 * text — *"Bare-chested, displaying extensive black-and-grey ornamental tattoos
 * covering most of his chest, shoulders, upper arms, and lower neck."* Both
 * have zero surviving candidates today, so this feature has **no living
 * population at all**, which is stated here rather than discovered later.
 *
 * # Why the parent is `CASTING_V2_SCOPE` and nothing narrower
 *
 * A brief-born tattoo needs no studio door, no design row, no uploaded picture
 * and no repaint: the BRIEF is the document, which is D-137's boundary met by
 * the only route that meets it without a picture. Hanging this off the ink
 * studio would gate a lane whose subject does not require it — the words road's
 * own argument, one lane over.
 *
 * # It spends nothing new
 *
 * No new engine call, no new segmenter call, no new text call, no table and no
 * migration. The reading rides the interpreter call that already runs
 * (`statedInk`, beside `statedHair` and `statedAccessories`), and the row is
 * written from what that call already answered. `assertFalBudget` is untouched.
 *
 * # ⚠ What it does NOT buy, said here rather than found
 *
 * A born tattoo is RECORDED and DISCLOSED; it is not editable and it is not
 * pixels. 7b-ii — the sign-mint that would make it a picture — is not designed
 * and not started, and waits on the fable-1296 §3 court. The row's own lane
 * says the same thing in code: `selectCarriedFeatureWords` declines it
 * `markingDiscloses`, because a tattoo under fabric has zero visible
 * consequence and carrying its words would either do nothing or fight the view
 * prompt's placement discipline (fable-1396 §2).
 */
export const CASTING_BORN_INK_SCOPE_ENV = "CASTING_BORN_INK_SCOPE";

export class CastingBornInkScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_BORN_INK_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingBornInkScopeConfigurationError";
  }
}

export class CastingBornInkCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_BORN_INK_SCOPE_ENV} ${detail}`);
    this.name = "CastingBornInkCoverageError";
  }
}

export function parseCastingBornInkScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingBornInkScopeConfigurationError();
  });
}

/** Whether this account's briefs may be read for ink, and file a row when they name it. */
export function captureCastingBornInkEnabled(userId: number): boolean {
  const child = parseCastingBornInkScope(process.env[CASTING_BORN_INK_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingBornInkEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingBornInkScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingBornInkCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — the row is minted when a CANDIDATE `
      + "lands, and a user outside casting rolls none",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingBornInkCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingBornInkCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

export const CASTING_INK_TRANSFORM_SCOPE_ENV = "CASTING_INK_TRANSFORM_SCOPE";

export class CastingInkTransformScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_INK_TRANSFORM_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingInkTransformScopeConfigurationError";
  }
}

export class CastingInkTransformCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_INK_TRANSFORM_SCOPE_ENV} ${detail}`);
    this.name = "CastingInkTransformCoverageError";
  }
}

export function parseCastingInkTransformScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingInkTransformScopeConfigurationError();
  });
}

/** Whether this user may change a tattoo she already has. */
export function captureCastingInkTransformEnabled(userId: number): boolean {
  const child = parseCastingInkTransformScope(process.env[CASTING_INK_TRANSFORM_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingInkStudioEnabled(userId);
}

export function validateCastingInkTransformEnvironment(input: {
  scope: string | undefined;
  studioScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingInkTransformScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingInkStudioScope(input.studioScope);
  if (parent.kind === "off") {
    throw new CastingInkTransformCoverageError(
      `cannot be enabled while ${CASTING_INK_STUDIO_SCOPE_ENV} is off — a transform changes a tattoo `
      + "this product delivered, and a user outside the studio door has none",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingInkTransformCoverageError(
      `cannot be "all" while ${CASTING_INK_STUDIO_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingInkTransformCoverageError(
      `names users outside ${CASTING_INK_STUDIO_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/**
 * THE TWO PATHS — whether a customer may choose how her cast is BORN (founder
 * ruling 2026-08-21, *"this is the way foward 100%"*; relayed fable-1311 with
 * fable-1312's addendum; design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md`
 * §10, countersigned fable-1334; migration `0051`, ceremony taken on both
 * databases 2026-08-22).
 *
 * # What it gates
 *
 * Off, and absent means off: **no toggle is rendered, no path is written, every
 * roll composes the wardrobe sentence exactly as it does today, and not one
 * line of the new road runs.** The two columns stay NULL on every roll, which
 * is what NULL means — *cast before the paths existed*.
 *
 * On, a roll is bought on a chosen path. `wardrobe` is born and signed in an
 * outfit — hers if she named one, otherwise one the engine picks for the cast
 * type, otherwise the plain grey tee — and ink lands where that outfit leaves
 * skin. `basics` is born and signed in plain black basics: a clean body record,
 * and the chest is bare.
 *
 * # Why the parent is `CASTING_V2_SCOPE` and nothing narrower
 *
 * ⚠ **This is the one sub-flag on this road whose parent is not the repaint
 * scope, and the difference is the subject rather than a preference.** Every
 * other flag here gates something a REFINE does, and a refine's road is the
 * repaint one. This gates THE ROLL — the spendable surface that is already at
 * `all` — so hanging it off the repaint scope would refuse the path to accounts
 * that can already buy the very thing being pathed.
 *
 * The refine half is gated a second way and NOT by a second flag: the WARDROBE
 * subject card is `admittedOn: "repaintOnly"`, so a garment edit is confined to
 * the road it will be measured on by the card that describes it, which is a
 * fact a reader of the card can see rather than a coupling they have to know.
 *
 * # It requires nothing new of the environment
 *
 * No stored bytes, so no cleanup worker. No new transport and no new engine
 * call, so `assertFalBudget`'s ceiling arithmetic is untouched. The line is
 * written by the interpreter call that already runs.
 *
 * # ⚠ AND A SECOND FLIP PRECONDITION, ADDED BY ITEM 7a (fable-1368 ruling 2)
 *
 * **Every ink placement refuses on a Wardrobe-path cast with a picked or
 * customer-named outfit, until the coverage reader lands.**
 *
 * Item 7a made *does this cast's wardrobe cover this surface* a real question
 * with one owner (`inkSurfaceCoverage.ts`) instead of three frozen constants
 * measured on sixteen masters in the house crew tee. It answers `bare` or
 * `covered` for the lines this product WROTE — the house line and the two
 * Basics forms — and `unknown` for anything else, because guessing what a
 * customer's outfit covers is guessing about her body.
 *
 * `unknown` fails closed. While this flag is absent that costs nobody anything:
 * every roll is `unpathed`, which answers the house table byte for byte. **The
 * day it widens, a cast born in an outfit the picker invented meets an ink
 * refusal on every placement** — an honest one, naming its own reason rather
 * than claiming a covering, but a refusal.
 *
 * So the flip carries ONE of these two, enumerated here rather than remembered:
 *
 *   1. **7a-bis**, the reader that answers coverage for an arbitrary line —
 *      one text read per distinct outfit ever, on the
 *      `casting_open_kind_properties` pattern (a fact about the WORDS, no owner
 *      column, its own migration by ceremony); or
 *   2. **an explicit founder acceptance** of the refuse-until-read state, which
 *      is a real option and not a lesser one — ink and wardrobe are different
 *      features and he may well want the paths before the tattoos.
 *
 * A road named in a ruling is written where the next person acts or it does not
 * exist, and this is that place.
 *
 * # ⚠ THE COLUMNS ARE A PREREQUISITE OF THE CODE, WHICH IS STRICTER THAN A
 * # PREREQUISITE OF THE FLIP — AND IT IS ALREADY DISCHARGED
 *
 * A new column on a table drizzle SELECTs is in every read, flag or no flag, so
 * `casting_rolls.path` and `.wardrobeLine` had to exist in BOTH databases
 * before any of this compiled — not before it was switched on. That is why the
 * order is *ceremony → code lands dark → court → his eyes → flip* and why this
 * boot guard does not check for the columns: by the time it can run, the schema
 * naming them has already shipped. What would have caught the wrong order is
 * `twoPathsMigration.test.ts`'s absence arm, and it did its job before being
 * retired into the three-way arm that replaced it.
 */
export const CASTING_TWO_PATHS_SCOPE_ENV = "CASTING_TWO_PATHS_SCOPE";

export class CastingTwoPathsScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_TWO_PATHS_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingTwoPathsScopeConfigurationError";
  }
}

export class CastingTwoPathsCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_TWO_PATHS_SCOPE_ENV} ${detail}`);
    this.name = "CastingTwoPathsCoverageError";
  }
}

export function parseCastingTwoPathsScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingTwoPathsScopeConfigurationError();
  });
}

/** Whether this account chooses the path its casts are born on. */
export function captureCastingTwoPathsEnabled(userId: number): boolean {
  const child = parseCastingTwoPathsScope(process.env[CASTING_TWO_PATHS_SCOPE_ENV]);
  if (!castingV2EnabledForUser(child, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingTwoPathsEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const child = parseCastingTwoPathsScope(input.scope);
  if (child.kind === "off") return child;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingTwoPathsCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — a path is chosen when a roll is `
      + "bought, and a user outside casting has no roll to buy",
    );
  }
  if (parent.kind === "all") return child;
  if (child.kind === "all") {
    throw new CastingTwoPathsCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = child.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingTwoPathsCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return child;
}

/* ---------------------------------------------- the framing trim */

/**
 * THE FRAMING TRIM — whether a roll renders LARGER than it delivers and trims
 * every frame to a common head size before storing it.
 *
 * Ordered by the founder on his own eye, 2026-08-24, after comparing the court's
 * cut strips against the raw ones: *"hate to say it but the strips genuinely
 * look better and it gives us more control over framing just need to make sure
 * the hair is fully in the image."* Its evidence is
 * `CASTING_FRAMING_CONSISTENCY_COURT.md`; its build is
 * `CASTING_FRAMING_TRIM_BUILD.md`, countersigned fable-1576.
 *
 * **Off, and absent means off, the roll road is BYTE-IDENTICAL to today's**: the
 * render size is unchanged, `FRAMING_FIXED` carries its current landmark
 * sentence, no region read is bought and no trim runs. That matters more here
 * than usual — *context is not additive* was measured in this campaign, so a
 * prompt change that leaked to unflagged accounts would change every cast in the
 * product, not just the ones being watched.
 *
 * On, a roll renders at 1536×2304 with one swapped sentence, reads `face` and
 * `head` on each delivered frame, trims to a common head size with per-frame
 * headroom (`framingTrim.ts`), and downscales to the 1024×1536 it delivers
 * today. Nothing downstream moves: the stored candidate is the same size at the
 * same key, so every refine still anchors on it.
 *
 * The parent is `CASTING_V2_SCOPE` and nothing narrower — what it governs is a
 * ROLL, and a user outside casting has no roll to trim.
 *
 * ⚠ **IT DOES NOT FLIP BEFORE THE KEPT-ORIGINAL COLUMN EXISTS** (build §11a). A
 * roll under the trim without it would trim its frames and DISCARD the
 * originals, which is the one thing the KEEP ruling exists to prevent and is
 * unrecoverable for those casts except by re-rendering different faces. That is
 * a sequencing condition on the FLIP rather than a boot guard, exactly as the
 * ink studio's table prerequisite is — a boot guard cannot see whether a column
 * this code does not yet write is present.
 */
export const CASTING_FRAMING_TRIM_SCOPE_ENV = "CASTING_FRAMING_TRIM_SCOPE";

export class CastingFramingTrimScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_FRAMING_TRIM_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingFramingTrimScopeConfigurationError";
  }
}

export class CastingFramingTrimCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_FRAMING_TRIM_SCOPE_ENV} ${detail}`);
    this.name = "CastingFramingTrimCoverageError";
  }
}

export function parseCastingFramingTrimScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingFramingTrimScopeConfigurationError();
  });
}

/**
 * Whether this user's rolls render large and get trimmed.
 *
 * An AND of the chain, for `captureCastingRepaintEnabled`'s reason: the boot
 * check already refuses a scope reaching past its parent, and the same rule is
 * enforced again where it is used, because a boot check nobody invoked is the
 * second way a flag pair goes wrong.
 */
export function captureCastingFramingTrimEnabled(userId: number): boolean {
  const trim = parseCastingFramingTrimScope(process.env[CASTING_FRAMING_TRIM_SCOPE_ENV]);
  if (!castingV2EnabledForUser(trim, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingFramingTrimEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const trim = parseCastingFramingTrimScope(input.scope);
  if (trim.kind === "off") return trim;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingFramingTrimCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — what it governs is a ROLL, and a `
      + "user outside casting has no roll to trim",
    );
  }
  if (parent.kind === "all") return trim;
  if (trim.kind === "all") {
    throw new CastingFramingTrimCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = trim.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingFramingTrimCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return trim;
}

/**
 * ⚠ **THE BRIEF FIDELITY BUILD** — whether a customer's own words are RATIONED
 * on the way into her sheet (`CASTING_BRIEF_FIDELITY_BUILD.md`, countersigned
 * fable-1600; two courts, $1.12, both text-only).
 *
 * Off, and absent means off, the roll road is BYTE-IDENTICAL to today's: the
 * interpreter is told `characterNotes` must be "Under 25 words.", the reply is
 * bounded at 180 characters, and there is no skin lane. On, that sentence is
 * replaced, the bound becomes the brief's own bound, and a stated skin fact
 * gets a lane that speaks.
 *
 * # WHY THERE IS A FLAG HERE AT ALL, AND WHY IT IS AN UNCOMFORTABLE ONE
 *
 * Every other capability in this program ships dark behind a scope because the
 * road is separable. This one is not: the announced cap and the enforced bound
 * are properties of ONE interpreter call that every roll makes, so a per-user
 * branch means **two products interpreting two sets of briefs**, with the
 * census, the corpus and every future reading having to ask which one it
 * measured. That is a real cost and it is paid on purpose, for one reason:
 *
 *   **the IMAGE side is unmeasured.** Both courts under this build are TEXT —
 *   the notes and the compiled prompts. A `Character detail:` line going from
 *   ~150 to ~500 characters is more IMAGE-prompt context, and this product's
 *   own measurement is that context is not additive: a SUBSET of prompt context
 *   raised the stage wall twice as often as its superset. Three things could
 *   move and none is measured — the eight candidates' variety, the stage wall,
 *   and the provider's content checker.
 *
 * # ⚠ ITS LIFESPAN IS DECLARED SHORT, AND THE DECLARATION IS PART OF THE RULING
 *
 * (fable-1600.) It exists for that one unknown, so **it widens to `all`
 * promptly after the founder's gate rather than living at `users:1` for weeks.**
 * Two products interpreting two sets of briefs is a cost paid briefly and on
 * purpose; paid indefinitely it becomes the road the design rejected — a flag
 * that never widens is a second product nobody maintains.
 *
 * **Every brief-fidelity reading taken while this is narrow stamps which side it
 * drove.** That is the run-label lesson and this campaign has paid for it once:
 * a corpus whose before/after labels named the OUTPUT FILE and nothing else
 * cost a two-tree confusion that a control word had to catch.
 *
 * The parent is `CASTING_V2_SCOPE` and nothing narrower — what it governs is
 * the compile of a ROLL, and a user outside casting has no brief to compile.
 */
export const CASTING_BRIEF_FIDELITY_SCOPE_ENV = "CASTING_BRIEF_FIDELITY_SCOPE";

export class CastingBriefFidelityScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CASTING_BRIEF_FIDELITY_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CastingBriefFidelityScopeConfigurationError";
  }
}

export class CastingBriefFidelityCoverageError extends Error {
  constructor(detail: string) {
    super(`${CASTING_BRIEF_FIDELITY_SCOPE_ENV} ${detail}`);
    this.name = "CastingBriefFidelityCoverageError";
  }
}

export function parseCastingBriefFidelityScope(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new CastingBriefFidelityScopeConfigurationError();
  });
}

/**
 * Whether this user's briefs are read without a ration.
 *
 * An AND of the chain, for `captureCastingRepaintEnabled`'s reason: the boot
 * check already refuses a scope reaching past its parent, and the same rule is
 * enforced again where it is used, because a boot check nobody invoked is the
 * second way a flag pair goes wrong.
 */
export function captureCastingBriefFidelityEnabled(userId: number): boolean {
  const fidelity = parseCastingBriefFidelityScope(process.env[CASTING_BRIEF_FIDELITY_SCOPE_ENV]);
  if (!castingV2EnabledForUser(fidelity, userId)) return false;
  return captureCastingV2Enabled(userId);
}

export function validateCastingBriefFidelityEnvironment(input: {
  scope: string | undefined;
  castingScope: string | undefined;
}): CastingV2Scope {
  const fidelity = parseCastingBriefFidelityScope(input.scope);
  if (fidelity.kind === "off") return fidelity;

  const parent = parseCastingV2Scope(input.castingScope);
  if (parent.kind === "off") {
    throw new CastingBriefFidelityCoverageError(
      `cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off — what it governs is the COMPILE of a `
      + "roll, and a user outside casting has no brief to compile",
    );
  }
  if (parent.kind === "all") return fidelity;
  if (fidelity.kind === "all") {
    throw new CastingBriefFidelityCoverageError(
      `cannot be "all" while ${CASTING_V2_SCOPE_ENV} is limited to specific users`,
    );
  }
  const uncovered = fidelity.userIds.filter((userId) => !parent.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new CastingBriefFidelityCoverageError(
      `names users outside ${CASTING_V2_SCOPE_ENV}: ${uncovered.join(",")}`,
    );
  }
  return fidelity;
}
