import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addTierForAngle } from '../client/src/features/casting/components/ImageViewer/ViewTabs';

const root = path.join(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('R7-4A strip-first package care', () => {
  it('routes missing views through the smallest existing package tier that contains them', () => {
    expect(addTierForAngle('frontClose')).toBe('draft');
    expect(addTierForAngle('sideClose')).toBe('core');
    expect(addTierForAngle('threeQuarter')).toBe('core');
    expect(addTierForAngle('frontFull')).toBe('core');
    expect(addTierForAngle('sideFull')).toBe('production');
    expect(addTierForAngle('backFull')).toBe('production');
  });

  it('shows direct priced repair actions while healthy views stay quiet', () => {
    const strip = read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx');
    expect(strip).toContain('Refresh ${label} for ${refreshCost.toLocaleString()} credits');
    expect(strip).toContain("cost={plan?.refusal === null ? plan.cost : undefined}");
    expect(strip).toContain('Refresh all<br />{actionableCost.toLocaleString()} credits');
    expect(strip).toContain("const pinningAvailable = packageQuery.data?.pinningAvailable !== false");
    expect(strip).toContain("(pinningAvailable && slot.stale && slot.pinned)");
    expect(strip).not.toContain('Stale dot');
    expect(strip).not.toContain("'Package health'");
  });

  it('uses one shared refresh mutation and only invokes it from deliberate click handlers', () => {
    const strip = read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx');
    const details = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    const refresh = read('client/src/features/casting/hooks/useCastingPackageRefresh.ts');

    expect(strip).toContain('useCastingPackageRefresh(currentModelId)');
    expect(details).toContain('useCastingPackageRefresh(modelId)');
    expect(strip).not.toContain('refreshSlots.useMutation');
    expect(details).not.toContain('refreshSlots.useMutation');
    expect(refresh.match(/refreshSlots\.useMutation/g)).toHaveLength(1);
    expect(refresh).toContain('const refreshAngles = useCallback');
    expect(refresh).not.toMatch(/useEffect[\s\S]{0,300}refreshAngles\(/);
  });

  it('carries the selected missing-view tier through both Studio hosts', () => {
    const strip = read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx');
    const modal = read('client/src/features/studio/components/CastModelModal.tsx');
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    const studio = read('client/src/pages/DrapeStudio.tsx');

    expect(strip).toContain('{ detail: { tier } }');
    expect(modal).toContain('initialTier?: MintTier');
    expect(modal).toContain('if (isOpen) setTier(initialTier)');
    for (const host of [takeover, studio]) {
      expect(host).toContain('detail?.tier');
      expect(host).toContain('setRequestedTier(tierFromEvent(event))');
      expect(host).toContain('initialTier={requestedTier}');
    }
  });

  it('keeps server planning authoritative before refresh credits move', () => {
    const route = read('server/routes/generation/castingExport.ts');
    const executor = read('server/casting/refreshSlots.ts');
    expect(route).toContain('planRefreshSlots({');
    expect(route).toContain('angles: input.angles,');
    expect(route).toContain('readMode,');
    expect(executor).toContain('// Structural refusals before any money moves');
    expect(executor).toContain('await deductPoints(');
  });
});
