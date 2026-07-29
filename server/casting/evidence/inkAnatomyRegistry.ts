import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import type { NormalizedInkZone } from "./composer/inkZoneGuide";

export const INK_ANYWHERE_CAPABILITY_KEY = "ink.add.anywhere.v2" as const;
export const INK_ACTIVE_FAMILY_KEY = "ink.add" as const;
export const INK_ANYWHERE_ONTOLOGY_VERSION = "body-zones.ink.v2" as const;
export const INK_ANYWHERE_AUTHORIZATION_RECIPE_VERSION =
  "ink.add.anywhere.authorization.v1" as const;
export const INK_ANYWHERE_COMPOSER_RECIPE_VERSION =
  "ink.add.anywhere.composer.v6" as const;
export const INK_ANYWHERE_READABLE_COMPOSER_RECIPE_VERSIONS =
  Object.freeze([
    "ink.add.anywhere.composer.v2",
    "ink.add.anywhere.composer.v3",
    "ink.add.anywhere.composer.v4",
    "ink.add.anywhere.composer.v5",
    INK_ANYWHERE_COMPOSER_RECIPE_VERSION,
  ] as const);
export const INK_ANYWHERE_PROBE_RECIPE_VERSION =
  "ink.add.anywhere.probe.v2" as const;
export const INK_ANYWHERE_PLACEMENT_AUDIT_RECIPE_VERSION =
  "ink.add.anywhere.placement-audit.v4" as const;
export const INK_ANYWHERE_VISIBILITY_RECIPE_VERSION =
  "ink.add.anywhere.visibility.v4" as const;
export const INK_ANYWHERE_PROJECTION_RECIPE_VERSION =
  "ink.add.anywhere.projection.v1" as const;
export const INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION =
  "ink.add.anywhere.projection.probe.v1" as const;
export const INK_ANYWHERE_EVIDENCE_MOSAIC_RECIPE_VERSION =
  "ink.add.anywhere.evidence-mosaic.v1" as const;
export const INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION =
  "ink.add.anywhere.coverage-probe.v1" as const;

export const INK_ANATOMY_ZONES = [
  "face",
  "scalp",
  "neck",
  "upper_torso",
  "lower_torso",
  "full_torso",
  "shoulder",
  "upper_arm",
  "forearm",
  "full_arm",
  "hand",
  "hip",
  "thigh",
  "lower_leg",
  "full_leg",
  "foot",
] as const;
export type InkAnatomyZone = typeof INK_ANATOMY_ZONES[number];

export const INK_ANATOMY_SURFACES = [
  "anterior",
  "lateral",
  "posterior",
  "circumferential",
  "dorsal",
  "palmar",
] as const;
export type InkAnatomySurface = typeof INK_ANATOMY_SURFACES[number];

export const INK_ANATOMY_SIDES = [
  "left",
  "centre",
  "right",
] as const;
export type InkAnatomySide = typeof INK_ANATOMY_SIDES[number];

export interface InkAnatomyTuple {
  zone: InkAnatomyZone;
  surface: InkAnatomySurface;
  side: InkAnatomySide;
}

type ZoneRule = Readonly<{
  surfaces: readonly InkAnatomySurface[];
  sides: readonly InkAnatomySide[];
  label: string;
}>;

function zoneRule(value: ZoneRule): ZoneRule {
  return Object.freeze({
    ...value,
    surfaces: Object.freeze([...value.surfaces]),
    sides: Object.freeze([...value.sides]),
  });
}

