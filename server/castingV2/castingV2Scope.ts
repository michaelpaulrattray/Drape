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
 * charge the promotion plus six views, fail all six conformance checks, and
 * refund three hundred credits back — a Cast with an empty package, every
 * single time, and the money technically correct throughout. Refusing to
 * enable is the only honest posture (invariant 7).
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
 * `CASTING_V2_SCOPE` is already open in production for the founder's own
 * dogfooding. A store that shipped under that flag alone would begin writing
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
 * THE REFERENCE LIBRARY — its own switch, off everywhere until the ceremony.
 *
 * The library is a NEW TABLE (migration 0028) on the same paid path
 * `CASTING_V2_SCOPE` already opens for the founder. A writer shipping under
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
 * user never asked to pay for — but fourteen segmenter calls per version
 * looked at, and a switch is the difference between that starting when we
 * choose and starting the moment a deploy lands on whoever already has the
 * panel. `CASTING_REFERENCE_LIBRARY_SCOPE` is open for the founder, so without
 * this the scan would arrive on his next selection unannounced.
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
