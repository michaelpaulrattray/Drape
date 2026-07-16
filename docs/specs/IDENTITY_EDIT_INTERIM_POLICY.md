# Identity-edit interim policy (FR-1) — founder-ratified implementation contract

**Date:** 2026-07-16, revision 9 (revision 8 = founder ratification of R1/R1b/R1c/R2/R3/R6/R7/R8/R9 + the makeup/eyelash clarification; revision 9 = §5.4 type-contract completion + eyelash creation-boundary clarification) · **Status: FOUNDER-RATIFIED 2026-07-16 — binding implementation contract; Batch C implementation pending. This ratification approves the policy, not a claim that current code enforces it. Until the shared guard and test matrix are implemented and verified, no newly permitted identity-edit capability is considered available; existing safety refusals remain.** Produced under the R6 execution plan (Batch C-prep, FR-1). Nothing here claims V6/V7 (instance-level mark preservation across views) is closed by any routing rule.

## 1. How to read this document

Labels: **CURRENT CODE** (verified against the working tree at `7e97cf6`, file:line cited) · **RATIFIED POLICY** (founder-ratified 2026-07-16; binding) · **REQUIRED IMPLEMENTATION** (Batch C builds and verifies it — ratification implements nothing; until then the ratified capability is unavailable and existing refusals stand) · **FOUNDER-DIRECTED** (historical marker for direction given during drafting; ratified 2026-07-16 with the whole document). §17 is the dated ratification record of the nine FR-1 rulings — there are no open FR-1 decisions.

Terminology: a **free-text image-edit instruction** is natural language typed against a generated image (with or without an attached reference). The board's `applyModelEdit` form is the **structured attribute editor**. An **identity leaf** is one exact, normalizable identity attribute (§8.5); parent categories like `person.face` exist only inside the classifier and never authorize generation.

## 2. The product boundary this policy protects

**Casting Studio creates Drape's reusable character identity and its neutral character/casting sheet** — face and facial structure, hair, body build and proportions, skin and natural physical features, permanent marks (once the Batch D composer exists), neutral casting presentation, and the canonical views that preserve identity downstream.

Casting is **not** the primary outfit-styling environment. **Canvas** is where the user dresses, directs, and composes the cast person freely; **Wardrobe** is the precise reusable garment-digitization/VTO workflow. The promise: **cast the person once; dress and direct them downstream.** Clothing, makeup, accessories, and headwear are never persistent cast identity. Ordinary Canvas/Wardrobe outputs never rewrite the cast; the one deliberate Canvas-hosted identity door is Edit Cast (§13.15).

This policy: governs every current Casting Studio editing, generation, and creation surface, including the live reference path (§9); is an R6 interim, not the final capability ceiling; is superseded where appropriate by the Batch D/R7 evidence-composer architecture (§18); and temporarily refuses operations the final product intends to support — refusal copy says "not yet," never "never."

## 3. Scope, authority, supersessions

**Governs** every writer of the identity document, every generation door that consumes it, and every creation path that initializes it (`IDENTITY_WRITER_INVENTORY.md`; resolved per writer in §13).

**Settled, not reopened:** D-43 mint immutability; FR-2(A) export never mints; FR-3(B) rename is display metadata; FR-4 archived = deleted; masked tools disabled until the unified boundary exists; no Photoshop-style reveal/composite layer.

**Supersession note.** The ratified policy and its supersessions will be recorded operationally in **D-56 when Batch C implementation lands** (per the execution plan) — a decision-log entry must not imply enforcement is already shipped. This policy amends:

- **D-43** "drafts stay freely editable, full stop" — narrowed (§8).
- **D-43.2** cosmetic class → split into presentation (refused, routed) and image-only (allowed, asset-only) (§5).
- **F5** mark-discoverability framing (§15, R6).
- **F6 / D-21** "pinned heads exempt from staleness" — removed for identity changes (§14).
- The implicit "newest headshot is the identity reference" convention — replaced by anchor authority (§7).
- **The "restore/version checkout is the exact rollback" clause** (C5-era founder ruling, execution-plan preamble) — **narrowed to within the current identity revision** (§7.4, FOUNDER-DIRECTED): ordinary restore is free reuse of compatible images from the current identity revision; it is not, and must never silently act as, an identity rollback. True identity rollback is a Batch D/R7 snapshot operation.
- **D-12 exact-reproducibility scope for reference-assisted identity edits** — clarified (§8.6, FOUNDER-DIRECTED): provenance records the normalized identity patch, not the transient reference image; exact replay of a reference-assisted generation is deferred to Batch D reference plates. The founder accepts normal generative drift; the R6 goal is coherent identity, not pixel-perfect replay.

## 4. Definitions

- **Identity document** — `masterPrompt`, `technicalSchema`, `preferences` on the model row.
- **Displayed headshot** — the newest filled `frontClose`; what the package UI shows.
- **Identity anchor** — the newest **anchor-eligible** `frontClose` (§7): the image every identity consumer (refresh, add-views, mint) uses as the visual identity reference. CURRENT CODE conflates displayed and anchor (newest filled wins: `composeIdentityPayload`; `mintPackage.ts:251-252`).
- **Identity revision** — the server-owned era between identity-authorized anchor changes (§7.4). Every asset belongs to the revision it was generated, edited, or restored under.
- **Anchor view** — `frontClose`. **Non-anchor views** — the other five canonical views.
- **Reference-assisted request** — a free-text image-edit instruction with an uploaded reference attached (`castingRefinement.ts:33`). References are iteration-only: they play no part in creation (§10.3).
- **Package creation shape (CURRENT CODE):** creation produces the model row + `frontClose` only (`lib/boardOps.ts:615-647`); other views generate later from the then-current anchor + document text.

## 5. Three-class taxonomy and the closed typed contract

**RATIFIED POLICY (FOUNDER-DIRECTED).** Identity / presentation / image-only; category and operation are separate axes.

### 5.1 Class A — identity (who the person is)

Marks (`mark.ink`, `mark.scar`, `mark.pigmentation`, `mark.piercing`, `mark.structural`) — deterministic detection, all refused in R6 (§8.1). Person-level structured attributes (`person.build`, `person.age`, `person.gender`, `person.skinTone`, `person.ethnicity`) — refused at free-text doors (§8.2); allowed via the hardened structured attribute editor per ratified R3, once its implementation lands. Face/hair/skin **identity leaves** — the exhaustive ledger in §8.5; classifier parents `person.face` / `person.hair` never authorize anything (§8.4-rule).

### 5.2 Class B — presentation/styling (what the person is wearing)

`presentation.clothing` · `presentation.headwear` · `presentation.eyewear` · `presentation.jewelry` · `presentation.footwear` · `presentation.props` · `presentation.makeup`. Outside the neutral cast sheet: refused in Casting and routed — *"Casting creates the reusable character identity. Apply this on Canvas for a quick creative result, or continue to Wardrobe for precise garment control."* Never written into identity documents; never propagated through the Casting composer. Keyword lists (hat, cap, beanie, headpiece, helmet, glasses, sunglasses, necklace, earrings, jacket, dress, shirt, trousers, shoes, garment, outfit, look) are a fast path; the closed taxonomy + fail-closed `unknown` is the boundary. Presentation edits remain asset-scoped creative work downstream — this contract never turns them into identity edits.

**Makeup and eyelashes (founder clarification, ratified 2026-07-16 — recorded without creating any new R6 edit capability):** makeup, mascara, false eyelashes, lash extensions, lash lifts, and other cosmetic lash treatments are `presentation.makeup` — refused in Casting, routed to Canvas, and never written to cast identity documents or canonical views. The creation/edit boundary for lashes is explicit:

- **Creation (allowed, natural anatomy only):** validated natural eyelash anatomy — naturally long, dense, sparse, straight, or curled lashes — may persist through the initial casting brief and its **validated** initial `features` → master-description path (§10.2 intake validation still applies to everything else in the brief).
- **Creation (refused):** cosmetic eyelash language — mascara, false lashes, extensions, lash lifts, cosmetic curl/treatments — refuses during creation as presentation, **before model save or credit deduction**.
- **Post-creation (refused):** natural eyelash anatomy is **creation-only during R6**. Once the model exists, no edit, append, reconcile, raw route, or `features` update may use `features` as an escape hatch for a natural *or* cosmetic eyelash change — R6 has no dedicated eyelash leaf, durable mapping, scoped prompt contract, or post-creation tests, and eyelash changes are never smuggled through `eyeShape`, `browShape`, `features`, or any generic parent category (M16/M18/M22).

This creates no dedicated eyelash leaf and no post-creation eyelash-edit authorization. A dedicated `person.face.eyelashes` identity field (with mapping, prompt contract, and tests) may be considered later if product demand justifies it. Future styled reference sheets may carry production makeup downstream without changing the neutral canonical cast — none of this broadens into makeup support in Casting.

### 5.3 Class C — image-only (this photograph)

`image.lighting` · `image.background` · `image.poseExpression` · `image.framing` · `image.quality` · `image.retouch` (identity-preserving retouching: temporary blemish cleanup, lighting-artifact correction — explicitly distinct from changing **natural skin texture**, which is an identity leaf, §8.5). Allowed on the selected view, drafts and minted alike — **asset-only**: no identity-document writes, no compaction, no reconcile-back, no stale flags, and on `frontClose` the result is display-only, never the anchor (§7). CURRENT CODE contradicts every line (freeze-and-append `castingRefinement.ts:120-132`, write :197-200, auto-compaction :126-132, client auto-reconcile `useCastingGeneration.ts:401-415`). REQUIRED IMPLEMENTATION: byte-unchanged identity fields (M17).

### 5.4 The closed typed unions (RATIFIED POLICY — no placeholder types)

