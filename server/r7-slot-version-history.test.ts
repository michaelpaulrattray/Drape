import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { slotVersionAvailability } from '../client/src/features/casting/components/SlotVersionHistory';

const root = path.join(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('R7-4B coherent Cast version history', () => {
  it('classifies current, compatible, and earlier-identity rows without guessing', () => {
    expect(slotVersionAvailability({ isHead: true, revisionCompatible: false })).toBe('current');
    expect(slotVersionAvailability({ isHead: false, revisionCompatible: true })).toBe('compatible');
    expect(slotVersionAvailability({ isHead: false, revisionCompatible: false })).toBe('earlier_identity');
  });

  it('uses the same selection component in Studio and Canvas', () => {
    const details = read('client/src/features/casting/components/PackageHealthDialog.tsx');
    const canvas = read('client/src/features/boards/canvas/nodes/CastNode.tsx');
    const controller = read('client/src/features/boards/canvas/nodes/useSheetController.ts');

    expect(details).toContain('<SlotVersionHistory');
    expect(canvas).toContain('<SlotVersionHistory');
    expect(details).not.toContain('restoreSlotVersion.useMutation');
    expect(canvas).not.toContain('restoreSlotVersion.useMutation');
    expect(controller).not.toContain('restoreSlotVersion.useMutation');
  });

  it('makes the current asset and incompatible identity history explicit', () => {
    const history = read('client/src/features/casting/components/SlotVersionHistory.tsx');
    expect(history).toContain('Current version — in use');
    expect(history).toContain('Earlier identity — unavailable for this cast');
    expect(history).toContain('Earlier-identity images stay visible for reference, but cannot replace this cast.');
    expect(history).toContain("aria-pressed={version.isHead || selectedEarlier}");
  });

  it('keeps version browsing non-destructive and names copy-forward reuse honestly', () => {
    const history = read('client/src/features/casting/components/SlotVersionHistory.tsx');
    expect(history).toContain('onClick={() => setSelectedAssetId(version.isHead ? null : version.assetId)}');
    expect(history).toContain('Use this version');
    expect(history).toContain('Free · saves a new current copy and keeps the history.');
    expect(history).not.toContain("'Rollback'");
    expect(history).not.toContain("'Revert'");
  });

  it('retires Package Health language from every live client surface', () => {
    const files = [
      'client/src/features/casting/components/PackageHealthDialog.tsx',
      'client/src/features/casting/components/ImageViewer/ViewTabs.tsx',
      'client/src/features/casting/components/ImageViewer/LoadingOverlay.tsx',
      'client/src/features/casting/components/CastProfilePanel.tsx',
      'client/src/features/studio/components/CastModelModal.tsx',
    ];
    for (const file of files) {
      expect(read(file).toLowerCase()).not.toContain('package health');
    }
  });

  it('shares immediate local refresh progress across the strip and Details', () => {
    const store = read('client/src/features/casting/stores/useCastingRefreshStore.ts');
    const hook = read('client/src/features/casting/hooks/useCastingPackageRefresh.ts');
    expect(store).toContain('localRefreshingByModel');
    expect(hook).toContain('beginLocalRefresh(targetModelId, angles)');
    expect(hook).toContain('endLocalRefresh(variables.modelId, variables.angles)');
  });
});
