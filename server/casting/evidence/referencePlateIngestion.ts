import { randomUUID } from "node:crypto";
import {
  buildReferencePlateStorageKey,
  putCanonicalEvidence,
  resolveEvidenceOwnerDelivery,
  type EvidenceDeliveryAdapter,
} from "./evidenceDelivery";
import {
  assertCanonicalEvidenceImage,
  type CanonicalEvidenceImage,
} from "./imageValidation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface EvidenceModelHead {
  stateVersion: number;
  currentPackageSnapshotId: string | null;
  identityRevisionId: string | null;
}

export interface PlannedReferencePlate {
  userId: number;
  modelId: number;
  operationId: string;
  ingestionId: string;
  plateId: string;
  storageKey: string;
  image: CanonicalEvidenceImage;
}

export interface ReferencePlateAttachment extends PlannedReferencePlate {
  expectedHead: EvidenceModelHead;
}

export interface ReferencePlateIngestionPersistence {
  planReferencePlate(input: PlannedReferencePlate): Promise<EvidenceModelHead>;
  markReferencePlateStored(input: PlannedReferencePlate): Promise<void>;
  attachReferencePlate(input: ReferencePlateAttachment): Promise<void>;
}

export interface StagedReferencePlate {
  plateId: string;
  mime: "image/webp";
  width: number;
  height: number;
  byteSize: number;
  contentHash: string;
  delivery: string;
}

export interface StageCanonicalReferencePlateDependencies {
  persistence: ReferencePlateIngestionPersistence;
  delivery: EvidenceDeliveryAdapter;
  generateId?: () => string;
}

function assertPositiveId(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new TypeError(`${label} must be a UUID`);
}

/**
 * Internal C2 orchestration only. No route, worker, startup hook, or production
 * delivery adapter may call this until the later reviewed C4 capability.
 */
export async function stageCanonicalReferencePlate(
  dependencies: StageCanonicalReferencePlateDependencies,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    image: CanonicalEvidenceImage;
  },
): Promise<StagedReferencePlate> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  assertUuid(input.operationId, "operationId");
  await assertCanonicalEvidenceImage(input.image);
  const generateId = dependencies.generateId ?? randomUUID;
  const ingestionId = generateId();
  const plateId = generateId();
  assertUuid(ingestionId, "ingestionId");
  assertUuid(plateId, "plateId");
  if (ingestionId === plateId || ingestionId === input.operationId || plateId === input.operationId) {
    throw new TypeError("Evidence identities must be distinct");
  }

  const storageKey = buildReferencePlateStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    plateId,
  });
  const planned: PlannedReferencePlate = {
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    ingestionId,
    plateId,
    storageKey,
    image: input.image,
  };

  const expectedHead = await dependencies.persistence.planReferencePlate(planned);
  await putCanonicalEvidence(dependencies.delivery, {
    key: storageKey,
    image: input.image,
  });
  await dependencies.persistence.markReferencePlateStored(planned);
  await dependencies.persistence.attachReferencePlate({
    ...planned,
    expectedHead,
  });
  const delivery = await resolveEvidenceOwnerDelivery(dependencies.delivery, {
    userId: input.userId,
    key: storageKey,
  });

  return {
    plateId,
    mime: input.image.mime,
    width: input.image.width,
    height: input.image.height,
    byteSize: input.image.byteSize,
    contentHash: input.image.contentHash,
    delivery,
  };
}
