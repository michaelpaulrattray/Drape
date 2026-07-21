import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { staledAnglesForAssetIds } from './casting/identity/staleResponse';
import { useCastingRefreshStore } from '../client/src/features/casting/stores/useCastingRefreshStore';
import type { GenerationOperationDto } from '../client/src/features/operations/generationOperationProjection';
import { shouldClearIdentityWarning } from '../client/src/features/casting/hooks/useCastingPackageRefresh';
import { addTierForAngle } from '../client/src/features/casting/components/ImageViewer/ViewTabs';
import { SINGLE_VIEW_PROMPTS } from './casting/geminiViews';

const root = path.join(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('W3 stale response truth', () => {
  it('returns exactly the canonical angles written stale, without duplicates or unknown rows', () => {
    const assets = [
      { id: 10, viewType: 'sideClose' },
      { id: 11, viewType: 'threeQuarter' },
      { id: 12, viewType: 'legacy-side' },
      { id: 13, viewType: 'sideClose' },
    ];
    expect(staledAnglesForAssetIds(assets, [10, 11, 12, 13, 999])).toEqual(['sideClose', 'threeQuarter']);
  });

  it('the identity response carries angles plus the ratified sibling copy; image-only returns none', () => {
    const source = read('server/routes/generation/castingRefinement.ts');
    expect(source).toContain('const staledAngles = staledAnglesForAssetIds(assets, commit.staledAssetIds)');
    expect(source).toContain('result: { assetId: commit.assetId, identityChanged: true, staledAngles }');
    expect(source).toContain('staleMessage: REFUSAL_COPY.siblingsNeedRefresh');
    expect(source).toContain('staledAngles: []');
  });
});

const OPERATION_NOW = '2026-07-20T00:00:00.000Z';

function refreshOperation(
  overrides: Partial<GenerationOperationDto> = {},
): GenerationOperationDto {
  return {
    operationId: '6fa459ea-ee8a-4ca4-894e-db77e160355e',
    clientRequestId: '7fa459ea-ee8a-4ca4-894e-db77e160355f',
    kind: 'casting.refresh',
    modelId: 7,
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
    createdAt: OPERATION_NOW,
    updatedAt: OPERATION_NOW,
    completedAt: null,
    heartbeatAt: OPERATION_NOW,
    leaseExpiresAt: OPERATION_NOW,
    cancellable: false,
    landingStatus: 'not_applicable',
    landedItemId: null,
    landingAcknowledgedAt: null,
    children: [],
    ...overrides,
  };
}

describe('W3 durable in-flight projection', () => {
  beforeEach(() => useCastingRefreshStore.setState({
    refreshingByModel: {},
    localRefreshingByModel: {},
    detailsOpen: false,
  }));

  it('hydrates pending per-angle truth from durable children and drops settled work', () => {
    const child = (id: number, viewAngle: string, status: 'pending' | 'processing' | 'completed' | 'failed') => ({
      id,
      stepKey: `slot:${viewAngle}`,
      viewAngle,
      status,
      pointsCost: 300,
      createdAt: OPERATION_NOW,
      completedAt: status === 'completed' || status === 'failed' ? OPERATION_NOW : null,
    });
    const running = refreshOperation({
      children: [
        child(1, 'frontClose', 'completed'),
        child(2, 'threeQuarter', 'processing'),
        child(3, 'sideClose', 'pending'),
        child(4, 'frontFull', 'failed'),
        child(5, 'sideFull', 'completed'),
        child(6, 'backFull', 'processing'),
      ],
    });
    const terminal = refreshOperation({
      operationId: '8fa459ea-ee8a-4ca4-894e-db77e160356a',
      clientRequestId: '9fa459ea-ee8a-4ca4-894e-db77e160356b',
      modelId: 8,
      status: 'partial',
      completedAt: OPERATION_NOW,
      children: [child(7, 'sideFull', 'pending')],
    });

    useCastingRefreshStore.getState().syncServerOperations([running, terminal]);
    expect(useCastingRefreshStore.getState().refreshingByModel).toEqual({
      7: ['threeQuarter', 'sideClose', 'backFull'],
    });

    useCastingRefreshStore.getState().syncServerOperations([]);
    expect(useCastingRefreshStore.getState().refreshingByModel).toEqual({});
  });

  it('shares immediate local refresh truth without erasing another angle', () => {
    const store = useCastingRefreshStore.getState();
    store.beginLocalRefresh(7, ['sideClose']);
    useCastingRefreshStore.getState().beginLocalRefresh(7, ['backFull', 'sideClose']);
    expect(useCastingRefreshStore.getState().localRefreshingByModel[7]).toEqual(['sideClose', 'backFull']);

    useCastingRefreshStore.getState().endLocalRefresh(7, ['sideClose']);
    expect(useCastingRefreshStore.getState().localRefreshingByModel[7]).toEqual(['backFull']);
    useCastingRefreshStore.getState().endLocalRefresh(7, ['backFull']);
    expect(useCastingRefreshStore.getState().localRefreshingByModel).toEqual({});
  });
});

describe('W3 package-health wiring', () => {
  it('reuses server plan/refresh/restore/pin truth and preserves real refresh asset ids', () => {
    const dialog = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    const refresh = read('client/src/features/casting/hooks/useCastingPackageRefresh.ts');
    const history = read('client/src/features/casting/components/SlotVersionHistory.tsx');
    for (const contract of ['refreshSlotsPlan', 'setSlotPinned']) {
      expect(dialog).toContain(contract);
    }
    expect(history).toContain('restoreSlotVersion');
    expect(dialog).toContain('useCastingPackageRefresh');
    expect(refresh).toContain('refreshSlots.useMutation');
    expect(read('server/casting/refreshSlots.ts')).toContain('assetId: r.assetId!');
  });

  it('is reachable from the Studio strip and both mint hosts', () => {
    expect(read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx')).toContain('openCastingDetails');
    expect(read('client/src/features/studio/takeover/CastingTakeover.tsx')).toContain('onResolvePackage={() => openCastingDetails()}');
    expect(read('client/src/pages/DrapeStudio.tsx')).toContain('onResolvePackage={() => openCastingDetails()}');
  });

  it('uses one server-backed refresh projection in Canvas and Studio', () => {
    const canvas = read('client/src/features/boards/canvas/nodes/useSheetController.ts');
    const studio = read('client/src/features/casting/hooks/useCastingPackageRefresh.ts');
    const history = read('client/src/features/casting/components/SlotVersionHistory.tsx');
    const bridge = read('client/src/features/operations/GenerationOperationBridge.tsx');
    expect(canvas).toContain('useCastingRefreshStore');
    expect(studio).toContain('useCastingRefreshStore');
    expect(bridge).toContain('syncServerOperations(operations)');
    expect(canvas).not.toContain('.begin(targetModelId');
    expect(canvas).not.toContain('.end(targetModelId');
    expect(studio).toContain('castingState.currentModelId === variables.modelId');
    expect(history).toContain('castingState.currentModelId === result.modelId');
  });

  it('lets Versions & details own Escape without closing the surrounding takeover', () => {
    const dialog = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(dialog).toContain('s.detailsOpen');
    expect(dialog).toContain('s.setDetailsOpen');
    expect(takeover).toContain('s.detailsOpen');
    expect(takeover).toContain('identityDialog || detailsOpen');

    useCastingRefreshStore.getState().setDetailsOpen(true);
    expect(useCastingRefreshStore.getState().detailsOpen).toBe(true);
    useCastingRefreshStore.getState().setDetailsOpen(false);
    expect(useCastingRefreshStore.getState().detailsOpen).toBe(false);
  });
});

describe('W3 prompt and copy honesty', () => {
  const wardrobe = 'Attire: black casting basics.';

  it('uses one unambiguous frame-relative direction for Side and Three-quarter', () => {
    for (const prompt of [
      SINGLE_VIEW_PROMPTS.sideClose(wardrobe),
      SINGLE_VIEW_PROMPTS.sideFull(wardrobe),
      SINGLE_VIEW_PROMPTS.threeQuarter(wardrobe),
    ]) {
      expect(prompt).toContain('RIGHT EDGE OF THE OUTPUT FRAME');
    }
    expect(SINGLE_VIEW_PROMPTS.sideClose(wardrobe)).toContain('true 90-degree profile');
    expect(SINGLE_VIEW_PROMPTS.threeQuarter(wardrobe)).toContain('both eyes remain visible');
  });

  it('does not teach retired history controls and limits mark placement claims', () => {
    const loading = read('client/src/features/casting/components/ImageViewer/LoadingOverlay.tsx');
    expect(loading).not.toContain('Undo and redo preserve your full history');
    expect(loading).not.toContain('Drag the history slider');
    const views = read('server/casting/geminiViews.ts');
    expect(views).toContain('never move or mirror it onto another body surface');
  });
});

describe('W5-B strip and warning truth', () => {
  it('clears the warning only after fully fresh server truth and no in-flight view', () => {
    const fresh = [{ stale: false, failed: null }, { stale: false, failed: null }];
    expect(shouldClearIdentityWarning(fresh, [])).toBe(true);
    expect(shouldClearIdentityWarning([{ stale: true, failed: null }], [])).toBe(false);
    expect(shouldClearIdentityWarning([{ stale: false, failed: { reason: 'failed' } }], [])).toBe(false);
    expect(shouldClearIdentityWarning(fresh, ['sideClose'])).toBe(false);
  });

  it('refetches server package truth before clearing the client warning', () => {
    const refresh = read('client/src/features/casting/hooks/useCastingPackageRefresh.ts');
    expect(refresh).toContain('packageState.fetch({ modelId: variables.modelId })');
    expect(refresh).toContain('shouldClearIdentityWarning(freshPackage.slots, remaining)');
    expect(refresh).toContain('castingState.setIdentityWarning(null)');
  });

  it('makes the strip the primary package-care surface with direct, priced actions', () => {
    const strip = read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx');
    for (const contract of ['ViewThumbnail', 'isStale', 'isRefreshing', 'FailedSlot', 'GhostSlot', 'RefreshingSlot']) {
      expect(strip).toContain(contract);
    }
    expect(strip).toContain('aria-busy={isRefreshing || undefined}');
    expect(strip).toContain('refreshAngles([vt])');
    expect(strip).toContain('Refresh all');
    expect(strip).toContain('credits');
    expect(strip).not.toContain('Stale dot');
    expect(strip).not.toContain("'Package health'");
    expect(strip).not.toContain('refreshSlots.useMutation');
  });

  it('routes a missing slot to the smallest existing tier that actually contains it', () => {
    expect(addTierForAngle('frontClose')).toBe('draft');
    for (const angle of ['sideClose', 'threeQuarter', 'frontFull'] as const) {
      expect(addTierForAngle(angle)).toBe('core');
    }
    for (const angle of ['sideFull', 'backFull'] as const) {
      expect(addTierForAngle(angle)).toBe('production');
    }
  });
});
