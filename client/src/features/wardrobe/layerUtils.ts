/**
 * Client-side garment layer hierarchy utilities.
 *
 * Mirrors server/wardrobe/utils.ts INNER_LAYER_TAGS / OUTER_LAYER_TAGS
 * so LayersPanel can render inner/outer nesting without a server call.
 */

const INNER_LAYER_TAGS = [
  "tights", "leggings", "compression", "thermal", "stockings", "pantyhose",
  "undershirt", "camisole", "tank", "sports-bra", "bralette",
  "liner", "slip", "base-layer", "fitted", "skin-tight",
];

const OUTER_LAYER_TAGS = [
  "cargo", "jeans", "trousers", "chinos", "wide-leg", "straight-leg",
  "jacket", "coat", "blazer", "puffer", "parka", "overcoat", "bomber",
  "oversized", "baggy", "relaxed", "layering-piece",
];

/**
 * Returns 0 for inner-layer garments, 10 for outer-layer, 5 for neutral.
 */
export function getIntraCategoryWeight(
  garment: { tags?: string[] | unknown; description?: string | null },
): number {
  const tags = (Array.isArray(garment.tags) ? garment.tags : []).map(
    (t: string) => t.toLowerCase(),
  );
  const desc = (garment.description || "").toLowerCase();

  const hasInnerTag = tags.some((t) =>
    INNER_LAYER_TAGS.some((inner) => t.includes(inner)),
  );
  const hasOuterTag = tags.some((t) =>
    OUTER_LAYER_TAGS.some((outer) => t.includes(outer)),
  );
  const descHasInner = INNER_LAYER_TAGS.some((inner) => desc.includes(inner));
  const descHasOuter = OUTER_LAYER_TAGS.some((outer) => desc.includes(outer));

  if (hasInnerTag || descHasInner) return 0;
  if (hasOuterTag || descHasOuter) return 10;
  return 5;
}

/** Canonical render order for slot types (bottom-up layering). */
export const LAYER_ORDER = [
  "shoes",
  "bottoms",
  "tops",
  "accessories",
  "full_look",
] as const;

export type LayerGroup<T> = {
  garment: T;
  children: T[];
};

/**
 * Groups garments by slot type in LAYER_ORDER, nesting inner-layer items
 * under their outer-layer counterpart within the same category.
 */
export function buildHierarchy<
  T extends { id: number; slotType: string; tags?: string[] | unknown; description?: string | null },
>(garments: T[]): LayerGroup<T>[] {
  const groups: LayerGroup<T>[] = [];
  const byType: Record<string, T[]> = {};

  garments.forEach((g) => {
    if (!byType[g.slotType]) byType[g.slotType] = [];
    byType[g.slotType].push(g);
  });

  LAYER_ORDER.forEach((type) => {
    const items = byType[type];
    if (!items) return;

    const inners = items.filter((g) => getIntraCategoryWeight(g) === 0);
    const outers = items.filter((g) => getIntraCategoryWeight(g) > 0);

    if (outers.length > 0) {
      outers.forEach((outer) =>
        groups.push({ garment: outer, children: inners }),
      );
    } else {
      items.forEach((g) => groups.push({ garment: g, children: [] }));
    }
  });

  return groups;
}