```ts
// ── Classifier layer ────────────────────────────────────────────────────────
type MarkCategory = "mark.ink" | "mark.scar" | "mark.pigmentation"
                  | "mark.piercing" | "mark.structural";

type PersonStructuredCategory =            // structured-editor scope (R3); free-text refused
  "person.build" | "person.age" | "person.gender" | "person.skinTone" | "person.ethnicity";

type ClassifierParent = "person.face" | "person.hair" | "person.skin";  // classifier-internal ONLY

type FaceLeaf = "person.face.faceShape" | "person.face.jawline" | "person.face.chin"
              | "person.face.cheekbones" | "person.face.cheeks"
              | "person.face.eyeShape" | "person.face.eyeColor"
              | "person.face.noseShape" | "person.face.lipShape"
              | "person.face.browShape" | "person.face.browColor"
              | "person.face.facialHair";
type HairLeaf = "person.hair.style" | "person.hair.color" | "person.hair.length"
              | "person.hair.texture" | "person.hair.fringe" | "person.hair.parting"
              | "person.hair.volume" | "person.hair.fade" | "person.hair.hairline"
              | "person.hair.tuck" | "person.hair.flyaways";
type SkinLeaf = "person.skin.texture" | "person.skin.finish";
type IdentityLeaf = FaceLeaf | HairLeaf | SkinLeaf;

type PresentationCategory =
  | "presentation.clothing" | "presentation.headwear" | "presentation.eyewear"
  | "presentation.jewelry"  | "presentation.footwear" | "presentation.props"
  | "presentation.makeup";

type ImageOnlyCategory =
  | "image.lighting" | "image.background" | "image.poseExpression"
  | "image.framing"  | "image.quality"    | "image.retouch";

type Operation = "add" | "remove" | "modify";
type ReferenceModality = "none" | "attached";

type EditClassification =
  | { kind: "imageOnly";    categories: ImageOnlyCategory[] }
  | { kind: "presentation"; categories: PresentationCategory[] }
  | { kind: "identity";
      categories: (MarkCategory | PersonStructuredCategory | ClassifierParent | IdentityLeaf)[];
      operations: Partial<Record<MarkCategory, Operation>>;
      source: "deterministic" | "model" }
  | { kind: "unknown" } | { kind: "unavailable" } | { kind: "malformed" };

// ── Authorization layer (FOUNDER-DIRECTED: exact authorizable fields only) ──
//
// Four separate concepts, never conflated:
//  1. CLASSIFIER-RECOGNIZED — everything above (marks, parents, all leaves,
//     structured categories). Recognition NEVER implies authorizability.
//  2. POLICY-REFUSED — excluded from the authorizable unions at the TYPE level:
type RefusedIdentityLeaf = "person.face.chin" | "person.face.browColor";  // §8.5, R9
//     (all mark.* categories are likewise refused and have no authorizable form)
//  3. RATIFIED-BUT-UNIMPLEMENTED — compiles into the authorizable unions and its
//     gating ruling IS ratified (2026-07-16: R1 face/hair leaves ALLOWED; R1c
//     skin texture ALLOWED text-only; R3 structured fields ALLOWED via the
//     hardened editor; R1b below-shoulder length REVERSED to ALLOWED by the
//     founder's final ruling 2026-07-16 — see the amended R1b entries/D-56.1),
//     but every entry stays
//     DISABLED in the runtime authorization registry until Batch C implements
//     and verifies the shared boundary. Registry-disabled fields refuse exactly
//     like refused ones until then — ratification enables policy, not runtime.
//  4. AUTHORIZABLE — the only things a server authorization may ever contain:

type SupportedFaceLeaf =
  | "person.face.faceShape" | "person.face.jawline" | "person.face.cheekbones"
  | "person.face.cheeks"    | "person.face.eyeShape" | "person.face.eyeColor"
  | "person.face.noseShape" | "person.face.lipShape" | "person.face.browShape"
  | "person.face.facialHair";                        // chin/browColor NOT constructible here
type SupportedHairLeaf =
  | "person.hair.style"  | "person.hair.color"   | "person.hair.length"
  | "person.hair.texture"| "person.hair.fringe"  | "person.hair.parting"
  | "person.hair.volume" | "person.hair.fade"    | "person.hair.hairline"
  | "person.hair.tuck"   | "person.hair.flyaways";
type SupportedSkinLeaf = "person.skin.texture" | "person.skin.finish";
type SupportedIdentityLeaf = SupportedFaceLeaf | SupportedHairLeaf | SupportedSkinLeaf;

// Structured fields keep their REAL value types — never reduced to prose:
type StructuredIdentityField =
  | { field: "person.build";     value: BodyTypeOption }               // prefs.bodyType (closed option set)
  | { field: "person.age";       value: AgeValue }                     // prefs.age (numeric-or-band, as the form defines)
  | { field: "person.gender";    value: GenderOption }                 // prefs.gender (+ cross-field invalidation, boardOps.ts:555-561)
  | { field: "person.skinTone";  value: SkinToneOption }               // prefs.skinTone / subject.skin_tone
  | { field: "person.ethnicity";
      value: { blend: Array<{ name: string; pct: number }> } };        // prefs.ethnicityBlend — a structured
                                                                        // array, PLUS the derived prefs.ethnicity
                                                                        // string / subject.ethnicity (dual-write,
                                                                        // boardOps.ts:569-577) — never prose

// The complete authorizable field union — refused/classifier-only fields
// (chin, browColor, every mark.*, the parents) are NOT constructible here:
type AuthorizableIdentityField =
  | SupportedIdentityLeaf
  | StructuredIdentityField["field"];

// Base/override pairs normalize into BOTH members, deterministically (§5.5):
type EnumWithOverrideValue = {
  base: string;        // nearest value from the field's closed option set ("" if none fits)
  override: string;    // detailed prose when the value exceeds the enum; "" clears a superseded override
};
/** A concrete durable description ("broad angular jaw, squared") — never a
 *  relational instruction (§8.6 step 2). */
type DurableDescriptor = string;
// The four scalar structured values are literal unions derived from the ONE
// option-set constant Batch C extracts (declared `as const`) from the existing
// closed form lists in client/src/features/casting/constants.ts (CHAR_OPTIONS
// and friends) — so an off-list value cannot compile:
declare const FORM_OPTION_SETS: {
  readonly bodyType: readonly string[]; readonly age: readonly string[];
  readonly gender:   readonly string[]; readonly skinTone: readonly string[];
};
type FormOption<K extends keyof typeof FORM_OPTION_SETS> =
  (typeof FORM_OPTION_SETS)[K][number];
type BodyTypeOption = FormOption<"bodyType">;
type AgeValue       = FormOption<"age">;
type GenderOption   = FormOption<"gender">;
type SkinToneOption = FormOption<"skinTone">;

// ONE complete field→value map — exhaustively keyed by AuthorizableIdentityField;
// a field without an entry (or an entry without a field) fails compilation:
type NormalizedValueByField = {
  // the five base/override leaves (§5.5)
  "person.hair.style":      EnumWithOverrideValue;
  "person.hair.color":      EnumWithOverrideValue;
  "person.face.eyeColor":   EnumWithOverrideValue;
  "person.face.facialHair": EnumWithOverrideValue;
  "person.skin.texture":    EnumWithOverrideValue;
  // the remaining supported leaves: durable descriptors
  "person.face.faceShape":  DurableDescriptor;
  "person.face.jawline":    DurableDescriptor;
  "person.face.cheekbones": DurableDescriptor;
  "person.face.cheeks":     DurableDescriptor;
  "person.face.eyeShape":   DurableDescriptor;
  "person.face.noseShape":  DurableDescriptor;
  "person.face.lipShape":   DurableDescriptor;
  "person.face.browShape":  DurableDescriptor;
  "person.hair.length":     DurableDescriptor;
  "person.hair.texture":    DurableDescriptor;
  "person.hair.fringe":     DurableDescriptor;
  "person.hair.parting":    DurableDescriptor;
  "person.hair.volume":     DurableDescriptor;
  "person.hair.fade":       DurableDescriptor;
  "person.hair.hairline":   DurableDescriptor;
  "person.hair.tuck":       DurableDescriptor;
  "person.hair.flyaways":   DurableDescriptor;
  "person.skin.finish":     DurableDescriptor;
  // structured fields: their REAL closed value types — never flattened to prose
  "person.build":     BodyTypeOption;
  "person.age":       AgeValue;
  "person.gender":    GenderOption;
  "person.skinTone":  SkinToneOption;
  "person.ethnicity": { blend: Array<{ name: string; pct: number }> };
};
type NormalizedValueFor<F extends AuthorizableIdentityField> = NormalizedValueByField[F];

// Mapped discriminated union: each exact leaf is bound to its exact value type —
// a mismatched leaf/value pair fails to compile:
type AuthorizedLeafEdit = {
  [L in SupportedIdentityLeaf]: {
    kind: "leaf";
    leaf: L;
    operation: "modify";
    value: NormalizedValueFor<L>;
  }
}[SupportedIdentityLeaf];

type AuthorizedIdentityEdit =
  | AuthorizedLeafEdit
  | { kind: "structured"; edit: StructuredIdentityField };

/** The normalized identity patch every allowed identity change — structured,
 *  text, or reference-assisted — produces BEFORE charging. STRICT: authorizable
 *  edits with field-specific value types only. The classifier/normalizer NEVER
 *  returns preference keys, schema paths, write maps, or prompt destinations —
 *  the contract has no channel to carry them. */
type AuthorizedIdentityPatch = {
  edits: AuthorizedIdentityEdit[];           // ≥ 1; each edit keeps its own typed value
  source: "structured" | "text" | "reference";
};

// Persistence destinations are CLOSED unions of the verified writable set —
// a developer typo or an invented destination fails to compile:
type WritableIdentityPreferenceKey =
  | "faceShape" | "jawline" | "cheekbones" | "cheeks" | "eyeShape"
  | "eyeColor" | "eyeColorOverride" | "noseShape" | "lipShape" | "eyebrowStyle"
  | "facialHair" | "facialHairOverride"
  | "hairStyle" | "hairStyleOverride" | "hairColor" | "hairColorOverride"
  | "hairLength" | "hairTexture" | "hairFringe" | "hairParting" | "hairVolume"
  | "hairFade" | "hairHairline" | "hairTuck" | "hairFlyaways"
  | "skinTexture" | "skinTextureOverride" | "skinFinish"
  | "bodyType" | "age" | "gender" | "skinTone" | "ethnicity" | "ethnicityBlend";
type WritableIdentitySchemaPath =
  | "subject.sex" | "subject.age" | "subject.ethnicity" | "subject.skin_tone"
  | "subject.hair_style" | "subject.hair_color" | "subject.eye_color"
  | "facial_features.eye_shape" | "facial_features.face_shape"
  | "facial_features.jawline" | "facial_features.cheekbones"
  | "facial_features.cheeks_shape" | "facial_features.nose_shape"
  | "facial_features.lips_shape" | "facial_features.eyebrows";
// (facial_features.freckles and context.* are deliberately NOT writable —
//  mark territory and non-identity context respectively.)

// ONE complete field→preference-keys map — exhaustively keyed. Override pairs
// list BOTH members, so a patch that omits the override twin fails to compile
// and a stale override cannot survive (§5.5). person.gender and
// person.hair.style additionally list the cross-field keys the verified merge
// rules already reset (lib/boardOps.ts:555-568) — the handler owns those
// resets deterministically:
type PreferenceKeysByField = {
  "person.face.faceShape":  "faceShape";
  "person.face.jawline":    "jawline";
  "person.face.cheekbones": "cheekbones";
  "person.face.cheeks":     "cheeks";
  "person.face.eyeShape":   "eyeShape";
  "person.face.eyeColor":   "eyeColor" | "eyeColorOverride";
  "person.face.noseShape":  "noseShape";
  "person.face.lipShape":   "lipShape";
  "person.face.browShape":  "eyebrowStyle";
  "person.face.facialHair": "facialHair" | "facialHairOverride";
  "person.hair.style":      "hairStyle" | "hairStyleOverride"
                          | "hairLength" | "hairTexture" | "hairFringe" | "hairParting"
                          | "hairVolume" | "hairTuck" | "hairFlyaways" | "hairFade"; // rule-2 resets
  "person.hair.color":      "hairColor" | "hairColorOverride";
  "person.hair.length":     "hairLength";
  "person.hair.texture":    "hairTexture";
  "person.hair.fringe":     "hairFringe";
  "person.hair.parting":    "hairParting";
  "person.hair.volume":     "hairVolume";
  "person.hair.fade":       "hairFade";
  "person.hair.hairline":   "hairHairline";
  "person.hair.tuck":       "hairTuck";
  "person.hair.flyaways":   "hairFlyaways";
  "person.skin.texture":    "skinTexture" | "skinTextureOverride";
  "person.skin.finish":     "skinFinish";
  "person.build":           "bodyType";
  "person.age":             "age";
  "person.gender":          "gender" | "hairStyle" | "hairFade" | "facialHair"; // rule-1 resets
  "person.skinTone":        "skinTone";
  "person.ethnicity":       "ethnicity" | "ethnicityBlend";                     // dual-write
};

// ONE complete field→schema-path map — `never` where no mirror exists
// (verified against the live schema, §8.5):
type SchemaPathByField = {
  "person.face.faceShape":  "facial_features.face_shape";
  "person.face.jawline":    "facial_features.jawline";
  "person.face.cheekbones": "facial_features.cheekbones";
  "person.face.cheeks":     "facial_features.cheeks_shape";
  "person.face.eyeShape":   "facial_features.eye_shape";
  "person.face.eyeColor":   "subject.eye_color";
  "person.face.noseShape":  "facial_features.nose_shape";
  "person.face.lipShape":   "facial_features.lips_shape";
  "person.face.browShape":  "facial_features.eyebrows";
  "person.face.facialHair": never;
  "person.hair.style":      "subject.hair_style";
  "person.hair.color":      "subject.hair_color";
  "person.hair.length":     never;
  "person.hair.texture":    never;
  "person.hair.fringe":     never;
  "person.hair.parting":    never;
  "person.hair.volume":     never;
  "person.hair.fade":       never;
  "person.hair.hairline":   never;
  "person.hair.tuck":       never;
  "person.hair.flyaways":   never;
  "person.skin.texture":    never;
  "person.skin.finish":     never;
  "person.build":           never;          // subject.* has no build field
  "person.age":             "subject.age";
  "person.gender":          "subject.sex";
  "person.skinTone":        "subject.skin_tone";
  "person.ethnicity":       "subject.ethnicity";
};

// Patch/write types are DERIVED from those maps — invalid keys/paths cannot
// compile, and no LLM output can choose a destination:
type TypedPreferencePatchFor<F extends AuthorizableIdentityField> =
  Required<Pick<ModelPreferences, PreferenceKeysByField[F]>>;   // Required ⇒ both
                                                                // override-pair members present
type TypedSchemaWriteFor<F extends AuthorizableIdentityField> =
  [SchemaPathByField[F]] extends [never]
    ? null                                       // no mirror ⇒ null, NOT {} —
                                                 // in TS, {} would accept anything
    : { path: SchemaPathByField[F]; value: string };

/** One complete handler per authorizable field — typed write BUILDERS, not
 *  key lists: the returned patches are typed by the per-field maps above,
 *  so an invalid destination cannot compile. */
interface IdentityFieldHandler<F extends AuthorizableIdentityField> {
  buildPreferencePatch(value: NormalizedValueFor<F>, current: ModelPreferences):
    TypedPreferencePatchFor<F>;
  buildSchemaWrite(value: NormalizedValueFor<F>, current: TechnicalSchema):
    TypedSchemaWriteFor<F>;
  buildPromptFragment(value: NormalizedValueFor<F>): string;   // master-description fragment builder
  promptDirectives(value: NormalizedValueFor<F>): string[];    // §8.4 lock/unlock framing
  stalesSiblings: true;
}

/** The exhaustive server registry — a new field cannot become authorizable
 *  without its complete handler, and a removed field orphans its handler;
 *  both fail compilation. Exact implementation syntax is a Batch C choice,
 *  but the contract must be met in this shape: */
declare const IDENTITY_FIELD_HANDLERS: { [F in AuthorizableIdentityField]: IdentityFieldHandler<F> };
// IDENTITY_FIELD_HANDLERS satisfies { [F in AuthorizableIdentityField]: IdentityFieldHandler<F> }

/** Server-constructed after all policy checks. NEVER client-suppliable;
 *  no tRPC input carries it or any stand-in boolean/category. */
interface GenerationAuthorization {
  modelId: number;
  viewType: CanonicalViewAngle;
  class: "imageOnly" | "identity";
  imageOnlyCategories?: ImageOnlyCategory[];
  identityPatch?: AuthorizedIdentityPatch;   // present iff class === "identity"
  referenceAssisted: boolean;
  anchorEligible: boolean;                   // §7
  stalesSiblings: boolean;                   // §7/§14, pinned included
  identityRevisionId?: string;               // the NEW revision minted on commit (§7.4)
  promptDirectives: string[];                // §8.4 category-aware lock/unlock framing
}
```

