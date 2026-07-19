/**
 * creationPayload — builds the exact `preferences` object sent to
 * models.create. Batch C (§10.3): a new cast is established from the
 * selections and brief alone — the server's STRICT schema rejects
 * `referenceImage` at creation, so the key must never exist in this object.
 * Merely setting it to `undefined` is NOT enough: tRPC uses superjson, which
 * round-trips undefined values with the key present, and `.strict()` rejects
 * on key presence (the R6 launch blocker, 2026-07-16). References join after
 * the first headshot through the guarded iteration path (performIteration).
 *
 * Pure and store-free so the client/server contract tests can prove the
 * real creation payload against the real server schema.
 */
import type { ModelPreferences } from "./constants";
import { sanitizeEngineChoice, type EngineChoiceFlags } from './engineChoicePersistence';

export function buildCreationPreferences(
  prefs: ModelPreferences,
  resolvedBrand: string | undefined,
  engineChoice: EngineChoiceFlags = {},
) {
  const durableEngineChoice = sanitizeEngineChoice(engineChoice);
  const values = {
    gender: prefs.gender,
    age: prefs.age,
    ethnicity: prefs.ethnicity,
    bodyType: prefs.bodyType,
    faceShape: prefs.faceShape,
    jawline: prefs.jawline,
    cheekbones: prefs.cheekbones,
    cheeks: prefs.cheeks,
    eyeShape: prefs.eyeShape,
    noseShape: prefs.noseShape,
    lipShape: prefs.lipShape,
    eyebrowStyle: prefs.eyebrowStyle,
    skinTone: prefs.skinTone,
    skinTexture: prefs.skinTexture,
    skinFinish: prefs.skinFinish,
    eyeColor: prefs.eyeColor,
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
    castingBrand: resolvedBrand,
    castingVibe: prefs.castingVibe,
    features: prefs.features,
    userPrompt: prefs.userPrompt,
    ethnicityBlend: prefs.ethnicityBlend,
    ...(Object.keys(durableEngineChoice).length > 0
      ? { engineChoice: durableEngineChoice }
      : {}),
  };
  // Superjson preserves explicit undefined keys. Keep the creation wire
  // payload structurally JSON-clean so schema parsing and operation hashing
  // agree that an unselected optional field is absent.
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as typeof values;
}
