import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type ModelPreferences } from '../constants';

/**
 * Required fields for a cast (mirrors useCastingGeneration's isFormValid).
 * Each is satisfied by a value OR by an explicit Engine's-choice flag (D-41).
 * `ethnicity` is satisfied by either the legacy string or a non-empty blend.
 */
export const REQUIRED_CAST_FIELDS = [
  'castingBrand', 'gender', 'age', 'ethnicity',
  'skinTone', 'eyeColor', 'hairColor', 'hairStyle',
] as const;
export type RequiredCastField = (typeof REQUIRED_CAST_FIELDS)[number];

// Default preferences for a new model. Gender / age / brand deliberately
// start EMPTY (founder ruling 2026-07-11): their old silent defaults
// (Female / 23 / Gucci) masqueraded as choices — absence now means
// Engine's choice, honestly.
const DEFAULT_PREFERENCES: ModelPreferences = {
  castingBrand: '',
  castingVibe: { editorial: 0.33, commercial: 0.33, runway: 0.34 },
  gender: '',
  age: '',
  ethnicity: '',
  bodyType: 'Slim',
  faceShape: 'Auto',
  skinTone: '',
  skinTexture: 'Raw / Standard',
  skinFinish: 'Natural',
  eyeColor: '',
  hairColor: '',
  hairStyle: '',
  hairLength: 'Medium',
  hairTexture: 'Straight',
  hairFringe: 'None',
  hairParting: 'Center',
  hairVolume: 'Natural',
  hairFlyaways: '',
  hairHairline: '',
  hairTuck: '',
  hairFade: '',
  facialHair: '',
  jawline: '',
  cheekbones: '',
  cheeks: '',
  eyeShape: '',
  noseShape: '',
  lipShape: '',
  eyebrowStyle: 'Random',
  features: '',
  userPrompt: '',
  ethnicityBlend: [],
};

// Form state interface
interface CastingFormState {
  // Model preferences
  prefs: ModelPreferences;
  setPrefs: (prefs: ModelPreferences) => void;
  updatePref: <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => void;
  updatePrefs: (partial: Partial<ModelPreferences>) => void;

  /** Engine's-choice flags (D-41): required fields the user explicitly
   *  delegated to the engine. UI-only validation state — never a sentinel
   *  string in prompts; absence in prefs IS the engine directive. */
  engineChoice: Partial<Record<RequiredCastField, boolean>>;
  /** Toggle a field's Engine's-choice state. Turning it ON clears the
   *  field's value (delegating un-chooses); selecting a value clears it. */
  setEngineChoice: (field: RequiredCastField, on: boolean) => void;
  /** Mark every required-but-unset field as Engine's choice (the post-parse
   *  fill that arms the two-keystroke flow). Returns the fields marked. */
  markUnsetRequiredAsEngineChoice: () => RequiredCastField[];

  // Model name
  modelName: string;
  setModelName: (name: string) => void;

  // Computed values
  currentHairFamilies: () => Array<{ name: string; hex: string }>;

  // Reset form
  resetForm: () => void;
}

/** Value-emptiness per required field (ethnicity = string + blend). */
function isRequiredFieldSet(prefs: ModelPreferences, field: RequiredCastField): boolean {
  if (field === 'ethnicity') {
    return !!prefs.ethnicity || (Array.isArray(prefs.ethnicityBlend) && prefs.ethnicityBlend.length > 0);
  }
  return !!prefs[field];
}

/** Clearing map for setEngineChoice(field, true). */
function clearedValuesFor(field: RequiredCastField): Partial<ModelPreferences> {
  if (field === 'ethnicity') return { ethnicity: '', ethnicityBlend: [] };
  return { [field]: '' } as Partial<ModelPreferences>;
}

