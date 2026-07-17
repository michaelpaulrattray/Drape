/**
 * identityFieldHandlers — exactly one exhaustive `IdentityFieldHandler<F>`
 * per authorizable identity field (IDENTITY_EDIT_INTERIM_POLICY §5.4/§5.5).
 *
 * Persistence destinations derive ONLY from this registry: a new field cannot
 * become authorizable without its complete handler, and a removed field
 * orphans its handler — both fail compilation (`satisfies` below). An LLM
 * response never selects a database field, preference key, or schema path.
 *
 * The runtime availability registry (FIELD_AVAILABILITY) encodes the §8.5
 * ledger's per-modality capability: `text` (free-text iterate), `reference`
 * (reference-assisted iterate), `structured` (the hardened attribute editor).
 * Ratified-but-modality-unavailable entries refuse exactly like refused ones.
 */
import type { ModelPreferences } from "../geminiTypes";
import {
  type AuthorizableIdentityField,
  type EnumWithOverrideValue,
  type EthnicityBlendValue,
  type IdentityFieldHandler,
  type NormalizedValueFor,
  type SupportedIdentityLeaf,
  type TechnicalSchema,
  type TypedPreferencePatchFor,
  type TypedSchemaWriteFor,
  FORM_OPTION_SETS,
} from "./identityTypes";
import {
  CHAR_OPTIONS,
  ETHNICITIES,
  EYE_COLORS,
  HAIR_FAMILIES_FEMALE,
  HAIR_FAMILIES_MALE,
  NATURAL_HAIR_COLORS,
  DYED_HAIR_COLORS,
  SKIN_TEXTURES,
} from "../../../shared/castingOptions";

// ── Closed option sets for the five base/override pairs (§5.5) ──────────────

export const BASE_OPTION_SETS = {
  "person.hair.style": [...HAIR_FAMILIES_FEMALE, ...HAIR_FAMILIES_MALE],
  "person.hair.color": [...NATURAL_HAIR_COLORS, ...DYED_HAIR_COLORS],
  "person.face.eyeColor": [...EYE_COLORS],
  "person.face.facialHair": [...CHAR_OPTIONS.facialHair],
  "person.skin.texture": [...SKIN_TEXTURES],
} as const;
export type OverridePairField = keyof typeof BASE_OPTION_SETS;

/** §5.5 rule: the base must come from the field's closed option set, or ""
 *  when nothing fits (the override then carries the whole value). */
export function isValidBaseValue(field: OverridePairField, base: string): boolean {
  return base === "" || (BASE_OPTION_SETS[field] as readonly string[]).includes(base);
}

/** A valid pair carries at least one member and a legal base. */
export function isValidOverridePairValue(field: OverridePairField, v: EnumWithOverrideValue): boolean {
  if (!isValidBaseValue(field, v.base)) return false;
  return v.base.trim() !== "" || v.override.trim() !== "";
}

// ── Structured scalar validation (runtime halves of the literal unions) ─────

export function isValidBodyType(v: string): v is NormalizedValueFor<"person.build"> {
  return (FORM_OPTION_SETS.bodyType as readonly string[]).includes(v);
}
export function isValidGender(v: string): v is NormalizedValueFor<"person.gender"> {
  return (FORM_OPTION_SETS.gender as readonly string[]).includes(v);
}
export function isValidSkinTone(v: string): v is NormalizedValueFor<"person.skinTone"> {
  return (FORM_OPTION_SETS.skinTone as readonly string[]).includes(v);
}
/** `age` is numeric-or-band as the form defines (no closed enum exists):
 *  a whole number 16–80, as string or number. */
export function isValidAgeValue(v: string | number): boolean {
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isInteger(n) && n >= 16 && n <= 80;
}
export function isValidEthnicityBlend(v: unknown): v is EthnicityBlendValue {
  if (!v || typeof v !== "object" || !Array.isArray((v as EthnicityBlendValue).blend)) return false;
  const blend = (v as EthnicityBlendValue).blend;
  if (blend.length < 1 || blend.length > 2) return false;
  const namesOk = blend.every(
    (e) => typeof e?.name === "string" && ETHNICITIES.includes(e.name) && Number.isFinite(e?.pct) && e.pct > 0,
  );
  if (!namesOk) return false;
  const total = blend.reduce((s, e) => s + e.pct, 0);
  return Math.round(total) === 100;
}