export const INK_ZONE_RULES = Object.freeze({
    face: zoneRule({
      surfaces: ["anterior", "lateral"],
      sides: ["left", "centre", "right"],
      label: "face",
    }),
    scalp: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "centre", "right"],
      label: "scalp",
    }),
    neck: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "centre", "right"],
      label: "neck",
    }),
    upper_torso: zoneRule({
      surfaces: ["anterior", "lateral", "posterior"],
      sides: ["left", "centre", "right"],
      label: "upper torso",
    }),
    lower_torso: zoneRule({
      surfaces: ["anterior", "lateral", "posterior"],
      sides: ["left", "centre", "right"],
      label: "lower torso",
    }),
    full_torso: zoneRule({
      surfaces: ["anterior", "posterior"],
      sides: ["centre"],
      label: "full torso",
    }),
    shoulder: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "right"],
      label: "shoulder",
    }),
    upper_arm: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "right"],
      label: "upper arm",
    }),
    forearm: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "right"],
      label: "forearm",
    }),
    full_arm: zoneRule({
      surfaces: ["circumferential"],
      sides: ["left", "right"],
      label: "arm · full sleeve",
    }),
    hand: zoneRule({
      surfaces: ["dorsal", "palmar", "lateral"],
      sides: ["left", "right"],
      label: "hand",
    }),
    hip: zoneRule({
      surfaces: ["anterior", "lateral", "posterior"],
      sides: ["left", "right"],
      label: "hip",
    }),
    thigh: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "right"],
      label: "thigh",
    }),
    lower_leg: zoneRule({
      surfaces: ["anterior", "lateral", "posterior", "circumferential"],
      sides: ["left", "right"],
      label: "lower leg",
    }),
    full_leg: zoneRule({
      surfaces: ["circumferential"],
      sides: ["left", "right"],
      label: "leg · full sleeve",
    }),
    foot: zoneRule({
      surfaces: ["dorsal", "lateral"],
      sides: ["left", "right"],
      label: "foot",
    }),
  } satisfies Readonly<Record<InkAnatomyZone, ZoneRule>>);

export type InkExistingSelectionImpact =
  | "affected"
  | "unaffected"
  | "uncertain";
export type InkViewVisibility =
  | "reproduce_visible"
  | "hidden_omit"
  | "outside_frame_omit"
  | "below_resolution_omit"
  | "conditional_probe";

export interface InkViewDirectiveV2 {
  impact: InkExistingSelectionImpact;
  visibility: InkViewVisibility;
  normalizedTargetZone: NormalizedInkZone | null;
  requiresObservedCoverage: boolean;
}

export interface InkAuthoringSourcePreference {
  angle: CanonicalViewAngle;
  requiresCoverageProbe: boolean;
}

const CLOSE_ANGLES = new Set<CanonicalViewAngle>([
  "frontClose",
  "threeQuarter",
  "sideClose",
]);
const HEAD_ZONES = new Set<InkAnatomyZone>(["face", "scalp", "neck"]);
const LIMB_ZONES = new Set<InkAnatomyZone>([
  "shoulder",
  "upper_arm",
  "forearm",
  "full_arm",
  "hand",
  "hip",
  "thigh",
  "lower_leg",
  "full_leg",
  "foot",
]);
const KNEE_FRAMED_OUTSIDE_ZONES = new Set<InkAnatomyZone>([
  "lower_leg",
  "full_leg",
  "foot",
]);

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedInkZone {
  return Object.freeze({ x, y, width, height });
}

const FULL_FRONT_CENTRE: Readonly<Record<InkAnatomyZone, NormalizedInkZone>> =
  Object.freeze({
    face: rect(0.39, 0.035, 0.22, 0.12),
    scalp: rect(0.38, 0.015, 0.24, 0.1),
    neck: rect(0.4, 0.12, 0.2, 0.1),
    upper_torso: rect(0.24, 0.18, 0.52, 0.25),
    lower_torso: rect(0.3, 0.37, 0.4, 0.2),
    full_torso: rect(0.23, 0.18, 0.54, 0.4),
    shoulder: rect(0.2, 0.18, 0.6, 0.17),
    upper_arm: rect(0.12, 0.23, 0.76, 0.25),
    forearm: rect(0.08, 0.39, 0.84, 0.27),
    full_arm: rect(0.08, 0.2, 0.84, 0.48),
    hand: rect(0.04, 0.58, 0.92, 0.17),
    hip: rect(0.27, 0.47, 0.46, 0.16),
    thigh: rect(0.25, 0.55, 0.5, 0.25),
    lower_leg: rect(0.28, 0.72, 0.44, 0.24),
    full_leg: rect(0.23, 0.54, 0.54, 0.43),
    foot: rect(0.25, 0.91, 0.5, 0.085),
  });

