/**
 * structuredEdit — the hardened structured attribute editor's server half
 * (IDENTITY_EDIT_INTERIM_POLICY §8.2/§13.5, ratified R3; Batch C).
 *
 * `applyModelEdit`'s update branch is a `source:"structured"` §8.6 patch
 * commit: every change resolves to an authorizable identity field with its
 * REAL typed value (closed enums, numeric age, the {name,pct} ethnicity-blend
 * array with its dual-write) — never prose reductions, never unknown keys,
 * never presentation smuggling. Non-identity keys refuse honestly.
 */
import {
  type AuthorizedIdentityEdit,
  type AuthorizedIdentityPatch,
  type EnumWithOverrideValue,
} from "./identityTypes";
import {
  isValidAgeValue,
  isValidBodyType,
  isValidEthnicityBlend,
  isValidGender,
  isValidOverridePairValue,
  isValidSkinTone,
  type OverridePairField,
} from "./identityFieldHandlers";
import { RELATIONAL_VALUE_PATTERN, deterministicStage } from "./editAuthority";
import { REFUSAL_COPY } from "./refusalCopy";
import {
  CHAR_OPTIONS,
  CORE_FACE_SHAPES,
  HAIR_FADES,
  HAIR_FLYAWAYS,
  HAIR_FRINGES,
  HAIR_LENGTHS,
  HAIR_PARTINGS,
  HAIR_TEXTURES,
  HAIR_TUCKS,
  HAIR_VOLUMES,
  SKIN_FINISHES,
} from "../../../shared/castingOptions";

export type StructuredPatchResult =
  | { ok: true; patch: AuthorizedIdentityPatch }
  | {
      ok: false;
      code: "unsupported_key" | "invalid_value" | "forbidden_content" | "empty";
      message: string;
    };

/** Base/override pair wiring: form key → field + twin. */
const PAIR_FIELDS: Array<{
  field: OverridePairField;
  baseKey: string;
  overrideKey: string;
}> = [
  { field: "person.hair.style", baseKey: "hairStyle", overrideKey: "hairStyleOverride" },
  { field: "person.hair.color", baseKey: "hairColor", overrideKey: "hairColorOverride" },
  { field: "person.face.eyeColor", baseKey: "eyeColor", overrideKey: "eyeColorOverride" },
  { field: "person.face.facialHair", baseKey: "facialHair", overrideKey: "facialHairOverride" },
  { field: "person.skin.texture", baseKey: "skinTexture", overrideKey: "skinTextureOverride" },
];

/** Descriptor leaves: form key → field. */
const DESCRIPTOR_FIELDS: Array<{ field: import("./identityTypes").SupportedIdentityLeaf; key: string }> = [
  { field: "person.face.faceShape", key: "faceShape" },
  { field: "person.face.jawline", key: "jawline" },
  { field: "person.face.cheekbones", key: "cheekbones" },
  { field: "person.face.cheeks", key: "cheeks" },
  { field: "person.face.eyeShape", key: "eyeShape" },
  { field: "person.face.noseShape", key: "noseShape" },
  { field: "person.face.lipShape", key: "lipShape" },
  { field: "person.face.browShape", key: "eyebrowStyle" },
  { field: "person.hair.length", key: "hairLength" },
  { field: "person.hair.texture", key: "hairTexture" },
  { field: "person.hair.fringe", key: "hairFringe" },
  { field: "person.hair.parting", key: "hairParting" },
  { field: "person.hair.volume", key: "hairVolume" },
  { field: "person.hair.fade", key: "hairFade" },
  { field: "person.hair.hairline", key: "hairHairline" },
  { field: "person.hair.tuck", key: "hairTuck" },
  { field: "person.hair.flyaways", key: "hairFlyaways" },
  { field: "person.skin.finish", key: "skinFinish" },
];

const STRUCTURED_KEYS = ["bodyType", "age", "gender", "skinTone", "ethnicity", "ethnicityBlend"] as const;

