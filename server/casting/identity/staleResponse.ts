import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from '../../../shared/boardTypes';

const CANONICAL = new Set<string>(CANONICAL_VIEW_ANGLES);

/** Translate the exact stale-writer row ids into stable wire angles. */
export function staledAnglesForAssetIds(
  assets: Array<{ id: number; viewType: string }>,
  staledAssetIds: number[],
): CanonicalViewAngle[] {
  const staleIds = new Set(staledAssetIds);
  return Array.from(new Set(
    assets
      .filter((asset) => staleIds.has(asset.id) && CANONICAL.has(asset.viewType))
      .map((asset) => asset.viewType as CanonicalViewAngle),
  ));
}
