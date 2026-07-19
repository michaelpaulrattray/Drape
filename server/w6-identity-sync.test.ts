import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { editablePreferencesFromStored } from '../client/src/features/casting/engineChoicePersistence';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('W6-D post-identity-edit client synchronization', () => {
  it('restores editable preferences without promoting Open resolutions into the form', () => {
    const restored = editablePreferencesFromStored({
      eyeColor: 'Hazel',
      hairColor: 'Pink',
      engineChoice: { eyeColor: true },
    });

    expect(restored.preferences.eyeColor).toBe('');
    expect(restored.preferences.hairColor).toBe('Pink');
    expect(restored.engineChoice).toEqual({ eyeColor: true });
  });

  it('applies all three documents only behind the identity-response discriminator', () => {
    const source = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    const branchStart = source.indexOf("if (\n          'preferences' in result");
    const branchEnd = source.indexOf('// Log amendment', branchStart);
    const branch = source.slice(branchStart, branchEnd);

    expect(branchStart).toBeGreaterThan(-1);
    expect(branch).toContain('result.preferences !== undefined');
    expect(branch).toContain('result.masterPrompt !== undefined');
    expect(branch).toContain('result.technicalSchema !== undefined');
    expect(branch).toContain('editablePreferencesFromStored(result.preferences)');
    expect(branch).toContain('setCurrentMasterPrompt(result.masterPrompt)');
    expect(branch).toContain('setCurrentTechnicalSchema(result.technicalSchema as Record<string, unknown> | null)');
    expect(branch).toContain('setPrefs(restored.preferences)');
    expect(branch).toContain('setEngineChoices(restored.engineChoice)');
    expect(branch).toContain('utils.models.get.invalidate({ modelId: currentModelId })');
  });

  it('keeps the generation hook store-agnostic through its binding surface', () => {
    const hook = read('client/src/features/casting/hooks/useCastingGeneration.ts');
    const bindings = read('client/src/features/casting/hooks/castingBindings.ts');

    expect(hook).not.toContain('useCastingFormStore');
    expect(bindings).toContain('setPrefs: (prefs: ModelPreferences) => void');
    expect(bindings).toContain('setEngineChoices: (flags: EngineChoiceFlags) => void');
  });
});
