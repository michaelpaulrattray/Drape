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
import { ethnicityLegacyString } from "@shared/castingOptions";
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
    `LOCKED CONTEXT — preserve every trait outside the authorized ${FIELD_LABELS[field]} change exactly. Every other facial feature, hair trait, skin trait, body trait, demographic trait, and permanent mark must stay identical to the source person.`,
  ];
}

function renderPairValue(v: EnumWithOverrideValue): string {
  return v.override.trim() !== "" ? v.override : v.base;
}

/** A simple descriptor leaf: one preference key, optional schema mirror.
 *
 *  ⚠ The destination is a BUILDER supplied by the registry below, never a key
 *  passed in to be spread. A computed-key object literal (`{ [prefKey]: v }`)
 *  is `Record<string, …>`, so the `as TypedPreferencePatchFor<F>` this used to
 *  carry silenced `Required` entirely — measured #888: the patch type and the
 *  handler could assert opposite things with `pnpm check` green. Here `F` is
 *  inferred from the literal first argument, so each builder is checked
 *  against that field's CONCRETE patch type at its own call site. */
function descriptorHandler<F extends Exclude<SupportedIdentityLeaf, OverridePairField>>(
  field: F,
  buildPreferencePatch: (value: NormalizedValueFor<F>) => TypedPreferencePatchFor<F>,
  schemaPath: SchemaPathOf<F>,
): IdentityFieldHandler<F> {
  return {
    buildPreferencePatch,
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
 *  so an old override can never fight the new value.
 *
 *  ⚠ "BOTH members always written" is now a COMPILE-TIME fact rather than a
 *  sentence in this comment. The builder comes from the registry, where `F` is
 *  a literal, so `TypedPreferencePatchFor<F>` resolves to the concrete
 *  `Required<Pick<…>>` and a missing member is an error. It was a sentence
 *  only until #888: the old factory spread computed keys and asserted the
 *  result, and deleting the override line left `pnpm check` at exit 0.
 *  The rule-2 resets are on the same footing — they used to arrive as a bare
 *  `Record<string, string>` from `Object.fromEntries`, which is why the patch
 *  type could list `hairTexture` for years while the handler never wrote it. */
function overridePairHandler<F extends OverridePairField>(
  field: F,
  buildPreferencePatch: (
    value: NormalizedValueFor<F>,
    current: ModelPreferences,
  ) => TypedPreferencePatchFor<F>,
  schemaPath: SchemaPathOf<F>,
): IdentityFieldHandler<F> {
  return {
    buildPreferencePatch,
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

// ⚠ THREE key-typing helpers stood here until #888 — `PrefKeySingle`,
// `BasePrefKeyOf` and `OverridePrefKeyOf` — and all three were hand-copies of
// `PreferenceKeysByField`, which is working law 4 (a second list shadowing a
// source of truth always drifts from it). They existed only to feed the
// computed keys the factories spread. The builders read the real map through
// `TypedPreferencePatchFor<F>`, so the copies are deleted rather than kept in
// step: a destination is now stated once, in `identityTypes.ts`.

/** ⚠ `null` is permitted ONLY where the field genuinely has no mirror. The
 *  plain `… | null` this used to be let a field WITH a path be handed `null`,
 *  and `buildSchemaWrite`'s own assertion then swallowed the mismatch — the
 *  same shape as the patch hole #888 measured, one field over. */
type SchemaPathOf<F extends AuthorizableIdentityField> =
  [import("./identityTypes").SchemaPathByField[F]] extends [never]
    ? null
    : import("./identityTypes").SchemaPathByField[F];

function setSchema(path: string, value: string) {
  return { path, value };
}
void setSchema;

// ── The exhaustive registry ──────────────────────────────────────────────────

export const IDENTITY_FIELD_HANDLERS = {
  // Face descriptor leaves
  "person.face.faceShape": descriptorHandler("person.face.faceShape", (v) => ({ faceShape: v }), "facial_features.face_shape"),
  "person.face.jawline": descriptorHandler("person.face.jawline", (v) => ({ jawline: v }), "facial_features.jawline"),
  "person.face.cheekbones": descriptorHandler("person.face.cheekbones", (v) => ({ cheekbones: v }), "facial_features.cheekbones"),
  "person.face.cheeks": descriptorHandler("person.face.cheeks", (v) => ({ cheeks: v }), "facial_features.cheeks_shape"),
  "person.face.eyeShape": descriptorHandler("person.face.eyeShape", (v) => ({ eyeShape: v }), "facial_features.eye_shape"),
  "person.face.noseShape": descriptorHandler("person.face.noseShape", (v) => ({ noseShape: v }), "facial_features.nose_shape"),
  "person.face.lipShape": descriptorHandler("person.face.lipShape", (v) => ({ lipShape: v }), "facial_features.lips_shape"),
  "person.face.browShape": descriptorHandler("person.face.browShape", (v) => ({ eyebrowStyle: v }), "facial_features.eyebrows"),

  // Base/override pairs (§5.5) — both members written, and now compile-checked
  "person.face.eyeColor": overridePairHandler(
    "person.face.eyeColor",
    (v) => ({ eyeColor: v.base, eyeColorOverride: v.override }),
    "subject.eye_color",
  ),
  "person.face.facialHair": overridePairHandler(
    "person.face.facialHair",
    (v) => ({ facialHair: v.base, facialHairOverride: v.override }),
    null,
  ),
  "person.hair.color": overridePairHandler(
    "person.hair.color",
    (v) => ({ hairColor: v.base, hairColorOverride: v.override }),
    "subject.hair_color",
  ),
  "person.skin.texture": overridePairHandler(
    "person.skin.texture",
    (v) => ({ skinTexture: v.base, skinTextureOverride: v.override }),
    null,
  ),
  // hair.style additionally owns the verified rule-2 resets: a style change
  // resets its sub-selectors so the engine re-derives them for the new
  // silhouette. This is the SOLE owner of that rule since R6 Batch C
  // (8b514bed); the boardOps wrapper it was transcribed from is deleted (#886).
  // NOTE the deliberate narrowing, pinned by identityContract.test.ts: texture
  // is NOT reset. A cut changes the geometry, not what her hair is made of —
  // identityDependencies.ts keeps texture out of the coupled list on the same
  // reasoning.
  "person.hair.style": overridePairHandler(
    "person.hair.style",
    (v, current) => {
      const changed = renderPairValue(v) !== (current.hairStyleOverride || current.hairStyle || "");
      // A changed cut clears its sub-selectors; an unchanged one carries them
      // through untouched. Each reset is named, so the patch type and this
      // handler can no longer disagree about which keys the rule owns.
      const reset = (key: keyof ModelPreferences): string =>
        changed ? "" : ((current[key] as string | undefined) ?? "");
      return {
        hairStyle: v.base,
        hairStyleOverride: v.override,
        hairLength: reset("hairLength"),
        hairFringe: reset("hairFringe"),
        hairParting: reset("hairParting"),
        hairVolume: reset("hairVolume"),
        hairTuck: reset("hairTuck"),
        hairFlyaways: reset("hairFlyaways"),
        hairFade: reset("hairFade"),
      };
    },
    "subject.hair_style",
  ),

  // Hair descriptor leaves (prompt+pref only)
  "person.hair.length": descriptorHandler("person.hair.length", (v) => ({ hairLength: v }), null),
  "person.hair.texture": descriptorHandler("person.hair.texture", (v) => ({ hairTexture: v }), null),
  "person.hair.fringe": descriptorHandler("person.hair.fringe", (v) => ({ hairFringe: v }), null),
  "person.hair.parting": descriptorHandler("person.hair.parting", (v) => ({ hairParting: v }), null),
  "person.hair.volume": descriptorHandler("person.hair.volume", (v) => ({ hairVolume: v }), null),
  "person.hair.fade": descriptorHandler("person.hair.fade", (v) => ({ hairFade: v }), null),
  "person.hair.hairline": descriptorHandler("person.hair.hairline", (v) => ({ hairHairline: v }), null),
  "person.hair.tuck": descriptorHandler("person.hair.tuck", (v) => ({ hairTuck: v }), null),
  "person.hair.flyaways": descriptorHandler("person.hair.flyaways", (v) => ({ hairFlyaways: v }), null),

  // Skin finish (structured-editor field; free-text one-offs are image.retouch)
  "person.skin.finish": descriptorHandler("person.skin.finish", (v) => ({ skinFinish: v }), null),

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
        ethnicity: ethnicityLegacyString(value.blend),
      };
    },
    buildSchemaWrite(value) {
      return { path: "subject.ethnicity", value: ethnicityLegacyString(value.blend) };
    },
    buildPromptFragment(value) {
      return `ethnicity: ${value.blend.map((e) => `${e.name} ${e.pct}%`).join(", ")}`;
    },
    promptDirectives(value) {
      return unlockDirective("person.ethnicity", ethnicityLegacyString(value.blend));
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