// ── Handler builders ─────────────────────────────────────────────────────────

/** Human-readable labels for prompt directives and refusal copy. */
export const FIELD_LABELS: Record<AuthorizableIdentityField, string> = {
  "person.face.faceShape": "face shape",
  "person.face.jawline": "jawline",
  "person.face.cheekbones": "cheekbones",
  "person.face.cheeks": "cheek fullness",
  "person.face.eyeShape": "eye shape",
  "person.face.eyeColor": "eye color",
  "person.face.noseShape": "nose shape",
  "person.face.lipShape": "lip shape",
  "person.face.browShape": "brow shape",
  "person.face.facialHair": "facial hair",
  "person.hair.style": "hairstyle",
  "person.hair.color": "hair color",
  "person.hair.length": "hair length",
  "person.hair.texture": "hair texture",
  "person.hair.fringe": "fringe",
  "person.hair.parting": "hair parting",
  "person.hair.volume": "hair volume",
  "person.hair.fade": "hair fade",
  "person.hair.hairline": "hairline",
  "person.hair.tuck": "hair tuck",
  "person.hair.flyaways": "hair flyaways",
  "person.skin.texture": "natural skin texture",
  "person.skin.finish": "skin finish",
  "person.build": "body build",
  "person.age": "age",
  "person.gender": "gender",
  "person.skinTone": "skin tone",
  "person.ethnicity": "ethnicity",
};

/** §8.4 lock/unlock framing — the prompt unlocks ONLY the authorized field;
 *  every unrequested feature stays locked. Never the raw user sentence. */
function unlockDirective(field: AuthorizableIdentityField, rendered: string): string[] {
  return [
    `AUTHORIZED IDENTITY CHANGE — ${FIELD_LABELS[field]} only: ${rendered}.`,
    `Preserve every unrequested feature exactly: face shape, bone structure, jawline, cheekbones, chin, eyes, nose, lips, brows, skin tone, skin texture, hair, permanent marks, and everything else not named above stays identical to the source person.`,
  ];
}

function renderPairValue(v: EnumWithOverrideValue): string {
  return v.override.trim() !== "" ? v.override : v.base;
}

/** A simple descriptor leaf: one preference key, optional schema mirror. */
function descriptorHandler<F extends SupportedIdentityLeaf & keyof PrefKeySingle>(
  field: F,
  prefKey: PrefKeySingle[F],
  schemaPath: SchemaPathOf<F>,
): IdentityFieldHandler<F> {
  return {
    buildPreferencePatch(value) {
      return { [prefKey]: value } as TypedPreferencePatchFor<F>;
    },
    buildSchemaWrite(value) {
      return (schemaPath === null
        ? null
        : { path: schemaPath, value: value as string }) as TypedSchemaWriteFor<F>;
    },
    buildPromptFragment(value) {
      return `${FIELD_LABELS[field]}: ${value as string}`;
    },
    promptDirectives(value) {
      return unlockDirective(field, value as string);
    },
    stalesSiblings: true,
  };
}

/** A §5.5 base/override pair: BOTH members always written — the override is
 *  the new prose or explicitly "" when the value is fully enum-representable,
 *  so an old override can never fight the new value. */
