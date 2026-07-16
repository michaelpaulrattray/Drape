/**
 * identityTypes — the closed typed contract of the founder-ratified interim
 * identity-edit policy (IDENTITY_EDIT_INTERIM_POLICY.md §5.4/§5.5, Batch C).
 *
 * Four separate concepts, never conflated:
 *  1. CLASSIFIER-RECOGNIZED — everything the classifier may name (marks,
 *     parents, all leaves, structured categories). Recognition NEVER implies
 *     authorizability.
 *  2. POLICY-REFUSED — excluded from the authorizable unions at the TYPE
 *     level (chin, browColor, every mark.*, the classifier parents).
 *  3. RATIFIED-BUT-GATED — compiles into the authorizable unions; the runtime
 *     authorization registry (identityFieldHandlers.ts) decides modality
 *     availability (text / reference / structured) per the §8.5 ledger.
 *  4. AUTHORIZABLE — the only things a server authorization may ever contain.
 *
 * No LLM response can choose a persistence destination: preference keys and
 * schema paths derive ONLY from the per-field maps below — the classifier /
 * normalizer contract has no channel to carry them.
 */
import type { ModelPreferences } from "../geminiTypes";
import type { CanonicalViewAngle } from "../../../shared/boardTypes";
import {
  BODY_TYPE_VALUES,
  GENDER_VALUES,
  SKIN_TONE_VALUES,
} from "../../../shared/castingOptions";

// ── Classifier layer ────────────────────────────────────────────────────────

export type MarkCategory =
  | "mark.ink"
  | "mark.scar"
  | "mark.pigmentation"
  | "mark.piercing"
  | "mark.structural";

/** Structured-editor scope (R3); refused at every free-text door (§8.2). */
export type PersonStructuredCategory =
  | "person.build"
  | "person.age"
  | "person.gender"
  | "person.skinTone"
  | "person.ethnicity";

/** Classifier-internal ONLY — a parent never authorizes anything (§8.4). */
export type ClassifierParent = "person.face" | "person.hair" | "person.skin";

export type FaceLeaf =
  | "person.face.faceShape"
  | "person.face.jawline"
  | "person.face.chin"
  | "person.face.cheekbones"
  | "person.face.cheeks"
  | "person.face.eyeShape"
  | "person.face.eyeColor"
  | "person.face.noseShape"
  | "person.face.lipShape"
  | "person.face.browShape"
  | "person.face.browColor"
  | "person.face.facialHair";
export type HairLeaf =
  | "person.hair.style"
  | "person.hair.color"
  | "person.hair.length"
  | "person.hair.texture"
  | "person.hair.fringe"
  | "person.hair.parting"
  | "person.hair.volume"
  | "person.hair.fade"
  | "person.hair.hairline"
  | "person.hair.tuck"
  | "person.hair.flyaways";
export type SkinLeaf = "person.skin.texture" | "person.skin.finish";
export type IdentityLeaf = FaceLeaf | HairLeaf | SkinLeaf;

export type PresentationCategory =
  | "presentation.clothing"
  | "presentation.headwear"
  | "presentation.eyewear"
  | "presentation.jewelry"
  | "presentation.footwear"
  | "presentation.props"
  | "presentation.makeup";

export type ImageOnlyCategory =
  | "image.lighting"
  | "image.background"
  | "image.poseExpression"
  | "image.framing"
  | "image.quality"
  | "image.retouch";

export type MarkOperation = "add" | "remove" | "modify";
export type ReferenceModality = "none" | "attached";

export type IdentityClassifierCategory =
  | MarkCategory
  | PersonStructuredCategory
  | ClassifierParent
  | IdentityLeaf;

export type EditClassification =
  | { kind: "imageOnly"; categories: ImageOnlyCategory[] }
  | { kind: "presentation"; categories: PresentationCategory[] }
  | {
      kind: "identity";
      categories: IdentityClassifierCategory[];
      /** MIXED requests (review finding 6): every recognized non-identity
       *  category is RETAINED so the ratified most-restrictive-wins order can
       *  run — refused identity beats presentation beats allowed identity
       *  beats image-only. One request, one decision. */
      presentationAlso: PresentationCategory[];
      imageOnlyAlso: ImageOnlyCategory[];
      operations: Partial<Record<MarkCategory, MarkOperation>>;
      source: "deterministic" | "model";
    }
  | { kind: "unknown" }
  | { kind: "unavailable" }
  | { kind: "malformed" };

