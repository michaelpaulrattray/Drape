import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type ModelPreferences, type CastingVibe } from '../constants';

// Default preferences for a new model
const DEFAULT_PREFERENCES: ModelPreferences = {
  castingBrand: 'Gucci',
  castingVibe: { editorial: 0.33, commercial: 0.33, runway: 0.34 },
  gender: '',
  age: '23',
  ethnicity: '',
  bodyType: 'Slim',
  faceShape: 'Oval',
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
};

// Form state interface
interface CastingFormState {
  // Model preferences
  prefs: ModelPreferences;
  setPrefs: (prefs: ModelPreferences) => void;
  updatePref: <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => void;
  
  // Model name
  modelName: string;
  setModelName: (name: string) => void;
  
  // Computed values
  currentHairFamilies: () => Array<{ name: string; hex: string }>;
  
  // Reset form
  resetForm: () => void;
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
        (state) => ({ prefs: { ...state.prefs, [key]: value } }),
        false,
        `updatePref:${key}`
      ),
      
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
        modelName: '',
      }, false, 'resetForm'),
    }),
    { name: 'CastingFormStore' }
  )
);

// Selector hooks for optimized re-renders
export const usePrefs = () => useCastingFormStore((state) => state.prefs);
export const useSetPrefs = () => useCastingFormStore((state) => state.setPrefs);
export const useUpdatePref = () => useCastingFormStore((state) => state.updatePref);

export const useModelName = () => useCastingFormStore((state) => state.modelName);
export const useSetModelName = () => useCastingFormStore((state) => state.setModelName);

export const useCurrentHairFamilies = () => useCastingFormStore((state) => state.currentHairFamilies);

// Export default preferences for external use
export { DEFAULT_PREFERENCES };
