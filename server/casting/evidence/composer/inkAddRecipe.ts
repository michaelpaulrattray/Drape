import { IMAGE_PRO, TEXT_ECONOMY } from "@shared/modelRegistry";
import { INK_ADD_CAPABILITY_KEY } from "../evidenceCandidateContract";

export const INK_ADD_ONTOLOGY_VERSION =
  "body-zones.front-upper-torso.v1" as const;
export const INK_ADD_COMPOSER_RECIPE_VERSION =
  "ink.add.front_upper_torso.composer.v1" as const;
export const INK_ADD_PROBE_RECIPE_VERSION =
  "ink.add.front_upper_torso.probe.v1" as const;
export const INK_ADD_VISIBILITY_RECIPE_VERSION =
  "ink.add.front_upper_torso.visibility.v1" as const;

export const INK_ADD_IMAGE_ENGINE = IMAGE_PRO;
export const INK_ADD_PROBE_MODEL = TEXT_ECONOMY;
export const INK_ADD_TARGET_VIEW = "frontFull" as const;
export const INK_ADD_ZONE = "front_upper_torso" as const;
export const INK_ADD_SURFACE = "anterior" as const;
export const INK_ADD_SIDES = ["left", "centre", "right"] as const;
export type InkAddSide = typeof INK_ADD_SIDES[number];

export const INK_ADD_MIN_DESCRIPTOR_LENGTH = 3;
export const INK_ADD_MAX_DESCRIPTOR_LENGTH = 240;

export interface InkAddRecipeIdentity {
  capabilityKey: typeof INK_ADD_CAPABILITY_KEY;
  ontologyVersion: typeof INK_ADD_ONTOLOGY_VERSION;
  composerRecipeVersion: typeof INK_ADD_COMPOSER_RECIPE_VERSION;
  probeRecipeVersion: typeof INK_ADD_PROBE_RECIPE_VERSION;
  visibilityRecipeVersion: typeof INK_ADD_VISIBILITY_RECIPE_VERSION;
  imageEngine: typeof INK_ADD_IMAGE_ENGINE;
  probeModel: typeof INK_ADD_PROBE_MODEL;
  targetView: typeof INK_ADD_TARGET_VIEW;
  zone: typeof INK_ADD_ZONE;
  surface: typeof INK_ADD_SURFACE;
}

export const INK_ADD_RECIPE: InkAddRecipeIdentity = Object.freeze({
  capabilityKey: INK_ADD_CAPABILITY_KEY,
  ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
  composerRecipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
  probeRecipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
  visibilityRecipeVersion: INK_ADD_VISIBILITY_RECIPE_VERSION,
  imageEngine: INK_ADD_IMAGE_ENGINE,
  probeModel: INK_ADD_PROBE_MODEL,
  targetView: INK_ADD_TARGET_VIEW,
  zone: INK_ADD_ZONE,
  surface: INK_ADD_SURFACE,
});

export function assertInkAddSide(value: unknown): asserts value is InkAddSide {
  if (!INK_ADD_SIDES.includes(value as InkAddSide)) {
    throw new TypeError("Unknown ink placement");
  }
}
