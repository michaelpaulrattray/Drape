import { describe, expect, it } from 'vitest';
import type { GenerationOperationDto } from '@/features/operations/generationOperationProjection';
import {
  operationPhaseLabel,
  projectRefreshingByModel,
  selectStudioOperation,
} from '@/features/operations/generationOperationProjection';

const NOW = '2026-07-20T00:00:00.000Z';

function operation(overrides: Partial<GenerationOperationDto> = {}): GenerationOperationDto {
  return {
    operationId: '6fa459ea-ee8a-4ca4-894e-db77e160355e',
    clientRequestId: '7fa459ea-ee8a-4ca4-894e-db77e160355f',
    kind: 'casting.refresh',
    modelId: 44,
    originBoardId: null,
    originItemId: null,
    status: 'running',
    phase: 'refreshing',
    progress: null,
    plannedCredits: 1_500,
    chargedCredits: 600,
    refundedCredits: 0,
    netCredits: 600,
    result: null,
    publicMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    heartbeatAt: NOW,
    leaseExpiresAt: NOW,
    cancellable: false,
    landingStatus: 'not_applicable',
    landedItemId: null,
    landingAcknowledgedAt: null,
    children: [],
    ...overrides,
  };
}

function child(
  id: number,
  viewAngle: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
) {
  return {
    id,
    stepKey: `slot:${viewAngle}`,
    viewAngle,
    status,
    pointsCost: 300,
    createdAt: NOW,
    completedAt: status === 'completed' || status === 'failed' ? NOW : null,
  };
}

describe('R7-2E durable Studio operation projection', () => {
  it('rehydrates only unfinished angles after reload, including a six-angle partial run', () => {
    const refresh = operation({
      children: [
        child(1, 'frontClose', 'completed'),
        child(2, 'threeQuarter', 'processing'),
        child(3, 'sideClose', 'pending'),
        child(4, 'frontFull', 'failed'),
        child(5, 'sideFull', 'completed'),
        child(6, 'backFull', 'processing'),
      ],
    });
    expect(projectRefreshingByModel([refresh])).toEqual({
      44: ['threeQuarter', 'sideClose', 'backFull'],
    });
  });

  it('falls back to receipt progress when child rows are not yet visible', () => {
    const refresh = operation({
      progress: {
        total: 2,
        completed: 0,
        failed: 0,
        steps: [
          { stepKey: 'slot:sideClose', viewAngle: 'sideClose', status: 'processing' },
          { stepKey: 'slot:backFull', viewAngle: 'backFull', status: 'pending' },
        ],
      },
    });
    expect(projectRefreshingByModel([refresh])).toEqual({ 44: ['sideClose', 'backFull'] });
  });

  it('stops spinning terminal work and never projects unknown angles', () => {
    expect(projectRefreshingByModel([
      operation({ status: 'partial', completedAt: NOW, children: [child(1, 'sideClose', 'pending')] }),
      operation({
        operationId: '8fa459ea-ee8a-4ca4-894e-db77e160356a',
        clientRequestId: '9fa459ea-ee8a-4ca4-894e-db77e160356b',
        children: [child(2, 'legacySide', 'processing')],
      }),
    ])).toEqual({});
  });

  it('isolates models and chooses recovery before running, then running before claimed', () => {
    const claimed = operation({ kind: 'casting.iterate', status: 'claimed', phase: 'planning' });
    const running = operation({
      operationId: '8fa459ea-ee8a-4ca4-894e-db77e160356a',
      clientRequestId: '9fa459ea-ee8a-4ca4-894e-db77e160356b',
      kind: 'casting.iterate',
      updatedAt: '2026-07-20T00:00:01.000Z',
    });
    const recovery = operation({
      operationId: 'afa459ea-ee8a-4ca4-894e-db77e160356c',
      clientRequestId: 'bfa459ea-ee8a-4ca4-894e-db77e160356d',
      kind: 'casting.iterate',
      status: 'recovery_required',
      phase: 'reconciling',
      publicMessage: 'Support needs to check this result.',
      updatedAt: '2026-07-20T00:00:02.000Z',
    });
    const anotherModel = operation({
      operationId: 'cfa459ea-ee8a-4ca4-894e-db77e160356e',
      clientRequestId: 'dfa459ea-ee8a-4ca4-894e-db77e160356f',
      kind: 'casting.iterate',
      modelId: 45,
      status: 'recovery_required',
    });

    expect(selectStudioOperation([claimed, running], 44)?.operationId).toBe(running.operationId);
    expect(selectStudioOperation([claimed, running, recovery, anotherModel], 44)?.operationId)
      .toBe(recovery.operationId);
    expect(operationPhaseLabel(recovery)).toBe('Support needs to check this result.');
    expect(selectStudioOperation([anotherModel], 44)).toBeNull();
  });

  it('keeps refresh and Add Views on the per-angle strip instead of blocking the whole viewer', () => {
    expect(selectStudioOperation([operation()], 44)).toBeNull();
    expect(selectStudioOperation([operation({ kind: 'casting.add_views' })], 44)).toBeNull();
  });
});
