import type { PdfModelData } from "./pdfService";

function firstDisplayValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/** PDF fields read the structured technical schema first and the persisted
 *  founder-era preferences second. Neither source is rewritten, and truly
 *  unknown values remain undefined so the PDF renders an honest em dash. */
export function resolvePdfPreferences(
  technicalSchema: unknown,
  modelPreferences: unknown,
): PdfModelData["preferences"] {
  const tech = (technicalSchema ?? {}) as Record<string, any>;
  const pref = (modelPreferences ?? {}) as Record<string, any>;
  return {
    gender: firstDisplayValue(tech.subject?.gender, pref.gender),
    age: firstDisplayValue(tech.subject?.age, pref.age),
    ethnicity: firstDisplayValue(tech.subject?.ethnicity, pref.ethnicity),
    bodyType: firstDisplayValue(tech.subject?.body_type, pref.bodyType),
    skinTone: firstDisplayValue(tech.subject?.skin_tone, tech.skin?.tone, pref.skinTone),
    skinTexture: firstDisplayValue(tech.skin?.texture, pref.skinTexture),
    skinFinish: firstDisplayValue(tech.skin?.finish, pref.skinFinish),
    eyeColor: firstDisplayValue(tech.subject?.eye_color, pref.eyeColor),
    hairColor: firstDisplayValue(tech.subject?.hair_color, pref.hairColor),
    hairStyle: firstDisplayValue(tech.subject?.hair_style, tech.hair?.style, pref.hairStyle),
    hairLength: firstDisplayValue(tech.subject?.hair_length, tech.hair?.length, pref.hairLength),
    hairTexture: firstDisplayValue(tech.hair?.texture, pref.hairTexture),
    hairVolume: firstDisplayValue(tech.hair?.volume, pref.hairVolume),
    hairFringe: firstDisplayValue(tech.hair?.fringe, pref.hairFringe),
    hairParting: firstDisplayValue(tech.hair?.parting, pref.hairParting),
    hairFlyaways: firstDisplayValue(tech.hair?.flyaways, pref.hairFlyaways),
    faceShape: firstDisplayValue(tech.face?.shape, pref.faceShape),
    jawline: firstDisplayValue(tech.face?.jawline, pref.jawline),
    cheekbones: firstDisplayValue(tech.face?.cheekbones, pref.cheekbones),
    cheeks: firstDisplayValue(tech.face?.cheeks, pref.cheeks),
    eyeShape: firstDisplayValue(tech.face?.eye_shape, pref.eyeShape),
    noseShape: firstDisplayValue(tech.face?.nose_shape, pref.noseShape),
    lipShape: firstDisplayValue(tech.face?.lip_shape, pref.lipShape),
    eyebrowStyle: firstDisplayValue(tech.face?.eyebrow_style, pref.eyebrowStyle),
    castingBrand: firstDisplayValue(tech.context?.casting_for, pref.castingBrand),
    castingVibe:
      tech.context?.vibe_blend && typeof tech.context.vibe_blend === "object"
        ? tech.context.vibe_blend
        : pref.castingVibe && typeof pref.castingVibe === "object"
          ? pref.castingVibe
          : undefined,
  };
}
