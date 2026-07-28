import {
  parseEvidenceComposerScope,
  type EvidenceComposerScope,
} from "./evidenceComposerScope";

export const EVIDENCE_PACKAGE_SCOPE_ENV = "R7_EVIDENCE_PACKAGE_SCOPE";

export type EvidencePackageScope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export class EvidencePackageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidencePackageConfigurationError";
  }
}

export function parseEvidencePackageScope(
  raw: string | undefined,
): EvidencePackageScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new EvidencePackageConfigurationError(
      `${EVIDENCE_PACKAGE_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
  }
  const members = raw.slice("users:".length).split(",");
  if (
    members.length === 0
    || members.some((member) => !/^[1-9]\d*$/.test(member))
  ) {
    throw new EvidencePackageConfigurationError(
      `${EVIDENCE_PACKAGE_SCOPE_ENV} contains an invalid user allowlist`,
    );
  }
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new EvidencePackageConfigurationError(
      `${EVIDENCE_PACKAGE_SCOPE_ENV} contains an invalid user allowlist`,
    );
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

function scopeIsSubset(
  requested: EvidencePackageScope,
  composer: EvidenceComposerScope,
): boolean {
  if (requested.kind === "off") return true;
  if (composer.kind === "all") return true;
  if (requested.kind === "all" || composer.kind === "off") return false;
  const composerIds = new Set(composer.userIds);
  return requested.userIds.every((userId) => composerIds.has(userId));
}

export function validateEvidencePackageEnvironment(input: {
  scope: string | undefined;
  composerScope: string | undefined;
}): EvidencePackageScope {
  const scope = parseEvidencePackageScope(input.scope);
  const composerScope = parseEvidenceComposerScope(input.composerScope);
  if (!scopeIsSubset(scope, composerScope)) {
    throw new EvidencePackageConfigurationError(
      `${EVIDENCE_PACKAGE_SCOPE_ENV} must be a subset of R7_EVIDENCE_COMPOSER_SCOPE`,
    );
  }
  return scope;
}

export function evidencePackageEnabledForUser(
  scope: EvidencePackageScope,
  userId: number,
): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Evidence package scope requires a positive integer user id");
  }
  return scope.kind === "all"
    || (scope.kind === "users" && scope.userIds.includes(userId));
}

export function captureEvidencePackageEnabled(userId: number): boolean {
  return evidencePackageEnabledForUser(
    parseEvidencePackageScope(process.env[EVIDENCE_PACKAGE_SCOPE_ENV]),
    userId,
  );
}
