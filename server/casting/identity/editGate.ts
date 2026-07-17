import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { Type } from "@google/genai";
import { getAiClient, SAFETY_SETTINGS, safeResponseText, withTimeout } from "../geminiClient";
import { withTextQueue } from "../geminiQueue";
import { toInlinePart } from "../../wardrobe/utils";
import { createModuleLogger } from "../../logging/logger";
import { AUTHORIZABLE_FIELDS, FIELD_LABELS } from "./identityFieldHandlers";
import {
  dependentFieldsForPatch,
  explicitFieldsForPatch,
} from "./identityDependencies";
import type {
  AuthorizableIdentityField,
  AuthorizedIdentityEdit,
  AuthorizedIdentityPatch,
} from "./identityTypes";

const log = createModuleLogger("casting/identity/editGate");

export const OVERALL_IDENTITY_DIMENSION = "overall.facialIdentity" as const;
export const PERMANENT_MARKS_DIMENSION = "marks.visiblePermanent" as const;

export type IdentityGateDimension =
  | AuthorizableIdentityField
  | typeof OVERALL_IDENTITY_DIMENSION
  | typeof PERMANENT_MARKS_DIMENSION;

export type DimensionStatus = "unchanged" | "changed" | "not_observable" | "uncertain";

const STATUS_VALUES = new Set<DimensionStatus>([
  "unchanged",
  "changed",
  "not_observable",
  "uncertain",
]);

const ALWAYS_PROTECTED: readonly IdentityGateDimension[] = [
  OVERALL_IDENTITY_DIMENSION,
  PERMANENT_MARKS_DIMENSION,
];

const DIMENSION_LABELS: Record<IdentityGateDimension, string> = {
  ...FIELD_LABELS,
  [OVERALL_IDENTITY_DIMENSION]: "overall facial identity (the same underlying individual)",
  [PERMANENT_MARKS_DIMENSION]: "visible permanent marks (tattoos, scars, freckles, beauty spots, birthmarks, piercings)",
};

export function authorizedFieldsForPatch(patch: AuthorizedIdentityPatch): AuthorizableIdentityField[] {
  return explicitFieldsForPatch(patch);
}

export function protectedDimensionsFor(patch: AuthorizedIdentityPatch): IdentityGateDimension[] {
  const authorized = new Set<AuthorizableIdentityField>([
    ...authorizedFieldsForPatch(patch),
    ...dependentFieldsForPatch(patch),
  ]);
  return [
    ...ALWAYS_PROTECTED,
    ...AUTHORIZABLE_FIELDS.filter((field) => !authorized.has(field)),
  ];
}

/** Dimensions a same-frame visual comparison can honestly inspect. Hidden
 * fields remain protected by the typed patch/atomic commit, not by a visual
 * claim the image cannot support. */
export function expectedObservableDimensions(
  frame: "HEADSHOT" | "FULL_BODY",
): Set<IdentityGateDimension> {
  const dimensions = new Set<IdentityGateDimension>([
    OVERALL_IDENTITY_DIMENSION,
    PERMANENT_MARKS_DIMENSION,
    ...AUTHORIZABLE_FIELDS,
  ]);
  if (frame === "HEADSHOT") dimensions.delete("person.build");
  return dimensions;
}

function renderValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function renderAuthorizedChanges(patch: AuthorizedIdentityPatch): string {
  return patch.edits.map((edit) => {
    const field = edit.kind === "leaf" ? edit.leaf : edit.edit.field;
    const value = edit.kind === "leaf" ? edit.value : edit.edit.value;
    return `- ${field} (${FIELD_LABELS[field]}): ${renderValue(value)}`;
  }).join("\n");
}

export interface ParsedGateResponse {
  checked: true;
  statuses: Record<string, DimensionStatus>;
}

export function parseGateResponse(
  raw: string,
  queried: readonly IdentityGateDimension[],
): ParsedGateResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const top = parsed as Record<string, unknown>;
  if (Object.keys(top).length !== 1 || !top.dimensions || typeof top.dimensions !== "object" || Array.isArray(top.dimensions)) {
    return null;
  }
  const dimensions = top.dimensions as Record<string, unknown>;
  const expectedKeys = [...queried].sort();
  const actualKeys = Object.keys(dimensions).sort();
  if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, i) => key !== actualKeys[i])) {
    return null;
  }
  const statuses: Record<string, DimensionStatus> = {};
  for (const key of expectedKeys) {
    const value = dimensions[key];
    if (typeof value !== "string" || !STATUS_VALUES.has(value as DimensionStatus)) return null;
    statuses[key] = value as DimensionStatus;
  }
  return { checked: true, statuses };
}

