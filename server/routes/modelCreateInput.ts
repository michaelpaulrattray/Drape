/**
 * modelCreateInput — the strict models.create wire schema, in a dependency-
 * light module so the client/server contract tests can import it without
 * dragging in the router's DB and Gemini imports. This IS the production
 * schema (models.ts uses it directly), not a copy.
 */
import { z } from "zod";

// Schema matches geminiService.ts ModelPreferences interface exactly
export const modelCreatePreferencesSchema = z.object({
  // Demographics
  gender: z.string().optional(),
  age: z.union([z.number(), z.string()]).optional(),
  ethnicity: z.string().optional(),
  ethnicityBlend: z.array(z.object({
    name: z.string(),
    pct: z.number(),
  })).optional(),
  bodyType: z.string().optional(),

  // Face structure
  faceShape: z.string().optional(),
  jawline: z.string().optional(),
  cheekbones: z.string().optional(),
  cheeks: z.string().optional(),
  eyeShape: z.string().optional(),
  noseShape: z.string().optional(),
  lipShape: z.string().optional(),
  eyebrowStyle: z.string().optional(),

  // Skin
  skinTone: z.string().optional(),
  skinTexture: z.string().optional(),
  skinFinish: z.string().optional(),

  // Eyes
  eyeColor: z.string().optional(),

  // Hair - complete builder
  hairStyle: z.string().optional(),
  hairColor: z.string().optional(),
  hairLength: z.string().optional(),
  hairTexture: z.string().optional(),
  hairFringe: z.string().optional(),
  hairParting: z.string().optional(),
  hairVolume: z.string().optional(),
  hairFlyaways: z.string().optional(),
  hairHairline: z.string().optional(),
  hairTuck: z.string().optional(),
  hairFade: z.string().optional(),
  facialHair: z.string().optional(),

  // Brand & Vibe
  castingBrand: z.string().optional(),
  castingVibe: z.object({
    editorial: z.number(),
    commercial: z.number(),
    runway: z.number(),
  }).optional(),

  // Additional
  features: z.string().optional(),
  userPrompt: z.string().optional(),
  // W4/R8: explicit Open choices are durable UI authority. True-only and
  // closed-keyed; generated resolutions remain in technicalSchema.
  engineChoice: z.object({
    castingBrand: z.literal(true).optional(),
    gender: z.literal(true).optional(),
    age: z.literal(true).optional(),
    ethnicity: z.literal(true).optional(),
    skinTone: z.literal(true).optional(),
    eyeColor: z.literal(true).optional(),
    hairColor: z.literal(true).optional(),
    hairStyle: z.literal(true).optional(),
  }).strict().optional(),
  // Batch C (§10.3, M22): `referenceImage` is GONE and the object is
  // STRICT — a creation reference is schema-REJECTED, never silently
  // ignored. References join after the first headshot, through the
  // guarded iteration path. (`previousMasterPrompt` was an unused
  // creation channel and is likewise rejected.)
}).strict();

export const modelCreateInputSchema = z.object({
  preferences: modelCreatePreferencesSchema,
  name: z.string().optional(),
});
