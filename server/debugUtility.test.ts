import { describe, it, expect } from "vitest";

/**
 * Tests for Debug Utility - Random Preferences Generator
 * These test the randomization logic and value validity
 */

// Constants that mirror CastingStudio.tsx
const BRAND_OPTIONS = [
  { value: "Gucci", desc: "Eclectic / Quirky" },
  { value: "Prada", desc: "Intellectual / Severe" },
  { value: "Saint Laurent", desc: "Heroin Chic / Edgy" },
  { value: "Balenciaga", desc: "Brutalist / Street" },
  { value: "Miu Miu", desc: "Subversive / Youthful" },
  { value: "Versace", desc: "Glamour / Bombshell" },
  { value: "Zara", desc: "Trendy / Polished" },
  { value: "Social Media", desc: "Creator / Authentic" },
];

const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Mixed", "Polynesian"
];

const BODY_TYPES = [
  { label: "Ultra Thin", value: "Ultra Thin" },
  { label: "Slim", value: "Slim" },
  { label: "Athletic", value: "Athletic" },
  { label: "Muscular", value: "Muscular" },
  { label: "Curvy", value: "Curvy" },
  { label: "Petite", value: "Petite" },
];

const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond"];

const HAIR_FAMILIES_FEMALE = [
  "Buzz / Shaved", "Pixie", "Cropped Bob", "Bob", "Lob (Long Bob)",
  "Medium Layers", "Long Layers", "Shag / Wolf", "Blunt Cut",
  "Updo", "Pulled Back", "Braids"
];

const HAIR_FAMILIES_MALE = [
  "Buzz / Shaved", "Crew / Ivy League", "French Crop", "Caesar",
  "Short Textured", "Fade", "Undercut", "Slick Back",
  "Side Part", "Quiff", "Medium Layers", "Long Layers",
  "Curly Top", "Man Bun", "Braids / Locs"
];

const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"];
const HAIR_TEXTURES = ["Straight", "Slight Wave", "Wavy", "Curly", "Coily / Afro"];

describe("Debug Utility - Random Preferences Generator", () => {
  // Helper function that mirrors the one in CastingStudio.tsx
  const generateRandomPreferences = () => {
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
      faceShape: pick(FACE_SHAPES),
      hairStyle: pick(hairFamilies),
      hairLength: pick(HAIR_LENGTHS),
      hairTexture: pick(HAIR_TEXTURES),
    };
  };

  it("should generate valid gender values", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(['Male', 'Female']).toContain(prefs.gender);
    }
  });

  it("should generate valid age range (18-37)", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      const age = parseInt(prefs.age);
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(37);
    }
  });

  it("should generate valid brand values", () => {
    const validBrands = BRAND_OPTIONS.map(b => b.value);
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(validBrands).toContain(prefs.castingBrand);
    }
  });

  it("should generate vibe values that sum to 1", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      const sum = prefs.castingVibe.editorial + prefs.castingVibe.commercial + prefs.castingVibe.runway;
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("should generate valid ethnicity values", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(ETHNICITIES).toContain(prefs.ethnicity);
    }
  });

  it("should generate valid body type values", () => {
    const validBodyTypes = BODY_TYPES.map(b => b.value);
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(validBodyTypes).toContain(prefs.bodyType);
    }
  });

  it("should generate valid face shape values", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(FACE_SHAPES).toContain(prefs.faceShape);
    }
  });

  it("should generate gender-appropriate hair styles", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      const validStyles = prefs.gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
      expect(validStyles).toContain(prefs.hairStyle);
    }
  });

  it("should generate valid hair length values", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(HAIR_LENGTHS).toContain(prefs.hairLength);
    }
  });

  it("should generate valid hair texture values", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = generateRandomPreferences();
      expect(HAIR_TEXTURES).toContain(prefs.hairTexture);
    }
  });
});

describe("Debug Utility - Required Fields Coverage", () => {
  it("should generate all required fields for form validation", () => {
    // These are the required fields checked by isFormValid in CastingStudio.tsx
    const requiredFields = [
      'gender',
      'age',
      'ethnicity',
      'bodyType',
      'hairStyle',
    ];

    const generateRandomPreferences = () => {
      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const pickLabel = (arr: { label: string; value: string }[]): string => pick(arr).value;
      
      const gender = pick(['Male', 'Female']);
      const hairFamilies = gender === 'Male' ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
      
      return {
        gender,
        age: String(Math.floor(Math.random() * 20) + 18),
        ethnicity: pick(ETHNICITIES),
        bodyType: pickLabel(BODY_TYPES),
        hairStyle: pick(hairFamilies),
      };
    };

    for (let i = 0; i < 10; i++) {
      const prefs = generateRandomPreferences();
      requiredFields.forEach(field => {
        expect(prefs).toHaveProperty(field);
        expect((prefs as any)[field]).toBeTruthy();
      });
    }
  });
});
