import type { EvidenceDeliveryAdapter } from "./evidenceDelivery";

/**
 * R7-7C deliberately ships without a production evidence adapter. Founder
 * privacy policy must choose private authenticated delivery or permanent
 * public URLs before a real adapter may be installed here.
 */
export function getEvidenceDeliveryAdapter(): EvidenceDeliveryAdapter | null {
  return null;
}

export function evidenceDeliveryConfigured(): boolean {
  return getEvidenceDeliveryAdapter() !== null;
}
