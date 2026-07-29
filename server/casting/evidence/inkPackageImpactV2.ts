import type { CanonicalViewAngle } from "../../../shared/boardTypes";
import { inkPackageDirective } from "./evidencePackageRegistry";
import type {
  ClosedInkFeatureEntry,
  ClosedInkFeatureGraph,
} from "./inkFeatureGraph";
import {
  assertSupportedInkAnatomyTuple,
  inkViewDirectiveV2,
  type InkExistingSelectionImpact,
  type InkViewVisibility,
} from "./inkAnatomyRegistry";

export interface InkFeatureAngleAuthority {
  entry: ClosedInkFeatureEntry;
  impact: InkExistingSelectionImpact;
  visibility: InkViewVisibility | "authoring_truth";
  acceptedEvidenceAssetId: number | null;
  requiresCoverageProbe: boolean;
  requiresProjectionCandidate: boolean;
}

export interface InkPackageAngleAuthority {
  angle: CanonicalViewAngle;
  impact: InkExistingSelectionImpact;
  requiresCoverageProbe: boolean;
  requiresProjectionCandidate: boolean;
  features: readonly InkFeatureAngleAuthority[];
}

function aggregateImpact(
  features: readonly InkFeatureAngleAuthority[],
): InkExistingSelectionImpact {
  if (features.some((feature) => feature.impact === "affected")) {
    return "affected";
  }
  if (features.some((feature) => feature.impact === "uncertain")) {
    return "uncertain";
  }
  return "unaffected";
}

function acceptedEvidenceAssetId(
  entry: ClosedInkFeatureEntry,
  angle: CanonicalViewAngle,
): number | null {
  if (entry.version.sourceViewAngle === angle) {
    return entry.version.acceptedAssetId;
  }
  return entry.projections.find(
    (projection) => projection.evidence.targetViewAngle === angle,
  )?.evidence.acceptedAssetId ?? null;
}

function legacyAuthority(
  entry: ClosedInkFeatureEntry,
  angle: CanonicalViewAngle,
): InkFeatureAngleAuthority {
  const directive = inkPackageDirective({
    capabilityKey: "ink.add.front_upper_torso.v1",
    ontologyVersion: entry.version.ontologyVersion,
    zone: entry.version.zone,
    surface: entry.version.surface,
    side: entry.version.side,
    angle,
  });
  if (!directive) {
    throw new TypeError("Closed legacy tattoo graph has no package directive");
  }
  return Object.freeze({
    entry,
    impact: directive.existingSelectionImpact,
    visibility: directive.visibility,
    acceptedEvidenceAssetId: acceptedEvidenceAssetId(entry, angle),
    requiresCoverageProbe: false,
    requiresProjectionCandidate: false,
  });
}

function anywhereAuthority(
  entry: ClosedInkFeatureEntry,
  angle: CanonicalViewAngle,
): InkFeatureAngleAuthority {
  const anatomy = {
    zone: entry.version.zone,
    surface: entry.version.surface,
    side: entry.version.side,
  };
  assertSupportedInkAnatomyTuple(anatomy);
  const directive = inkViewDirectiveV2(anatomy, angle);
  const evidenceAssetId = acceptedEvidenceAssetId(entry, angle);
  return Object.freeze({
    entry,
    impact: directive.impact,
    visibility: directive.visibility,
    acceptedEvidenceAssetId: evidenceAssetId,
    requiresCoverageProbe:
      directive.requiresObservedCoverage && evidenceAssetId === null,
    requiresProjectionCandidate:
      evidenceAssetId === null
      && (
        directive.impact === "affected"
        || directive.impact === "uncertain"
      ),
  });
}

/**
 * Aggregate closed feature authority for one canonical target. Private feature
 * details remain server-side; callers project only action/refusal truth.
 */
export function inkPackageAngleAuthority(
  graph: ClosedInkFeatureGraph,
  angle: CanonicalViewAngle,
): InkPackageAngleAuthority {
  if (graph.entries.length === 0) {
    throw new TypeError("Tattoo package authority requires selected features");
  }
  const features = graph.entries.map((entry) =>
    entry.contract === "legacy_front_upper_torso_v1"
      ? legacyAuthority(entry, angle)
      : anywhereAuthority(entry, angle)
  );
  return Object.freeze({
    angle,
    impact: aggregateImpact(features),
    requiresCoverageProbe: features.some(
      (feature) => feature.requiresCoverageProbe,
    ),
    requiresProjectionCandidate: features.some(
      (feature) => feature.requiresProjectionCandidate,
    ),
    features: Object.freeze(features),
  });
}