// ── Authorization layer (exact authorizable fields only) ────────────────────

/** §8.5 R9: refused during R6 — no durable field, no rushed mapping. These
 *  leaves are NOT constructible in any authorizable union below. */
export type RefusedIdentityLeaf = "person.face.chin" | "person.face.browColor";

export type SupportedFaceLeaf =
  | "person.face.faceShape"
  | "person.face.jawline"
  | "person.face.cheekbones"
  | "person.face.cheeks"
  | "person.face.eyeShape"
  | "person.face.eyeColor"
  | "person.face.noseShape"
  | "person.face.lipShape"
  | "person.face.browShape"
  | "person.face.facialHair";
export type SupportedHairLeaf =
  | "person.hair.style"
  | "person.hair.color"
  | "person.hair.length"
  | "person.hair.texture"
  | "person.hair.fringe"
  | "person.hair.parting"
  | "person.hair.volume"
  | "person.hair.fade"
  | "person.hair.hairline"
  | "person.hair.tuck"
  | "person.hair.flyaways";
export type SupportedSkinLeaf = "person.skin.texture" | "person.skin.finish";
export type SupportedIdentityLeaf = SupportedFaceLeaf | SupportedHairLeaf | SupportedSkinLeaf;

// The four scalar structured values are literal unions derived from the ONE
// option-set constant extracted from the existing closed form lists
// (shared/castingOptions.ts) — so an off-list value cannot compile. `age` is
// numeric-or-band as the form defines (no closed enum exists in the form),
// so its option set is typed `readonly string[]` and its handler validates
// the numeric band at runtime — exactly the §5.4 declaration.
export const FORM_OPTION_SETS = {
  bodyType: BODY_TYPE_VALUES,
  age: [] as readonly string[],
  gender: GENDER_VALUES,
  skinTone: SKIN_TONE_VALUES,
} as const;
export type FormOption<K extends keyof typeof FORM_OPTION_SETS> =
  (typeof FORM_OPTION_SETS)[K][number];
export type BodyTypeOption = FormOption<"bodyType">;
export type AgeValue = FormOption<"age">;
export type GenderOption = FormOption<"gender">;
export type SkinToneOption = FormOption<"skinTone">;

export type EthnicityBlendValue = { blend: Array<{ name: string; pct: number }> };

/** Structured fields keep their REAL value types — never reduced to prose. */
export type StructuredIdentityField =
  | { field: "person.build"; value: BodyTypeOption }
  | { field: "person.age"; value: AgeValue }
  | { field: "person.gender"; value: GenderOption }
  | { field: "person.skinTone"; value: SkinToneOption }
  | { field: "person.ethnicity"; value: EthnicityBlendValue };

/** The complete authorizable field union — refused/classifier-only fields
 *  (chin, browColor, every mark.*, the parents) are NOT constructible here. */
export type AuthorizableIdentityField =
  | SupportedIdentityLeaf
  | StructuredIdentityField["field"];

/** Base/override pairs normalize into BOTH members, deterministically (§5.5). */
export type EnumWithOverrideValue = {
  /** Nearest value from the field's closed option set ("" if none fits). */
  base: string;
  /** Detailed prose when the value exceeds the enum; "" clears a superseded
   *  override (the engine prefers the override, so a leftover one is an
   *  identity bug, not a cosmetic one). */
  override: string;
};
/** A concrete durable description ("broad angular jaw, squared") — never a
 *  relational instruction (§8.6 step 2). */
export type DurableDescriptor = string;

/** ONE complete field→value map — exhaustively keyed by
 *  AuthorizableIdentityField; a field without an entry (or an entry without
 *  a field) fails compilation (assertion below). */
