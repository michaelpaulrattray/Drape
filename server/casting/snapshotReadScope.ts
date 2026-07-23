/**
 * Server-owned R7-7B snapshot-reader rollout scope.
 *
 * Clients never send or influence this value. Callers capture the returned
 * mode once at request/operation entry so one request cannot mix authorities.
 */
export const SNAPSHOT_READ_SCOPE_ENV = "R7_SNAPSHOT_READ_SCOPE";

export type SnapshotReadScope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export type SnapshotReadMode = "r6" | "snapshot";

export class SnapshotReadScopeConfigurationError extends Error {
  constructor() {
    super(
      `${SNAPSHOT_READ_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "SnapshotReadScopeConfigurationError";
  }
}

/**
 * Strict on purpose: whitespace, empty members, leading zeroes, duplicates,
 * unsafe integers and unknown modes all fail server startup.
 */
export function parseSnapshotReadScope(raw: string | undefined): SnapshotReadScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new SnapshotReadScopeConfigurationError();
  }

  const members = raw.slice("users:".length).split(",");
  if (
    members.length === 0
    || members.some((member) => !/^[1-9]\d*$/.test(member))
  ) {
    throw new SnapshotReadScopeConfigurationError();
  }

  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new SnapshotReadScopeConfigurationError();
  }

  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function snapshotReadModeForUser(
  scope: SnapshotReadScope,
  userId: number,
): SnapshotReadMode {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Snapshot read mode requires a positive integer user id");
  }
  if (scope.kind === "all") return "snapshot";
  if (scope.kind === "users" && scope.userIds.includes(userId)) return "snapshot";
  return "r6";
}

/** Capture once at request/operation entry. */
export function captureSnapshotReadMode(userId: number): SnapshotReadMode {
  return snapshotReadModeForUser(
    parseSnapshotReadScope(process.env[SNAPSHOT_READ_SCOPE_ENV]),
    userId,
  );
}