// Hair families data (imported from constants for reference)
const HAIR_FAMILIES_FEMALE = [
  { name: 'Platinum Blonde', hex: '#F5F5DC' },
  { name: 'Golden Blonde', hex: '#FFD700' },
  { name: 'Strawberry Blonde', hex: '#FF9966' },
  { name: 'Copper Red', hex: '#B87333' },
  { name: 'Auburn', hex: '#A52A2A' },
  { name: 'Chestnut Brown', hex: '#954535' },
  { name: 'Chocolate Brown', hex: '#7B3F00' },
  { name: 'Espresso', hex: '#3C1414' },
  { name: 'Jet Black', hex: '#0A0A0A' },
  { name: 'Silver Gray', hex: '#C0C0C0' },
];

const HAIR_FAMILIES_MALE = [
  { name: 'Platinum Blonde', hex: '#F5F5DC' },
  { name: 'Sandy Blonde', hex: '#F4A460' },
  { name: 'Light Brown', hex: '#A0522D' },
  { name: 'Medium Brown', hex: '#8B4513' },
  { name: 'Dark Brown', hex: '#654321' },
  { name: 'Espresso', hex: '#3C1414' },
  { name: 'Jet Black', hex: '#0A0A0A' },
  { name: 'Salt & Pepper', hex: '#808080' },
  { name: 'Silver Gray', hex: '#C0C0C0' },
  { name: 'Ginger Red', hex: '#B06500' },
];

// Create the store
export const useCastingFormStore = create<CastingFormState>()(
  devtools(
    (set, get) => ({
      // Model preferences
      prefs: { ...DEFAULT_PREFERENCES },
      setPrefs: (prefs) => set({ prefs }, false, 'setPrefs'),
      updatePref: (key, value) => set(
        (state) => ({
          prefs: { ...state.prefs, [key]: value },
          // Choosing a value un-delegates the field (D-41)
          engineChoice: value
            ? { ...state.engineChoice, [key]: false }
            : state.engineChoice,
        }),
        false,
        `updatePref:${key}`
      ),
      updatePrefs: (partial) => set(
        (state) => {
          const engineChoice = { ...state.engineChoice };
          for (const field of REQUIRED_CAST_FIELDS) {
            const key = field === 'ethnicity' ? 'ethnicityBlend' : field;
            const v = (partial as Record<string, unknown>)[key] ?? (partial as Record<string, unknown>)[field];
            if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
              engineChoice[field] = false;
            }
          }
          return { prefs: { ...state.prefs, ...partial }, engineChoice };
        },
        false,
        'updatePrefs'
      ),

      engineChoice: {},
      setEngineChoice: (field, on) => set(
        (state) => ({
          engineChoice: { ...state.engineChoice, [field]: on },
          prefs: on ? { ...state.prefs, ...clearedValuesFor(field) } : state.prefs,
        }),
        false,
        `setEngineChoice:${field}`
      ),
      markUnsetRequiredAsEngineChoice: () => {
        const marked: RequiredCastField[] = [];
        set(
          (state) => {
            const engineChoice = { ...state.engineChoice };
            for (const field of REQUIRED_CAST_FIELDS) {
              if (!isRequiredFieldSet(state.prefs, field) && !engineChoice[field]) {
                engineChoice[field] = true;
                marked.push(field);
              } else if (!isRequiredFieldSet(state.prefs, field) && engineChoice[field]) {
                marked.push(field);
              }
            }
            return { engineChoice };
          },
          false,
          'markUnsetRequiredAsEngineChoice'
        );
        return marked;
      },

      // Model name
      modelName: '',
      setModelName: (name) => set({ modelName: name }, false, 'setModelName'),
      
      // Computed values
      currentHairFamilies: () => {
        const { prefs } = get();
        return prefs.gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
      },
      
      // Reset form
      resetForm: () => set({
        prefs: { ...DEFAULT_PREFERENCES },
        engineChoice: {},
        modelName: '',
      }, false, 'resetForm'),
    }),
    { name: 'CastingFormStore' }
  )
);

// Export default preferences for external use
export { DEFAULT_PREFERENCES };