/** Every key the UPDATE branch may carry. Anything else — presentation,
 *  creation-context (brand/vibe/brief/features), references, unknowns —
 *  refuses; a post-creation `features` update is exactly the escape hatch
 *  §5.2 closes. */
export const STRUCTURED_UPDATE_KEYS: ReadonlySet<string> = new Set([
  ...STRUCTURED_KEYS,
  ...PAIR_FIELDS.flatMap((p) => [p.baseKey, p.overrideKey]),
  ...DESCRIPTOR_FIELDS.map((d) => d.key),
]);

const UPDATE_KEY_REFUSAL =
  "Draft updates change identity attributes only — brand, vibe, brief, and notes are set at casting. Fork or re-cast to change those.";

/**
 * Fields whose UI is a CLOSED select — the wire boundary enforces exact
 * membership in the shared option list (review finding 4: the structured
 * editor must not become a second, weaker authorization boundary that
 * accepts arbitrary prose in enum channels).
 */
const CLOSED_DESCRIPTOR_OPTIONS: Record<string, readonly string[]> = {
  faceShape: CORE_FACE_SHAPES,
  jawline: CHAR_OPTIONS.jawline,
  cheekbones: CHAR_OPTIONS.cheekbones,
  cheeks: CHAR_OPTIONS.cheeks,
  eyeShape: CHAR_OPTIONS.eyeShape,
  noseShape: CHAR_OPTIONS.noseShape,
  lipShape: CHAR_OPTIONS.lipShape,
  eyebrowStyle: CHAR_OPTIONS.eyebrows,
  hairLength: HAIR_LENGTHS,
  hairTexture: HAIR_TEXTURES,
  hairFringe: HAIR_FRINGES,
  hairParting: HAIR_PARTINGS,
  hairVolume: HAIR_VOLUMES,
  hairTuck: HAIR_TUCKS,
  hairFade: HAIR_FADES,
  hairFlyaways: HAIR_FLYAWAYS,
  skinFinish: SKIN_FINISHES,
};

// (Founder final ruling 2026-07-16: Long and Very Long are VALID durable
// identity values at this door — R1b's R6 refusal is reversed. Length is a
// separate identity value from style: "Long Layers" may accompany any
// length, and an explicitly Medium layered cut stays Medium.)

/** Open prose channels (overrides + the mirror-less hairline) take the SAME
 *  deterministic content boundary as free-text edits: marks, presentation,
 *  cosmetic/natural eyelash, whole-identity, vague-reference, and
 *  relational-reference wording all refuse before any patch is built. */
function forbiddenOpenValue(value: string): { code: "forbidden_content"; message: string } | null {
  const deterministic = deterministicStage(value, true);
  if (deterministic) return { code: "forbidden_content", message: deterministic.message };
  if (RELATIONAL_VALUE_PATTERN.test(value)) {
    return { code: "forbidden_content", message: REFUSAL_COPY.vagueReference };
  }
  return null;
}