### 5.5 Base and override preference pairs — deterministic, field-specific (RATIFIED POLICY)

Five preferences carry a base enum **and** a verbatim-prose override twin (verified, `constants.ts:121-154` + parser contract): `hairStyle`/`hairStyleOverride`, `hairColor`/`hairColorOverride`, `eyeColor`/`eyeColorOverride`, `facialHair`/`facialHairOverride`, `skinTexture`/`skinTextureOverride`. CURRENT CODE: **the engine prefers the override when present** (the parser's own contract, `promptParser.ts:335-337`), so a stale override silently defeats any new base value.

These are never modeled as "write the same normalized string to every key." Each pair's handler deterministically:

1. Maps the normalized value to the **nearest valid base enum** from that field's closed option set (chip/UI display; `""` when nothing fits).
2. Puts the **detailed prose in the override field** when the value exceeds the enum — e.g. a detailed wolf-cut reference produces base `hairStyle` = the nearest supported style category **plus** `hairStyleOverride` = "chin-length layered wolf cut with wispy curtain fringe".
3. **Always writes both members of the pair** — the override is set to the new prose or explicitly cleared to `""` when the normalized value is fully enum-representable, so an old override can never fight the new value (the engine-prefers-override rule makes a leftover override an identity bug, not a cosmetic one).
4. Keeps UI, PDF, and generation prompt consistent by construction: chips read the base, the engine and PDF read override-preferred, and both were written in the same §8.6 atomic commit.

The mapping is part of each field's `IdentityFieldHandler` — deterministic, field-specific, and covered by M18's base/override coherence proofs.

## 6. Layered classification and server-owned authorization

### 6.1 CURRENT CODE — cannot enforce this policy

`{ identityLevel: boolean, checked: boolean }` (`editClassifier.ts:48-52`); `text.includes("YES")` parser (:93-94); fail-open on error (:97-100); only the deterministic mark short-circuit is category-aware (:64-65, :81-84).

### 6.2 RATIFIED POLICY (FOUNDER-DIRECTED) — the server-side sequence

1. Receive the explicit instruction and reference modality.
2. Deterministic high-confidence checks first: shared mark vocabulary (§6.4), presentation terms, known ambiguity patterns.
3. Strict structured LLM classifier for semantic intent (never the only safety layer).
4. Parse exact JSON against the closed unions; deviation ⇒ `malformed`; unrecognized category ⇒ `unknown`; `UNSURE` ⇒ `unknown`. Model confidence prose is never authority.
5. Apply status, view, evidence, and technical-capability rules (§8, §9.3): policy permission and prompt capability are separate tests.
6. **Resolve to exact leaves and normalize** (§8.6 sequence) — identity requests refine into `AuthorizedIdentityLeaf`s with concrete values, or refuse.
7. Produce the server-owned `GenerationAuthorization`.
8. Deduct credits and call image generation only after authorization succeeds. Refusals precede generation records, deductions, and image-model calls.

**Mixed requests — most-restrictive-wins:** `unavailable`/`malformed`/`unknown` win; then any refused identity category/leaf refuses the whole request; then presentation refuses-and-routes; then allowed identity; then image-only. One request, one decision. A multi-leaf request proceeds only when **every** leaf is supported, allowed in the current model state, and normalized successfully.

**Example corpus** (M2/M18 fixtures): "Give her the sharp lower-face structure from the reference" → `person.face.jawline`. "Use the headpiece she is wearing" → `presentation.headwear`. "Take only the soft arch of the brows" → `person.face.browShape`. "Make her resemble this person" → whole-identity replacement ⇒ refuse. "Use this whole look" → `unknown`. "Put him in whatever she's wearing" → `presentation.clothing`. "Keep the same person but borrow the stronger jaw" → `person.face.jawline`. "Use only the hairstyle, not the face" → `person.hair.style` with the exclusion honored in prompt framing. "Change her face" → parent-only ⇒ ambiguous ⇒ refine or refuse (§8.4-rule).

### 6.3 REQUIRED IMPLEMENTATION

Typed contract, strict parser, deterministic stages, leaf normalizer, authorization object, consumer updates. Force-hook retained (`editClassifier.ts:74-77`).

### 6.4 REQUIRED IMPLEMENTATION — one shared marks vocabulary

`MARK_PATTERN` (broad, `editClassifier.ts:64-65`) vs `hasBodyArt` (ink-only, `geminiPrompts.ts:247-252`, selects the prompt rule at :254-256). Batch C extracts one per-category vocabulary for the deterministic stage, compaction guard, creation-intake validation (§10), and three-state prompt selection (§13.10). M14 tests the current disagreement.

## 7. Identity-anchor authority and identity revisions (FOUNDER-DIRECTED)

### 7.1 The contradiction being resolved

CURRENT CODE anchors every identity consumer on the newest **filled** `frontClose` (`composeIdentityPayload` tests: "anchors on the NEWEST filled headshot"; `mintPackage.ts:251-252`), so an image-only headshot refinement would silently become the identity reference and any accidental facial drift would propagate.

### 7.2 RATIFIED POLICY — displayed headshot vs identity anchor

Durable role in the server-written `provenance` JSON (`drizzle/schema.ts:209`; no tRPC input anywhere accepts `provenance` — M21 keeps that a tested invariant):

```ts
// inside model_assets.provenance (server-written only)
identityRole: "anchor" | "display"
identityRevisionId: string        // §7.4 — the revision this asset belongs to
```

| `frontClose` writer | Role | Siblings |
|---|---|---|
| Initial cast headshot | `anchor` | none yet |
| Deliberate draft headshot re-roll (`castingImage`) | `anchor` | stale flags, pinned included (R4) |
| `applyModelEdit` identity regeneration | `anchor` | stale flags, pinned included (R3) |
| Ratified R1 leaf edit on draft `frontClose` | `anchor` | stale flags, pinned included |
| Image-only refinement of `frontClose` | `display` | none |
| **Any restore of `frontClose`** (§7.4) | **`display` — always** | none |

**Selection:** one shared server selector for refresh/add-views/mint and every identity consumer — *newest `frontClose` with role `anchor`; a row with no role (pre-Batch-C legacy) counts as `anchor`*. Display selection stays newest-filled; displayed and anchor may legally diverge. Anchor eligibility flows only from `GenerationAuthorization.anchorEligible`; a client can never mark its own asset anchor-eligible.

This is Batch C's minimal durable mechanism, not Batch D's immutable `identity_plate` architecture, which supersedes it.

### 7.3 REQUIRED IMPLEMENTATION + tests (M21)

Role and revision stamping at the writers; the shared selector; restore rules (§7.4). Tests: displayed v2 image-only while v1 anchors; refresh/add-views/mint consume v1; an authorized leaf edit produces v3 ⇒ new anchor ⇒ siblings flagged; raw callers cannot promote an image-only asset; legacy no-role rows still anchor.

### 7.4 RATIFIED POLICY (FOUNDER-DIRECTED) — identity revisions; restore never changes identity authority

**The problem:** restoring an old headshot could make an image from an earlier identity state look authoritative while the identity document and siblings describe the newer identity — a silent identity fork.

**The rule:**

- Every successful identity-authorized anchor change creates a server-owned **`identityRevisionId`** (minted inside the §8.6 atomic commit; stored on the model row — additive, forward-only migration — with `null` meaning the genesis revision for existing models).
- Every generated, edited, or restored asset records the identity revision it belongs to (`provenance.identityRevisionId`).
- **Ordinary "restore/use this version" means reusing an image within the current identity revision. It is not an identity rollback.**
- Restore is allowed only when the source asset **provably belongs to the current identity revision**: its recorded revision matches, or — for legacy assets with no recorded revision — its recorded anchor/document fingerprint (D-12 slot provenance records the consumed anchor URL and verbatim identity text) demonstrably matches the current identity canon. Missing or uncertain provenance ⇒ **refuse**. (CURRENT CODE consequence, stated honestly: iterate-created versions carry no provenance at all — `castingRefinement.ts:170-176` writes none — so on legacy models those versions will refuse restore under this rule.)
- A restored `frontClose` is **always display-only**; generic restore never promotes an image to anchor authority.
- An asset from an older identity revision refuses. The same compatibility rule applies to **non-headshot views**: an old sibling view must not be restored as apparently current when it represents an earlier identity.
- Refusal copy: *"This version belongs to an earlier identity and can't replace the current cast. Fork or re-cast to use it."*

**True identity rollback** — atomically restoring the anchor, `masterPrompt`, `technicalSchema`, identity preferences, the corresponding identity revision, and correct sibling stale states — requires snapshot architecture that does not exist in R6. It remains **unavailable, deferred to Batch D/R7**. Every earlier claim that ordinary restore is "the free exact rollback" or a promised stale-package exit is amended accordingly (§3 supersessions): restore's interim purpose is **free reuse of compatible images within the current identity revision**. The Batch A-safe F6 copy that offers restore "when an earlier version exists" must gain the revision-compatibility gate at Batch C (M13).

## 8. Interim rules — identity class

### 8.1 Permanent marks — deterministic refusal, all statuses, all edit doors

All five `mark.*` categories, all operations, text or reference, refuse before money moves — drafts and minted alike. No honestly convergent cross-view state exists until the Batch D composer (§18). Refusals say "not yet." Creation-time mark reality is category-uneven (§13.10, R6).

### 8.2 Person-level structured attributes — presumptive refusal at free-text doors

`person.build` / `person.age` / `person.gender` / `person.skinTone` / `person.ethnicity` refuse at every free-text image-edit door, every status (evidence: build invisible in the anchor and headshot rendering conditions on body type `geminiGeneration.ts:240-242`; iterate never writes `preferences`, so tone/ethnicity edits fight the stored hint, `castingRefinement.ts:142`). Per ratified **R3** they remain reachable on drafts through the hardened structured attribute editor — which, once its implementation lands, produces the same `AuthorizedIdentityPatch` as every other identity door, as `kind:"structured"` edits carrying their real value types (closed enums, numeric age, the `{name, pct}` ethnicity-blend array with its dual-write — §5.4), never prose reductions. Until that implementation exists, unsupported structured changes refuse and route to re-cast; unknown keys never pass through.

### 8.3 Face/hair/skin identity leaves — drafts only, anchor view only (RATIFIED: R1 allow, ~~R1b refuse~~ R1b REVERSED 2026-07-16 → all lengths allow, R1c allow text-only)

Ledger leaves marked *allow* (§8.5), via free-text or reference-assisted iterate, **only on a draft AND targeting `frontClose`** — ratified R1. A successful authorized edit produces the normalized typed patch, is stamped `anchor` + new `identityRevisionId`, updates the matching identity fields atomically (no partially updated identity state, §8.6), and applies stale flags to every filled sibling, pinned included; bulk refresh converges the package from the new anchor + updated document. Non-anchor identity edits refuse with routing to the headshot; minted refuses with the F4 fork copy.

**R1 does not include localized permanent marks.** Beauty spots, moles, freckles and freckle clusters, birthmarks, scars, tattoos, piercings, pigmentation marks, and other location-specific marks are outside R1 and refuse as edits during R6 (§8.1) — they require the Batch D/R7 evidence-composer architecture. **R1c's "natural skin texture"** means diffuse physical surface qualities only (visible pores; naturally smooth, coarse, or fine-grained skin) — never localized marks, makeup, cosmetic skin treatments, or temporary retouching/blemish cleanup (which stays `image.retouch`, asset-only, never identity). R1c is **text-only**: reference-assisted skin-texture transfer remains unavailable while the live prompt rejects it.

**The hairstyle workflow (ratified):** a hairstyle reference on a draft's `frontClose` → scoped analysis normalizes the style into a durable description (§8.6) → edited headshot becomes the new anchor → existing siblings flagged → refresh regenerates from the new anchor and the deliberately updated identity text → absent siblings later generate from it.

**Below-shoulder hair length refuses during R6 (ratified R1b)** — ~~the bare-shoulders headshot cannot reliably evidence it; above-shoulder hair edits stay eligible under R1~~. **AMENDED — FOUNDER FINAL RULING 2026-07-16 (Batch C final corrections): R1b's refusal is REVERSED. `Long` and `Very Long` are valid durable identity values at every door — initial casting AND draft edits (structured, text, supported reference-assisted), through the same R1 pathway: normalized concrete value → typed `hairLength` preference + master identity description → new anchor + new identity revision → every filled sibling staled, pinned included → the UI explains existing views need refresh (never regenerated or charged automatically). Minted stays refused → Fork. Hair length is never an image-only cosmetic edit. `Long Layers` is a hairstyle characteristic independent of length; explicitly requested layered Medium hair stays Medium. **Deterministic band preservation (final corrections):** the committed durable value on the text/reference path is exactly the closed band the user named (`Very Short`/`Short`/`Medium`/`Long`/`Very Long` — the shared `HAIR_LENGTHS` list): explicit `Long` remains `Long`, explicit `Very Long` remains `Very Long`, below-shoulder/chest/mid-back wording maps to `Long`, waist/hip/tailbone wording maps to `Very Long`; the normalizer can never commit a more (or less) extreme band than requested, and wording that names no single band (vague comparatives, conflicting terms) fails closed and free (D-56.1).**

### 8.4 Category-aware identity lock (FOUNDER-DIRECTED; REQUIRED IMPLEMENTATION)

CURRENT CODE: the transfer prompt rejects face shape, bone structure, jawline, cheekbones, chin, skin tone/texture, freckles/moles/scars regardless of instruction (`geminiGeneration.ts:866-870`) and allows hair style/color, eye/nose/brow/lip shape, skin finish, expression (:841-857). That default protection is correct — **facial-geometry reference transfer does not work today and this policy does not claim it does.** Under ratified R1, the prompt unlocks **only the authorized leaf**, driven by `GenerationAuthorization.promptDirectives` (never the raw sentence): e.g. *"Authorized identity change: jawline only. Preserve face shape, eyes, nose, lips, brows, skin, hair, marks and every unrequested feature."* Normal reference-assisted image-only operation, minted models, and non-anchor views keep full geometry lock.

**Leaf-only authorization rule (FOUNDER-DIRECTED):** `person.face`, `person.hair`, `person.skin` are classifier parents only. Every authorized identity operation resolves to one or more exact supported leaves; broad language refines into leaves or refuses as ambiguous; every leaf normalizes independently; a multi-leaf request proceeds only if every leaf passes; any refused/undeterminable leaf ⇒ most-restrictive-wins refusal of the whole operation; suggestion chips and reference analysis never constitute authorization. A newly introduced leaf is **not** authorized merely because it falls beneath an allowed parent — it must be added to the §8.5 ledger, mapped, and tested first (M18).

### 8.5 The identity-leaf ledger (exhaustive; RATIFIED POLICY)

Column notes: *Pref key* = verified `ModelPreferences` field (`client/src/features/casting/constants.ts:112-155`); *Schema path* = the verified live `technicalSchema` mirror where one exists — the schema is exactly `subject.{sex, age, ethnicity, skin_tone, hair_style, hair_color, eye_color}` + `facial_features.{eye_shape, face_shape, jawline, cheekbones, cheeks_shape, nose_shape, lips_shape, eyebrows, freckles}` + `context.{tone, casting_for, wardrobe}` (`server/casting/aiService.ts:26-52`; **there is no `physical.*` section** — revision 5's `physical.*` paths were wrong and are corrected below) — else "prompt+pref only" (genuinely no mirror; the field handler's `buildSchemaWrite` returns `null` and only fragment + preference are written); *Ref?* = reference-assisted capability of the live transfer prompt (`geminiGeneration.ts:841-871`); every *allow* is **ratified (R1/R1c, 2026-07-16)** yet **unavailable at runtime until Batch C implements and verifies the shared guard** (registry-gated; existing refusals stand meanwhile) — draft + `frontClose` only, new anchor + new identity revision + all-sibling stale flags (pinned included), evidence = the edited anchor itself. Text capability exists for all leaves via the iterate path once the classifier resolves them. Schema facts noted for Batch C intake mapping, no ruling change implied: `facial_features.freckles` exists (a creation-time pigmentation slot — mark *edits* stay refused per §8.1); `subject.skin_tone`/`subject.ethnicity` mirror the §8.2 structured attributes; `context.wardrobe` is the schema's neutral-presentation slot and is governed by §10.2's intake validation.

| Leaf | Interim | Pref key | Schema path | Ref? (prompt today) | Normalized value shape | Refusal reason if refused |
|---|---|---|---|---|---|---|
| `person.face.faceShape` | allow | `faceShape` | `facial_features.face_shape` | **rejected** — needs §8.4 unlock | prose descriptor ("soft oval, tapered") | — |
| `person.face.jawline` | allow | `jawline` | `facial_features.jawline` | **rejected** — needs §8.4 | prose descriptor ("broad angular jaw, squared") | — |
| `person.face.chin` | **refuse (R6)** | — none | — none | rejected | — | **R9 ratified: refused during R6** — no durable field, no rushed mapping; jaw-adjacent supported requests may route through `jawline` when semantically accurate, never by silently reinterpreting an explicitly different request |
| `person.face.cheekbones` | allow | `cheekbones` | `facial_features.cheekbones` | **rejected** — needs §8.4 | prose descriptor | — |
| `person.face.cheeks` | allow | `cheeks` | `facial_features.cheeks_shape` | **rejected** — needs §8.4 | prose descriptor (fullness) | — |
| `person.face.eyeShape` | allow | `eyeShape` | `facial_features.eye_shape` | allowed (lid structure; keeps iris) | prose descriptor | — |
| `person.face.eyeColor` | allow | `eyeColor` (+`eyeColorOverride`) | `subject.eye_color` | allowed only when "eye color" explicit | color descriptor ("deep hazel, amber inner ring") | — |
| `person.face.noseShape` | allow | `noseShape` | `facial_features.nose_shape` | allowed (bridge/tip/nostrils) | prose descriptor | — |
| `person.face.lipShape` | allow | `lipShape` | `facial_features.lips_shape` | allowed (fullness; keeps pigment) | prose descriptor | — |
| `person.face.browShape` | allow | `eyebrowStyle` | `facial_features.eyebrows` | allowed (arch/thickness; keeps color) | enum-or-prose descriptor | — |
| `person.face.browColor` | **refuse (R6)** | — none (`eyebrowStyle` is a style enum) | — none dedicated (the generic `facial_features.eyebrows` field carries shape/grooming prose, not a brow-colour slot with its own durable preference mapping) | prompt allows BROW COLOR transfer — capability with **nowhere durable to store the result** | — | **R9 ratified: refused during R6** — authorization without durable storage is forbidden; a dedicated mapping is deferred to later design |
| `person.face.facialHair` | allow | `facialHair` (+`facialHairOverride`) | prompt+pref only | **not in the allowed-transfer list** ⇒ reference form refuses as unsupported; text form allowed | prose descriptor | — |
| `person.hair.style` | allow | `hairStyle` (+`hairStyleOverride`) | `subject.hair_style` | **allowed**, high fidelity (keeps color) | prose descriptor ("chin-length layered wolf cut…") | — |
| `person.hair.color` | allow | `hairColor` (+`hairColorOverride`) | `subject.hair_color` | allowed when explicitly "hair color" | color descriptor | — |
| `person.hair.length` | **allow — ALL lengths (R1b refusal REVERSED by founder final ruling 2026-07-16, D-56.1)** | `hairLength` | prompt+pref only | length within style transfer | the closed band the user named (`Very Short`/`Short`/`Medium`/`Long`/`Very Long`), committed deterministically from the user's own wording — never the normalizer's; no-band wording fails closed free | — |
| `person.hair.texture` | allow | `hairTexture` | prompt+pref only | allowed (texture within style) | texture descriptor | — |
| `person.hair.fringe` | allow | `hairFringe` | prompt+pref only | allowed ("bangs only" partial transfer) | descriptor | — |
| `person.hair.parting` | allow | `hairParting` | prompt+pref only | allowed (parting within style) | descriptor | — |
| `person.hair.volume` | allow | `hairVolume` | prompt+pref only | within style | descriptor | — |
| `person.hair.fade` | allow | `hairFade` | prompt+pref only | within style | descriptor | — |
| `person.hair.hairline` | allow | `hairHairline` | prompt+pref only | within style | descriptor | — |
| `person.hair.tuck` | allow | `hairTuck` | prompt+pref only | within style | descriptor | — |
| `person.hair.flyaways` | allow | `hairFlyaways` | prompt+pref only | within style | descriptor | — |
| `person.skin.texture` (natural texture — an identity trait: diffuse surface qualities only, per R1c's definition; never localized marks/makeup/treatments/retouch) | allow — **text-only (R1c ratified)** | `skinTexture` (+`skinTextureOverride`) | prompt+pref only | **rejected** (skin texture in the REJECT list) ⇒ reference form refuses while the prompt rejects it | texture descriptor ("visible pores, fine-grained matte skin") | — |
| `person.skin.finish` | structured-spec field: editable via the structured editor (R3 ratified, once implemented); a one-off "make this photo dewy" is `image.retouch`, asset-only | `skinFinish` | prompt+pref only | allowed (dewy/matte; keeps tone/texture) — as asset-only | finish descriptor | — |
| *(contrast)* cosmetic skin retouching | **not identity** — `image.retouch`, asset-only, never writes documents, never anchors | — | — | allowed as image-only | — | — |

Structured person-level attributes (`bodyType`, `age`, `gender`, `ethnicity`/`ethnicityBlend`, `skinTone` keys) are governed by §8.2/R3, not this ledger. **Do not assume a field is supported because it sounds like "face" or "hair"** — if it is not in this ledger, it refuses. **Natural eyelashes have no leaf** (founder clarification, §5.2): validated natural-lash anatomy is **creation-only** (it may persist from the initial brief through the validated initial `features` → master-description path); post-creation eyelash edits — natural or cosmetic, through any route including `features` updates — refuse during R6 and are never resolved through `eyeShape`, `browShape`, `features`, or any parent; a dedicated `person.face.eyelashes` field may be considered later.

### 8.6 The normalized identity-patch contract (FOUNDER-DIRECTED; applies to every allowed identity change)

Structured-form changes, text instructions, and reference-assisted instructions all produce the **same server-owned `AuthorizedIdentityPatch`** (§5.4) before generation or charging:

1. Classify the request into exact identity leaves (§8.4-rule).
2. Normalize every requested leaf into a **concrete new value** before charging — one value per leaf, never a single collapsed description for several changes; for references, scoped analysis converts the authorized attribute into a durable description. **Never store relational instructions** ("use the hairstyle from the reference", "make his jaw like this image", "copy her eyes"); store their normalized results ("chin-length layered wolf cut with wispy curtain fringe", "broad angular jaw with a squared chin", "deep hazel irises with an amber inner ring").
3. Validate the normalizer returned **only** the authorized edits with their field-specific value types — the contract has no channel for preference keys, schema paths, write maps, or prompt destinations (§5.4), so it cannot choose its own persistence destination.
4. Refuse if the result is ambiguous, incomplete, unsupported, registry-disabled (ratified but its Batch C implementation not yet landed and verified), or introduces an unrequested field.
5. Generate using the normalized patch (§8.4 prompt framing, from each field's handler `promptDirectives`).
6. Suppress old prompt/preference content **only for the fields being changed**, exactly as each field's handler dictates — for base/override pairs, by always writing both members so a stale override cannot fight the new value (§5.5).
7. Lock every unrequested identity attribute.
8. After successful generation, **atomically commit** — with every write built by the field's typed handler from the `IDENTITY_FIELD_HANDLERS` mapping (§5.4), never from LLM output: the preference patch (`buildPreferencePatch`, typed against the closed writable-key union); the schema write (`buildSchemaWrite`, typed by `SchemaPathByField`, `null` when no mirror exists); the updated master-description fragments (`buildPromptFragment`); the new anchor asset; the new `identityRevisionId`; the required sibling stale states (pinned included); and operation provenance containing the **strict typed edit list that was authorized and committed** — never an arbitrary write map.
9. If normalization, generation, or the commit fails: **no partial identity change** (all-or-nothing, or a recoverable pending operation); paid-generation failure follows the existing credit/refund policy (§14).

**Honesty about references (FOUNDER-DIRECTED):** the resulting anchor plus normalized values provide **forward identity consistency** — later sibling generation and refresh reproduce the updated trait from the anchor and description after the temporary reference is gone. This does **not** promise pixel-identical replay of the original reference-assisted generation; exact replay and persistent owned reference plates are Batch D. D-12's exact-reproducibility language is scoped accordingly (§3 supersessions): for reference-assisted identity edits, provenance records the normalized patch, not the transient reference.

This contract does not reclassify presentation or image-only work: makeup, clothing, accessories, lighting, backgrounds, pose, and approved per-image changes remain asset-only and never update identity documents. Permanent marks remain refused until the composer exists.

## 9. Reference images provide evidence, never authorization

### 9.1 RATIFIED POLICY (FOUNDER-DIRECTED)

1. References are **iteration-only** — never part of initial cast creation (§10.3).
2. The user must explicitly name what transfers; the named attribute classifies exactly as if text-only, then resolves to exact leaves (§8.4-rule).
3. Vague reference requests ("apply this", "use this look", "make her like the reference") refuse as ambiguous, free, before any charge.
4. An attached image never weakens the classifier; mixed requests are most-restrictive-wins.
5. Suggestions never authorize: every chip passes through the same server guard when clicked.
6. The UI advertises only operations the server actually supports.
7. Styling references route to Canvas/Wardrobe; identity-leaf references obey §8.3's draft/anchor gates and §8.6's normalization.

### 9.2 CURRENT CODE contradictions (verified)

"apply eye makeup from reference image" (`MasterPromptPanel.tsx:254`) vs the prompt's BLOCKED list (`geminiGeneration.ts:860`) and the BARE FACE suggestion rule (`geminiSuggestions.ts:13, 148-151`) · "a hairstyle, tattoo, accessory, or look" uploader copy (`MasterPromptPanel.tsx:302`) · `analyzeReferenceForTransfer` suggests jawline/cheekbones (`geminiSuggestions.ts:278-279`) that the prompt rejects (:866-870) · suggestion chips offer mark edits ("Add light freckles on nose", "Add a subtle scar on eyebrow", `geminiSuggestions.ts:136, 140`) · "Tattoos and body art carry through to all generated views" (`LoadingOverlay.tsx:22, 47, 53`) · "add a small tattoo on the forearm" placeholder (`RefinePanel.tsx:11`).

### 9.3 Reference capability summary

Authorization is leaf-level; the §8.5 ledger is authoritative for every leaf's reference capability. Non-leaf summary rows: **permanent marks** — not transferable (freckles/moles/scars rejected; tattoos absent from the allowed list) and refused before charge; **clothing/hats/accessories/jewelry/makeup** — BLOCKED by the prompt and refused-with-routing (makeup is currently *advertised*, §9.2); **lighting/background/pose** — BLOCKED as transfers; text forms are image-only; reference forms refuse as unsupported modality; **expression / skin finish** — allowed by the prompt, treated as asset-only image work; **vague whole-reference** — refuse as `unknown` before charging (today the prompt would ignore unnamed attributes but money already moved). Policy permission never proves prompt capability; unsupported subtypes refuse before charging until their prompt contract is deliberately changed and tested (M18).

## 10. Creation-time identity intake

### 10.1 CURRENT CODE — the `features` / "Additional Traits" channel

Not a visible user-facing field. Populated by the brief parser (whose schema routes "freckles, scars, gap teeth, beauty marks, asymmetries, tattoos" into it, `promptParser.ts:333`), retained in form state (`useCastingFormStore.ts:51`), written by fork-from-refusal (`CastingTakeover.tsx:339`), persisted verbatim by `models.create` (`routes/models.ts:70, :95`), injected with priority as `"Additional Traits: …"` (`geminiGeneration.ts:378`), rendered read-only as "Notes" (`MasterPromptPanel.tsx:324-332`). Parser exclusions cover mood/expression/subculture (`promptParser.ts:427-430`) — nothing excludes garments/headwear/jewelry/makeup; leftovers also ride the persisted `userPrompt` (`routes/models.ts:73, :95`).

### 10.2 RATIFIED POLICY — validate the final normalized creation intent

Before any model save or image charge, the server validates the complete normalized creation intent — structured attributes, parsed `features`, the original `userPrompt`, parser leftovers. Presentation language never enters `preferences`, `masterPrompt`, `technicalSchema`, identity notes/amendments, or generated neutral casting imagery. **No silent stripping** — refuse honestly and route styling downstream, or require the user to remove it. Initial identity traits (including brief-time ink marks per R6) remain valid input. Applies to every creation path: standalone Casting, Canvas `runGeneration`, direct `models.create`, parsed briefs, raw `features`, structured attributes, recast, fork, variation, any creation helper. **Ordering (CURRENT CODE violates it):** Canvas `runGeneration` deducts before parsing (`lib/boardOps.ts:297→329`); `applyModelEdit` `:683→693`; fork `:859→616`. REQUIRED IMPLEMENTATION: validation and refusal before money moves on every creation path (M22).

### 10.3 RATIFIED POLICY (FOUNDER-DIRECTED) — no reference images at creation

A new cast is established from the selected structured attributes, the written brief, and engine choices — never a visual reference, which could override deliberate selections and make identity authority ambiguous. CURRENT CODE (a server-supported creation/recast path, not necessarily a prominent first-run control): `models.create` accepts and persists `referenceImage` (`routes/models.ts:71, :95`); initial `castingImage` forwards it (`castingImaging.ts:25, :102`); the creation hook sends both (`useCastingGeneration.ts:266, :286`); fork's preferences-merge can leak it (`lib/boardOps.ts:553`). Required interim contract (M22): schema-reject at `models.create` (never silently ignore); no reference on initial `castingImage`; new-cast/recast clears attached references; references available only after the first headshot, through the guarded iteration path; raw creation-reference attempts refuse; no reference persisted in preferences; refusal/rejection before image credits move. Covers direct `models.create`, Canvas creation, standalone creation, recast/fork/variation, raw `castingImage`.

## 11. Evidence matrix

| Category / class | Status / door | Required evidence | Post-edit authority | Stale flags | Resolution | Evidence missing ⇒ |
|---|---|---|---|---|---|---|
| `mark.*` (edit) | refused — all statuses/doors | none until Batch D | — | — | — | "not yet" copy §15 |
| `mark.ink` (brief) | creation only, per ratified R6 (ink-family advertising only, honest variance wording) | brief text → persistence rule; class-level | each view its own instance | — | — | n/a |
| other mark families (brief) | not advertised (§13.10) | none | — | — | — | after §6.4 + three-state + M14 only |
| identity leaves (§8.5 *allow*) | draft + iterate on `frontClose` (ratified R1/R1c; registry-gated until Batch C lands); text, or reference per ledger | the edited anchor; result = `anchor` + new `identityRevisionId`; normalized patch committed atomically (§8.6) | new anchor | ALL filled heads, pinned included | bulk refresh; restore only within the current identity revision (§7.4), display-only | non-anchor ⇒ redirect; minted ⇒ F4; unmapped leaf ⇒ refuse (ledger) |
| `person.build`/`age`/`gender`/`skinTone`/`ethnicity` | free text/ref: refused. Structured editor on drafts per ratified R3 (same §8.6 patch), once implemented; refuse + re-cast routing until then | structured fields + re-derived document + regenerated anchor | new anchor + document | ALL filled views, pinned included | bulk refresh | free text ⇒ re-cast routing |
| presentation (edit or creation) | refused in Casting, all doors incl. intake (§10.2) | n/a — downstream | — | — | Canvas / Wardrobe | routing copy; creation: refuse or correct, never silent-strip |
| image-only | allowed, selected view, draft & minted | none — asset-scoped | new asset version; `display` on `frontClose` — never anchor | none | version history; restore within current revision | unknown/uncertain ⇒ refuse (§12) |

## 12. Fail-closed contract

CURRENT CODE fails open (`editClassifier.ts:97-100`; malformed counts cosmetic :93-94). RATIFIED (R2), for every free-text image-edit instruction (with or without reference) and every creation intake: deterministic checks hold during LLM outage; `unavailable` / `malformed` / `unknown` (incl. UNSURE, unrecognized category, unplaceable styling term, vague reference, ambiguous or parent-only identity request, unsupported reference modality, unmapped leaf) ⇒ typed, retryable, free refusal — no deduction, no generation record, no document write, **no image-only fallback**; `identity` ⇒ §8; `presentation` ⇒ refuse-and-route; `imageOnly` ⇒ asset-only. Ordering invariant: classification, leaf normalization, and every refusal complete before `createGeneration`, deduction, and image-model calls — already true on the edit path (`castingRefinement.ts:89` → :102 → :112; `enforceDailyQuota` :61 is a pure check, `db/dailyQuota.ts:85-95`), violated on creation paths (§10.2; M22). R2 covers the outage cost. Force-hook retained.

## 13. Writer-by-writer resolution

**13.1 `generation.iterate`** — CURRENT CODE: masked refused first (:43-49); boolean fail-open classifier; F4 on minted identity (:90-100); drafts open; every allowed edit writes the document (:120-132, :197-200); stale-writer skips pinned (:184-195); accepts `referenceImage` (:33). RATIFIED: the central gate — §6 sequence, §8 leaf rules + §8.6 patch commit (identity), presentation routing, image-only asset-only, §7 roles/revisions, fail-closed, pinned included.

**13.2 Masked path** — refused before classification/money (:43-49); board surfaces deleted. Unchanged; regressions.

**13.3 `generation.reconcile` — disabled (R7 ratified: keep off).** Rewrites document from an image with no classification (:485-495); client auto-fires after every success (`useCastingGeneration.ts:401-415`); "newest-head leash" withdrawn as self-defeating. Identity-document updates happen only inside §8.6 commits. REQUIRED IMPLEMENTATION: remove client call; procedure refuses; M4.

**13.4 `compactPrompt` + auto-compaction** — image-only edits never compact; legitimate §8.6 writes keep the protected-language invariant (broad vocabulary; violation ⇒ raw text kept); marked documents never select `CLEAN_SKIN_RULE`.

**13.5 `applyModelEdit` (structured attribute editor)** — CURRENT CODE: arbitrary `z.record` (`routes/boardOps.ts:241`); drafts-only update (:666-671); wholesale document re-derivation (:693) discarding amendments; headshot regeneration (:697-711); board-edge staling only (:735-746). RATIFIED (R3: harden): explicit server schema; permitted fields only; the update branch becomes a **`source:"structured"` §8.6 patch commit** — exact preference/schema patches, `anchor` role, new identity revision, all-sibling stale flags (pinned included), amendment-loss handling, presentation-free validation (§10.2). Until that implementation lands, unsupported structured changes refuse and route to re-cast; unknown keys never pass through.

**13.6 `castingImage`** — draft-only re-roll, newest-wins, no staling, accepts a creation reference (`castingImaging.ts:25`). RATIFIED: R4 — identity-changing anchor operation (role `anchor`, new revision, all siblings flagged); loses the reference parameter (§10.3).

**13.7 `executeMintPackage` (mint)** — guards regressions (`mintPackage.ts:219-255`); consults neither staleness nor failures (`failed` beside `minted:true`, :343); anchor = newest filled (:251-252). RATIFIED: §14 integrity gate + §7 anchor selector; M7.

**13.8 add-views (`mint:false`)** — draft nickname written (:293-305); minted name untouched; status untouched. Unchanged; consumes the §7 anchor; M8.

**13.9 `refreshSlots`** — regenerates from newest filled anchor + document; parity shipped (`shared/refreshPolicy.ts`). RATIFIED: consumes the §7 anchor selector; the resolution leg of every allowed identity edit; regenerated assets stamped with the current `identityRevisionId`; pinned-stale surfaces unpin-and-refresh; M9.

**13.10 Prompt-rule selection — three-state (FOUNDER-DIRECTED).** CURRENT CODE: binary `hasBodyArt` ⇒ persistence vs clean-skin (`geminiPrompts.ts:243-256`); no-ink adds the piercings NO-list (`geminiGeneration.ts:559-561`). RATIFIED: ink ⇒ persistence; **non-ink mark ⇒ neither rule** (prevents erasure, provides no persistence); no mark ⇒ clean-skin. Per-category persistence is Batch D. M14.

**13.11 `restoreSlotVersion`** — CURRENT CODE: copy-forward, free, owner-scoped. RATIFIED (**§7.4 supersedes rev 4's role-carrying rule**): restore requires proven current-revision membership (recorded revision, or legacy fingerprint match); refuses older revisions and missing/uncertain provenance; restored `frontClose` is always `display`; restored rows are stamped with the current revision; the cross-revision refusal copy is §7.4's. M13.

**13.12 Export** — read surface; refuses drafts, never mints (FR-2A); no refused-edit affordances. M11.

**13.13 `models.update` (rename)** — name-only strict; display metadata (FR-3B). M12.

**13.14 Creation sites** — §10 governs intake, validation, ordering, no-reference; §13.10 governs mark prompting; R6 governs advertising.

**13.15 Canvas / Wardrobe isolation.** Ordinary Canvas generations and Wardrobe/VTO outputs never modify the source cast. **Edit Cast** (`applyModelEdit`) is the sole Canvas-hosted exception: it delegates to the shared identity-authority boundary — draft updates only under the ratified structured-editor rules (R3, §8.6); minted follows the fork rule and never silently mutates the original (fork split enforced today, `lib/boardOps.ts:666-671`); using a cast as a generation reference never authorizes an identity write. CURRENT CODE elsewhere: wardrobe writes its own tables; no model writers outside casting modules (inventory §G). M19 proves both sides without a blanket grep that would fail the intentional route.

## 14. Package integrity — staleness, pinning, mint, credits (FOUNDER-DIRECTED)

Identity-changing anchor operations apply stale flags to every affected sibling, **pinned included** (pinning prevents automatic replacement, not staleness; cannot waive character-sheet integrity — D-21 exemption superseded). CURRENT CODE gaps: stale-writer skips pinned (`editClassifier.ts:117-130`); mint checks nothing (§13.7).

**Mint validity is three separate checks — not one vague "headshot out of sync" state.** A legal `display` headshot may intentionally differ from the identity anchor (§7.2); that difference alone never blocks mint.

1. **Identity-anchor validity.** Mint requires: a filled authoritative anchor selected through the §7 shared anchor selector; known anchor authority; an anchor belonging to the model's current identity revision (or the accepted legacy genesis/fingerprint case, §7.4); and an anchor that is neither stale nor failed. Every identity consumer and every mint-time slot generation uses this anchor. Refusal copy: *"This model's identity reference needs attention — refresh or re-roll the headshot before minting."*
2. **Display-headshot validity.** The newest displayed headshot may legally be a same-revision `display` asset sitting above an older authoritative anchor — that is **not** out of sync merely because the image URL differs from the anchor's. Mint may include/render that display headshot only when it belongs to the current identity revision; a displayed headshot from an older or unknown revision refuses with distinct copy: *"The displayed headshot belongs to an earlier identity — switch to a current version before minting."*
3. **Tier-view validity.** Every selected-tier view that **exists** must be fresh (not stale — pinned or unpinned), successful (no failed marker), and belong to the current identity revision. Cross-revision tier views refuse with the §7.4 copy. **A genuinely missing tier view never blocks minting — the mint/add-views workflow generates it** (priced per slot, D-39/D-55); only stale, failed-marker, cross-revision, and unknown-authority *existing* views refuse into the repair/retry path (refresh, retry, or restore a compatible version). *(Clarified at the Batch C final corrections, 2026-07-16 — earlier wording that read as "missing views block minting" contradicted the intended and implemented behavior.)*

Resolutions: unpin and refresh; **restore a compatible version from the current identity revision** (free, display-only for `frontClose`, §7.4); or cancel. The mint dialog predicts each refusal per check, with its own copy.

**Credit honesty:** tier deducts up front (`mintPackage.ts:260-268`); a failed slot refunds individually (:182-184) with a durable marker (:190-204); a retry is a new normally-priced generation — *"The failed attempt was refunded. Retrying charges the normal view price only if generation succeeds."* Mint-transition retry with slots filled adds no new generation charges (the narrow meaning of :318's comment). §8.6 step 9 failures follow this same policy.

## 15. Refusal behavior and copy

Typed, honest, never advertising unsupported capability, temporary limits framed as temporary. In addition to rev-4 copy (marks "not yet" with ink-only brief pointer per R6; presentation routing + creation-correction; build/age/gender/skin-tone re-cast routing; F4 on minted; non-anchor redirect; ~~R1b length~~ (REVERSED 2026-07-16 — no below-shoulder refusal exists; a successful length edit explains that existing views need refresh; the one remaining length refusal is the fail-closed no-band case: *"Say exactly how long — 'short', 'medium', 'long', 'very long', or wording like 'chin-length' or 'waist-length'. Nothing was charged."*); vague reference; unsupported reference subtype; creation reference; classifier outage; mint integrity; F5 placeholder and the UI promise sweep — `MasterPromptPanel.tsx:254/302`, `LoadingOverlay.tsx:22/47/53`, `RefinePanel.tsx:11`):

- **Makeup / cosmetic lashes (mascara, false lashes, extensions, lifts — §5.2):** "Makeup and lash styling live on Canvas — the cast sheet stays natural." (The standard presentation routing copy also applies.)
- **Post-creation natural-eyelash edit (§5.2 clarification):** "Eyelash changes aren't supported yet — describe natural lashes in the casting brief when you cast. Coming later."
- **Cross-revision restore (§7.4):** "This version belongs to an earlier identity and can't replace the current cast. Fork or re-cast to use it."
- **Ambiguous/parent-only identity request:** "Tell me exactly what to change — for example 'a sharper jawline' or 'shorter hair'."
- **Unmapped leaf (chin, brow color under R9-refuse):** "That specific change isn't supported yet — coming later."
- **Stale-exit honesty:** copy promises restore only as *reuse of versions from the current look*, never as identity rollback.

## 16. Test matrix

Router-harness pattern; drive legs marked; statuses per row: draft, active, `locked`, archived, foreign-owner. ⊕ = REQUIRED IMPLEMENTATION tests.

| # | Surface | Required proofs |
|---|---|---|
| M1 | iterate — identity ⊕ | Mark families × operations, text AND reference, refuse before deduction. §8.2 categories refuse. Ratified R1 leaves proceed on draft+`frontClose` only: `anchor` role, new revision, ALL heads flagged incl. pinned; non-anchor redirect; minted F4; ~~R1b terms refuse~~ (AMENDED 2026-07-16: all hair lengths incl. long/very-long PROCEED as durable identity edits; the committed value is the deterministic band the user named — explicit Long stays Long, Very Long stays Very Long, below-shoulder/chest/mid-back ⇒ Long, waist/hip/tailbone ⇒ Very Long; the normalizer can never escalate or shrink the band; no-band wording fails closed free); parent-only requests refuse as ambiguous; unmapped leaves (chin, browColor) refuse. Mixed/multi-leaf most-restrictive-wins: one refused leaf refuses the whole request. |
| M2 | classifier states ⊕ | `unavailable`/`malformed`/`unknown` (UNSURE, unrecognized category, §6.2 corpus, vague reference, parent-only) refuse everywhere: nothing charged, no rows, no document writes. Deterministic stages fire with the LLM dead. Strict parser vs malformed corpus. No tRPC input carries authorization- or provenance-shaped fields (literal guard). Force-hook intact. |
| M3 | masked path | Refused before classification/money everywhere; board surfaces deleted (regressions). |
| M4 | reconcile disabled ⊕ | Client auto-call removed; procedure refuses; no path writes the document from an image. |
| M5 | compaction guard ⊕ | Image-only never compacts; §8.6 writes keep per-family protected language; violation ⇒ raw kept; marked docs never get `CLEAN_SKIN_RULE`. |
| M6 | applyModelEdit ⊕ (R3) | Schema rejects unknown keys; update = `source:"structured"` §8.6 commit: exact patches, `anchor` role, new revision, all views flagged incl. pinned; amendments/mark language not destroyed; presentation refused in structured inputs; drafts-only + fork-untouched regressions. |
| M7 | mint integrity ⊕ | Guard regressions. §14's three checks, each with its own copy: (1) same-revision `display` headshot over an older authoritative anchor **passes**; (2) mint-time slot generation still consumes the anchor (not the display asset) via the §7 selector; (3) a stale or failed anchor refuses; (4) a displayed headshot from an earlier or unknown revision refuses; (5) current-revision tier views pass; (6) cross-revision tier views refuse; (7) the legacy fingerprint-match case passes AND the fingerprint-mismatch case refuses — both explicit. Stale tier views refuse pinned and unpinned; a failed-marker slot refuses into the retry path; a genuinely MISSING slot never refuses — the mint generates it (amended 2026-07-16, final corrections); dialog predicts per check; credits per M20. |
| M8 | add-views | Nickname (drafts only); minted name untouched; correct prompt rule; consumes §7 anchor; new assets stamped with current revision ⊕. |
| M9 | refresh | Regenerates from the §7 anchor + document; ratified-R1 edit converges siblings (drive leg); outputs stamped with current revision ⊕; pinned-stale surfaces unpin-and-refresh; parity regression. |
| M10 | castingImage ⊕ | Guard-order regressions; re-roll = `anchor` + new revision + all siblings flagged incl. pinned; empty draft flags nothing; reference parameter schema-rejected before charge. |
| M11 | export | Draft refusal + routing; no document writes; archived NOT_FOUND (regressions). |
| M12 | rename | Name-only strict; minted display-only (regressions). |
| M13 | restore ⊕ | Within-revision restore succeeds, free, stamped with current revision; restored `frontClose` is `display` and the anchor selector ignores it; **cross-revision restore refuses with §7.4 copy — headshots AND sibling views**; missing/uncertain legacy provenance refuses unless the recorded anchor/document fingerprint matches the current canon (fingerprint-match case proven both ways); no restore path mints anchor authority; offered-only-where-compatible copy (supersedes the Batch A-safe unconditional earlier-version offer). |
| M14 | prompt-rule three-state ⊕ | Ink ⇒ persistence; non-ink mark ⇒ neither rule, no piercings NO-list append; mark-free ⇒ clean-skin; pins the narrow-vs-broad detector split until §6.4. |
| M15 | cross-door agreement ⊕ | Same typed refusal per category/leaf at every free-text door; refresh/add-views/mint/export neither offer nor perform refused changes; one shared guard (literal-guard). |
| M16 | presentation routing ⊕ | Styling terms, text and reference, refuse with routing: no charge, no document write, no stale flags; never classified image-only (corpus). Makeup/mascara/false-lash/extension/lift terms route as presentation; **post-creation eyelash edit requests (natural or cosmetic) refuse as unmapped and are proven NOT to resolve through `eyeShape`, `browShape`, `features`, or any parent — including any post-creation `features`-update route used as an escape hatch** (§5.2 clarification). |
| M17 | image-only asset-only ⊕ | Per writer/status: new asset version; identity fields **byte-unchanged**; no compaction; no reconcile; no stale flags; `frontClose` result `display` and the prior anchor still selected. |
| M18 | reference-assisted, per leaf ⊕ | Ledger-exhaustive: every §8.5 leaf tested in text and reference form against its recorded capability — allowed leaves proceed only on draft+`frontClose` with §8.6 commit; geometry leaves refuse until §8.4 ships, then unlock ONLY the authorized leaf (unrequested-feature lock proven); refused leaves (chin, browColor) refuse; **a reference-assisted identity edit stores a concrete normalized value (no relational text in any identity field) and a later sibling refresh reproduces the updated trait with the temporary reference gone**; tattoo/vague references refuse before charging; mixed most-restrictive; chips route through the guard; a new leaf added under a parent is NOT authorized until added to the ledger + tests; UI copy assertions. **Patch strictness (the eight closure proofs):** (1) refused leaves (chin, browColor, every `mark.*`) cannot inhabit the authorization type — type-level assertion; (2) ratified-but-unimplemented fields stay registry-disabled and refuse until Batch C lands and verifies the shared boundary (rulings ratified 2026-07-16; ~~R1b entries stay refused outright~~ AMENDED — R1b reversed 2026-07-16, all lengths authorizable); (3) every authorizable leaf AND structured field has exactly one exhaustive `IdentityFieldHandler` — compile/test-time; (4) invalid preference keys and schema paths cannot compile or pass validation (closed writable unions); (5) multi-edit patches retain field-specific value types (no prose flattening); (6) ethnicity blends remain structured `{name, pct}` arrays end-to-end, never prose; (7) base/override pairs update coherently — both members written, superseded override cleared, engine/UI/PDF read consistently (§5.5); (8) no LLM response can choose a persistence destination (the contract has no channel; destinations derive only from handlers); (9) type-contract completeness — `NormalizedValueByField`, `PreferenceKeysByField`, and `SchemaPathByField` are each exhaustively keyed by `AuthorizableIdentityField` (mapped-type compile checks, no missing or extra keys); `AuthorizedLeafEdit` preserves the exact leaf↔value pairing (a mismatched pair fails to compile); no-mirror fields produce `null` schema writes, never `{}`; the registry satisfies `{ [F in AuthorizableIdentityField]: IdentityFieldHandler<F> }`. |
| M19 | Canvas/Wardrobe isolation, two-sided | Ordinary Canvas/Wardrobe operations cannot mutate the cast; Edit Cast reaches only the guarded draft-update/fork boundary (R3 rules; minted ⇒ fork); reference-use never authorizes writes. No blanket grep. |
| M20 | credits and retry ⊕ | Failed slot refunded once + durable marker; retry deducts normally, refunded only on repeat failure; mint-transition retry free of new generation charges; every refusal class zero-net-charge, balance-asserted; §8.6 step-9 failure leaves no partial identity change AND follows refund policy. |
| M21 | anchor authority + revisions ⊕ | Displayed v2 (`display`) with v1 anchoring; refresh/add-views/mint consume v1 (the §14 case-1/case-2 pair cross-checked with M7); authorized leaf edit ⇒ v3 anchor + new revision + siblings flagged; raw callers cannot promote (no provenance-accepting input — literal guard + probe); legacy no-role rows anchor; the legacy fingerprint pass and fail cases explicit (shared fixtures with M7/M13); every identity-consumer output carries the revision it was generated under. |
| M22 | creation intake ⊕ | Presentation in brief/`features`/`userPrompt`/structured fields refuses before save and charge on every creation path, including reordering the deduct-before-parse paths (`lib/boardOps.ts:297→329`, `:683→693`, `:859→616`); creation references schema-rejected everywhere (`models.create`, `castingImage`, recast/fork/variation state cleared, nothing persisted); fork-from-refusal text (`CastingTakeover.tsx:339`) passes intake validation; refusals before credits, balance-asserted. **Eyelash boundary (§5.2):** positive — an initial brief describing natural eyelash anatomy (long/dense/sparse/straight/curled) passes validation and persists into the initial master description; negative — mascara, false-lash, extension, lift, and cosmetic-treatment creation briefs refuse before save and charge. |

## 17. Founder ratification record — FR-1 (ratified 2026-07-16)

**All nine FR-1 rulings are decided.** The previously founder-directed architecture (three-class split; presentation routing; reference rules incl. iteration-only; anchor authority; identity revisions and restore-never-rolls-back-identity; the normalized identity-patch contract; leaf-only authorization; three-state mark prompting; pinned-staleness and mint integrity; credit wording; creation-intake validation; no creation references) is ratified with the whole document. None of this is a claim of implementation: every newly permitted capability stays registry-disabled until Batch C lands and verifies the shared boundary.

| # | Ruling | Decision (2026-07-16) |
|---|---|---|
| **R1** | Draft face/hair identity edits | **ALLOW** — ledger-supported face/hair leaves only, on a draft's authoritative `frontClose` edit path. A successful authorized edit produces the normalized typed patch, becomes the new identity anchor, creates a new identity revision, updates the matching identity fields atomically, flags every filled sibling stale (pinned included), and leaves no partially updated identity state. Non-anchor edits refuse with routing to the headshot; minted follows the fork rule. **Excludes localized permanent marks**: beauty spots, moles, freckles/freckle clusters, birthmarks, scars, tattoos, piercings, pigmentation marks, and other location-specific marks refuse as edits during R6 (Batch D/R7 composer). |
| **R1b** | Below-shoulder hair length | ~~REFUSE during R6~~ **REVERSED — FOUNDER FINAL RULING 2026-07-16 (Batch C final corrections, D-56.1): ALLOW all lengths.** Long/Very Long are valid initial identity choices AND valid draft identity edits through the ordinary R1 pathway (typed `hairLength` + master identity; new anchor/revision; all siblings staled pinned-included; existing views explained as needing refresh, never auto-regenerated). Minted stays refused → Fork. Never an image-only cosmetic edit. `Long Layers` is style, not length; explicit layered Medium stays Medium. The committed value is the deterministic band the user named (Very Short/Short/Medium/Long/Very Long; below-shoulder/chest/mid-back ⇒ Long, waist/hip/tailbone ⇒ Very Long); the normalizer can never change the band; no-band wording fails closed free. |
| **R1c** | Natural skin texture | **ALLOW, text-only**, on the draft authoritative headshot. Natural skin texture = diffuse physical surface qualities (visible pores; naturally smooth, coarse, or fine-grained skin). Excludes beauty spots, moles, freckles, localized pigmentation, scars, tattoos, and other permanent marks; makeup; cosmetic skin treatments; temporary retouching/blemish cleanup. Reference-assisted transfer remains unavailable while the live prompt rejects it; image-only retouching stays asset-only and never changes identity. |
| **R2** | Classifier outage/uncertainty | **FAIL SAFELY** — unavailable, malformed, ambiguous, parent-only, or uncertain classification refuses before credits, generation records, image calls, or identity writes. Free, retryable, clearly explained. Never fall back to an unchecked image-only edit. |
| **R3** | Structured attribute editor | **HARDEN** — strict server-owned field schema; supported draft changes to build, age, gender, skin tone, ethnicity, and ethnicity blends proceed only through the typed normalized patch, field-specific persistence handlers, new-anchor/new-revision commit, and stale-all-siblings flow. Until that implementation exists, unsupported structured changes refuse and route to re-cast. Unknown keys never pass through. |
| **R6** | Marks advertised at casting | **TATTOO/INK ONLY during R6**, with honest wording that the design may vary between views. Scars, birthmarks, beauty spots, pigmentation marks, piercings, and other mark families are not advertised or promised. Existing mark-edit refusals remain. |
| **R7** | Automatic reconcile | **KEEP OFF** — identity documents change only through deliberate authorized operations; the newest image never silently rewrites the identity document. |
| **R8** | Mint integrity | **ENFORCE the three separate validity checks** (§14): identity-anchor validity, display-headshot validity, selected-tier view validity. Refuse stale, failed, cross-revision, and unknown-authority states with state-specific, graceful copy that says what is wrong and how to resolve it — never one vague "headshot out of sync" message. *(Amended 2026-07-16, final corrections: "missing" removed from the refusal list — a genuinely missing tier view is generated by the mint/add-views workflow, §14 check 3; only defective existing views refuse.)* |
| **R9** | Chin shape & brow colour | **REFUSE during R6** — no rushed persistence fields; both remain unsupported until dedicated durable mappings are designed later. Jaw-adjacent supported requests may route through the mapped `jawline` leaf when semantically accurate; an explicitly different request is never silently reinterpreted. |

**Founder clarification — makeup and eyelashes** (recorded in §5.2 and the §8.5 ledger note; creates no new R6 edit capability): cosmetic makeup and lash treatments are presentation, refused in Casting and routed to Canvas, never touching identity documents or canonical views; validated natural eyelash anatomy may be described in the initial brief and persist through the validated initial `features` → master-description path (creation-only); cosmetic-lash creation language refuses as presentation before save or charge; post-creation eyelash edits — natural or cosmetic, including any `features` update used as an escape hatch — refuse during R6 (no leaf, no mapping, no prompt contract, no tests) and are never smuggled through `eyeShape`, `browShape`, `features`, or any parent; `person.face.eyelashes` may be considered later; styled reference sheets may carry production makeup downstream without changing the neutral cast.

**D-56 timing:** the ratified policy and its supersessions will be recorded operationally in D-56 when Batch C implementation lands.

## 18. The Batch D target this interim protects (not implemented in R6)

The composer flow: mark authored on a view that can show it → contextual anatomical zone crop (placement-preserving) → mark registry (category, body zone, evidence) → visibility probe → affected views generate from identity plate, clean body plate, zone crops; unaffected views untouched → generative drift expected and disclosed. The Casting composer is for persistent identity evidence, not outfit propagation. Also deferred to Batch D/R7: **true identity rollback** (atomic snapshot restore of anchor + documents + revision + sibling states, §7.4); exact replay of reference-assisted generations and persistent owned reference plates (§8.6); per-category mark persistence; reference plates; evidence versioning; probes; generative erase; canon snapshots/checkout (the full immutable `identity_plate` architecture superseding §7); concurrency/idempotency (the mint race stays a pre-launch item); masked-tool re-enablement.

---

*Prepared as Batch C-prep FR-1 under `CASTING_SYSTEM_R6_EXECUTION_PLAN.md`. Revisions 5–7 built the architecture: identity revisions with restore-never-changes-authority; the `AuthorizedIdentityPatch` contract; leaf-only authorization with the §8.5 ledger; schema paths corrected against the live `technicalSchema`; mint validity split into anchor / display-headshot / tier-view checks; the authorization contract closed (`SupportedIdentityLeaf`, type-excluded refused leaves, typed structured fields, closed writable destinations, base/override semantics). **Revision 8 (2026-07-16) folds in the founder ratification of R1, R1b, R1c, R2, R3, R6, R7, R8, R9 and the makeup/eyelash clarification, converting this report into the binding implementation contract.** Revision 9 (2026-07-16) completes §5.4's typed contract (`AuthorizableIdentityField`; the exhaustive `NormalizedValueByField`/`PreferenceKeysByField`/`SchemaPathByField` maps; the mapped `AuthorizedLeafEdit` union; `TypedPreferencePatchFor`/`TypedSchemaWriteFor` with `null` no-mirror writes; the generic handler + `satisfies` registry) and makes the eyelash boundary explicit (natural anatomy creation-only through the validated brief path; cosmetic-lash creation language refuses before save/charge; no post-creation `features` escape hatch). Ratification approves the policy, not current-code enforcement: until Batch C implements and verifies the shared guard and test matrix, no newly permitted identity-edit capability is available and existing safety refusals remain. The ratified policy and its supersessions will be recorded operationally in D-56 when Batch C implementation lands. Batch A-coupled and Batch C have not begun. Not staged or committed pending founder/Codex review.*
