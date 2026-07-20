import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useCastingGenerationStore } from '../client/src/features/casting/stores/useCastingGenerationStore';
import { captureCastingSession } from '../client/src/features/casting/castingSessionToken';
import {
  editablePreferencesFromStored,
  resolvedEngineChoices,
  sanitizeEngineChoice,
} from '../client/src/features/casting/engineChoicePersistence';
import { buildCreationPreferences } from '../client/src/features/casting/creationPayload';
import { DEFAULT_PREFERENCES } from '../client/src/features/casting/stores/useCastingFormStore';
import { modelCreatePreferencesSchema } from './routes/modelCreateInput';

const root = path.join(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('W4 casting-session continuation guard', () => {
  beforeEach(() => {
    useCastingGenerationStore.getState().resetGeneration();
  });

  it('a continuation resolving after reset cannot write into the reset store', () => {
    const guard = captureCastingSession(() => useCastingGenerationStore.getState().sessionToken);
    useCastingGenerationStore.getState().resetGeneration();
    const snapshot = {
      modelId: useCastingGenerationStore.getState().currentModelId,
      assets: useCastingGenerationStore.getState().currentAssets,
    };

    if (guard.isCurrent()) {
      useCastingGenerationStore.getState().setCurrentModelId(91);
      useCastingGenerationStore.getState().setCurrentAssets([
        { id: 10, viewType: 'frontClose', storageUrl: 'old-session' },
      ]);
    }

    expect(guard.isCurrent()).toBe(false);
    expect({
      modelId: useCastingGenerationStore.getState().currentModelId,
      assets: useCastingGenerationStore.getState().currentAssets,
    }).toEqual(snapshot);
  });

  it('a continuation cannot overwrite a different live session', () => {
    const oldGuard = captureCastingSession(() => useCastingGenerationStore.getState().sessionToken);
    useCastingGenerationStore.getState().resetGeneration();
    useCastingGenerationStore.getState().setCurrentModelId(22);
    useCastingGenerationStore.getState().setCurrentAssets([
      { id: 22, viewType: 'frontClose', storageUrl: 'new-session' },
    ]);

    if (oldGuard.isCurrent()) {
      useCastingGenerationStore.getState().setCurrentModelId(11);
    }

    expect(useCastingGenerationStore.getState().currentModelId).toBe(22);
    expect(useCastingGenerationStore.getState().currentAssets[0]?.storageUrl).toBe('new-session');
  });

  it('invalidates at close-start before the exit timer and guards every async writer', () => {
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(takeover.indexOf('state.invalidateSession()')).toBeLessThan(
      takeover.indexOf('window.setTimeout(onClose, 210)'),
    );
    expect(takeover).toContain('if (closingStartedRef.current) return;');
    expect(takeover).toContain('closingStartedRef.current = true;');
    const generation = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    expect(generation.match(/captureCastingSession\(getSessionToken\)/g)?.length).toBeGreaterThanOrEqual(6);
  });
});

describe('W4 close and landing truth', () => {
  it('auto-lands only a real headshot and keeps the pre-headshot path library-only', () => {
    const takeover = read('client/src/features/studio/takeover/CastingTakeover.tsx');
    expect(takeover).toContain('const needsBoardLanding');
    expect(takeover).toContain("asset.viewType === 'frontClose' && asset.storageUrl");
    expect(takeover).toContain('onDraftLanded(sessionModelId');
    expect(takeover).toContain('Until the headshot is ready, this node stays empty.');
    expect(takeover).toContain('Your draft will be placed on this board before Casting closes.');
    expect(takeover).toContain('The in-flight change will keep saving to this draft.');
    expect(takeover).toContain('Your draft is already saved. The in-flight change will keep saving to it.');
  });

  it('reports background completion through the durable bridge and preserves board landing intent', () => {
    const generation = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    expect(generation).toContain("kind: 'newCast'");
    expect(generation).toContain('castingOperation.succeed');
    const app = read('client/src/App.tsx');
    expect(app).toContain('<GenerationOperationBridge />');
    const bridge = read('client/src/features/operations/GenerationOperationBridge.tsx');
    expect(bridge).toContain('settled.landedNow');
    expect(bridge).toContain('Draft generated and placed on your canvas');
    const board = read('client/src/features/boards/BoardPage.tsx');
    expect(board).toContain('originNeedsLanding: !landed');
    expect(board).toContain('handleBackgroundDraftReady');
    expect(board).toContain('activeCastSessionRef.current = { takeoverItemId: null, editContext: null }');
  });
});

describe('W4 durable Open choices', () => {
  it('persists true-only flags through the strict creation schema', () => {
    const payload = buildCreationPreferences(DEFAULT_PREFERENCES, 'Prada', {
      gender: true,
      eyeColor: true,
      hairStyle: false,
    });
    expect(payload.engineChoice).toEqual({ gender: true, eyeColor: true });
    expect(modelCreatePreferencesSchema.safeParse(payload).success).toBe(true);
    expect(modelCreatePreferencesSchema.safeParse({
      ...payload,
      engineChoice: { gender: false },
    }).success).toBe(false);
    expect(sanitizeEngineChoice({ gender: true, madeUp: true, age: false })).toEqual({ gender: true });
  });

  it('requires explicit Open authority before resolving an absent brand', () => {
    const generation = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    expect(generation).toContain("ok('castingBrand', prefs.castingBrand)");
    expect(generation).toContain('if (engineChoice.castingBrand)');
    expect(generation).not.toContain('updatePrefs({ castingBrand: resolvedBrand })');
  });

  it('restores Open validation without copying generated resolutions into editable preferences', () => {
    const restored = editablePreferencesFromStored({
      ...DEFAULT_PREFERENCES,
      gender: 'Female',
      eyeColor: 'Hazel',
      engineChoice: { gender: true, eyeColor: true },
    });
    expect(restored.engineChoice).toEqual({ gender: true, eyeColor: true });
    expect(restored.preferences.gender).toBe('');
    expect(restored.preferences.eyeColor).toBe('');

    expect(resolvedEngineChoices({
      subject: { sex: 'Female', eye_color: 'Hazel' },
    }, restored.engineChoice)).toEqual([
      { field: 'gender', label: 'Gender', value: 'Female' },
      { field: 'eyeColor', label: 'Eye color', value: 'Hazel' },
    ]);
  });

  it('hydrates the flags and labels schema values read-only', () => {
    const workspace = read('client/src/features/studio/components/CastingWorkspace.tsx');
    expect(workspace).toContain('editablePreferencesFromStored');
    expect(workspace).toContain('formStore.setEngineChoices(restored.engineChoice)');
    expect(read('client/src/features/casting/MasterPromptPanel.tsx')).toContain('Resolved at casting');
    expect(read('client/src/features/casting/ControlPanel.tsx')).toContain('Open choices resolved at casting');
    expect(read('server/routes/models.ts')).toContain('stripEngineChoiceMetadata(input.preferences)');
  });
});

describe('W4 occupied reference replacement rider', () => {
  it('routes empty and occupied drops through the same existing validation handler', () => {
    const panel = read('client/src/features/casting/MasterPromptPanel.tsx');
    expect(panel.match(/onDrop=\{handleDrop\}/g)?.length).toBe(2);
    expect(panel).toContain('if (!file.type.startsWith');
    expect(panel).toContain('className="absolute inset-0');
    expect(panel).toContain('Drop to replace');
  });
});
