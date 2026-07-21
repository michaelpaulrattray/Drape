/** R7-3 draft refinement/recast surface contracts. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  canInvokeIdentityGeneration,
  shouldOfferDraftIdentityDoor,
  shouldShowCastProfile,
  shouldShowCastingControlPanel,
} from "../client/src/features/casting/castingAuthoringMode";
import { ChangeIdentityDoor } from "../client/src/features/casting/components/ChangeIdentityDoor";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("R7-3 draft authoring modes", () => {
  const fresh = {
    hasAssets: false,
    isReadOnly: false,
    mintedEdit: false,
    identityChangeOpen: false,
  };
  const draft = { ...fresh, hasAssets: true };

  it("keeps creation visible but makes refinement the ordinary draft surface", () => {
    expect(shouldShowCastingControlPanel(fresh)).toBe(true);
    expect(canInvokeIdentityGeneration(fresh)).toBe(true);
    expect(shouldOfferDraftIdentityDoor(fresh)).toBe(false);

    expect(shouldShowCastingControlPanel(draft)).toBe(false);
    expect(canInvokeIdentityGeneration(draft)).toBe(false);
    expect(shouldOfferDraftIdentityDoor(draft)).toBe(true);
  });

  it("arms recasting only inside the explicit identity-change ceremony", () => {
    const changing = { ...draft, identityChangeOpen: true };
    expect(shouldShowCastingControlPanel(changing)).toBe(true);
    expect(canInvokeIdentityGeneration(changing)).toBe(true);
    expect(shouldOfferDraftIdentityDoor(changing)).toBe(false);

    expect(canInvokeIdentityGeneration({ ...draft, isReadOnly: true })).toBe(false);
    expect(canInvokeIdentityGeneration({ ...draft, mintedEdit: true })).toBe(false);
    expect(shouldShowCastingControlPanel({ ...draft, isReadOnly: true })).toBe(false);
    expect(shouldShowCastingControlPanel({ ...draft, mintedEdit: true })).toBe(false);
    expect(shouldShowCastProfile({ ...draft, isReadOnly: true })).toBe(true);
    expect(shouldShowCastProfile({ ...draft, mintedEdit: true })).toBe(true);
    expect(shouldShowCastProfile(draft)).toBe(false);
  });

  it("states the destructive distinction on the identity door itself", () => {
    const html = renderToStaticMarkup(createElement(ChangeIdentityDoor, { onClick: vi.fn() }));
    expect(html).toContain("Change identity");
    expect(html).toContain("Casts a separate draft person. This one stays unchanged.");
    expect(html).toContain("data-change-identity-door");
  });

  it("snapshots draft settings before the ceremony and restores them on Back", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const open = workspace.slice(
      workspace.indexOf("const openIdentityChange"),
      workspace.indexOf("const closeIdentityChange"),
    );
    const close = workspace.slice(
      workspace.indexOf("const closeIdentityChange"),
      workspace.indexOf("// A successful recast"),
    );

    expect(open).toContain("prefs: structuredClone(prefs)");
    expect(open).toContain("engineChoice: { ...engineChoice }");
    expect(open).not.toContain("handleGenerate");
    expect(close).toContain("setPrefs(snapshot.prefs)");
    expect(close).toContain("setEngineChoices(snapshot.engineChoice)");
    expect(close).toContain("generation.setCurrentModelId(snapshot.modelId)");
    expect(close).toContain("generation.setCurrentMasterPrompt(snapshot.masterPrompt)");
    expect(close).toContain("generation.setGenState({ isGenerating: false, currentStep: '', error: null })");
    expect(close).toContain("generation.setFailedAction(null)");
    expect(close).toContain("utils.models.get.fetch({ modelId: snapshot.modelId })");
  });

  it("keeps failures in the ceremony but exits when a new model becomes current", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const settle = workspace.slice(
      workspace.indexOf("// A successful recast"),
      workspace.indexOf("const handleNewModel"),
    );

    expect(settle).toContain("currentModelId === snapshot.modelId");
    expect(settle).toContain("currentHeadshotAssetId === snapshot.headshotAssetId");
    expect(settle).toContain("setIdentityChangeOpen(false)");
    expect(settle).not.toContain("setPrefs(");
  });

  it("closes the keyboard bypass and leaves refinement free of a recast callback", () => {
    const viewer = read("client/src/features/casting/ImageViewerPanel.tsx");
    const refine = read("client/src/features/casting/components/ImageViewer/RefinePanel.tsx");
    const shortcut = viewer.slice(
      viewer.indexOf("// Ctrl+G"),
      viewer.indexOf("if (currentAssets.length === 0)"),
    );

    expect(shortcut).toContain("allowIdentityGeneration");
    expect(shortcut).not.toContain("!isReadOnly");
    expect(refine).not.toContain("handleGenerate");
  });

  it("uses the existing mobile controls door for Identity after a headshot", () => {
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const profile = read("client/src/features/casting/MasterPromptPanel.tsx");

    expect(workspace).toContain("hasAssets && !identityChangeOpen && showMobilePanel");
    expect(workspace).toContain("mobileSheet");
    expect(workspace).toContain("!previousHasAssetsRef.current && hasAssets");
    expect(profile).toContain('aria-label="Close Identity"');
    expect(profile).toContain("activeTab === 'profile' ? 'Identity' : 'Spec'");
    expect(profile).toContain("<ChangeIdentityDoor onClick={onChangeIdentity} />");
  });

  it("labels the recast form and paid action as a new person, never a refinement", () => {
    const control = read("client/src/features/casting/ControlPanel.tsx");
    expect(control).toContain("Cast a new person");
    expect(control).toContain("The current draft stays unchanged");
    expect(control).toContain("This creates a separate draft identity.");
    expect(control).not.toContain("Recast model");
  });

  it("gives the inner identity ceremony ownership of Escape without a stuck flag", () => {
    const control = read("client/src/features/casting/ControlPanel.tsx");
    const workspace = read("client/src/features/studio/components/CastingWorkspace.tsx");
    const takeover = read("client/src/features/studio/takeover/CastingTakeover.tsx");
    const uiStore = read("client/src/features/casting/stores/useCastingUIStore.ts");

    expect(control).toContain("if (!identityChangeMode) return");
    expect(control).toContain("onCloseIdentityChange?.()");
    expect(takeover).toContain("packageHealthOpen || identityChangeOpen");
    expect(workspace).toContain("useEffect(() => () => setIdentityChangeOpen(false)");
    expect(uiStore).toContain("identityChangeOpen: false");
  });
});