export function violationsForStatuses(
  queried: readonly IdentityGateDimension[],
  statuses: Record<string, DimensionStatus>,
  frame: "HEADSHOT" | "FULL_BODY",
): IdentityGateDimension[] {
  const observable = expectedObservableDimensions(frame);
  return queried.filter((dimension) => {
    const status = statuses[dimension];
    // Strict parsing makes a missing key unreachable in the live path, but
    // this exported decision helper must remain fail-closed on its own.
    if (status === undefined) return true;
    if (status === "changed" || status === "uncertain") return true;
    return status === "not_observable" && observable.has(dimension);
  });
}

export interface IdentityGateVerdict {
  ok: boolean;
  checked: boolean;
  violations: IdentityGateDimension[];
  statuses?: Record<string, DimensionStatus>;
}

export interface VerifyIdentityEditInput {
  sourceImage: string;
  candidateImage: string;
  patch: AuthorizedIdentityPatch;
  frame: "HEADSHOT" | "FULL_BODY";
}

export async function verifyIdentityEdit(input: VerifyIdentityEditInput): Promise<IdentityGateVerdict> {
  if (process.env.IDENTITY_GATE_FORCE_UNAVAILABLE === "1") {
    log.warn("[IdentityEditGate] force-unavailable hook active");
    return { ok: false, checked: false, violations: [] };
  }
  if (process.env.IDENTITY_GATE_FORCE_FAIL === "1") {
    log.warn("[IdentityEditGate] force-fail hook active");
    return { ok: false, checked: true, violations: [OVERALL_IDENTITY_DIMENSION] };
  }

  const queried = protectedDimensionsFor(input.patch);
  const expectedConsequences = dependentFieldsForPatch(input.patch);
  const observable = expectedObservableDimensions(input.frame);
  const prompt = `You are the fail-closed identity authority for a casting reference system.
Image 1 is the official pre-edit source. Image 2 is a generated candidate.

AUTHORIZED CHANGES (expected; do not count these exact fields as differences):
${renderAuthorizedChanges(input.patch)}

EXPECTED PHYSICAL CONSEQUENCES (do not count these bounded hair-geometry fields as differences):
${expectedConsequences.length > 0 ? expectedConsequences.map((field) => `- ${field}: ${FIELD_LABELS[field]}`).join("\n") : "- none"}

Evaluate every queried protected dimension independently. Do not assume two people are the same merely because they share demographic traits. "${OVERALL_IDENTITY_DIMENSION}" asks whether this remains the same underlying individual after allowing only the authorized changes.

Status vocabulary:
- unchanged: visibly preserved
- changed: visibly different
- not_observable: this frame cannot honestly show it
- uncertain: visible enough to assess but identity preservation is unclear

Queried dimensions:
${queried.map((dimension) => `- ${dimension}: ${DIMENSION_LABELS[dimension]} (expected observable: ${observable.has(dimension)})`).join("\n")}

Return strict JSON only, with exactly this top-level key and exactly one key for every queried dimension:
{"dimensions":{"dimension.id":"unchanged|changed|not_observable|uncertain"}}`;

  try {
    const [sourcePart, candidatePart] = await Promise.all([
      toInlinePart(input.sourceImage),
      toInlinePart(input.candidateImage),
    ]);
    const ai = getAiClient();
    const response = await withTextQueue(
      () => withTimeout(
        ai.models.generateContent({
          model: TEXT_ECONOMY,
          contents: [{ parts: [{ text: prompt }, sourcePart, candidatePart] }],
          config: {
            responseMimeType: "application/json",
            // The gate asks for every protected leaf. Relying on prompt text
            // alone produced occasional missing-key JSON in the paid W5
            // calibration, so the provider now receives the same closed
            // shape that parseGateResponse enforces locally.
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dimensions: {
                  type: Type.OBJECT,
                  properties: Object.fromEntries(queried.map((dimension) => [
                    dimension,
                    { type: Type.STRING, enum: Array.from(STATUS_VALUES) },
                  ])),
                  required: [...queried],
                },
              },
              required: ["dimensions"],
            },
            maxOutputTokens: 4096,
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        30_000,
        "IdentityEditGate",
      ),
      "identity-edit-gate",
    );
    const parsed = parseGateResponse(safeResponseText(response).trim(), queried);
    if (!parsed) {
      log.warn({ queried }, "[IdentityEditGate] malformed verdict");
      return { ok: false, checked: false, violations: [] };
    }
    const violations = violationsForStatuses(queried, parsed.statuses, input.frame);
    const ok = violations.length === 0;
    log.info({ ok, violations }, "[IdentityEditGate] verdict");
    return { ok, checked: true, violations, statuses: parsed.statuses };
  } catch (error) {
    log.warn({ err: error }, "[IdentityEditGate] checker unavailable; failing closed");
    return { ok: false, checked: false, violations: [] };
  }
}
