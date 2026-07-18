import { describe, expect, it } from 'vitest';
import {
  dedupeVariationEdges,
  settleVariationEdges,
  type VariationEdge,
} from '../client/src/features/boards/canvas/variationEdges';

const edge = (overrides: Partial<VariationEdge> = {}): VariationEdge => ({
  id: -1,
  source: 7,
  target: -10,
  relation: 'variant_of',
  metadata: null,
  ...overrides,
});

describe('W5-D optimistic variation lineage', () => {
  it('remaps a loading candidate edge to the landed item', () => {
    expect(settleVariationEdges([edge()], new Map([[-10, 44]]))).toEqual([
      edge({ target: 44 }),
    ]);
  });

  it('removes a failed candidate edge while preserving unrelated lineage', () => {
    const unrelated = edge({ id: 8, target: 9, relation: 'forked_from' });
    expect(settleVariationEdges([edge(), unrelated], new Map([[-10, 0]]))).toEqual([
      unrelated,
    ]);
  });

  it('dedupes an optimistic remap against a fetched durable row', () => {
    const optimistic = edge({ target: 44 });
    const durable = edge({ id: 91, target: 44 });
    expect(dedupeVariationEdges([optimistic, durable])).toEqual([durable]);
  });

  it('settles multiple candidates independently', () => {
    expect(settleVariationEdges(
      [edge(), edge({ id: -2, target: -11 })],
      new Map([[-10, 44], [-11, 0]]),
    )).toEqual([edge({ target: 44 })]);
  });
});
