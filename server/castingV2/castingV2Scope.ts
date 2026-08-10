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
