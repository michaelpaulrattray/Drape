import type { EvidenceDeliveryAdapter } from "./evidenceDelivery";
import { parsePrivateEvidenceStorageConfig } from "./privateEvidenceStorage";

/**
 * C5B installs the private adapter authority, but product traffic stays
 * unreachable until C5C lands both authenticated delivery and cleanup
 * routing. This constant is intentionally consumed by boot validation so an
 * operator cannot enable the existing ingest routes against a half-installed
 * product boundary.
 */
export const EVIDENCE_PRODUCT_DELIVERY_READY = false;

export function getEvidenceDeliveryAdapter(): EvidenceDeliveryAdapter | null {
  return null;
}

export function evidenceDeliveryConfigured(): boolean {
  return EVIDENCE_PRODUCT_DELIVERY_READY
    && getEvidenceDeliveryAdapter() !== null;
}

export function privateEvidenceAdapterConfigured(): boolean {
  return parsePrivateEvidenceStorageConfig(process.env) !== null;
}
