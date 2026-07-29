import {
  parseSnapshotReadScope,
  type SnapshotReadScope,
} from "./snapshotReadScope";

export const SNAPSHOT_RESTORE_SCOPE_ENV = "R7_SNAPSHOT_RESTORE_SCOPE";

export type SnapshotRestoreScope = SnapshotReadScope;

export class SnapshotRestoreScopeConfigurationError extends Error {
  constructor(message?: string) {
    super(
      message
        ?? `${SNAPSHOT_RESTORE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "SnapshotRestoreScopeConfigurationError";
  }
}

export function parseSnapshotRestoreScope(
  raw: string | undefined,
): SnapshotRestoreScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new SnapshotRestoreScopeConfigurationError();
  }
  const members = raw.slice("users:".length).split(",");
  if (
    members.length === 0
    || members.some((member) => !/^[1-9]\d*$/.test(member))
  ) {
    throw new SnapshotRestoreScopeConfigurationError();
  }
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new SnapshotRestoreScopeConfigurationError();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

function scopeContains(
  outer: SnapshotReadScope,
  inner: SnapshotRestoreScope,
): boolean {
  if (inner.kind === "off") return true;
  if (outer.kind === "all") return true;
  if (outer.kind === "off" || inner.kind === "all") return false;
  return inner.userIds.every((userId) => outer.userIds.includes(userId));
}

export function validateSnapshotRestoreEnvironment(input: {
  restoreScope: string | undefined;
  snapshotScope: string | undefined;
}): void {
  const restoreScope = parseSnapshotRestoreScope(input.restoreScope);
  const snapshotScope = parseSnapshotReadScope(input.snapshotScope);
  if (!scopeContains(snapshotScope, restoreScope)) {
    throw new SnapshotRestoreScopeConfigurationError(
      `${SNAPSHOT_RESTORE_SCOPE_ENV} must be a subset of R7_SNAPSHOT_READ_SCOPE`,
    );
  }
}

export function snapshotRestoreEnabledForUser(
  scope: SnapshotRestoreScope,
  userId: number,
): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Snapshot restore scope requires a positive integer user id");
  }
  return scope.kind === "all"
    || (scope.kind === "users" && scope.userIds.includes(userId));
}

/** Capture once at route entry. */
export function captureSnapshotRestoreEnabled(userId: number): boolean {
  return snapshotRestoreEnabledForUser(
    parseSnapshotRestoreScope(process.env[SNAPSHOT_RESTORE_SCOPE_ENV]),
    userId,
  );
}
