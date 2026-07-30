import type { NormalizedInkZone } from "./composer/inkZoneGuide";
import type {
  InkAnatomySide,
  InkAnatomyTuple,
  InkAnatomyZone,
} from "./inkAnatomyRegistry";
import {
  assertSupportedInkAnatomyTuple,
} from "./inkAnatomyRegistry";
import type {
  InkPoseAnalysis,
  InkPoseKeypointName,
  InkPosePoint,
} from "./inkPoseRuntime";

export const INK_POSE_GEOMETRY_RECIPE_VERSION =
  "ink.pose-geometry.v1" as const;

export type InkPoseGeometryFailureCode =
  | "landmark_missing"
  | "landmark_uncertain"
  | "geometry_invalid"
  | "surface_empty";

export class InkPoseGeometryError extends Error {
  constructor(
    readonly code: InkPoseGeometryFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "InkPoseGeometryError";
  }
}

export interface InkPoseAnatomyGuide {
  recipeVersion: typeof INK_POSE_GEOMETRY_RECIPE_VERSION;
  tuple: InkAnatomyTuple;
  width: number;
  height: number;
  mask: Uint8Array;
  normalizedSegments: readonly NormalizedInkZone[];
  minimumLandmarkScore: number;
}

export type InkPoseGeometryPoint = Readonly<{ x: number; y: number }>;
export type InkPoseGeometryPrimitive =
  | Readonly<{ kind: "capsule"; a: Point; b: Point; radius: number }>
  | Readonly<{ kind: "ellipse"; centre: Point; rx: number; ry: number }>
  | Readonly<{ kind: "polygon"; points: readonly Point[] }>;
type Point = InkPoseGeometryPoint;
type Primitive = InkPoseGeometryPrimitive;

const MIN_LANDMARK_SCORE = 0.65;
const MIN_PERSON_ALPHA = 128;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function point(value: InkPosePoint): Point {
  return Object.freeze({ x: value.x, y: value.y });
}

