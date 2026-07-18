import { describe, expect, it } from 'vitest';
import {
  resolveCastPlacementLabel,
  withPlacementCustomLabel,
} from '../client/src/features/boards/canvas/castNodeLabel';
import {
  itemFingerprint,
  type BoardItemRecord,
} from '../client/src/features/boards/BoardCanvas';

const boardItem = (overrides: Partial<BoardItemRecord> = {}): BoardItemRecord => ({
  id: 19,
  type: 'model',
  kind: 'cast_config',
  label: 'Cast',
  imageUrl: 'https://example.com/headshot.png',
  positionX: 100,
  positionY: 200,
  width: 280,
  height: 420,
  zIndex: 1,
  metadata: null,
  sourceModelId: 93,
  sourceDraft: true,
  sourceName: null,
  ...overrides,
});

describe('W5-C live model-name and placement-label truth', () => {
  it('uses the live source name over a stale stamped label', () => {
    expect(resolveCastPlacementLabel({
      itemLabel: 'Draft Model',
      sourceName: 'Daniel',
    })).toBe('Daniel');
  });

  it('keeps an explicit placement-only rename over later source names', () => {
    expect(resolveCastPlacementLabel({
      itemLabel: 'Hero close-up',
      sourceName: 'Daniel',
      customLabel: true,
    })).toBe('Hero close-up');
  });

  it('never exposes the internal draft sentinel as a founder-visible name', () => {
    expect(resolveCastPlacementLabel({ itemLabel: 'Draft Model' })).toBe('Cast');
  });

  it('marks a rename without discarding existing canvas metadata', () => {
    expect(withPlacementCustomLabel({ version: 3, pinned: true })).toEqual({
      version: 3,
      pinned: true,
      customLabel: true,
    });
  });

  it('rebuilds React Flow node data when the live model name changes', () => {
    expect(itemFingerprint(boardItem({ sourceName: null }))).not.toBe(
      itemFingerprint(boardItem({ sourceName: 'Haniel' })),
    );
  });

  it('still ignores position-only server echoes', () => {
    expect(itemFingerprint(boardItem({ positionX: 100, positionY: 200 }))).toBe(
      itemFingerprint(boardItem({ positionX: 640, positionY: 480 })),
    );
  });
});
