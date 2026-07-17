import type { ModelPreferences } from './constants';

export const REQUIRED_CAST_FIELDS = [
  'castingBrand', 'gender', 'age', 'ethnicity',
  'skinTone', 'eyeColor', 'hairColor', 'hairStyle',
] as const;

export type RequiredCastField = (typeof REQUIRED_CAST_FIELDS)[number];
export type EngineChoiceFlags = Partial<Record<RequiredCastField, boolean>>;
export type PersistedEngineChoiceFlags = Partial<Record<RequiredCastField, true>>;

const SCHEMA_PATHS: Record<RequiredCastField, readonly [string, string]> = {
  castingBrand: ['context', 'casting_for'],
  gender: ['subject', 'sex'],
  age: ['subject', 'age'],
  ethnicity: ['subject', 'ethnicity'],
  skinTone: ['subject', 'skin_tone'],
  eyeColor: ['subject', 'eye_color'],
  hairColor: ['subject', 'hair_color'],
  hairStyle: ['subject', 'hair_style'],
};

export const ENGINE_CHOICE_LABELS: Record<RequiredCastField, string> = {
  castingBrand: 'Brand',
  gender: 'Gender',
  age: 'Age',
  ethnicity: 'Ethnicity',
  skinTone: 'Skin tone',
  eyeColor: 'Eye color',
  hairColor: 'Hair color',
  hairStyle: 'Hair style',
};

/** Persist true delegations only. False and unknown keys are not wire state. */
export function sanitizeEngineChoice(input: unknown): PersistedEngineChoiceFlags {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    REQUIRED_CAST_FIELDS.filter((field) => source[field] === true).map((field) => [field, true]),
  ) as PersistedEngineChoiceFlags;
}

/**
 * Rebuild the editable form without copying engine-resolved values into it.
 * The durable Open flags satisfy validation; technicalSchema owns the
 * read-only resolution shown elsewhere in Studio.
 */
export function editablePreferencesFromStored(input: unknown): {
  preferences: ModelPreferences;
  engineChoice: EngineChoiceFlags;
} {
  const stored = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};
  const engineChoice = sanitizeEngineChoice(stored.engineChoice);
  delete stored.engineChoice;

  for (const field of REQUIRED_CAST_FIELDS) {
    if (!engineChoice[field]) continue;
    if (field === 'ethnicity') {
      stored.ethnicity = '';
      stored.ethnicityBlend = [];
    } else {
      stored[field] = '';
    }
  }

  return { preferences: stored as unknown as ModelPreferences, engineChoice };
}

export interface ResolvedEngineChoice {
  field: RequiredCastField;
  label: string;
  value: string;
}

/** Read concrete engine resolutions without promoting them into preferences. */
export function resolvedEngineChoices(
  technicalSchema: unknown,
  engineChoice: EngineChoiceFlags,
): ResolvedEngineChoice[] {
  if (!technicalSchema || typeof technicalSchema !== 'object') return [];
  const schema = technicalSchema as Record<string, unknown>;
  const resolved: ResolvedEngineChoice[] = [];

  for (const field of REQUIRED_CAST_FIELDS) {
    if (!engineChoice[field]) continue;
    const [sectionName, key] = SCHEMA_PATHS[field];
    const section = schema[sectionName];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    const raw = (section as Record<string, unknown>)[key];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    resolved.push({ field, label: ENGINE_CHOICE_LABELS[field], value: String(raw) });
  }
  return resolved;
}
