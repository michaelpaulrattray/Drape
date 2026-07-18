export type VariationEdge = {
  id: number;
  source: number;
  target: number;
  relation: string;
  metadata: unknown;
};

function edgeKey(edge: Pick<VariationEdge, 'source' | 'target' | 'relation'>): string {
  return `${edge.source}:${edge.target}:${edge.relation}`;
}

/** Keep exactly one cache row for a logical edge. If a server row raced an
 * optimistic row into the cache, prefer the durable (positive-id) row. */
export function dedupeVariationEdges<T extends VariationEdge>(edges: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const edge of edges) {
    const key = edgeKey(edge);
    const existing = byKey.get(key);
    if (!existing || (existing.id < 0 && edge.id > 0)) byKey.set(key, edge);
  }
  return Array.from(byKey.values());
}

/** Settle every temporary candidate edge in one pass. Mapped candidates move
 * to their landed node; failed or otherwise unlanded candidates disappear. */
export function settleVariationEdges<T extends VariationEdge>(
  edges: T[],
  landedByTempId: ReadonlyMap<number, number>,
): T[] {
  const settledTempIds = new Set(landedByTempId.keys());
  return dedupeVariationEdges(
    edges.flatMap((edge) => {
      if (edge.relation !== 'variant_of' || !settledTempIds.has(edge.target)) return [edge];
      const landedId = landedByTempId.get(edge.target);
      return landedId ? [{ ...edge, target: landedId }] : [];
    }),
  );
}
