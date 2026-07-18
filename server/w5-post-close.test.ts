import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beginPendingCast,
  resetPendingCastRegistryForTests,
  subscribePendingCastOutcomes,
  type PendingCastOutcome,
} from '../client/src/features/casting/pendingCastRegistry';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('W5-F pending-cast registry', () => {
  beforeEach(resetPendingCastRegistryForTests);
  afterEach(resetPendingCastRegistryForTests);

  it('publishes one background success with one working Open Draft action', () => {
    const outcomes: PendingCastOutcome[] = [];
    let opened = -1;
    const unsubscribe = subscribePendingCastOutcomes((outcome) => outcomes.push(outcome));
    const cast = beginPendingCast((modelId) => { opened = modelId; });

    cast.succeedInBackground(42);
    cast.succeedInBackground(42);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ kind: 'success', modelId: 42 });
    if (outcomes[0]?.kind === 'success') outcomes[0].openDraft?.();
    expect(opened).toBe(42);
    unsubscribe();
  });

  it('publishes one background failure and never silently consumes it', () => {
    const outcomes: PendingCastOutcome[] = [];
    subscribePendingCastOutcomes((outcome) => outcomes.push(outcome));
    const cast = beginPendingCast();

    cast.failInBackground('Refund recorded; the cast failed');
    cast.failInBackground('duplicate');

    expect(outcomes).toEqual([
      { kind: 'failure', message: 'Refund recorded; the cast failed' },
    ]);
  });

  it('reports nothing through the board registry when the open surface already reported it', () => {
    const outcomes: PendingCastOutcome[] = [];
    subscribePendingCastOutcomes((outcome) => outcomes.push(outcome));
    const cast = beginPendingCast();

    cast.finishInForeground();
    cast.succeedInBackground(9);
    cast.failInBackground('late duplicate');

    expect(outcomes).toEqual([]);
  });
});

describe('W5-F wiring contracts', () => {
  it('routes post-close success and failure to the registry, not an unmounting toast owner', () => {
    const source = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    expect(source).toContain('pendingCast.succeedInBackground(modelResult.modelId!)');
    expect(source).toContain('pendingCast.failInBackground(message)');
    expect(source).toContain('pendingCast.finishInForeground()');
  });

  it('the always-mounted app owns the one success/failure notice and preserves Open Draft', () => {
    const source = read('client/src/App.tsx');
    expect(source).toContain('subscribePendingCastOutcomes');
    expect(source).toContain("label: 'Open Draft'");
    expect(source).toContain("toast.error(outcome.message, { duration: 10000 })");
    expect(source).toContain('<PendingCastOutcomeToasts />');
  });

  it('guards late package writes while keeping shared per-angle progress truthful', () => {
    const source = read('client/src/features/studio/hooks/useCastGate.ts');
    expect(source).toContain('captureCastingSession');
    expect(source).toContain('if (session.isCurrent() && result.generated.length > 0)');
    expect(source).toContain('useCastingRefreshStore.getState().begin(currentModelId, missingAngles)');
    expect(source).toContain('useCastingRefreshStore.getState().end(currentModelId, missingAngles)');
    expect(source).toContain('toast.error(message)');
  });

  it('lets Add Views close during generation and tells the user the work continues', () => {
    const source = read('client/src/features/studio/components/CastModelModal.tsx');
    expect(source).toContain('You can keep editing. These views will continue generating');
    expect(source).toContain('viewsGenerating &&');
    expect(source).not.toContain('onClick={onClose} disabled={isCasting}');
  });

  it('derives continuation copy from the real missing-view count in both modal hosts', () => {
    const gate = read('client/src/features/studio/hooks/useCastGate.ts');
    expect(gate).toContain('setViewsGenerating(missingAngles.length > 0)');
    expect(read('client/src/features/studio/takeover/CastingTakeover.tsx')).toContain('viewsGenerating={viewsGenerating}');
    expect(read('client/src/pages/DrapeStudio.tsx')).toContain('viewsGenerating={viewsGenerating}');
  });
});
