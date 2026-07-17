import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { staledAnglesForAssetIds } from './casting/identity/staleResponse';
import { useCastingRefreshStore } from '../client/src/features/casting/stores/useCastingRefreshStore';
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
    expect(source).toContain('staledAngles: staledAnglesForAssetIds(assets, commit.staledAssetIds)');
    expect(source).toContain('staleMessage: REFUSAL_COPY.siblingsNeedRefresh');
    expect(source).toContain('staledAngles: []');
  });
});

describe('W3 shared in-flight registry', () => {
  beforeEach(() => useCastingRefreshStore.setState({ refreshingByModel: {}, packageHealthOpen: false }));

  it('reference-counts overlapping angles per model without touching another model', () => {
    const store = useCastingRefreshStore.getState();
    store.begin(7, ['sideClose', 'threeQuarter']);
    store.begin(7, ['sideClose', 'backFull']);
    store.begin(8, ['sideFull']);
    expect(useCastingRefreshStore.getState().refreshingByModel[7]).toEqual(['sideClose', 'threeQuarter', 'sideClose', 'backFull']);
    useCastingRefreshStore.getState().end(7, ['sideClose', 'backFull']);
    expect(useCastingRefreshStore.getState().refreshingByModel[7]).toEqual(['threeQuarter', 'sideClose']);
    useCastingRefreshStore.getState().end(7, ['sideClose']);
    expect(useCastingRefreshStore.getState().refreshingByModel[7]).toEqual(['threeQuarter']);
    expect(useCastingRefreshStore.getState().refreshingByModel[8]).toEqual(['sideFull']);
  });
});

describe('W3 package-health wiring', () => {
  it('reuses server plan/refresh/restore/pin truth and preserves real refresh asset ids', () => {
    const dialog = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    for (const contract of ['refreshSlotsPlan', 'refreshSlots.useMutation', 'restoreSlotVersion', 'setSlotPinned']) {
      expect(dialog).toContain(contract);
    }
    expect(read('server/casting/refreshSlots.ts')).toContain('assetId: r.assetId!');
  });

  it('is reachable from the Studio strip and both mint hosts', () => {
    expect(read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx')).toContain('openPackageHealth');
    expect(read('client/src/features/studio/takeover/CastingTakeover.tsx')).toContain('onResolvePackage={() => openPackageHealth()}');
    expect(read('client/src/pages/DrapeStudio.tsx')).toContain('onResolvePackage={() => openPackageHealth()}');
  });

  it('uses one shared refresh registry in Canvas and Studio', () => {
    const canvas = read('client/src/features/boards/canvas/nodes/useSheetController.ts');
    const studio = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    expect(canvas).toContain('useCastingRefreshStore');
    expect(canvas).toContain('endRefresh(targetModelId, angles)');
    expect(studio).toContain('useCastingRefreshStore');
    expect(studio).toContain('castingState.currentModelId === variables.modelId');
    expect(studio).toContain('castingState.currentModelId === result.modelId');
  });

  it('lets Package health own Escape without closing the surrounding takeover', () => {
    const dialog = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(dialog).toContain('s.packageHealthOpen');
    expect(dialog).toContain('s.setPackageHealthOpen');
    expect(takeover).toContain('s.packageHealthOpen');
    expect(takeover).toContain('identityDialog || packageHealthOpen');

    useCastingRefreshStore.getState().setPackageHealthOpen(true);
    expect(useCastingRefreshStore.getState().packageHealthOpen).toBe(true);
    useCastingRefreshStore.getState().setPackageHealthOpen(false);
    expect(useCastingRefreshStore.getState().packageHealthOpen).toBe(false);
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
