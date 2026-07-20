/**
 * Shared helpers for building ethnicityHint and CASTING OVERRIDES
 * from model preferences. Used by both castingImaging and castingRefinement
 * routes to ensure the image model respects user choices.
 *
 * Matches SOT App.tsx lines 267-294 exactly.
 */

import { createModuleLogger } from "../logging/logger";
import {
  dependentFieldsForPatch,
  explicitFieldsForPatch,
} from "./identity/identityDependencies";
import type {
  AuthorizableIdentityField,
  AuthorizedIdentityPatch,
} from "./identity/identityTypes";
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
  hairColorOverride?: string;
  hairStyle?: string;
  hairStyleOverride?: string;
  hairLength?: string;
  hairTexture?: string;
  hairFringe?: string;
  hairParting?: string;
  facialHair?: string;
  facialHairOverride?: string;
}

export interface ReinforcementOptions {
  /**
   * Identity iteration uses the model's pre-edit preferences as its source
   * document. Never reinforce an old value for a field the server has just
   * authorized (or a reviewed physical dependent of that field).
   */
  suppressedFields?: ReadonlySet<AuthorizableIdentityField>;
}

function deliberateValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || ["open", "auto"].includes(normalized.toLowerCase())) {
    return null;
  }
  return normalized;
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
  prefs: ModelPreferencesForReinforcement,
  options: ReinforcementOptions = {},
): string {
  const overrides: string[] = [];
  const suppressed = options.suppressedFields;

  const eyeDefault = ["Dark", "Black", "Brown", ""];
  if (
    !suppressed?.has("person.face.eyeColor") &&
    prefs.eyeColor &&
    !eyeDefault.includes(prefs.eyeColor)
  ) {
    overrides.push(`EYE COLOR: ${prefs.eyeColor}`);
  }

  const hairDefault = ["Natural", "Off Black", "Black", "Dark Brown", ""];
  const hairColor = prefs.hairColorOverride || prefs.hairColor;
  if (
    !suppressed?.has("person.hair.color") &&
    hairColor &&
    !hairDefault.includes(hairColor)
  ) {
    overrides.push(`HAIR COLOR: ${hairColor}`);
  }

  const hairDesignCandidates: Array<[
    string,
    AuthorizableIdentityField,
    string | null,
  ]> = [
    [
      "style",
      "person.hair.style",
      deliberateValue(prefs.hairStyleOverride || prefs.hairStyle),
    ],
    ["length", "person.hair.length", deliberateValue(prefs.hairLength)],
    ["texture", "person.hair.texture", deliberateValue(prefs.hairTexture)],
    ["fringe", "person.hair.fringe", deliberateValue(prefs.hairFringe)],
    ["parting", "person.hair.parting", deliberateValue(prefs.hairParting)],
  ];
  const hairDesign = hairDesignCandidates
    .filter(
      (entry): entry is [string, AuthorizableIdentityField, string] =>
        !suppressed?.has(entry[1]) && entry[2] !== null,
    )
    .map(([label, , value]) => [label, value] as [string, string]);
  if (hairDesign.length > 0) {
    overrides.push(
      `HAIR DESIGN: ${hairDesign.map(([label, value]) => `${label}=${value}`).join(", ")} — every named property is a deliberate casting choice. Match it literally; never shorten it, simplify it, or substitute a buzz cut`,
    );
  }

  const facialHair = suppressed?.has("person.face.facialHair")
    ? null
    : deliberateValue(prefs.facialHairOverride || prefs.facialHair);
  if (facialHair) {
    overrides.push(
      facialHair.toLowerCase() === "none"
        ? "FACIAL HAIR: None — this is a deliberate casting choice. Keep the face clean-shaven"
        : `FACIAL HAIR: ${facialHair} — this is a deliberate casting choice. Do not remove it or substitute a clean-shaven face`,
    );
  }

  if (overrides.length > 0) {
    log.info({ overrides }, "[promptReinforcement] Applying CASTING OVERRIDES");
    return `[CASTING OVERRIDES — deliberate choices, not defaults: ${overrides.join(". ")}]\n${masterPrompt}`;
  }

  return masterPrompt;
}

/**
 * Build the pre-commit identity anchor for an authorized identity edit.
 * Explicitly changed fields and their reviewed physical dependents are
 * omitted from old-value reinforcement; unrelated identity traits stay
 * strongly protected.
 */
export function buildIdentityEditReinforcedPrompt(
  masterPrompt: string,
  prefs: ModelPreferencesForReinforcement,
  patch: AuthorizedIdentityPatch,
): string {
  const suppressedFields = new Set<AuthorizableIdentityField>([
    ...explicitFieldsForPatch(patch),
    ...dependentFieldsForPatch(patch),
  ]);
  return buildReinforcedPrompt(masterPrompt, prefs, { suppressedFields });
}
