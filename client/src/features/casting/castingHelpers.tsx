import {
  BRAND_OPTIONS,
  ETHNICITIES,
  SKIN_TONES,
  SKIN_TEXTURES,
  SKIN_FINISHES,
  EYE_PRESETS,
  CHAR_OPTIONS,
  HAIR_FAMILIES_FEMALE,
  HAIR_FAMILIES_MALE,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  HAIR_FRINGES,
  HAIR_PARTINGS,
  HAIR_VOLUMES,
  HAIR_TUCKS,
  HAIR_FADES,
  BODY_TYPES,
  FACE_SHAPES,
  type ModelPreferences,
} from "@/features/casting/constants";

// ============ Utility Functions ============

export const generateExportId = () => {
  const chars = '0123456789ABCDEF';
  let hash = '';
  for (let i = 0; i < 6; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;
};

export const generateRandomPreferences = (): Partial<ModelPreferences> => {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pickValue = (arr: { value: string }[]): string => pick(arr).value;
  const pickLabel = (arr: { label: string; value: string }[]): string => pick(arr).value;
  
  const gender = pick(['Male', 'Female']);
  const hairFamilies = gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
  
  const editorial = Math.random();
  const commercial = Math.random() * (1 - editorial);
  const runway = 1 - editorial - commercial;
  
  return {
    castingBrand: pickValue(BRAND_OPTIONS),
    castingVibe: { editorial, commercial, runway },
    gender,
    age: String(Math.floor(Math.random() * 20) + 18),
    ethnicity: pick(ETHNICITIES),
    bodyType: pickLabel(BODY_TYPES),
    faceShape: pick(FACE_SHAPES.filter(f => f !== 'Random')),
    skinTone: pickLabel(SKIN_TONES),
    skinTexture: pick(SKIN_TEXTURES),
    skinFinish: pick(SKIN_FINISHES),
    eyeColor: pick(EYE_PRESETS).label,
    hairColor: pick(['Jet Black', 'Dark Brown', 'Chestnut', 'Auburn', 'Blonde', 'Platinum', 'Copper', 'Silver']),
    hairStyle: pick(hairFamilies),
    hairLength: pick(HAIR_LENGTHS),
    hairTexture: pick(HAIR_TEXTURES),
    hairFringe: pick(HAIR_FRINGES),
    hairParting: pick(HAIR_PARTINGS),
    hairVolume: pick(HAIR_VOLUMES),
    hairTuck: pick(HAIR_TUCKS),
    hairFade: gender === 'Male' ? pick(HAIR_FADES) : 'None',
    facialHair: gender === 'Male' ? pick(CHAR_OPTIONS.facialHair) : '',
    jawline: pick(CHAR_OPTIONS.jawline),
    cheekbones: pick(CHAR_OPTIONS.cheekbones),
    cheeks: pick(CHAR_OPTIONS.cheeks),
    eyeShape: pick(CHAR_OPTIONS.eyeShape),
    noseShape: pick(CHAR_OPTIONS.noseShape),
    lipShape: pick(CHAR_OPTIONS.lipShape),
    eyebrowStyle: pick(CHAR_OPTIONS.eyebrows),
    features: '',
    userPrompt: '',
  };
};
