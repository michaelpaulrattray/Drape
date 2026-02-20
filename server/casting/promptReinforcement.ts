/**
 * Shared helpers for building ethnicityHint and CASTING OVERRIDES
 * from model preferences. Used by both castingImaging and castingRefinement
 * routes to ensure the image model respects user choices.
 *
 * Matches SOT App.tsx lines 267-294 exactly.
 */

import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/promptReinforcement");

export interface EthnicityBlendEntry {
  name: string;
  pct: number;
}

export interface ModelPreferencesForReinforcement {
  ethnicity?: string;
  ethnicityBlend?: EthnicityBlendEntry[];
  eyeColor?: string;
  hairColor?: string;
}

/**
 * Build ethnicityHint string from preferences for the image model phenotype lock.
 * Uses dominance bands matching SOT exactly:
 *   - Single ethnicity → just the name
 *   - 85%+ dominant → "X with subtle Y traits"
 *   - 65%+ dominant → "predominantly X with visible Y features"
 *   - Otherwise → "evenly mixed X-Y, both heritages clearly visible"
 */
export function buildEthnicityHint(
  prefs: ModelPreferencesForReinforcement
): string | undefined {
  if (prefs.ethnicityBlend && prefs.ethnicityBlend.length > 0) {
    const sorted = [...prefs.ethnicityBlend].sort((a, b) => b.pct - a.pct);
    if (sorted.length === 1) return sorted[0].name;
    const [pri, sec] = sorted;
    if (pri.pct >= 85) return `${pri.name} with subtle ${sec.name} traits`;
    if (pri.pct >= 65) return `predominantly ${pri.name} with visible ${sec.name} features`;
    return `evenly mixed ${pri.name}-${sec.name}, both heritages clearly visible`;
  }
  return prefs.ethnicity || undefined;
}

/**
 * Build CASTING OVERRIDES prefix for non-default eye/hair colors.
 * Only fires for non-default values — doesn't constrain creative output.
 * Returns the masterPrompt with overrides prepended if needed.
 */
export function buildReinforcedPrompt(
  masterPrompt: string,
  prefs: ModelPreferencesForReinforcement
): string {
  const overrides: string[] = [];

  const eyeDefault = ["Dark", "Black", "Brown", ""];
  if (prefs.eyeColor && !eyeDefault.includes(prefs.eyeColor)) {
    overrides.push(`EYE COLOR: ${prefs.eyeColor}`);
  }

  const hairDefault = ["Natural", "Off Black", "Black", "Dark Brown", ""];
  if (prefs.hairColor && !hairDefault.includes(prefs.hairColor)) {
    overrides.push(`HAIR COLOR: ${prefs.hairColor}`);
  }

  if (overrides.length > 0) {
    log.info({ overrides }, "[promptReinforcement] Applying CASTING OVERRIDES");
    return `[CASTING OVERRIDES — deliberate choices, not defaults: ${overrides.join(". ")}]\n${masterPrompt}`;
  }

  return masterPrompt;
}
