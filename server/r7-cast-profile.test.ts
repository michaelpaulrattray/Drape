/** R7-3A dedicated minted Cast Profile contracts. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('R7-3A minted Cast Profile', () => {
  it('is a dedicated read-only identity surface rather than the authoring panel', () => {
    const profile = read('client/src/features/casting/components/CastProfilePanel.tsx');

    expect(profile).toContain('data-cast-profile');
    expect(profile).toContain('Cast profile');
    expect(profile).toContain('This identity is locked');
    expect(profile).not.toContain('referenceImage');
    expect(profile).not.toContain('handleRefineSubmit');
    expect(profile).not.toContain('updatePref(');
  });

  it('keeps metadata, package truth, versions and the explicit package action together', () => {
    const profile = read('client/src/features/casting/components/CastProfilePanel.tsx');

    expect(profile).toContain('castingIdentityLabel');
    expect(profile).toContain('packageState.useQuery');
    expect(profile).toContain('mintPackagePlan.useQuery');
    expect(profile).toContain('tiers.production.cost');
    expect(profile).toContain('Versions & package details');
    expect(profile).toContain('Complete card');
  });

  it('allows display-name metadata without exposing any visual identity writer', () => {
    const profile = read('client/src/features/casting/components/CastProfilePanel.tsx');

    expect(profile).toContain('trpc.models.update.useMutation()');
    expect(profile).toContain("updateName.mutateAsync({ modelId: currentModelId, name: nextName })");
    expect(profile).toContain('Rename cast');
    expect(profile).not.toContain('models.create');
    expect(profile).not.toContain('generation.iterate');
  });

  it('routes identity change only through Fork and keeps export library-owned', () => {
    const profile = read('client/src/features/casting/components/CastProfilePanel.tsx');

    expect(profile).toContain('Fork as new model');
    expect(profile).toContain('Fork from Canvas');
    expect(profile).toContain('this cast stays unchanged');
    expect(profile).toContain("navigate('/app/models')");
    expect(profile).toContain('Export from Model Library');
  });

  it('removes the left form and composer for minted sessions in both hosts', () => {
    const workspace = read('client/src/features/studio/components/CastingWorkspace.tsx');
    const viewer = read('client/src/features/casting/ImageViewerPanel.tsx');
    const modes = read('client/src/features/casting/castingAuthoringMode.ts');

    expect(modes).toContain('if (isReadOnly || mintedEdit) return false');
    expect(workspace).toContain('const showCastProfile = shouldShowCastProfile(authoringMode)');
    expect(workspace).toContain('<CastProfilePanel onFork={onForkMinted} onCompleteCard={openPackageUpgrade} />');
    expect(workspace).toContain('isReadOnly={isReadOnly || mintedEdit}');
    expect(viewer).toContain('hasAssets && profileLocked');
    expect(viewer).toContain('data-cast-profile-lock');
    expect(viewer).toContain("Fork to explore a different version");
  });

  it('uses the existing trusted board fork operation with an explicit rerun ceremony', () => {
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    const dialog = read('client/src/features/studio/takeover/IdentityChangeDialog.tsx');
    const board = read('client/src/features/boards/BoardPage.tsx');

    expect(takeover).toContain("setIdentityDialog({ changes: {}, labels: [], intent: 'rerun' })");
    expect(takeover).toContain('onForkMinted={isMintedEdit ? handleForkProfile : undefined}');
    expect(takeover).toContain("onIdentityCommit(decision, changes, identityDialog.intent)");
    expect(dialog).toContain('Fork this cast?');
    expect(dialog).toContain('The minted identity stays locked');
    expect(board).toContain("intent?: 'rerun'");
    expect(board).toContain('...(intent ? { intent } : {})');
  });

  it('keeps missing-view upgrades truthful from Canvas and standalone Profile hosts', () => {
    const studio = read('client/src/pages/DrapeStudio.tsx');
    const strip = read('client/src/features/casting/components/ImageViewer/ViewTabs.tsx');

    expect(studio).toContain("window.addEventListener('casting-open-package-upgrade', onUpgrade)");
    expect(studio).toContain("mode={upgradeMode ? 'upgrade' : 'mint'}");
    expect(studio).toContain('handleCastAndContinue(name, tier, upgradeMode, stayDraft)');
    expect(strip).toContain('s.mintedEditContext?.modelId != null || s.canvas.isMinted');
    expect(strip).toContain("isMintedProfile ? 'casting-open-package-upgrade' : 'casting-open-mint'");
  });

  it('renames the library entry so minted models open as a Profile, not an editor', () => {
    const chooser = read('client/src/features/lobby/ModelCardChooser.tsx');
    expect(chooser).toContain("verb: 'View cast profile'");
    expect(chooser).not.toContain("verb: 'Open in casting'");
  });
});