export type NormalizedValueByField = {
  // the five base/override leaves (§5.5)
  "person.hair.style": EnumWithOverrideValue;
  "person.hair.color": EnumWithOverrideValue;
  "person.face.eyeColor": EnumWithOverrideValue;
  "person.face.facialHair": EnumWithOverrideValue;
  "person.skin.texture": EnumWithOverrideValue;
  // the remaining supported leaves: durable descriptors
  "person.face.faceShape": DurableDescriptor;
  "person.face.jawline": DurableDescriptor;
  "person.face.cheekbones": DurableDescriptor;
  "person.face.cheeks": DurableDescriptor;
  "person.face.eyeShape": DurableDescriptor;
  "person.face.noseShape": DurableDescriptor;
  "person.face.lipShape": DurableDescriptor;
  "person.face.browShape": DurableDescriptor;
  "person.hair.length": DurableDescriptor;
  "person.hair.texture": DurableDescriptor;
  "person.hair.fringe": DurableDescriptor;
  "person.hair.parting": DurableDescriptor;
  "person.hair.volume": DurableDescriptor;
  "person.hair.fade": DurableDescriptor;
  "person.hair.hairline": DurableDescriptor;
  "person.hair.tuck": DurableDescriptor;
  "person.hair.flyaways": DurableDescriptor;
  "person.skin.finish": DurableDescriptor;
  // structured fields: their REAL closed value types — never flattened to prose
  "person.build": BodyTypeOption;
  "person.age": AgeValue;
  "person.gender": GenderOption;
  "person.skinTone": SkinToneOption;
  "person.ethnicity": EthnicityBlendValue;
};
export type NormalizedValueFor<F extends AuthorizableIdentityField> = NormalizedValueByField[F];

/** Mapped discriminated union: each exact leaf is bound to its exact value
 *  type — a mismatched leaf/value pair fails to compile. */
export type AuthorizedLeafEdit = {
  [L in SupportedIdentityLeaf]: {
    kind: "leaf";
    leaf: L;
    operation: "modify";
    value: NormalizedValueFor<L>;
  };
}[SupportedIdentityLeaf];

export type AuthorizedIdentityEdit =
  | AuthorizedLeafEdit
  | { kind: "structured"; edit: StructuredIdentityField };

/** The normalized identity patch every allowed identity change — structured,
 *  text, or reference-assisted — produces BEFORE charging. STRICT: the
 *  classifier/normalizer NEVER returns preference keys, schema paths, write
 *  maps, or prompt destinations — this contract has no channel to carry them. */
export type AuthorizedIdentityPatch = {
  edits: AuthorizedIdentityEdit[]; // ≥ 1; each edit keeps its own typed value
  source: "structured" | "text" | "reference";
};

// ── Persistence destinations — CLOSED unions of the verified writable set ───

export type WritableIdentityPreferenceKey =
  | "faceShape" | "jawline" | "cheekbones" | "cheeks" | "eyeShape"
  | "eyeColor" | "eyeColorOverride" | "noseShape" | "lipShape" | "eyebrowStyle"
  | "facialHair" | "facialHairOverride"
  | "hairStyle" | "hairStyleOverride" | "hairColor" | "hairColorOverride"
  | "hairLength" | "hairTexture" | "hairFringe" | "hairParting" | "hairVolume"
  | "hairFade" | "hairHairline" | "hairTuck" | "hairFlyaways"
  | "skinTexture" | "skinTextureOverride" | "skinFinish"
  | "bodyType" | "age" | "gender" | "skinTone" | "ethnicity" | "ethnicityBlend";
export type WritableIdentitySchemaPath =
  | "subject.sex" | "subject.age" | "subject.ethnicity" | "subject.skin_tone"
  | "subject.hair_style" | "subject.hair_color" | "subject.eye_color"
  | "facial_features.eye_shape" | "facial_features.face_shape"
  | "facial_features.jawline" | "facial_features.cheekbones"
  | "facial_features.cheeks_shape" | "facial_features.nose_shape"
  | "facial_features.lips_shape" | "facial_features.eyebrows";
// (facial_features.freckles and context.* are deliberately NOT writable —
//  mark territory and non-identity context respectively.)

/** ONE complete field→preference-keys map — exhaustively keyed. Override
 *  pairs list BOTH members, so a patch that omits the override twin fails to
 *  compile and a stale override cannot survive (§5.5). person.gender and
 *  person.hair.style additionally list the cross-field keys the verified
 *  merge rules already reset (lib/boardOps.ts mergeAttributeChanges) — the
 *  handler owns those resets deterministically. */
