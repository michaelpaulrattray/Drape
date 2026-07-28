import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SIDES,
  INK_ADD_SURFACE,
  INK_ADD_TARGET_VIEW,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";

/**
 * The close trio is framed as head-and-shoulders, so an upper-chest mark is
 * outside those images. The rear view cannot show an anterior mark. The walk
 * is a full-body profile and can expose the front/lateral chest, so it must be
 * refreshed from evidence after Accept. The accepted Full view replaces its
 * old selection and is included here so the legacy source row is marked stale.
 *
 * This is server-owned product authority. The public composer may infer the
 * structured placement from natural language, but the client never decides
 * which canonical views remain compatible.
 */
const FRONT_UPPER_TORSO_VIEW_IMPACT = {
  frontClose: "unaffected",
  threeQuarter: "unaffected",
  [INK_ADD_TARGET_VIEW]: "affected",
  sideClose: "unaffected",
  sideFull: "affected",
  backFull: "unaffected",
} as const satisfies Record<CanonicalViewAngle, "affected" | "unaffected">;

export function affectedViewsForInkAdd(input: {
  capabilityKey: string;
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: string;
}): readonly CanonicalViewAngle[] {
  const supportedSide = (INK_ADD_SIDES as readonly string[]).includes(input.side);
  if (
    input.capabilityKey !== INK_ADD_CAPABILITY_KEY
    || input.ontologyVersion !== INK_ADD_ONTOLOGY_VERSION
    || input.zone !== INK_ADD_ZONE
    || input.surface !== INK_ADD_SURFACE
    || !supportedSide
  ) {
    // Unknown future ontology must fail closed: it may affect any view.
    return CANONICAL_VIEW_ANGLES;
  }
  return CANONICAL_VIEW_ANGLES.filter(
    (angle) => FRONT_UPPER_TORSO_VIEW_IMPACT[angle] === "affected",
  );
}
