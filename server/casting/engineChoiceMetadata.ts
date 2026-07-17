import type { ModelPreferences } from './geminiTypes';

export const ENGINE_CHOICE_FIELDS = [
  'castingBrand', 'gender', 'age', 'ethnicity',
  'skinTone', 'eyeColor', 'hairColor', 'hairStyle',
] as const;

export type EngineChoiceField = (typeof ENGINE_CHOICE_FIELDS)[number];
export type PersistedEngineChoice = Partial<Record<EngineChoiceField, true>>;

const IDENTITY_FIELD_TO_ENGINE_CHOICE: Partial<Record<string, EngineChoiceField>> = {
  'person.hair.style': 'hairStyle',
  'person.hair.color': 'hairColor',
  'person.face.eyeColor': 'eyeColor',
  'person.age': 'age',
  'person.gender': 'gender',
  'person.skinTone': 'skinTone',
  'person.ethnicity': 'ethnicity',
};

function sanitizeEngineChoice(input: unknown): PersistedEngineChoice {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    ENGINE_CHOICE_FIELDS
      .filter((field) => source[field] === true)
      .map((field) => [field, true]),
  ) as PersistedEngineChoice;
}

function attachEngineChoice(
  preferences: Record<string, unknown>,
  engineChoice: PersistedEngineChoice,
): ModelPreferences {
  return {
    ...preferences,
    ...(Object.keys(engineChoice).length > 0 ? { engineChoice } : {}),
  } as ModelPreferences;
}

/**
 * Prepare an inherited model for a new candidate. Metadata never enters the
 * content gate or Gemini. Delegated concrete values are cleared so the new
 * candidate genuinely resolves them again, while the flags remain durable.
 */
export function prepareCandidatePreferences(input: unknown): {
  promptPreferences: ModelPreferences;
  engineChoice: PersistedEngineChoice;
  storeResolved: (resolved: ModelPreferences) => ModelPreferences;
} {
  const promptPreferences = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};
  const engineChoice = sanitizeEngineChoice(promptPreferences.engineChoice);
  delete promptPreferences.engineChoice;

  for (const field of ENGINE_CHOICE_FIELDS) {
    if (!engineChoice[field]) continue;
    promptPreferences[field] = '';
    if (field === 'ethnicity') promptPreferences.ethnicityBlend = [];
  }

  return {
    promptPreferences: promptPreferences as ModelPreferences,
    engineChoice,
    storeResolved: (resolved) => attachEngineChoice(
      resolved as ModelPreferences & Record<string, unknown>,
      engineChoice,
    ),
  };
}

/** An explicit concrete edit revokes Open authority for that field only. */
export function clearEngineChoiceForChanges(
  input: unknown,
  changedFields: readonly string[],
): ModelPreferences {
  const preferences = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};
  const engineChoice = sanitizeEngineChoice(preferences.engineChoice);
  delete preferences.engineChoice;

  for (const rawField of changedFields) {
    const field = IDENTITY_FIELD_TO_ENGINE_CHOICE[rawField]
      ?? (rawField === 'ethnicityBlend' ? 'ethnicity' : rawField);
    if (ENGINE_CHOICE_FIELDS.includes(field as EngineChoiceField)) {
      delete engineChoice[field as EngineChoiceField];
    }
  }

  return attachEngineChoice(preferences, engineChoice);
}

/** models.create already receives resolved values; remove metadata only. */
export function stripEngineChoiceMetadata(input: unknown): ModelPreferences {
  const preferences = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};
  delete preferences.engineChoice;
  return preferences as ModelPreferences;
}