export type PreferenceKeysByField = {
  "person.face.faceShape": "faceShape";
  "person.face.jawline": "jawline";
  "person.face.cheekbones": "cheekbones";
  "person.face.cheeks": "cheeks";
  "person.face.eyeShape": "eyeShape";
  "person.face.eyeColor": "eyeColor" | "eyeColorOverride";
  "person.face.noseShape": "noseShape";
  "person.face.lipShape": "lipShape";
  "person.face.browShape": "eyebrowStyle";
  "person.face.facialHair": "facialHair" | "facialHairOverride";
  "person.hair.style": "hairStyle" | "hairStyleOverride"
    | "hairLength" | "hairTexture" | "hairFringe" | "hairParting"
    | "hairVolume" | "hairTuck" | "hairFlyaways" | "hairFade"; // rule-2 resets
  "person.hair.color": "hairColor" | "hairColorOverride";
  "person.hair.length": "hairLength";
  "person.hair.texture": "hairTexture";
  "person.hair.fringe": "hairFringe";
  "person.hair.parting": "hairParting";
  "person.hair.volume": "hairVolume";
  "person.hair.fade": "hairFade";
  "person.hair.hairline": "hairHairline";
  "person.hair.tuck": "hairTuck";
  "person.hair.flyaways": "hairFlyaways";
  "person.skin.texture": "skinTexture" | "skinTextureOverride";
  "person.skin.finish": "skinFinish";
  "person.build": "bodyType";
  "person.age": "age";
  "person.gender": "gender" | "hairStyle" | "hairFade" | "facialHair"; // rule-1 resets
  "person.skinTone": "skinTone";
  "person.ethnicity": "ethnicity" | "ethnicityBlend"; // dual-write
};

/** ONE complete field→schema-path map — `never` where no mirror exists
 *  (verified against the live technicalSchema shape, §8.5). */
export type SchemaPathByField = {
  "person.face.faceShape": "facial_features.face_shape";
  "person.face.jawline": "facial_features.jawline";
  "person.face.cheekbones": "facial_features.cheekbones";
  "person.face.cheeks": "facial_features.cheeks_shape";
  "person.face.eyeShape": "facial_features.eye_shape";
  "person.face.eyeColor": "subject.eye_color";
  "person.face.noseShape": "facial_features.nose_shape";
  "person.face.lipShape": "facial_features.lips_shape";
  "person.face.browShape": "facial_features.eyebrows";
  "person.face.facialHair": never;
  "person.hair.style": "subject.hair_style";
  "person.hair.color": "subject.hair_color";
  "person.hair.length": never;
  "person.hair.texture": never;
  "person.hair.fringe": never;
  "person.hair.parting": never;
  "person.hair.volume": never;
  "person.hair.fade": never;
  "person.hair.hairline": never;
  "person.hair.tuck": never;
  "person.hair.flyaways": never;
  "person.skin.texture": never;
  "person.skin.finish": never;
  "person.build": never; // subject.* has no build field
  "person.age": "subject.age";
  "person.gender": "subject.sex";
  "person.skinTone": "subject.skin_tone";
  "person.ethnicity": "subject.ethnicity";
};

// Patch/write types are DERIVED from those maps — invalid keys/paths cannot
// compile, and no LLM output can choose a destination:
export type TypedPreferencePatchFor<F extends AuthorizableIdentityField> =
  Required<Pick<ModelPreferences, PreferenceKeysByField[F]>>; // Required ⇒ both
                                                              // override-pair members present
export type TypedSchemaWriteFor<F extends AuthorizableIdentityField> =
  [SchemaPathByField[F]] extends [never]
    ? null // no mirror ⇒ null, NOT {} — in TS, {} would accept anything
    : { path: SchemaPathByField[F]; value: string };

/** The technicalSchema shape the handlers read (live schema, aiService.ts). */
export type TechnicalSchema = Record<string, unknown>;

/** One complete handler per authorizable field — typed write BUILDERS, not
 *  key lists: the returned patches are typed by the per-field maps above,
 *  so an invalid destination cannot compile. */
export interface IdentityFieldHandler<F extends AuthorizableIdentityField> {
  buildPreferencePatch(
    value: NormalizedValueFor<F>,
    current: ModelPreferences,
  ): TypedPreferencePatchFor<F>;
  buildSchemaWrite(
    value: NormalizedValueFor<F>,
    current: TechnicalSchema,
  ): TypedSchemaWriteFor<F>;
  /** Master-description fragment builder (§8.6 step 8). */
  buildPromptFragment(value: NormalizedValueFor<F>): string;
  /** §8.4 lock/unlock framing — drives the image prompt, never the raw sentence. */
  promptDirectives(value: NormalizedValueFor<F>): string[];
  stalesSiblings: true;
}

