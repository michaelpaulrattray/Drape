import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beginCastingOperation,
  getActiveCastingOperations,
  registerCastingOperationOriginProvider,
  remapCastingOperationOriginItem,
  resetPendingCastRegistryForTests,
  subscribeCastingOperations,
  type CastingOperationEvent,
} from '../client/src/features/casting/pendingCastRegistry';
import { useCastingRefreshStore } from '../client/src/features/casting/stores/useCastingRefreshStore';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('W6-A casting-operation registry', () => {
  beforeEach(resetPendingCastRegistryForTests);
  afterEach(resetPendingCastRegistryForTests);

  it('captures and remaps the origin, binds the model, mirrors angles, and settles exactly once', () => {
    const events: CastingOperationEvent[] = [];
    let opened: { modelId: number; landed: boolean } | null = null;
    registerCastingOperationOriginProvider(() => ({ boardId: 7, itemId: -4 }));
    subscribeCastingOperations((event) => events.push(event));

    const operation = beginCastingOperation({
      kind: 'newCast',
      angles: ['frontClose'],
      openDraft: (modelId, landed) => { opened = { modelId, landed }; },
    });
    expect(events[0]).toMatchObject({
      phase: 'begin',
      operation: { kind: 'newCast', origin: { boardId: 7, itemId: -4 }, modelId: null },
    });

    remapCastingOperationOriginItem(-4, 14);
    operation.setModelId(42);
    expect(getActiveCastingOperations(42)[0]).toMatchObject({
      origin: { boardId: 7, itemId: 14 },
      angles: ['frontClose'],
    });
    expect(useCastingRefreshStore.getState().refreshingByModel[42]).toEqual(['frontClose']);

    operation.succeed({
      modelId: 42,
      assets: [{ angle: 'frontClose', assetId: 9, url: 'https://example.com/head.png' }],
      name: 'Haniel',
      background: true,
    });
    operation.succeed({ modelId: 42, background: true });

    const settlements = events.filter((event) => event.phase === 'settle');
    expect(settlements).toHaveLength(1);
    const settlement = settlements[0];
    expect(settlement).toMatchObject({
      phase: 'settle',
      operation: { origin: { boardId: 7, itemId: 14 } },
      outcome: { status: 'success', modelId: 42, background: true },
    });
    if (settlement?.phase === 'settle' && settlement.outcome.status === 'success') {
      settlement.outcome.openDraft?.(true);
    }
    expect(opened).toEqual({ modelId: 42, landed: true });
    expect(useCastingRefreshStore.getState().refreshingByModel[42]).toBeUndefined();
    expect(getActiveCastingOperations()).toEqual([]);
  });

  it('publishes one refund-honest background failure and clears angle truth', () => {
    const events: CastingOperationEvent[] = [];
    subscribeCastingOperations((event) => events.push(event));
    const operation = beginCastingOperation({
      kind: 'iterate',
      modelId: 9,
      angles: ['sideClose'],
    });

    operation.fail({ message: 'Refund recorded; the edit failed', background: true });
    operation.fail({ message: 'duplicate', background: true });

    expect(events.filter((event) => event.phase === 'settle')).toEqual([
      expect.objectContaining({
        phase: 'settle',
        outcome: {
          status: 'failure',
          message: 'Refund recorded; the edit failed',
          background: true,
          notifyFailure: true,
        },
      }),
    ]);
    expect(useCastingRefreshStore.getState().refreshingByModel[9]).toBeUndefined();
  });

  it('still publishes foreground settlement so the originating node job cannot stick', () => {
    const events: CastingOperationEvent[] = [];
    subscribeCastingOperations((event) => events.push(event));
    const operation = beginCastingOperation({ kind: 'newCast', angles: ['frontClose'] });
    operation.setModelId(3);
    operation.succeed({ modelId: 3, background: false });

    expect(events.at(-1)).toMatchObject({
      phase: 'settle',
      outcome: { status: 'success', background: false },
    });
  });
});

describe('W6-A wiring contracts', () => {
  it('routes fresh casts and iterations through one operation handoff', () => {
    const source = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    expect(source.match(/beginCastingOperation\(\{/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("kind: 'newCast'");
    expect(source).toContain("kind: 'iterate'");
    expect(source).toContain('castingOperation.setModelId(modelResult.modelId!)');
    expect(source).toContain('castingOperation.succeed');
    expect(source).toContain('castingOperation.fail');
  });

  it('the always-mounted app lands only an empty origin and owns the one background notice', () => {
    const source = read('client/src/App.tsx');
    expect(source).toContain('subscribeCastingOperations');
    expect(source).toContain('!item.imageUrl && !item.sourceModelId');
    expect(source).toContain('await fillFromLibraryRef.current');
    expect(source).toContain('This owner must never have a subscription gap');
    expect(source).toContain('The node job is module-scoped and can outlive BoardPage');
    expect(source).toContain('useGenerationJobs.getState()');
    expect(source).toContain('}), []);');
    expect(source).toContain("label: 'Open Draft'");
    expect(source).toContain('<CastingOperationOwner />');
    const board = read('client/src/features/boards/BoardPage.tsx');
    expect(board).not.toContain('owner.completeJob(origin.itemId)');
    expect(board).not.toContain('clearJob(origin.itemId)');
  });

  it('keeps session guards while moving per-angle progress into the registry', () => {
    const source = read('client/src/features/studio/hooks/useCastGate.ts');
    expect(source).toContain('captureCastingSession');
    expect(source).toContain("kind: 'addViews'");
    expect(source).toContain('Every missing-view run uses the registry');
    expect(source).not.toContain('useCastingRefreshStore.getState().begin');
    expect(source).not.toContain('useCastingRefreshStore.getState().end');
    expect(source).toContain('notifyFailure: false');
  });

  it('blocks a true mint only and gives Add Views an honest leave branch', () => {
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(takeover).toContain("isCasting && castingOperation === 'mint'");
    expect(takeover).toContain("isCasting && castingOperation !== 'mint'");
    expect(takeover).toContain('Your new views will keep generating and appear on this card');
  });

  it('rejoins a matching model without weakening the W4 session token', () => {
    const workspace = read('client/src/features/studio/components/CastingWorkspace.tsx');
    expect(workspace).toContain('getActiveCastingOperations');
    expect(workspace).toContain('subscribeCastingOperations');
    expect(workspace).toContain('event.operation.modelId !== liveModelId');
    expect(workspace).toContain('An earlier edit is still finishing');
  });
});
