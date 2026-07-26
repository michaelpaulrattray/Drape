import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import {
  getConfiguredPrivateEvidenceStorageAdapter,
  parsePrivateEvidenceStorageConfig,
} from "./privateEvidenceStorage";

/**
 * C5C completes authenticated delivery and backend-aware cleanup routing.
 * Boot validation consumes this constant so a non-off scope cannot run
 * against a partial evidence boundary.
 */
export const EVIDENCE_PRODUCT_DELIVERY_READY = true;

export function getEvidenceDeliveryAdapter(): PrivateEvidenceStorageAdapter | null {
  return getConfiguredPrivateEvidenceStorageAdapter();
}

export function evidenceDeliveryConfigured(): boolean {
  return EVIDENCE_PRODUCT_DELIVERY_READY
    && getEvidenceDeliveryAdapter() !== null;
}

export function privateEvidenceAdapterConfigured(): boolean {
  return parsePrivateEvidenceStorageConfig(process.env) !== null;
}
