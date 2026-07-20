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

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('W6-A casting-operation adapter', () => {
  beforeEach(resetPendingCastRegistryForTests);
  afterEach(resetPendingCastRegistryForTests);

  it('captures and remaps the origin, binds the model, mirrors angles, and settles exactly once', () => {
    const events: CastingOperationEvent[] = [];
    registerCastingOperationOriginProvider(() => ({ boardId: 7, itemId: -4 }));
    subscribeCastingOperations((event) => events.push(event));

    const operation = beginCastingOperation({
      kind: 'newCast',
      angles: ['frontClose'],
      clientRequestIds: ['00000000-0000-4000-8000-000000000001'],
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
      clientRequestIds: ['00000000-0000-4000-8000-000000000001'],
    });

    operation.succeed({
      modelId: 42,
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
    expect(getActiveCastingOperations()).toEqual([]);
  });

  it('publishes one refund-honest background failure and clears angle truth', () => {
    const events: CastingOperationEvent[] = [];
    subscribeCastingOperations((event) => events.push(event));
    const operation = beginCastingOperation({
      kind: 'iterate',
      modelId: 9,
      angles: ['sideClose'],
      clientRequestIds: ['00000000-0000-4000-8000-000000000002'],
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
  });

  it('still publishes foreground settlement so the originating node job cannot stick', () => {
    const events: CastingOperationEvent[] = [];
    subscribeCastingOperations((event) => events.push(event));
    const operation = beginCastingOperation({
      kind: 'newCast',
      angles: ['frontClose'],
      clientRequestIds: ['00000000-0000-4000-8000-000000000003'],
    });
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

  it('the always-mounted app delegates durable progress and landing to the server bridge', () => {
    const source = read('client/src/App.tsx');
    expect(source).toContain('<GenerationOperationBridge />');
    expect(source).not.toContain('function CastingOperationOwner');
    expect(source).not.toContain('fillFromLibrary');
    const bridge = read('client/src/features/operations/GenerationOperationBridge.tsx');
    expect(bridge).toContain('syncServerOperations(operations)');
    expect(bridge).toContain('settled.landedNow');
    expect(bridge).toContain('settled.acknowledgedNow');
    expect(bridge).toContain('operationDedupeKey(operation)');
    const board = read('client/src/features/boards/BoardPage.tsx');
    expect(board).not.toContain('owner.completeJob(origin.itemId)');
    expect(board).not.toContain('clearJob(origin.itemId)');
  });

  it('keeps session guards while moving per-angle progress into the registry', () => {
    const source = read('client/src/features/studio/hooks/useCastGate.ts');
    expect(source).toContain('captureCastingSession');
    expect(source).toContain("kind: stayDraft || upgrade ? 'addViews' : 'mint'");
    expect(source).toContain('durable receipt and child rows');
    expect(source).not.toContain('useCastingRefreshStore.getState().begin');
    expect(source).not.toContain('useCastingRefreshStore.getState().end');
    expect(source).toContain('notifyFailure: false');
  });

  it('allows durable mint and Add Views work to detach with honest leave copy', () => {
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(takeover).not.toContain("isCasting && castingOperation === 'mint'");
    expect(takeover).toContain('Your new views will keep generating and appear on this card');
    expect(takeover).toContain('Closing detaches this surface');
  });

  it('rejoins a matching model through durable server truth without weakening the W4 session token', () => {
    const workspace = read('client/src/features/studio/components/CastingWorkspace.tsx');
    expect(workspace).toContain('selectStudioOperation(matching, currentModelId)');
    expect(workspace).toContain('utils.models.get.fetch({ modelId: currentModelId })');
    expect(workspace).toContain('currentModelId === currentModelId');
    expect(workspace).not.toContain('event.outcome.assets');
    expect(workspace).not.toContain('subscribeCastingOperations');
  });
});
