import { useState, useMemo, useCallback } from 'react';

/**
 * useCastingForm - Custom hook for managing CastingStudio form state
 * 
 * INTEGRATION GUIDE:
 * -----------------
 * To integrate this hook into CastingStudio.tsx:
 * 
 * 1. Import the hook:
 *    import { useCastingForm, type ModelPreferences, type CastingVibe } from '@/hooks/useCastingForm';
 * 
 * 2. Replace state declarations in CastingStudio component:
 *    // BEFORE:
 *    const [prefs, setPrefs] = useState<ModelPreferences>({...});
 *    const [modelName, setModelName] = useState("");
 *    
 *    // AFTER:
 *    const {
 *      prefs,
 *      modelName,
 *      setPrefs,
 *      setModelName,
 *      updatePref,
 *      currentHairFamilies,
 *      isFormValid,
 *      getBackendPreferences,
 *    } = useCastingForm();
 * 
 * 3. Remove the local updatePref function (now provided by hook)
 * 
 * 4. Remove the local isFormValid useMemo (now provided by hook)
 * 
 * 5. Replace handleGenerate's backendPrefs construction with:
 *    const backendPrefs = getBackendPreferences();
 * 
 * 6. Remove HAIR_FAMILIES constant (now internal to hook)
 * 
 * 7. Update currentHairFamilies references to use hook-provided value
 */

// ============ Types ============

export interface CastingVibe {
  editorial: number;
  commercial: number;
  runway: number;
}

export interface ModelPreferences {
  castingBrand: string;
  castingVibe: CastingVibe;
  gender: string;
  age: string;
  ethnicity: string;
  bodyType: string;
  faceShape: string;
  skinTone: string;
  skinTexture: string;
  skinFinish: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  hairLength: string;
  hairTexture: string;
  hairFringe: string;
  hairParting: string;
  hairVolume: string;
  hairFlyaways: string;
  hairHairline: string;
  hairTuck: string;
  hairFade: string;
  facialHair: string;
  jawline: string;
  cheekbones: string;
  cheeks: string;
  eyeShape: string;
  noseShape: string;
  lipShape: string;
  eyebrowStyle: string;
  features: string;
  referenceImage?: string;
  userPrompt: string;
}

// ============ Constants ============

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

// Hair style families for validation
const HAIR_FAMILIES: Record<string, string[]> = {
  "Straight": ["Blunt Cut", "Layered", "One-Length", "Sleek Back", "Side Swept", "Curtain Bangs", "Asymmetric", "Hime Cut", "Blowout"],
  "Wavy": ["Beach Waves", "Soft Waves", "S-Waves", "Tousled", "Finger Waves", "Old Hollywood"],
  "Curly": ["Ringlets", "Spiral Curls", "Bouncy Curls", "Defined Curls", "Loose Curls"],
  "Coily": ["Afro", "Twist Out", "Coil Out", "Bantu Knots", "Locs", "Sisterlocks"],
  "Braided": ["Box Braids", "Cornrows", "French Braid", "Dutch Braid", "Fishtail", "Crown Braid", "Micro Braids"],
  "Updo": ["Bun", "Chignon", "French Twist", "Top Knot", "Messy Updo", "Ballerina Bun", "Low Bun"],
  "Short": ["Pixie", "Buzz Cut", "Crew Cut", "Undercut", "Fade", "Caesar", "Bowl Cut", "Textured Crop"],
  "Ponytail": ["High Pony", "Low Pony", "Side Pony", "Sleek Pony", "Bubble Pony", "Wrapped Pony"],
  "Bald": ["Bald", "Shaved", "Buzzed"],
};

// ============ Hook ============

export function useCastingForm() {
  const [prefs, setPrefs] = useState<ModelPreferences>(DEFAULT_PREFERENCES);
  const [modelName, setModelName] = useState("");

  // Update preference helper
  const updatePref = useCallback(<K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Batch update preferences
  const setPreferences = useCallback((newPrefs: Partial<ModelPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...newPrefs }));
  }, []);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setPrefs(DEFAULT_PREFERENCES);
    setModelName("");
  }, []);

  // Get current hair families based on selected texture
  const currentHairFamilies = useMemo(() => {
    const texture = prefs.hairTexture || 'Straight';
    return HAIR_FAMILIES[texture] || HAIR_FAMILIES['Straight'];
  }, [prefs.hairTexture]);

  // Form validation
  const isFormValid = useMemo(() => {
    return !!(
      prefs.gender &&
      prefs.skinTone &&
      prefs.eyeColor &&
      prefs.hairColor &&
      prefs.hairStyle
    );
  }, [prefs.gender, prefs.skinTone, prefs.eyeColor, prefs.hairColor, prefs.hairStyle]);

  // Get missing required fields
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!prefs.gender) missing.push('Gender');
    if (!prefs.skinTone) missing.push('Skin Tone');
    if (!prefs.eyeColor) missing.push('Eye Color');
    if (!prefs.hairColor) missing.push('Hair Color');
    if (!prefs.hairStyle) missing.push('Hair Style');
    return missing;
  }, [prefs.gender, prefs.skinTone, prefs.eyeColor, prefs.hairColor, prefs.hairStyle]);

  // Convert preferences to backend format
  const getBackendPreferences = useCallback(() => {
    return {
      // Demographics
      gender: prefs.gender,
      age: prefs.age,
      ethnicity: prefs.ethnicity,
      bodyType: prefs.bodyType,
      
      // Face structure
      faceShape: prefs.faceShape,
      jawline: prefs.jawline,
      cheekbones: prefs.cheekbones,
      cheeks: prefs.cheeks,
      eyeShape: prefs.eyeShape,
      noseShape: prefs.noseShape,
      lipShape: prefs.lipShape,
      eyebrowStyle: prefs.eyebrowStyle,
      
      // Skin
      skinTone: prefs.skinTone,
      skinTexture: prefs.skinTexture,
      skinFinish: prefs.skinFinish,
      
      // Eyes
      eyeColor: prefs.eyeColor,
      
      // Hair - complete builder
      hairStyle: prefs.hairStyle,
      hairColor: prefs.hairColor,
      hairLength: prefs.hairLength,
      hairTexture: prefs.hairTexture,
      hairFringe: prefs.hairFringe,
      hairParting: prefs.hairParting,
      hairVolume: prefs.hairVolume,
      hairFlyaways: prefs.hairFlyaways,
      hairHairline: prefs.hairHairline,
      hairTuck: prefs.hairTuck,
      hairFade: prefs.hairFade,
      facialHair: prefs.facialHair,
      
      // Brand & Vibe - pass directly
      castingBrand: prefs.castingBrand,
      castingVibe: prefs.castingVibe,
      
      // Additional
      features: prefs.features,
      referenceImage: prefs.referenceImage,
      userPrompt: prefs.userPrompt,
    };
  }, [prefs]);

  return {
    // State
    prefs,
    modelName,
    
    // Setters
    setPrefs,
    setModelName,
    updatePref,
    setPreferences,
    resetForm,
    
    // Derived values
    currentHairFamilies,
    isFormValid,
    missingFields,
    
    // Utilities
    getBackendPreferences,
  };
}

export type UseCastingFormReturn = ReturnType<typeof useCastingForm>;