/** Server-constructed after all policy checks. NEVER client-suppliable;
 *  no tRPC input carries it or any stand-in boolean/category. */
export interface GenerationAuthorization {
  modelId: number;
  viewType: CanonicalViewAngle;
  class: "imageOnly" | "identity";
  imageOnlyCategories?: ImageOnlyCategory[];
  /** Present iff class === "identity". */
  identityPatch?: AuthorizedIdentityPatch;
  referenceAssisted: boolean;
  /** §7 — only an identity authorization may mint anchor authority. */
  anchorEligible: boolean;
  /** §7/§14 — pinned included. */
  stalesSiblings: boolean;
  /** The NEW revision minted on commit (§7.4); assigned by the commit, not
   *  the classifier. */
  identityRevisionId?: string;
  /** §8.4 category-aware lock/unlock framing. */
  promptDirectives: string[];
}

/** A typed, free refusal — produced BEFORE generation records, deductions,
 *  and image-model calls (§12). */
export interface EditRefusal {
  refused: true;
  /** Closed refusal taxonomy — drives copy + tests. */
  code:
    | "mark_edit"                // §8.1 — all mark families, all operations
    | "presentation"             // §5.2 — refuse-and-route to Canvas/Wardrobe
    | "person_structured"        // §8.2 — free-text door; route to structured editor / re-cast
    | "eyelash_post_creation"    // §5.2 clarification — no leaf, no escape hatch
    | "ambiguous_identity"       // parent-only / unrefinable
    | "unmapped_leaf"            // chin, browColor, anything not in the ledger
    | "registry_disabled"        // ratified but modality-disabled (e.g. R1c reference)
    | "non_anchor_view"          // identity edit not on the authoritative frontClose
    | "not_draft"                // minted — F4 fork copy
    | "vague_reference"          // §9.1 rule 3
    | "whole_identity_reference" // whole-face/person replacement
    | "unsupported_reference"    // unsupported modality/subtype for this leaf
    | "classifier_unavailable"   // LLM outage — free, retryable
    | "malformed_classification" // strict parser rejection
    | "unknown"                  // fail-closed default
    | "normalization_failed"     // §8.6 step 4
    | "hair_length_vague";       // D-56.1 — no explicit length band named; no justified durable value
  message: string;
  /** True when retrying the same request may succeed (outages). */
  retryable: boolean;
}

export type EditDecision = EditRefusal | { refused: false; authorization: GenerationAuthorization };

// ── Compile-time completeness assertions (M18 proof 9) ──────────────────────
// Each map must be exhaustively keyed by AuthorizableIdentityField — a missing
// or extra key fails compilation right here, not in a distant consumer.

type AssertExactKeys<T, K extends string> =
  Exclude<keyof T, K> extends never ? (Exclude<K, keyof T> extends never ? true : never) : never;

const _normalizedValueComplete: AssertExactKeys<NormalizedValueByField, AuthorizableIdentityField> = true;
const _preferenceKeysComplete: AssertExactKeys<PreferenceKeysByField, AuthorizableIdentityField> = true;
const _schemaPathsComplete: AssertExactKeys<SchemaPathByField, AuthorizableIdentityField> = true;

// Refused leaves are not constructible in the authorizable union:
type AssertDisjoint<A, B> = Extract<A, B> extends never ? true : never;
const _refusedExcluded: AssertDisjoint<AuthorizableIdentityField, RefusedIdentityLeaf> = true;

// Preference keys stay inside the verified writable set:
type AssertSubset<A, B> = A extends B ? true : never;
const _prefKeysWritable: AssertSubset<PreferenceKeysByField[AuthorizableIdentityField], WritableIdentityPreferenceKey> = true;
const _schemaPathsWritable: AssertSubset<
  Exclude<SchemaPathByField[AuthorizableIdentityField], never>,
  WritableIdentitySchemaPath
> = true;

void _normalizedValueComplete;
void _preferenceKeysComplete;
void _schemaPathsComplete;
void _refusedExcluded;
void _prefKeysWritable;
void _schemaPathsWritable;