export function buildStructuredPatch(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
): StructuredPatchResult {
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    return { ok: false, code: "empty", message: "Nothing to change." };
  }
  for (const key of keys) {
    if (!STRUCTURED_UPDATE_KEYS.has(key)) {
      return { ok: false, code: "unsupported_key", message: UPDATE_KEY_REFUSAL };
    }
  }

  // Review finding 4 — content boundary BEFORE any patch building:
  for (const key of keys) {
    const v = changes[key];
    if (typeof v !== "string" || v.trim() === "") continue;
    const trimmed = v.trim();
    // Closed-select fields: exact membership in the shared option list
    const options = CLOSED_DESCRIPTOR_OPTIONS[key];
    if (options) {
      if (!options.includes(trimmed)) {
        return {
          ok: false,
          code: "invalid_value",
          message: `That ${key} value isn't one this cast can hold — pick a value from the editor.`,
        };
      }
      continue;
    }
    // Open prose channels: the shared deterministic boundary
    const forbidden = forbiddenOpenValue(trimmed);
    if (forbidden) return { ok: false, ...forbidden };
  }

  const edits: AuthorizedIdentityEdit[] = [];

  // Structured person-level fields first (their handler resets run before
  // any explicit leaf value lands)
  if ("gender" in changes) {
    const v = changes.gender;
    if (typeof v !== "string" || !isValidGender(v)) {
      return invalid("gender");
    }
    edits.push({ kind: "structured", edit: { field: "person.gender", value: v } });
  }
  if ("bodyType" in changes) {
    const v = changes.bodyType;
    if (typeof v !== "string" || !isValidBodyType(v)) return invalid("body type");
    edits.push({ kind: "structured", edit: { field: "person.build", value: v } });
  }
  if ("age" in changes) {
    const v = changes.age;
    if ((typeof v !== "string" && typeof v !== "number") || !isValidAgeValue(v)) return invalid("age");
    edits.push({ kind: "structured", edit: { field: "person.age", value: String(v) } });
  }
  if ("skinTone" in changes) {
    const v = changes.skinTone;
    if (typeof v !== "string" || !isValidSkinTone(v)) return invalid("skin tone");
    edits.push({ kind: "structured", edit: { field: "person.skinTone", value: v } });
  }
  if ("ethnicityBlend" in changes || "ethnicity" in changes) {
    let blend = changes.ethnicityBlend as Array<{ name: string; pct: number }> | undefined;
    if (!blend && typeof changes.ethnicity === "string" && changes.ethnicity.trim()) {
      const names = changes.ethnicity.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
      const pct = names.length === 2 ? 50 : 100;
      blend = names.map((name) => ({ name, pct }));
    }
    const value = { blend: blend ?? [] };
    if (!isValidEthnicityBlend(value)) return invalid("ethnicity");
    edits.push({ kind: "structured", edit: { field: "person.ethnicity", value } });
  }

  // Base/override pairs (§5.5): both members always resolve — a provided base
  // with no override CLEARS the old override so it can never fight the new value.
  for (const pair of PAIR_FIELDS) {
    const hasBase = pair.baseKey in changes;
    const hasOverride = pair.overrideKey in changes;
    if (!hasBase && !hasOverride) continue;
    const base = hasBase ? changes[pair.baseKey] : ((current[pair.baseKey] as string | undefined) ?? "");
    const override = hasOverride ? changes[pair.overrideKey] : "";
    if (typeof base !== "string" || typeof override !== "string") return invalid(pair.baseKey);
    const value: EnumWithOverrideValue = { base: base.trim(), override: override.trim() };
    if (value.base === "" && value.override === "") continue; // clearing = engine choice, not an identity value
    if (!isValidOverridePairValue(pair.field, value)) return invalid(pair.baseKey);
    edits.push({ kind: "leaf", leaf: pair.field, operation: "modify", value } as AuthorizedIdentityEdit);
  }

  // Descriptor leaves
  for (const d of DESCRIPTOR_FIELDS) {
    if (!(d.key in changes)) continue;
    const v = changes[d.key];
    if (typeof v !== "string") return invalid(d.key);
    const trimmed = v.trim();
    if (trimmed === "") continue; // clearing back to engine choice is not a concrete identity value
    if (trimmed.length > 240) return invalid(d.key);
    edits.push({ kind: "leaf", leaf: d.field, operation: "modify", value: trimmed } as AuthorizedIdentityEdit);
  }

  if (edits.length === 0) {
    return { ok: false, code: "empty", message: "Nothing to change." };
  }
  return { ok: true, patch: { edits, source: "structured" } };
}

function invalid(label: string): StructuredPatchResult {
  return {
    ok: false,
    code: "invalid_value",
    message: `That ${label} value isn't one this cast can hold — pick a value from the editor.`,
  };
}
