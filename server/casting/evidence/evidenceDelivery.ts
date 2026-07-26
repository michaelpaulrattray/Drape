import type { CanonicalEvidenceImage } from "./imageValidation";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EVIDENCE_KEY_PATTERN = new RegExp(
  `^users/([1-9][0-9]*)/models/([1-9][0-9]*)/evidence/(plates|crops)/(${UUID_PATTERN})\\.webp$`,
);

export type EvidenceStorageKind = "plate" | "crop";

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
    kind: match[3] === "plates" ? "plate" : "crop",
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
  const segment = input.kind === "plate" ? "plates" : "crops";
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