/**
 * The canonical 3:4 front/back slots are allowed to frame at the knees. Their
 * hands and thighs therefore sit materially lower than they do in a true
 * head-to-foot full-body view. Keep these overrides angle-specific: Walk
 * retains the full-body bands used by its motion framing.
 */
const FULL_ANGLE_ZONE_OVERRIDES: Readonly<
  Partial<
    Record<
      CanonicalViewAngle,
      Readonly<Partial<Record<InkAnatomyZone, NormalizedInkZone>>>
    >
  >
> = Object.freeze({
  frontFull: Object.freeze({
    hand: rect(0.04, 0.65, 0.92, 0.27),
    thigh: rect(0.25, 0.76, 0.5, 0.24),
  }),
  backFull: Object.freeze({
    hand: rect(0.04, 0.65, 0.92, 0.27),
    thigh: rect(0.25, 0.76, 0.5, 0.24),
  }),
});

const CLOSE_CENTRE: Readonly<Record<"face" | "scalp" | "neck", NormalizedInkZone>> =
  Object.freeze({
    face: rect(0.27, 0.2, 0.46, 0.48),
    scalp: rect(0.24, 0.04, 0.52, 0.32),
    neck: rect(0.3, 0.62, 0.4, 0.28),
  });
const CLOSE_SHOULDER = rect(0.08, 0.76, 0.84, 0.235);
const CLOSE_UPPER_ARM = rect(0.02, 0.78, 0.96, 0.215);
const SIDED_ZONE_WIDTH_FRACTION = 0.42;
const FRAME_MIDLINE_MARGIN = 0.03;

function sidedZone(
  base: NormalizedInkZone,
  angle: CanonicalViewAngle,
  side: InkAnatomySide,
): NormalizedInkZone {
  if (side === "centre" || angle === "sideFull" || angle === "sideClose") {
    return base;
  }
  const leftAppearsFrameRight = angle !== "backFull";
  const usesFrameRight =
    side === "left" ? leftAppearsFrameRight : !leftAppearsFrameRight;
  const desiredWidth = Math.max(
    0.12,
    base.width * SIDED_ZONE_WIDTH_FRACTION,
  );
  const baseRight = base.x + base.width;
  const x = usesFrameRight
    ? Math.max(0.5 + FRAME_MIDLINE_MARGIN, baseRight - desiredWidth)
    : base.x;
  const width = usesFrameRight
    ? baseRight - x
    : Math.min(desiredWidth, 0.5 - FRAME_MIDLINE_MARGIN - x);
  if (width <= 0) throw new TypeError("Invalid sided tattoo geometry");
  return rect(x, base.y, width, base.height);
}

function targetZone(
  tuple: InkAnatomyTuple,
  angle: CanonicalViewAngle,
): NormalizedInkZone | null {
  if (CLOSE_ANGLES.has(angle)) {
    if (!HEAD_ZONES.has(tuple.zone)) {
      if (tuple.zone === "shoulder") {
        return sidedZone(CLOSE_SHOULDER, angle, tuple.side);
      }
      if (tuple.zone === "upper_arm" || tuple.zone === "full_arm") {
        return sidedZone(CLOSE_UPPER_ARM, angle, tuple.side);
      }
      return null;
    }
    return sidedZone(
      CLOSE_CENTRE[tuple.zone as "face" | "scalp" | "neck"],
      angle,
      tuple.side,
    );
  }
  const base =
    FULL_ANGLE_ZONE_OVERRIDES[angle]?.[tuple.zone]
    ?? FULL_FRONT_CENTRE[tuple.zone];
  if (angle === "sideFull") {
    return rect(
      Math.max(0.08, base.x - 0.08),
      base.y,
      Math.min(0.84, base.width + 0.16),
      base.height,
    );
  }
  return sidedZone(base, angle, tuple.side);
}