function midpoint(a: Point, b: Point): Point {
  return Object.freeze({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
}

function interpolate(a: Point, b: Point, ratio: number): Point {
  return Object.freeze({
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
  });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointMap(
  analysis: InkPoseAnalysis,
): ReadonlyMap<InkPoseKeypointName, InkPosePoint> {
  return new Map(analysis.landmarks.map((entry) => [entry.name, entry]));
}

function requiredPoint(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  name: InkPoseKeypointName,
): InkPosePoint {
  const value = points.get(name);
  if (!value) {
    throw new InkPoseGeometryError(
      "landmark_missing",
      `Tattoo geometry landmark is missing: ${name}`,
    );
  }
  if (
    value.score < MIN_LANDMARK_SCORE
    || value.x < -0.05
    || value.x > 1.05
    || value.y < -0.05
    || value.y > 1.05
  ) {
    throw new InkPoseGeometryError(
      "landmark_uncertain",
      `Tattoo geometry landmark is uncertain: ${name}`,
    );
  }
  return value;
}

function sideName(
  side: Exclude<InkAnatomySide, "centre">,
  suffix: string,
): InkPoseKeypointName {
  return `${side}_${suffix}` as InkPoseKeypointName;
}

function bilateralScale(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  left: InkPoseKeypointName,
  right: InkPoseKeypointName,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const value = distance(
    point(requiredPoint(points, left)),
    point(requiredPoint(points, right)),
  );
  if (value < minimum || value > maximum) {
    throw new InkPoseGeometryError(
      "geometry_invalid",
      `Tattoo ${label} scale is not geometrically plausible`,
    );
  }
  return value;
}

function shoulderScale(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
): number {
  return bilateralScale(
    points,
    "left_shoulder",
    "right_shoulder",
    0.025,
    0.85,
    "shoulder",
  );
}

function hipScale(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
): number {
  return bilateralScale(
    points,
    "left_hip",
    "right_hip",
    0.02,
    0.75,
    "hip",
  );
}

function torsoPolygon(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  zone: "upper_torso" | "lower_torso",
  side: InkAnatomySide,
): Primitive {
  const leftShoulder = point(requiredPoint(points, "left_shoulder"));
  const rightShoulder = point(requiredPoint(points, "right_shoulder"));
  const leftHip = point(requiredPoint(points, "left_hip"));
  const rightHip = point(requiredPoint(points, "right_hip"));
  const leftMid = interpolate(leftShoulder, leftHip, 0.52);
  const rightMid = interpolate(rightShoulder, rightHip, 0.52);
  const topLeft = zone === "upper_torso" ? leftShoulder : leftMid;
  const topRight = zone === "upper_torso" ? rightShoulder : rightMid;
  const bottomLeft = zone === "upper_torso" ? leftMid : leftHip;
  const bottomRight = zone === "upper_torso" ? rightMid : rightHip;
  const topCentre = midpoint(topLeft, topRight);
  const bottomCentre = midpoint(bottomLeft, bottomRight);
  if (side === "left") {
    return Object.freeze({
      kind: "polygon",
      points: Object.freeze([
        topCentre,
        topLeft,
        bottomLeft,
        bottomCentre,
      ]),
    });
  }
  if (side === "right") {
    return Object.freeze({
      kind: "polygon",
      points: Object.freeze([
        topRight,
        topCentre,
        bottomCentre,
        bottomRight,
      ]),
    });
  }
  return Object.freeze({
    kind: "polygon",
    points: Object.freeze([topLeft, topRight, bottomRight, bottomLeft]),
  });
}

function facePrimitive(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  zone: "face" | "scalp",
  side: InkAnatomySide,
): Primitive {
  const leftEar = point(requiredPoint(points, "left_ear"));
  const rightEar = point(requiredPoint(points, "right_ear"));
  const leftEye = point(requiredPoint(points, "left_eye"));
  const rightEye = point(requiredPoint(points, "right_eye"));
  const mouthLeft = point(requiredPoint(points, "mouth_left"));
  const mouthRight = point(requiredPoint(points, "mouth_right"));
  const eyeCentre = midpoint(leftEye, rightEye);
  const mouthCentre = midpoint(mouthLeft, mouthRight);
  const faceWidth = distance(leftEar, rightEar);
  const eyeMouth = distance(eyeCentre, mouthCentre);
  if (faceWidth < 0.015 || eyeMouth < 0.008) {
    throw new InkPoseGeometryError(
      "geometry_invalid",
      "Tattoo face geometry is not plausible",
    );
  }
  if (side !== "centre") {
    const sideEye = side === "left" ? leftEye : rightEye;
    const sideEar = side === "left" ? leftEar : rightEar;
    const sideMouth = side === "left" ? mouthLeft : mouthRight;
    const sideCentre = midpoint(sideEye, sideEar);
    if (zone === "scalp") {
      return Object.freeze({
        kind: "ellipse",
        centre: interpolate(sideCentre, sideMouth, -0.82),
        rx: Math.max(faceWidth * 0.27, distance(sideEye, sideEar) * 0.82),
        ry: Math.max(faceWidth * 0.46, eyeMouth * 1.8),
      });
    }
    return Object.freeze({
      kind: "ellipse",
      centre: interpolate(sideCentre, sideMouth, 0.52),
      rx: Math.max(faceWidth * 0.25, distance(sideEye, sideEar) * 0.78),
      ry: Math.max(faceWidth * 0.5, eyeMouth * 1.55),
    });
  }
  if (zone === "scalp") {
    return Object.freeze({
      kind: "ellipse",
      centre: interpolate(eyeCentre, mouthCentre, -1.35),
      rx: faceWidth * 0.57,
      ry: Math.max(faceWidth * 0.5, eyeMouth * 2.1),
    });
  }
  return Object.freeze({
    kind: "ellipse",
    centre: interpolate(eyeCentre, mouthCentre, 0.55),
    rx: faceWidth * 0.55,
    ry: Math.max(faceWidth * 0.58, eyeMouth * 1.75),
  });
}

function neckPrimitive(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  shoulderScale: number,
  side: InkAnatomySide,
): Primitive {
  const shoulders = midpoint(
    point(requiredPoint(points, "left_shoulder")),
    point(requiredPoint(points, "right_shoulder")),
  );
  const mouth = midpoint(
    point(requiredPoint(points, "mouth_left")),
    point(requiredPoint(points, "mouth_right")),
  );
  const top = interpolate(mouth, shoulders, 0.48);
  const bottom = interpolate(mouth, shoulders, 0.88);
  if (side !== "centre") {
    const shoulder = point(requiredPoint(points, sideName(side, "shoulder")));
    return Object.freeze({
      kind: "capsule",
      a: interpolate(top, shoulder, 0.24),
      b: interpolate(bottom, shoulder, 0.22),
      radius: shoulderScale * 0.09,
    });
  }
  return Object.freeze({
    kind: "capsule",
    a: top,
    b: bottom,
    radius: shoulderScale * 0.16,
  });
}

function sidedLimbPrimitives(
  points: ReadonlyMap<InkPoseKeypointName, InkPosePoint>,
  zone: InkAnatomyZone,
  side: Exclude<InkAnatomySide, "centre">,
): readonly Primitive[] {
  switch (zone) {
    case "shoulder": {
      const scale = shoulderScale(points);
      const shoulder = point(
        requiredPoint(points, sideName(side, "shoulder")),
      );
      return Object.freeze([{
        kind: "ellipse",
        centre: shoulder,
        rx: scale * 0.2,
        ry: scale * 0.2,
      }]);
    }
    case "upper_arm": {
      const scale = shoulderScale(points);
      return Object.freeze([{
        kind: "capsule",
        a: point(requiredPoint(points, sideName(side, "shoulder"))),
        b: point(requiredPoint(points, sideName(side, "elbow"))),
        radius: scale * 0.17,
      }]);
    }
    case "forearm": {
      const scale = shoulderScale(points);
      return Object.freeze([{
        kind: "capsule",
        a: point(requiredPoint(points, sideName(side, "elbow"))),
        b: point(requiredPoint(points, sideName(side, "wrist"))),
        radius: scale * 0.13,
      }]);
    }
    case "full_arm": {
      const scale = shoulderScale(points);
      const shoulder = point(
        requiredPoint(points, sideName(side, "shoulder")),
      );
      const elbow = point(requiredPoint(points, sideName(side, "elbow")));
      const wrist = point(requiredPoint(points, sideName(side, "wrist")));
      const index = point(requiredPoint(points, sideName(side, "index")));
      const pinky = point(requiredPoint(points, sideName(side, "pinky")));
      return Object.freeze([
        {
          kind: "capsule",
          a: shoulder,
          b: elbow,
          radius: scale * 0.17,
        },
        {
          kind: "capsule",
          a: elbow,
          b: wrist,
          radius: scale * 0.13,
        },
        {
          kind: "capsule",
          a: wrist,
          b: midpoint(index, pinky),
          radius: scale * 0.12,
        },
      ]);
    }
    case "hand": {
      const scale = shoulderScale(points);
      return Object.freeze([{
        kind: "capsule",
        a: point(requiredPoint(points, sideName(side, "wrist"))),
        b: midpoint(
          point(requiredPoint(points, sideName(side, "index"))),
          point(requiredPoint(points, sideName(side, "pinky"))),
        ),
        radius: scale * 0.12,
      }]);
    }
    case "hip": {
      const scale = hipScale(points);
      const hip = point(requiredPoint(points, sideName(side, "hip")));
      return Object.freeze([{
        kind: "ellipse",
        centre: hip,
        rx: scale * 0.3,
        ry: scale * 0.3,
      }]);
    }
    case "thigh": {
      const scale = hipScale(points);
      return Object.freeze([{
        kind: "capsule",
        a: point(requiredPoint(points, sideName(side, "hip"))),
        b: point(requiredPoint(points, sideName(side, "knee"))),
        radius: scale * 0.24,
      }]);
    }
    case "lower_leg": {
      const scale = hipScale(points);
      return Object.freeze([{
        kind: "capsule",
        a: point(requiredPoint(points, sideName(side, "knee"))),
        b: point(requiredPoint(points, sideName(side, "ankle"))),
        radius: scale * 0.18,
      }]);
    }
    case "full_leg": {
      const scale = hipScale(points);
      const hip = point(requiredPoint(points, sideName(side, "hip")));
      const knee = point(requiredPoint(points, sideName(side, "knee")));
      const ankle = point(requiredPoint(points, sideName(side, "ankle")));
      const heel = point(requiredPoint(points, sideName(side, "heel")));
      const footIndex = point(
        requiredPoint(points, sideName(side, "foot_index")),
      );
      return Object.freeze([
        {
          kind: "capsule",
          a: hip,
          b: knee,
          radius: scale * 0.24,
        },
        {
          kind: "capsule",
          a: knee,
          b: ankle,
          radius: scale * 0.18,
        },
        {
          kind: "capsule",
          a: midpoint(ankle, heel),
          b: footIndex,
          radius: scale * 0.17,
        },
      ]);
    }
    case "foot": {
      const scale = hipScale(points);
      const ankle = point(requiredPoint(points, sideName(side, "ankle")));
      const heel = point(requiredPoint(points, sideName(side, "heel")));
      return Object.freeze([{
        kind: "capsule",
        a: midpoint(ankle, heel),
        b: point(requiredPoint(points, sideName(side, "foot_index"))),
        radius: scale * 0.17,
      }]);
    }
    default:
      throw new InkPoseGeometryError(
        "geometry_invalid",
        `Tattoo limb geometry is unsupported: ${zone}`,
      );
  }
}

export function buildInkPoseGeometryPrimitives(
  tuple: InkAnatomyTuple,
  analysis: InkPoseAnalysis,
): readonly InkPoseGeometryPrimitive[] {
  assertSupportedInkAnatomyTuple(tuple);
  const points = pointMap(analysis);
  if (tuple.zone === "face" || tuple.zone === "scalp") {
    return Object.freeze([facePrimitive(points, tuple.zone, tuple.side)]);
  }
  if (tuple.zone === "neck") {
    return Object.freeze([
      neckPrimitive(points, shoulderScale(points), tuple.side),
    ]);
  }
  if (tuple.zone === "upper_torso" || tuple.zone === "lower_torso") {
    shoulderScale(points);
    hipScale(points);
    return Object.freeze([torsoPolygon(points, tuple.zone, tuple.side)]);
  }
  if (tuple.zone === "full_torso") {
    shoulderScale(points);
    hipScale(points);
    return Object.freeze([
      torsoPolygon(points, "upper_torso", "centre"),
      torsoPolygon(points, "lower_torso", "centre"),
    ]);
  }
  if (tuple.side === "centre") {
    throw new InkPoseGeometryError(
      "geometry_invalid",
      "A bilateral tattoo zone requires an anatomical side",
    );
  }
  return sidedLimbPrimitives(points, tuple.zone, tuple.side);
}

function pointSegmentDistance(
  x: number,
  y: number,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(x - a.x, y - a.y);
  const ratio = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(x - (a.x + dx * ratio), y - (a.y + dy * ratio));
}

function insidePolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = points.length - 1;
    current < points.length;
    previous = current, current += 1
  ) {
    const a = points[current]!;
    const b = points[previous]!;
    if (
      (a.y > y) !== (b.y > y)
      && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function primitiveBounds(primitive: Primitive): NormalizedInkZone {
  if (primitive.kind === "capsule") {
    const minX = Math.min(primitive.a.x, primitive.b.x) - primitive.radius;
    const maxX = Math.max(primitive.a.x, primitive.b.x) + primitive.radius;
    const minY = Math.min(primitive.a.y, primitive.b.y) - primitive.radius;
    const maxY = Math.max(primitive.a.y, primitive.b.y) + primitive.radius;
    const x = clamp(minX, 0, 1);
    const y = clamp(minY, 0, 1);
    return {
      x,
      y,
      width: clamp(maxX, 0, 1) - x,
      height: clamp(maxY, 0, 1) - y,
    };
  }
  if (primitive.kind === "ellipse") {
    const x = clamp(primitive.centre.x - primitive.rx, 0, 1);
    const y = clamp(primitive.centre.y - primitive.ry, 0, 1);
    return {
      x,
      y,
      width: clamp(primitive.centre.x + primitive.rx, 0, 1) - x,
      height: clamp(primitive.centre.y + primitive.ry, 0, 1) - y,
    };
  }
  const xs = primitive.points.map(({ x }) => x);
  const ys = primitive.points.map(({ y }) => y);
  const x = clamp(Math.min(...xs), 0, 1);
  const y = clamp(Math.min(...ys), 0, 1);
  return {
    x,
    y,
    width: clamp(Math.max(...xs), 0, 1) - x,
    height: clamp(Math.max(...ys), 0, 1) - y,
  };
}

function primitiveContains(primitive: Primitive, x: number, y: number): boolean {
  if (primitive.kind === "capsule") {
    return pointSegmentDistance(x, y, primitive.a, primitive.b)
      <= primitive.radius;
  }
  if (primitive.kind === "ellipse") {
    const dx = (x - primitive.centre.x) / primitive.rx;
    const dy = (y - primitive.centre.y) / primitive.ry;
    return dx * dx + dy * dy <= 1;
  }
  return insidePolygon(x, y, primitive.points);
}

function paintPrimitive(
  target: Uint8Array,
  primitive: Primitive,
  analysis: InkPoseAnalysis,
): NormalizedInkZone | null {
  const bounds = primitiveBounds(primitive);
  const minX = Math.max(0, Math.floor(bounds.x * analysis.width));
  const maxX = Math.min(
    analysis.width - 1,
    Math.ceil((bounds.x + bounds.width) * analysis.width),
  );
  const minY = Math.max(0, Math.floor(bounds.y * analysis.height));
  const maxY = Math.min(
    analysis.height - 1,
    Math.ceil((bounds.y + bounds.height) * analysis.height),
  );
  let paintedMinX = analysis.width;
  let paintedMaxX = -1;
  let paintedMinY = analysis.height;
  let paintedMaxY = -1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * analysis.width + x;
      if (
        analysis.personMask[index]! < MIN_PERSON_ALPHA
        || !primitiveContains(
          primitive,
          (x + 0.5) / analysis.width,
          (y + 0.5) / analysis.height,
        )
      ) {
        continue;
      }
      target[index] = 255;
      paintedMinX = Math.min(paintedMinX, x);
      paintedMaxX = Math.max(paintedMaxX, x);
      paintedMinY = Math.min(paintedMinY, y);
      paintedMaxY = Math.max(paintedMaxY, y);
    }
  }
  if (paintedMaxX < paintedMinX || paintedMaxY < paintedMinY) return null;
  return Object.freeze({
    x: paintedMinX / analysis.width,
    y: paintedMinY / analysis.height,
    width: (paintedMaxX - paintedMinX + 1) / analysis.width,
    height: (paintedMaxY - paintedMinY + 1) / analysis.height,
  });
}

export function buildInkPoseAnatomyGuide(
  tuple: InkAnatomyTuple,
  analysis: InkPoseAnalysis,
): InkPoseAnatomyGuide {
  assertSupportedInkAnatomyTuple(tuple);
  if (
    analysis.width < 1
    || analysis.height < 1
    || analysis.personMask.length !== analysis.width * analysis.height
  ) {
    throw new InkPoseGeometryError(
      "geometry_invalid",
      "Tattoo pose analysis dimensions are malformed",
    );
  }
  const points = pointMap(analysis);
  const primitives = buildInkPoseGeometryPrimitives(tuple, analysis);
  if (primitives.length < 1 || primitives.length > 4) {
    throw new InkPoseGeometryError(
      "geometry_invalid",
      "Tattoo pose geometry produced an invalid segment count",
    );
  }
  const mask = new Uint8Array(analysis.width * analysis.height);
  const segments = primitives
    .map((primitive) => paintPrimitive(mask, primitive, analysis))
    .filter((value): value is NormalizedInkZone => value !== null);
  if (segments.length !== primitives.length || !mask.some(Boolean)) {
    throw new InkPoseGeometryError(
      "surface_empty",
      "Tattoo anatomy is not materially visible in the person mask",
    );
  }
  const usedNames = new Set<InkPoseKeypointName>();
  for (const entry of Array.from(points.values())) {
    if (entry.score >= MIN_LANDMARK_SCORE) usedNames.add(entry.name);
  }
  const minimumLandmarkScore = Math.min(
    ...Array.from(usedNames, (name) => points.get(name)!.score),
  );
  return Object.freeze({
    recipeVersion: INK_POSE_GEOMETRY_RECIPE_VERSION,
    tuple: Object.freeze({ ...tuple }),
    width: analysis.width,
    height: analysis.height,
    mask,
    normalizedSegments: Object.freeze(segments),
    minimumLandmarkScore,
  });
}
