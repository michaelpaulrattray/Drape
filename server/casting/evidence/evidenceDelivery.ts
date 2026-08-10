import type { CanonicalEvidenceImage } from "./imageValidation";
import { createHash } from "node:crypto";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EVIDENCE_KEY_PATTERN = new RegExp(
  `^users/([1-9][0-9]*)/models/([1-9][0-9]*)/evidence/(plates|crops|candidates)/(${UUID_PATTERN})\\.webp$`,
);

export type EvidenceStorageKind = "plate" | "crop" | "candidate";

export interface ParsedEvidenceKey {
  userId: number;
  modelId: number;
  kind: EvidenceStorageKind;
  entityId: string;
}

export interface EvidenceDeliveryAdapter {
  putCanonical(
    key: string,
    bytes: Uint8Array,
    mime: "image/webp",
  ): Promise<{ key: string }>;
  resolveOwnerDelivery(userId: number, key: string): Promise<string>;
  deleteExact(key: string): Promise<EvidenceDeleteResult>;
}

export type EvidenceDeleteErrorCode =
  | "private_storage_unavailable"
  | "private_storage_refused"
  | "private_storage_invalid_request";

export type EvidenceDeleteResult =
  | { success: true }
  | {
    success: false;
    errorCode: EvidenceDeleteErrorCode;
    retryable: boolean;
  };

export interface CanonicalEvidenceRead {
  key: string;
  mime: "image/webp";
  byteSize: number;
  body: AsyncIterable<Uint8Array>;
  abort(): void;
}

export interface PrivateEvidenceStorageAdapter extends EvidenceDeliveryAdapter {
  readCanonical(input: {
    key: string;
    expectedByteSize: number;
  }): Promise<CanonicalEvidenceRead>;
  listCanonicalKeys(input?: {
    maxKeys?: number;
  }): Promise<readonly string[]>;
}

export class EvidenceDeliveryError extends Error {
  readonly code:
    | "invalid_key"
    | "owner_mismatch"
    | "returned_key_mismatch"
    | "invalid_delivery";

  constructor(code: EvidenceDeliveryError["code"]) {
    super("Evidence storage is temporarily unavailable.");
    this.name = "EvidenceDeliveryError";
    this.code = code;
  }
}

function positiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * THE DIAGNOSTIC FRAMES ARE IN THIS BUCKET TOO, and the deleter did not know it.
 *
 * `casting-v2/diagnostics/<userId>/<operationId>/<name>.png` — the painted frame
 * and mask kept when one of the founder's renders is refused, written by
 * `diagnosticCapture` and approved by him on the promise that the cleanup worker
 * sweeps them.
 *
 * **That promise was not being kept, and this is why.** `deleteExact` guarded
 * itself with `parseEvidenceStorageKey`, which only knows the R7 evidence shape,
 * so every diagnostic delete returned `private_storage_invalid_request` with
 * `retryable: false` and stopped forever. Six frames of his face, five failed
 * batches, nothing ever scheduled to try again — and the worker shouted about it
 * once a minute for two days while the count told nobody what it was.
 *
 * The guard's PURPOSE was always "refuse to delete anything that is not ours",
 * and that purpose is right. It was implemented as "must be an R7 evidence key",
 * which is a narrower thing that silently became wrong the moment this bucket
 * held a second kind of object. So it is now what it always meant: an
 * enumerated list of the shapes this bucket legitimately holds. A third kind
 * arriving must be added here, deliberately, and its absence fails CLOSED —
 * the object is retained rather than a stranger deleted.
 */
const DIAGNOSTIC_KEY_PATTERN = new RegExp(
  `^casting-v2/diagnostics/([1-9][0-9]*)/(${UUID_PATTERN})/[a-zA-Z0-9_-]{1,64}\\.png$`,
);

export function isPrivateEvidenceDeletableKey(key: string): boolean {
  return EVIDENCE_KEY_PATTERN.test(key) || DIAGNOSTIC_KEY_PATTERN.test(key);
}

export function parseEvidenceStorageKey(key: string): ParsedEvidenceKey {
  const match = EVIDENCE_KEY_PATTERN.exec(key);
  if (!match) throw new EvidenceDeliveryError("invalid_key");
  const userId = Number(match[1]);
  const modelId = Number(match[2]);
  if (!positiveId(userId) || !positiveId(modelId)) {
    throw new EvidenceDeliveryError("invalid_key");
  }
  return {
    userId,
    modelId,
    kind: match[3] === "plates"
      ? "plate"
      : match[3] === "crops"
        ? "crop"
        : "candidate",
    entityId: match[4],
  };
}