export function isSupportedInkAnatomyTuple(
  value: {
    zone: string;
    surface: string;
    side: string;
  },
): value is InkAnatomyTuple {
  if (!(INK_ANATOMY_ZONES as readonly string[]).includes(value.zone)) {
    return false;
  }
  const rule = INK_ZONE_RULES[value.zone as InkAnatomyZone];
  return (rule.surfaces as readonly string[]).includes(value.surface)
    && (rule.sides as readonly string[]).includes(value.side);
}

export function assertSupportedInkAnatomyTuple(
  value: {
    zone: string;
    surface: string;
    side: string;
  },
): asserts value is InkAnatomyTuple {
  if (!isSupportedInkAnatomyTuple(value)) {
    throw new TypeError("Unsupported tattoo anatomy");
  }
}

export function inkAnatomyLabel(tuple: InkAnatomyTuple): string {
  assertSupportedInkAnatomyTuple(tuple);
  const side = tuple.side === "centre"
    ? ""
    : `${tuple.side[0].toUpperCase()}${tuple.side.slice(1)} `;
  return `${side}${INK_ZONE_RULES[tuple.zone].label}`;
}

export interface InkAnatomicalSideAuthority {
  guideLabel: string;
  prompt: string;
}

/**
 * Canonical views have a server-owned camera direction. Spell the subject's
 * anatomical side out in frame-relative terms so neither the image composer
 * nor the placement audit can reinterpret "right" as viewer-right.
 */
export function inkAnatomicalSideAuthority(
  tuple: InkAnatomyTuple,
  angle: CanonicalViewAngle,
): InkAnatomicalSideAuthority {
  assertSupportedInkAnatomyTuple(tuple);
  if (!(CANONICAL_VIEW_ANGLES as readonly string[]).includes(angle)) {
    throw new TypeError("Unknown canonical view");
  }
  const subjectSide = tuple.side.toUpperCase();
  if (tuple.side === "centre") {
    return Object.freeze({
      guideLabel: "SUBJECT CENTRELINE",
      prompt:
        "The authorized placement is on the subject's anatomical centreline.",
    });
  }
  if (angle === "frontClose" || angle === "frontFull") {
    const frameSide = tuple.side === "right" ? "LEFT" : "RIGHT";
    return Object.freeze({
      guideLabel: `SUBJECT ${subjectSide} - FRAME ${frameSide}`,
      prompt:
        `This is a front-facing view. The subject's anatomical ${subjectSide}`
        + ` appears on FRAME ${frameSide}. Never use viewer-${tuple.side} for`
        + ` subject-${tuple.side}.`,
    });
  }
  if (angle === "backFull") {
    const frameSide = tuple.side === "right" ? "RIGHT" : "LEFT";
    return Object.freeze({
      guideLabel: `SUBJECT ${subjectSide} - FRAME ${frameSide}`,
      prompt:
        `This is a back-facing view. The subject's anatomical ${subjectSide}`
        + ` appears on FRAME ${frameSide}.`,
    });
  }
  return Object.freeze({
    guideLabel: `SUBJECT ${subjectSide} - RIGHT-FACING VIEW`,
    prompt:
      `The subject faces toward frame-right in this canonical ${angle} view.`
      + ` Judge ${tuple.side} only as the subject's own anatomical side; never`
      + " substitute viewer-left or viewer-right.",
  });
}