function overridePairHandler<F extends OverridePairField>(
  field: F,
  baseKey: BasePrefKeyOf<F>,
  overrideKey: OverridePrefKeyOf<F>,
  schemaPath: SchemaPathOf<F>,
  extraResets?: (value: EnumWithOverrideValue, current: ModelPreferences) => Record<string, string>,
): IdentityFieldHandler<F> {
  return {
    buildPreferencePatch(value, current) {
      const v = value as EnumWithOverrideValue;
      return {
        [baseKey]: v.base,
        [overrideKey]: v.override,
        ...(extraResets ? extraResets(v, current) : {}),
      } as TypedPreferencePatchFor<F>;
    },
    buildSchemaWrite(value) {
      return (schemaPath === null
        ? null
        : { path: schemaPath, value: renderPairValue(value as EnumWithOverrideValue) }) as TypedSchemaWriteFor<F>;
    },
    buildPromptFragment(value) {
      return `${FIELD_LABELS[field]}: ${renderPairValue(value as EnumWithOverrideValue)}`;
    },
    promptDirectives(value) {
      return unlockDirective(field, renderPairValue(value as EnumWithOverrideValue));
    },
    stalesSiblings: true,
  };
}

// Internal key-typing helpers so the generic builders stay honest:
type PrefKeySingle = {
  "person.face.faceShape": "faceShape";
  "person.face.jawline": "jawline";
  "person.face.cheekbones": "cheekbones";
  "person.face.cheeks": "cheeks";
  "person.face.eyeShape": "eyeShape";
  "person.face.noseShape": "noseShape";
  "person.face.lipShape": "lipShape";
  "person.face.browShape": "eyebrowStyle";
  "person.hair.length": "hairLength";
  "person.hair.texture": "hairTexture";
  "person.hair.fringe": "hairFringe";
  "person.hair.parting": "hairParting";
  "person.hair.volume": "hairVolume";
  "person.hair.fade": "hairFade";
  "person.hair.hairline": "hairHairline";
  "person.hair.tuck": "hairTuck";
  "person.hair.flyaways": "hairFlyaways";
  "person.skin.finish": "skinFinish";
};
type BasePrefKeyOf<F extends OverridePairField> = {
  "person.hair.style": "hairStyle";
  "person.hair.color": "hairColor";
  "person.face.eyeColor": "eyeColor";
  "person.face.facialHair": "facialHair";
  "person.skin.texture": "skinTexture";
}[F];
type OverridePrefKeyOf<F extends OverridePairField> = {
  "person.hair.style": "hairStyleOverride";
  "person.hair.color": "hairColorOverride";
  "person.face.eyeColor": "eyeColorOverride";
  "person.face.facialHair": "facialHairOverride";
  "person.skin.texture": "skinTextureOverride";
}[F];
type SchemaPathOf<F extends AuthorizableIdentityField> =
  import("./identityTypes").SchemaPathByField[F] | null;

function setSchema(path: string, value: string) {
  return { path, value };
}
void setSchema;

// ── The exhaustive registry ──────────────────────────────────────────────────

