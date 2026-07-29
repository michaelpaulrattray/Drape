export type EvidencePackageDisplayStatus =
  | "current"
  | "stale"
  | "missing"
  | "failed"
  | "attention";

/**
 * `attention` is a closed explanation, not stale work. Only server-authorized
 * missing/stale/failed rows may make a customer-facing view look actionable.
 */
export function evidencePackageSlotNeedsAction(
  slot?: { status: EvidencePackageDisplayStatus; refusal: string | null },
): boolean {
  return Boolean(
    slot
    && slot.refusal === null
    && (
      slot.status === "stale"
      || slot.status === "missing"
      || slot.status === "failed"
    ),
  );
}

/**
 * Compatibility truth and action authority are deliberately separate.
 * A safety-closed projection may not expose a paid action, but the selected
 * pre-evidence image must still look out of sync when its snapshot slot is
 * stale.
 */
export function evidencePackageSlotIsOutOfSync(input: {
  packageStale: boolean;
  evidenceSlot?: {
    status: EvidencePackageDisplayStatus;
    refusal: string | null;
  };
}): boolean {
  return input.packageStale
    || evidencePackageSlotNeedsAction(input.evidenceSlot);
}

export function evidencePackageRefusalMessage(
  refusal: string | null | undefined,
): string | null {
  if (refusal === "projection_not_calibrated") {
    return "Tattoo coverage is unavailable for this view in this release.";
  }
  return null;
}
