import type {
  CastingEvidenceIngestionPurpose,
  ModelReferencePlateKind,
} from "../../../drizzle/schema";
import { parseEvidenceStorageKey } from "./evidenceDelivery";

export type EvidenceStoragePurpose =
  | CastingEvidenceIngestionPurpose
  | ModelReferencePlateKind
  | "evidence_crop";

/**
 * Re-prove the complete ownership encoded by an evidence key before a
 * lifecycle path exports, manifests, or deletes the corresponding row.
 */
export function assertOwnedEvidenceStorageKey(input: {
  storageKey: string;
  userId: number;
  modelId: number;
  purpose: EvidenceStoragePurpose;
}): void {
  const parsed = parseEvidenceStorageKey(input.storageKey);
  const expectedKind = input.purpose === "evidence_crop"
    ? "crop"
    : "plate";
  if (
    parsed.userId !== input.userId
    || parsed.modelId !== input.modelId
    || parsed.kind !== expectedKind
  ) {
    throw new Error("Evidence key ownership is invalid");
  }
}
