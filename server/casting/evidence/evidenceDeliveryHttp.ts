import { createHmac } from "node:crypto";
import {
  EvidenceDeliveryError,
  parseEvidenceStorageKey,
  type CanonicalEvidenceRead,
  type EvidenceStorageKind,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";

const CONTENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const ENTITY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface AuthorizedEvidenceDelivery {
  ownerId: number;
  modelId: number;
  kind: EvidenceStorageKind;
  entityId: string;
  storageKey: string;
  byteSize: number;
  contentHash: string;
}

export type PreparedEvidenceHttpRead =
  | { status: "not_modified"; etag: string }
  | {
    status: "read";
    etag: string;
    object: CanonicalEvidenceRead;
  };

export function buildOwnerPrivateEvidenceEtag(input: {
  jwtSecret: string;
  ownerId: number;
  kind: EvidenceStorageKind;
  entityId: string;
  contentHash: string;
}): string {
  if (
    input.jwtSecret === ""
    || !Number.isSafeInteger(input.ownerId)
    || input.ownerId <= 0
    || !ENTITY_ID_PATTERN.test(input.entityId)
    || !CONTENT_HASH_PATTERN.test(input.contentHash)
  ) {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
  const digest = createHmac("sha256", input.jwtSecret)
    .update(`evidence-etag-v1\0${input.ownerId}\0${input.kind}\0${input.entityId}\0${input.contentHash}`)
    .digest("base64url");
  return `"ev1.${digest}"`;
}

export function evidenceEtagMatches(
  ifNoneMatch: string | undefined,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*"
      || normalized === etag
      || normalized === `W/${etag}`;
  });
}

/**
 * This service starts only after a route has authenticated the caller and
 * loaded an owner-scoped evidence row. A valid conditional hit returns before
 * the private adapter is touched, while every cache decision is still bound to
 * the authenticated owner and immutable database content hash.
 */
export async function prepareEvidenceHttpRead(input: {
  adapter: PrivateEvidenceStorageAdapter;
  evidence: AuthorizedEvidenceDelivery;
  jwtSecret: string;
  ifNoneMatch?: string;
}): Promise<PreparedEvidenceHttpRead> {
  const parsed = parseEvidenceStorageKey(input.evidence.storageKey);
  if (
    parsed.userId !== input.evidence.ownerId
    || parsed.modelId !== input.evidence.modelId
    || parsed.kind !== input.evidence.kind
    || parsed.entityId !== input.evidence.entityId
  ) {
    throw new EvidenceDeliveryError("owner_mismatch");
  }
  const etag = buildOwnerPrivateEvidenceEtag({
    jwtSecret: input.jwtSecret,
    ownerId: input.evidence.ownerId,
    kind: input.evidence.kind,
    entityId: input.evidence.entityId,
    contentHash: input.evidence.contentHash,
  });
  if (evidenceEtagMatches(input.ifNoneMatch, etag)) {
    return { status: "not_modified", etag };
  }
  const object = await input.adapter.readCanonical({
    key: input.evidence.storageKey,
    expectedByteSize: input.evidence.byteSize,
  });
  return { status: "read", etag, object };
}
