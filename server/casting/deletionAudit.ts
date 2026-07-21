/**
 * Pure safety helpers for the R7-5 Cast-deletion audit.
 *
 * This module deliberately has no database or storage imports. The audit may
 * classify evidence, but it is never deletion authority and cannot mutate
 * either system.
 */

export const CAST_PROVENANCE_TYPES = ["cast_root", "cast_view", "library_cast"] as const;

export type CastProvenanceType = typeof CAST_PROVENANCE_TYPES[number];

export type StorageReferenceClassification =
  | { kind: "explicit_key"; key: string }
  | { kind: "current_origin_url"; key: string; origin: string }
  | { kind: "external_url"; origin: string }
  | { kind: "invalid"; reason: string }
  | { kind: "missing" };

export interface CastDeletionAuditArgs {
  databaseUrl: string;
  appId: string;
  currentPublicUrl: string;
  modelId?: number;
  allowProductionReadOnly: boolean;
  includeOriginHosts: boolean;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function isProductionAppId(appId: string): boolean {
  return /(^|[-_])prod(uction)?($|[-_])/i.test(appId.trim());
}

/**
 * The database URL and app id must both be explicit. In particular, this
 * never falls back to DATABASE_URL, which prevents a developer's ambient
 * shell configuration from silently choosing the audit target.
 */
export function parseCastDeletionAuditArgs(argv: string[]): CastDeletionAuditArgs {
  const databaseUrl = flagValue(argv, "--database-url")?.trim();
  const appId = flagValue(argv, "--app-id")?.trim();
  const currentPublicUrl = flagValue(argv, "--r2-public-url")?.trim();
  if (!databaseUrl) throw new Error("Pass the target explicitly with --database-url mysql://...");
  if (!appId) throw new Error("Pass the target app explicitly with --app-id <app-id>");
  if (!currentPublicUrl || !normalizedOrigin(currentPublicUrl)) {
    throw new Error("Pass the target public bucket explicitly with --r2-public-url https://...");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("--database-url must be a valid MySQL URL");
  }
  if (parsed.protocol !== "mysql:") {
    throw new Error("--database-url must use the mysql:// protocol");
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("--database-url must identify an explicit host and database");
  }

  const modelIdText = flagValue(argv, "--model-id");
  const modelId = modelIdText === undefined ? undefined : Number(modelIdText);
  if (modelId !== undefined && (!Number.isSafeInteger(modelId) || modelId <= 0)) {
    throw new Error("--model-id must be a positive integer");
  }

  const allowProductionReadOnly = hasFlag(argv, "--allow-production-read-only");
  if (isProductionAppId(appId) && !allowProductionReadOnly) {
    throw new Error(
      "Production audit refused by default. Re-run only after explicit approval with --allow-production-read-only.",
    );
  }

  return {
    databaseUrl,
    appId,
    currentPublicUrl,
    modelId,
    allowProductionReadOnly,
    includeOriginHosts: hasFlag(argv, "--include-origin-hosts"),
  };
}

const READ_ONLY_START = /^(SELECT|SHOW|DESCRIBE|EXPLAIN|WITH|START\s+TRANSACTION\s+READ\s+ONLY|ROLLBACK)\b/i;
const MUTATING_SQL = /\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|LOAD)\b/i;

/** A runtime tripwire around every statement issued by the audit script. */
export function assertReadOnlyAuditSql(statement: string): void {
  const normalized = statement.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim();
  if (!READ_ONLY_START.test(normalized) || MUTATING_SQL.test(normalized)) {
    throw new Error("Cast-deletion audit attempted a non-read-only SQL statement");
  }
  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new Error("Cast-deletion audit refuses multiple SQL statements");
  }
}

export function normalizeOwnedStorageKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.length > 1024) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  const segments = trimmed.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return trimmed;
}

function normalizedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyStorageReference(input: {
  storageKey?: unknown;
  url?: unknown;
  currentPublicUrl: string;
}): StorageReferenceClassification {
  if (input.storageKey !== undefined && input.storageKey !== null) {
    const key = normalizeOwnedStorageKey(input.storageKey);
    return key
      ? { kind: "explicit_key", key }
      : { kind: "invalid", reason: "invalid explicit storage key" };
  }
  if (input.url === undefined || input.url === null || input.url === "") return { kind: "missing" };
  if (typeof input.url !== "string") return { kind: "invalid", reason: "URL is not a string" };
  // Check the original spelling before URL normalization can collapse an
  // encoded dot-segment and hide the evidence from parsed.pathname.
  const rawPath = input.url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] ?? "";
  if (
    /%(?:2e|2f|5c)/i.test(rawPath) ||
    rawPath.includes("\\") ||
    rawPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return { kind: "invalid", reason: "encoded path control" };
  }

  const currentOrigin = normalizedOrigin(input.currentPublicUrl);
  if (!currentOrigin) return { kind: "invalid", reason: "R2_PUBLIC_URL is invalid" };

  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { kind: "invalid", reason: "malformed URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "invalid", reason: "unsupported URL protocol" };
  }
  if (parsed.origin.toLowerCase() !== currentOrigin) {
    return { kind: "external_url", origin: parsed.origin.toLowerCase() };
  }
  // Encoded separators/dot segments are never cleanup authority. Decode only
  // after rejecting them, then apply the same normalizer used for explicit keys.
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return { kind: "invalid", reason: "malformed URL encoding" };
  }
  const key = normalizeOwnedStorageKey(decodedPath);
  if (!key) return { kind: "invalid", reason: "invalid object path" };
  return { kind: "current_origin_url", key, origin: currentOrigin };
}

export function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function readCastProvenance(value: unknown): {
  type: CastProvenanceType;
  modelId: number;
} | null {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const metadata = parsed as Record<string, unknown>;
  const raw = metadata.provenance;
  const provenance = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : metadata;
  if (!CAST_PROVENANCE_TYPES.includes(provenance.type as CastProvenanceType)) return null;
  if (!Number.isSafeInteger(provenance.modelId) || Number(provenance.modelId) <= 0) return null;
  return { type: provenance.type as CastProvenanceType, modelId: Number(provenance.modelId) };
}

export function collectHttpReferences(value: unknown): string[] {
  const found = new Set<string>();
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    const parsed = parseJsonValue(current);
    if (typeof parsed === "string") {
      // Metadata/error fields sometimes wrap a URL in prose. Count the URL as
      // evidence without ever returning the surrounding potentially-sensitive
      // sentence. Trailing prose punctuation is not part of the URL.
      const candidates = parsed.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
      for (const candidate of candidates) {
        const cleaned = candidate.replace(/[),.;!?]+$/, "");
        try {
          const url = new URL(cleaned);
          if (url.protocol === "http:" || url.protocol === "https:") found.add(cleaned);
        } catch {
          // Malformed candidates are not treated as URL evidence.
        }
      }
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    if (seen.has(parsed)) return;
    seen.add(parsed);
    if (Array.isArray(parsed)) {
      for (const child of parsed) visit(child);
    } else {
      for (const child of Object.values(parsed as Record<string, unknown>)) visit(child);
    }
  };
  visit(value);
  return Array.from(found);
}

const FORBIDDEN_DELETED_SUBJECT_KEYS = new Set([
  "name",
  "modelName",
  "agencyId",
  "masterPrompt",
  "technicalSchema",
  "preferences",
  "referenceImage",
]);

/** D-64 forbids reconstructive/display identity in the retained delete audit. */
export function hasForbiddenDeletedSubjectMetadata(value: unknown): boolean {
  const parsed = parseJsonValue(value);
  const seen = new Set<object>();
  const visit = (current: unknown): boolean => {
    if (!current || typeof current !== "object" || seen.has(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) return current.some(visit);
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (FORBIDDEN_DELETED_SUBJECT_KEYS.has(key)) return true;
      if (visit(child)) return true;
    }
    return false;
  };
  return visit(parsed);
}

export function countReferenceKinds(
  references: Array<{ storageKey?: unknown; url?: unknown }>,
  currentPublicUrl: string,
): Record<StorageReferenceClassification["kind"], number> {
  const counts: Record<StorageReferenceClassification["kind"], number> = {
    explicit_key: 0,
    current_origin_url: 0,
    external_url: 0,
    invalid: 0,
    missing: 0,
  };
  for (const reference of references) {
    counts[classifyStorageReference({ ...reference, currentPublicUrl }).kind] += 1;
  }
  return counts;
}