function closeVisibility(
  tuple: InkAnatomyTuple,
  angle: CanonicalViewAngle,
): InkViewVisibility {
  if (!HEAD_ZONES.has(tuple.zone)) {
    if (
      (
        tuple.zone === "shoulder"
        || tuple.zone === "upper_arm"
        || tuple.zone === "full_arm"
      )
      && angle !== "frontClose"
    ) {
      return "conditional_probe";
    }
    return "outside_frame_omit";
  }
  if (tuple.surface === "circumferential") return "reproduce_visible";
  if (angle === "frontClose") {
    if (tuple.surface === "anterior") return "reproduce_visible";
    if (tuple.surface === "lateral") return "conditional_probe";
    return "hidden_omit";
  }
  if (angle === "threeQuarter") {
    if (tuple.surface === "posterior") return "hidden_omit";
    return "reproduce_visible";
  }
  if (tuple.surface === "lateral") return "reproduce_visible";
  if (tuple.surface === "anterior" || tuple.surface === "posterior") {
    return "conditional_probe";
  }
  return "hidden_omit";
}

function fullVisibility(
  tuple: InkAnatomyTuple,
  angle: CanonicalViewAngle,
): InkViewVisibility {
  if (tuple.zone === "face" || tuple.zone === "scalp") {
    return "below_resolution_omit";
  }
  if (
    (angle === "frontFull" || angle === "backFull")
    && KNEE_FRAMED_OUTSIDE_ZONES.has(tuple.zone)
  ) {
    return "outside_frame_omit";
  }
  if (tuple.surface === "circumferential") return "reproduce_visible";
  if (angle === "frontFull") {
    if (tuple.surface === "anterior" || tuple.surface === "dorsal") {
      return "reproduce_visible";
    }
    if (tuple.surface === "lateral" || tuple.surface === "palmar") {
      return "conditional_probe";
    }
    return "hidden_omit";
  }
  if (angle === "backFull") {
    if (tuple.surface === "posterior" || tuple.surface === "dorsal") {
      return "reproduce_visible";
    }
    if (tuple.surface === "lateral" || tuple.surface === "palmar") {
      return "conditional_probe";
    }
    return "hidden_omit";
  }
  if (tuple.surface === "lateral") return "conditional_probe";
  if (
    tuple.surface === "anterior"
    || tuple.surface === "posterior"
    || tuple.surface === "dorsal"
    || tuple.surface === "palmar"
  ) {
    return "conditional_probe";
  }
  return "hidden_omit";
}

export function inkViewDirectiveV2(
  tuple: InkAnatomyTuple,
  angle: CanonicalViewAngle,
): InkViewDirectiveV2 {
  assertSupportedInkAnatomyTuple(tuple);
  if (!(CANONICAL_VIEW_ANGLES as readonly string[]).includes(angle)) {
    throw new TypeError("Unknown canonical view");
  }
  const visibility = CLOSE_ANGLES.has(angle)
    ? closeVisibility(tuple, angle)
    : fullVisibility(tuple, angle);
  const impact: InkExistingSelectionImpact =
    visibility === "reproduce_visible"
      ? "affected"
      : visibility === "conditional_probe"
        ? "uncertain"
        : "unaffected";
  return Object.freeze({
    impact,
    visibility,
    normalizedTargetZone:
      visibility === "reproduce_visible" || visibility === "conditional_probe"
        ? targetZone(tuple, angle)
        : null,
    requiresObservedCoverage: visibility === "conditional_probe",
  });
}

/**
 * A selected image becomes stale whenever the accepted feature is known or
 * plausibly able to appear in it. Conditional angles earn a free observed-
 * coverage probe before any charged projection; leaving them current would
 * silently present an unverified featureless image as package truth.
 */
export function inkInvalidatedAnglesV2(
  tuple: InkAnatomyTuple,
): readonly CanonicalViewAngle[] {
  assertSupportedInkAnatomyTuple(tuple);
  return Object.freeze(
    CANONICAL_VIEW_ANGLES.filter(
      (angle) => inkViewDirectiveV2(tuple, angle).impact !== "unaffected",
    ),
  );
}