export const IDENTITY_FIELD_HANDLERS = {
  // Face descriptor leaves
  "person.face.faceShape": descriptorHandler("person.face.faceShape", "faceShape", "facial_features.face_shape"),
  "person.face.jawline": descriptorHandler("person.face.jawline", "jawline", "facial_features.jawline"),
  "person.face.cheekbones": descriptorHandler("person.face.cheekbones", "cheekbones", "facial_features.cheekbones"),
  "person.face.cheeks": descriptorHandler("person.face.cheeks", "cheeks", "facial_features.cheeks_shape"),
  "person.face.eyeShape": descriptorHandler("person.face.eyeShape", "eyeShape", "facial_features.eye_shape"),
  "person.face.noseShape": descriptorHandler("person.face.noseShape", "noseShape", "facial_features.nose_shape"),
  "person.face.lipShape": descriptorHandler("person.face.lipShape", "lipShape", "facial_features.lips_shape"),
  "person.face.browShape": descriptorHandler("person.face.browShape", "eyebrowStyle", "facial_features.eyebrows"),

  // Base/override pairs (§5.5)
  "person.face.eyeColor": overridePairHandler("person.face.eyeColor", "eyeColor", "eyeColorOverride", "subject.eye_color"),
  "person.face.facialHair": overridePairHandler("person.face.facialHair", "facialHair", "facialHairOverride", null),
  "person.hair.color": overridePairHandler("person.hair.color", "hairColor", "hairColorOverride", "subject.hair_color"),
  "person.skin.texture": overridePairHandler("person.skin.texture", "skinTexture", "skinTextureOverride", null),
  // hair.style additionally owns the verified rule-2 resets: a style change
  // resets its sub-selectors so the engine re-derives them for the new
  // silhouette (mergeAttributeChanges rule 2, now handler-owned).
  "person.hair.style": overridePairHandler(
    "person.hair.style", "hairStyle", "hairStyleOverride", "subject.hair_style",
    (value, current) => {
      const changed = renderPairValue(value) !== (current.hairStyleOverride || current.hairStyle || "");
      const resets = ["hairLength", "hairFringe", "hairParting", "hairVolume", "hairTuck", "hairFlyaways", "hairFade"] as const;
      return Object.fromEntries(
        resets.map((k) => [k, changed ? "" : ((current[k] as string | undefined) ?? "")]),
      );
    },
  ),

  // Hair descriptor leaves (prompt+pref only)
  "person.hair.length": descriptorHandler("person.hair.length", "hairLength", null),
  "person.hair.texture": descriptorHandler("person.hair.texture", "hairTexture", null),
  "person.hair.fringe": descriptorHandler("person.hair.fringe", "hairFringe", null),
  "person.hair.parting": descriptorHandler("person.hair.parting", "hairParting", null),
  "person.hair.volume": descriptorHandler("person.hair.volume", "hairVolume", null),
  "person.hair.fade": descriptorHandler("person.hair.fade", "hairFade", null),
  "person.hair.hairline": descriptorHandler("person.hair.hairline", "hairHairline", null),
  "person.hair.tuck": descriptorHandler("person.hair.tuck", "hairTuck", null),
  "person.hair.flyaways": descriptorHandler("person.hair.flyaways", "hairFlyaways", null),

  // Skin finish (structured-editor field; free-text one-offs are image.retouch)
  "person.skin.finish": descriptorHandler("person.skin.finish", "skinFinish", null),

  // Structured person-level fields — REAL closed value types (§5.4)
  "person.build": {
    buildPreferencePatch(value) {
      return { bodyType: value };
    },
    buildSchemaWrite() {
      return null; // subject.* has no build field
    },
    buildPromptFragment(value) {
      return `body build: ${value}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.build", value);
    },
    stalesSiblings: true,
  },
  "person.age": {
    buildPreferencePatch(value) {
      return { age: value };
    },
    buildSchemaWrite(value) {
      return { path: "subject.age", value: String(value) };
    },
    buildPromptFragment(value) {
      return `age: ${value}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.age", String(value));
    },
    stalesSiblings: true,
  },
  "person.gender": {
    // Rule-1 resets (verified merge behavior): a gender change clears the
    // gendered styling keys so the engine re-derives them.
    buildPreferencePatch(value, current) {
      const changed = value !== (current.gender ?? "");
      return {
        gender: value,
        hairStyle: changed ? "" : ((current.hairStyle as string | undefined) ?? ""),
        hairFade: changed ? "" : ((current.hairFade as string | undefined) ?? ""),
        facialHair: changed ? "" : ((current.facialHair as string | undefined) ?? ""),
      };
    },
    buildSchemaWrite(value) {
      return { path: "subject.sex", value };
    },
    buildPromptFragment(value) {
      return `gender: ${value}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.gender", value);
    },
    stalesSiblings: true,
  },
  "person.skinTone": {
    buildPreferencePatch(value) {
      return { skinTone: value };
    },
    buildSchemaWrite(value) {
      return { path: "subject.skin_tone", value };
    },
    buildPromptFragment(value) {
      return `skin tone: ${value}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.skinTone", value);
    },
    stalesSiblings: true,
  },
  "person.ethnicity": {
    // Dual-write (verified): the structured blend AND the derived legacy string.
    buildPreferencePatch(value) {
      return {
        ethnicityBlend: value.blend,
        ethnicity: value.blend.map((e) => e.name).join(", "),
      };
    },
    buildSchemaWrite(value) {
      return { path: "subject.ethnicity", value: value.blend.map((e) => e.name).join(", ") };
    },
    buildPromptFragment(value) {
      return `ethnicity: ${value.blend.map((e) => `${e.name} ${e.pct}%`).join(", ")}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.ethnicity", value.blend.map((e) => e.name).join(", "));
    },
    stalesSiblings: true,
  },
} satisfies { [F in AuthorizableIdentityField]: IdentityFieldHandler<F> };

export function handlerFor<F extends AuthorizableIdentityField>(field: F): IdentityFieldHandler<F> {
  // The registry itself is `satisfies`-checked per field; indexing by a
  // generic key needs the widening hop TypeScript can't infer on its own.
  return IDENTITY_FIELD_HANDLERS[field] as unknown as IdentityFieldHandler<F>;
}

// ── Runtime availability registry (§8.5 ledger, modality-exact) ─────────────

export interface FieldAvailability {
  /** Free-text iterate on a draft's authoritative frontClose (R1/R1c). */
  text: boolean;
  /** Reference-assisted iterate (per-leaf prompt capability, §9.3). */
  reference: boolean;
  /** The hardened structured attribute editor (R3). */
  structured: boolean;
}

export const FIELD_AVAILABILITY: Record<AuthorizableIdentityField, FieldAvailability> = {
  // Geometry leaves: text allowed (R1); reference allowed only through the
  // §8.4 single-leaf unlock this batch ships (the transfer prompt's default
  // geometry lock stays for everything unrequested).
  "person.face.faceShape": { text: true, reference: true, structured: true },
  "person.face.jawline": { text: true, reference: true, structured: true },
  "person.face.cheekbones": { text: true, reference: true, structured: true },
  "person.face.cheeks": { text: true, reference: true, structured: true },
  "person.face.eyeShape": { text: true, reference: true, structured: true },
  "person.face.eyeColor": { text: true, reference: true, structured: true },
  "person.face.noseShape": { text: true, reference: true, structured: true },
  "person.face.lipShape": { text: true, reference: true, structured: true },
  "person.face.browShape": { text: true, reference: true, structured: true },
  // Not in the transfer prompt's allowed list ⇒ reference form refuses as
  // unsupported; text form allowed (§8.5).
  "person.face.facialHair": { text: true, reference: false, structured: true },
  "person.hair.style": { text: true, reference: true, structured: true },
  "person.hair.color": { text: true, reference: true, structured: true },
  "person.hair.length": { text: true, reference: true, structured: true }, // ALL lengths incl. Long/Very Long (founder final ruling reversed R1b)
  "person.hair.texture": { text: true, reference: true, structured: true },
  "person.hair.fringe": { text: true, reference: true, structured: true },
  "person.hair.parting": { text: true, reference: true, structured: true },
  "person.hair.volume": { text: true, reference: true, structured: true },
  "person.hair.fade": { text: true, reference: true, structured: true },
  "person.hair.hairline": { text: true, reference: true, structured: true },
  "person.hair.tuck": { text: true, reference: true, structured: true },
  "person.hair.flyaways": { text: true, reference: true, structured: true },
  // R1c: text-only — reference-assisted skin-texture transfer stays
  // unavailable while the live prompt rejects it.
  "person.skin.texture": { text: true, reference: false, structured: true },
  // Structured-spec field: durable changes go through the editor; a one-off
  // "make this photo dewy" is image.retouch, asset-only (§8.5).
  "person.skin.finish": { text: false, reference: false, structured: true },
  // §8.2: person-level structured attributes refuse at every free-text door.
  "person.build": { text: false, reference: false, structured: true },
  "person.age": { text: false, reference: false, structured: true },
  "person.gender": { text: false, reference: false, structured: true },
  "person.skinTone": { text: false, reference: false, structured: true },
  "person.ethnicity": { text: false, reference: false, structured: true },
};

export const AUTHORIZABLE_FIELDS = Object.keys(IDENTITY_FIELD_HANDLERS) as AuthorizableIdentityField[];
