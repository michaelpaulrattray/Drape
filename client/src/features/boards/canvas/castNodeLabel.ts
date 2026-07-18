import { honestModelName } from '@/features/casting/modelDisplayTruth';

/** Model-linked placements follow the source model's live name until the user
 * explicitly gives this one node a custom board label. */
export function resolveCastPlacementLabel(input: {
  itemLabel?: string | null;
  sourceName?: string | null;
  customLabel?: boolean;
}): string {
  if (input.customLabel) {
    const custom = (input.itemLabel ?? '').trim();
    if (custom) return custom;
  }
  return honestModelName(input.sourceName, input.itemLabel) || 'Cast';
}

/** Preserve all existing canvas metadata while recording that Rename is a
 * placement-only override, never a model rename. */
export function withPlacementCustomLabel(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return { ...(metadata ?? {}), customLabel: true };
}
