export enum GenerationMode {
  NEW = 'NEW',
  REFERENCE = 'REFERENCE',
  ITERATE = 'ITERATE',
}

export enum ImageResolution {
  STD = '1K',
  HIGH = '2K',
  ULTRA = '4K',
}

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '3:4',
  LANDSCAPE = '4:3',
  TALL = '9:16',
  WIDE = '16:9',
}

export type SkinTextureType = 'Raw / Standard' | 'Glass / Perfect' | 'Freckled' | 'Textured / Acneic' | 'Mature';
export type SkinFinishType = 'Natural' | 'Matte / Powdered' | 'Dewy / Sweat' | 'Oily';

export interface ModelPreferences {
  castingBrand: string;
  castingTone: string;
  
  // Tri-Blend Weights (0.0 - 1.0)
  castingVibe?: {
    editorial: number;
    commercial: number;
    runway: number;
  };
  
  gender: string;      
  age: string;         
  ethnicity: string;   
  bodyType: string;    
  faceShape?: string;  
  skinTone: string;    
  skinTexture?: SkinTextureType; 
  skinFinish?: SkinFinishType;   
  eyeColor: string;    
  hairColor: string;   
  
  // --- HAIR BUILDER ---
  hairStyle: string;
  hairLength?: string;
  hairTexture?: string;
  hairFringe?: string;
  hairParting?: string;
  hairVolume?: string;
  
  // Hair Advanced
  hairFlyaways?: string;
  hairHairline?: string;
  hairTuck?: string;
  hairFade?: string;
  hairSides?: string;

  // Specific Characteristics
  facialHair?: string;
  jawline?: string;
  cheekbones?: string;
  cheeks?: string;
  eyeShape?: string;
  noseShape?: string;
  lipShape?: string;
  eyebrowStyle?: string;

  features: string;    
  referenceImage?: string;
  previousMasterPrompt?: string;
  userPrompt?: string; 
}

export interface ModelViews {
  frontClose: string;
  frontFull?: string;
  sideClose?: string;
  sideFull?: string;
  backFull?: string;
  // Allow dynamic access to views
  [key: string]: string | undefined;
}

export interface GeneratedAsset {
  id: string;
  imageUrl: string; // This is technically frontClose (View 1)
  views: ModelViews; // Stores all views
  masterPrompt: string;
  technicalSchema?: any; // Structured JSON representation
  timestamp: number;
  resolution: ImageResolution;
  engine: string; // The specific model name used (e.g., gemini-3-pro...)
  isExpanding?: boolean; // UI state for loading extra views
}

export interface GenerationState {
  isGenerating: boolean;
  currentStep: string; // "Drafting Prompt" | "Casting Model" | "Developing"
  error: string | null;
}