function buildEvidenceStorageKey(input: {
  userId: number;
  modelId: number;
  entityId: string;
  kind: EvidenceStorageKind;
}): string {
  if (!positiveId(input.userId) || !positiveId(input.modelId)) {
    throw new EvidenceDeliveryError("invalid_key");
  }
  const segment = input.kind === "plate"
    ? "plates"
    : input.kind === "crop"
      ? "crops"
      : "candidates";
  const key =
    `users/${input.userId}/models/${input.modelId}/evidence/${segment}/${input.entityId}.webp`;
  parseEvidenceStorageKey(key);
  return key;
}

export function buildReferencePlateStorageKey(input: {
  userId: number;
  modelId: number;
  plateId: string;
}): string {
  return buildEvidenceStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    entityId: input.plateId,
    kind: "plate",
  });
}

export function buildEvidenceCropStorageKey(input: {
  userId: number;
  modelId: number;
  cropId: string;
}): string {
  return buildEvidenceStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    entityId: input.cropId,
    kind: "crop",
  });
}

export function buildEvidenceCandidateStorageKey(input: {
  userId: number;
  modelId: number;
  privatePlateId: string;
}): string {
  return buildEvidenceStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    entityId: input.privatePlateId,
    kind: "candidate",
  });
}

export async function putCanonicalEvidence(
  adapter: EvidenceDeliveryAdapter,
  input: { key: string; image: CanonicalEvidenceImage },
): Promise<void> {
  parseEvidenceStorageKey(input.key);
  const stored = await adapter.putCanonical(
    input.key,
    input.image.bytes,
    input.image.mime,
  );
  if (stored.key !== input.key) {
    throw new EvidenceDeliveryError("returned_key_mismatch");
  }
}

export async function resolveEvidenceOwnerDelivery(
  adapter: EvidenceDeliveryAdapter,
  input: { userId: number; key: string },
): Promise<string> {
  const parsed = parseEvidenceStorageKey(input.key);
  if (parsed.userId !== input.userId) {
    throw new EvidenceDeliveryError("owner_mismatch");
  }
  const delivery = await adapter.resolveOwnerDelivery(input.userId, input.key);
  if (typeof delivery !== "string" || delivery.trim() === "") {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
  return delivery;
}

async function readAllCanonical(input: CanonicalEvidenceRead): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of input.body) {
      total += chunk.byteLength;
      if (total > input.byteSize) throw new EvidenceDeliveryError("invalid_delivery");
      chunks.push(chunk);
    }
  } finally {
    input.abort();
  }
  if (total !== input.byteSize) throw new EvidenceDeliveryError("invalid_delivery");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export async function readCanonicalEvidenceBytesExact(
  adapter: PrivateEvidenceStorageAdapter,
  input: {
    key: string;
    byteSize: number;
    contentHash: string;
  },
): Promise<Buffer> {
  parseEvidenceStorageKey(input.key);
  if (
    !/^[0-9a-f]{64}$/.test(input.contentHash)
    || !Number.isSafeInteger(input.byteSize)
    || input.byteSize <= 0
  ) {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
  const source = await adapter.readCanonical({
    key: input.key,
    expectedByteSize: input.byteSize,
  });
  const bytes = await readAllCanonical(source);
  if (createHash("sha256").update(bytes).digest("hex") !== input.contentHash) {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
  return bytes;
}

/**
 * Copy one private canonical object while proving both source and destination
 * bytes against the immutable database hash. Fork never aliases source keys.
 */
export async function copyCanonicalEvidenceExact(
  adapter: PrivateEvidenceStorageAdapter,
  input: {
    sourceKey: string;
    destinationKey: string;
    byteSize: number;
    contentHash: string;
  },
): Promise<void> {
  parseEvidenceStorageKey(input.sourceKey);
  parseEvidenceStorageKey(input.destinationKey);
  if (
    !/^[0-9a-f]{64}$/.test(input.contentHash)
    || !Number.isSafeInteger(input.byteSize)
    || input.byteSize <= 0
  ) {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
  const bytes = await readCanonicalEvidenceBytesExact(adapter, {
    key: input.sourceKey,
    byteSize: input.byteSize,
    contentHash: input.contentHash,
  });
  await putCanonicalEvidence(adapter, {
    key: input.destinationKey,
    image: {
      bytes,
      mime: "image/webp",
      width: 1,
      height: 1,
      byteSize: bytes.byteLength,
      contentHash: input.contentHash,
    },
  });
  const copied = await adapter.readCanonical({
    key: input.destinationKey,
    expectedByteSize: input.byteSize,
  });
  const copiedBytes = await readAllCanonical(copied);
  if (createHash("sha256").update(copiedBytes).digest("hex") !== input.contentHash) {
    throw new EvidenceDeliveryError("invalid_delivery");
  }
}
