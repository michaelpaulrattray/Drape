import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import {
  INK_ADD_PACKAGE_DIRECTIVES,
  isSupportedInkPackageTuple,
} from "./evidencePackageRegistry";

/**
 * The close trio is framed as head-and-shoulders, so an upper-chest mark is
 * outside those images. The rear view cannot show an anterior mark. A walk
 * can expose a lateral chest mark, but a strict profile cannot reliably show
 * the centre chest. Left/right placement therefore invalidates Walk; centre
 * placement does not. The accepted Full view replaces its old selection and
 * is included here so the legacy source row is marked stale.
 *
 * This is server-owned product authority. The public composer may infer the
 * structured placement from natural language, but the client never decides
 * which canonical views remain compatible.
 */
export function affectedViewsForInkAdd(input: {
  capabilityKey: string;
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: string;
}): readonly CanonicalViewAngle[] {
  if (!isSupportedInkPackageTuple(input)) {
    // Unknown future ontology must fail closed: it may affect any view.
    return CANONICAL_VIEW_ANGLES;
  }
  return CANONICAL_VIEW_ANGLES.filter(
    (angle) =>
      INK_ADD_PACKAGE_DIRECTIVES[angle][input.side]
        .existingSelectionImpact === "affected",
  );
}
