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

export function parseCastingV2Scope(raw: string | undefined): CastingV2Scope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new CastingV2ScopeConfigurationError();
  }
  const members = raw.slice("users:".length).split(",");
  if (members.length === 0 || members.some((member) => !/^[1-9]\d*$/.test(member))) {
    throw new CastingV2ScopeConfigurationError();
  }
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new CastingV2ScopeConfigurationError();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
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

export function validateCastingV2Environment(input: {
  scope: string | undefined;
  cleanupWorker: string | undefined;
  transportConfigured?: boolean;
}): CastingV2Scope {
  const parsed = parseCastingV2Scope(input.scope);
  if (parsed.kind !== "off" && input.cleanupWorker !== "true") {
    throw new CastingV2CleanupWorkerConfigurationError();
  }
  if (parsed.kind !== "off" && input.transportConfigured !== true) {
    throw new CastingV2TransportConfigurationError();
  }
  return parsed;
}