function preferredAngles(tuple: InkAnatomyTuple): CanonicalViewAngle[] {
  if (tuple.zone === "face" || tuple.zone === "scalp") {
    if (tuple.surface === "posterior") {
      return ["sideClose", "threeQuarter", "backFull"];
    }
    if (tuple.surface === "lateral") {
      return ["sideClose", "threeQuarter", "frontClose"];
    }
    return ["frontClose", "threeQuarter", "sideClose"];
  }
  if (tuple.zone === "neck") {
    if (tuple.surface === "posterior") return ["backFull", "sideClose"];
    if (tuple.surface === "lateral") {
      return ["sideClose", "threeQuarter", "sideFull", "frontClose"];
    }
    if (tuple.surface === "circumferential") {
      return ["threeQuarter", "sideClose", "frontClose", "backFull"];
    }
    return ["frontClose", "frontFull", "threeQuarter"];
  }
  if (tuple.surface === "posterior") return ["backFull", "sideFull"];
  if (tuple.surface === "lateral") return ["sideFull", "frontFull", "backFull"];
  if (tuple.surface === "circumferential") {
    return ["frontFull", "sideFull", "backFull"];
  }
  if (tuple.surface === "palmar") return ["frontFull", "sideFull"];
  if (tuple.surface === "dorsal") return ["frontFull", "backFull", "sideFull"];
  return ["frontFull", "sideFull"];
}

export function inkAuthoringSourcePreferences(
  tuple: InkAnatomyTuple,
): readonly InkAuthoringSourcePreference[] {
  assertSupportedInkAnatomyTuple(tuple);
  const seen = new Set<CanonicalViewAngle>();
  const preferences: InkAuthoringSourcePreference[] = [];
  for (const angle of preferredAngles(tuple)) {
    if (seen.has(angle)) continue;
    seen.add(angle);
    const directive = inkViewDirectiveV2(tuple, angle);
    if (
      directive.visibility === "hidden_omit"
      || directive.visibility === "outside_frame_omit"
      || directive.visibility === "below_resolution_omit"
    ) {
      continue;
    }
    preferences.push(Object.freeze({
      angle,
      requiresCoverageProbe: directive.requiresObservedCoverage,
    }));
  }
  return Object.freeze(preferences);
}

export interface CurrentInkSourceView {
  angle: CanonicalViewAngle;
  assetId: number;
  compatibility: "current" | "stale" | "unverified" | null;
  pinned: boolean;
}

export function chooseCurrentInkAuthoringSource(
  tuple: InkAnatomyTuple,
  views: readonly CurrentInkSourceView[],
): InkAuthoringSourcePreference & { assetId: number } | null {
  const byAngle = new Map(views.map((view) => [view.angle, view]));
  for (const preference of inkAuthoringSourcePreferences(tuple)) {
    const view = byAngle.get(preference.angle);
    if (
      view
      && Number.isSafeInteger(view.assetId)
      && view.assetId > 0
      && view.compatibility === "current"
      && !view.pinned
    ) {
      return Object.freeze({ ...preference, assetId: view.assetId });
    }
  }
  return null;
}

export function allSupportedInkAnatomyTuples(): readonly InkAnatomyTuple[] {
  const tuples: InkAnatomyTuple[] = [];
  for (const zone of INK_ANATOMY_ZONES) {
    const rule = INK_ZONE_RULES[zone];
    for (const surface of rule.surfaces) {
      for (const side of rule.sides) {
        tuples.push(Object.freeze({ zone, surface, side }));
      }
    }
  }
  return Object.freeze(tuples);
}

export const ALL_SUPPORTED_INK_ANATOMY_TUPLES =
  allSupportedInkAnatomyTuples();

export function isLimbInkZone(zone: InkAnatomyZone): boolean {
  return LIMB_ZONES.has(zone);
}
