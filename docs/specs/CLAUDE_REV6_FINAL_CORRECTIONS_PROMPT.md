# Claude prompt — Revision 6 final policy and reference-sheet corrections

Perform one final targeted correction pass. Do not implement code.

Revision 6 fixed the schema ledger and mint-state separation correctly. Preserve those changes.

Two areas remain incomplete:

1. The normalized identity contract is still not genuinely closed.
2. The adaptive reference-sheet section was truncated before its operational rules.

Revise:

- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- `docs/specs/PASS_4_VIDEO_NOTES.md`

The D-30 pointer already added to `docs/specs/DECISION_LOG.md` is correct. Do not duplicate or relocate it unless a factual correction is required.

## 1. Make the authorization contract genuinely closed

### Define the supported authorization fields

`SupportedIdentityLeaf` is currently mentioned in a comment but is not defined.

`AuthorizedIdentityLeaf.leaf` still accepts the complete `IdentityLeaf` union, including:

- R6-refused leaves such as chin and brow colour.
- Conditional leaves that may not be ratified.
- Fields for which no complete persistence mapping exists.

Define a real authorizable union that includes only fields the ratified R6 policy supports.

Keep separate concepts for:

- Classifier-recognized fields.
- Policy-refused fields.
- Conditional founder-ruling fields.
- Fields actually permitted inside a server authorization.

A classifier recognizing a field must never automatically make it authorizable.

### Cover structured identity fields

The policy says structured edits to build, age, gender, skin tone and ethnicity use the same normalized atomic-commit boundary, but the current patch can contain only face/hair/skin `IdentityLeaf` values represented as strings.

It therefore cannot represent:

- `person.build`
- `person.age`
- `person.gender`
- `person.skinTone`
- `person.ethnicity`
- An ethnicity blend with multiple names and percentages

Correct this using either:

- One strict discriminated `AuthorizableIdentityField` union covering both supported leaves and structured fields, with field-specific value types; or
- Two strict patch variants—leaf edits and structured edits—that share the same authorization and atomic-commit envelope.

Do not reduce arrays, numeric values, enums or ethnicity blends to arbitrary prose strings merely to fit one type.

### Close the persistence destinations

These remain open:

```ts
preferenceKeys: readonly string[];
schemaPath: string | null;
```

They prevent an LLM from selecting destinations, but they do not prevent a developer typo or arbitrary future destination from compiling.

Replace them with closed types or typed write functions.

Acceptable architecture:

```ts
type WritableIdentityPreferenceKey =
  | /* exact verified writable preference keys */;

type WritableIdentitySchemaPath =
  | /* exact verified writable schema paths */;

interface LeafHandler<L extends SupportedIdentityLeaf> {
  buildPreferencePatch(
    value: NormalizedValueFor<L>,
    current: ModelPreferences
  ): TypedPreferencePatchFor<L>;

  buildSchemaPatch(
    value: NormalizedValueFor<L>,
    current: TechnicalSchema
  ): TypedSchemaPatchFor<L>;

  buildPromptFragment(value: NormalizedValueFor<L>): string;
  promptDirectives(value: NormalizedValueFor<L>): string[];
  stalesSiblings: true;
}
```

The precise syntax may differ, but the contract must guarantee:

- Every authorizable field has exactly one complete handler.
- Every persistence key and schema path is from a closed verified set.
- Refused fields cannot appear in `GenerationAuthorization`.
- Adding a new authorizable field without a handler fails compilation or exhaustive tests.
- The LLM never supplies preference keys, schema paths, write maps or prompt destinations.

### Handle base fields and override fields correctly

Some preferences have different base and override semantics, for example:

- `hairStyle` plus `hairStyleOverride`
- `hairColor` plus `hairColorOverride`
- `eyeColor` plus `eyeColorOverride`
- `facialHair` plus `facialHairOverride`
- `skinTexture` plus `skinTextureOverride`

Do not model these as “write the same normalized string to every key.”

The handler must determine:

- Whether the normalized value maps cleanly to the existing enum/base field.
- Whether the detailed prose belongs in the override field.
- Whether the old override must be removed.
- How the UI, PDF and generation prompt remain consistent.
- How an old base value is prevented from fighting the new override.

For example, a detailed wolf-cut reference might produce:

- A valid base style such as the nearest supported style category.
- A detailed `hairStyleOverride` containing the normalized description.

The exact mapping must be deterministic and field-specific.

### Update tests

Add policy requirements proving:

1. Refused leaves cannot inhabit the authorization type.
2. Conditional leaves remain unauthorized until their ruling enables them.
3. Every authorizable leaf and structured field has one exhaustive handler.
4. Invalid preference keys and schema paths cannot compile or pass validation.
5. Multi-leaf edits retain field-specific value types.
6. Ethnicity blends remain structured arrays rather than prose.
7. Base/override pairs are updated coherently.
8. No LLM response can choose a persistence destination.

## 2. Complete the adaptive derived reference-sheet section

The existing section ends after the single-visible-face profile because the previous direction was truncated.

Keep the completed sentence:

> “For a specifically profile-led task, calibration may determine whether the side profile replaces the frontal portrait as the sheet’s single visible face.”

Remove the temporary editorial note saying the founder’s message ended mid-sentence. The completed wording accurately preserves the intended calibration decision.

Use “derived reference sheet” internally where possible. Drape’s user-facing composite remains the “comp card” under D-51, and “call sheet” also has a different film-production meaning.

Add the missing sections below.

### Prompt accompanying the reference sheet

The instruction is sent outside the image pixels:

> “The same person is shown in these reference panels. The portrait defines facial identity. The other panels provide body proportions, pose and silhouette only. Do not reproduce the sheet layout.”

Do not render that text, labels or metadata into the reference-sheet image itself.

### Authority and source eligibility

A canonical derived reference sheet may use only:

- The current authoritative identity anchor.
- Current-revision compatible canonical views.
- Filled and successful assets.
- Fresh views, unless an explicitly accepted pinned-final rule is later calibrated for that engine.

Never include:

- Stale assets.
- Failed assets.
- Cross-revision assets.
- Unknown-authority legacy assets.
- Display-only headshots as identity authority.
- Canvas or Wardrobe outputs pretending to be canonical cast views.

The identity anchor remains authoritative even when the displayed headshot differs.

### Deterministic assembly and cache behaviour

Canonical derived reference sheets are assembled mechanically, without AI generation.

They are:

- Derived delivery assets.
- Never canonical `model_assets` views.
- Never identity writers.
- Never permitted to alter the identity document.
- Never treated as new identity evidence.

Cache/version them using at least:

- Model ID.
- Identity revision.
- Recipe version.
- Engine/model capability-profile version.
- Task/intent view.
- Constituent asset IDs or content hashes.
- Crop/transformation configuration.

Invalidate or regenerate when any included identity revision, source asset, recipe or engine capability profile changes.

Rendering:

- Neutral background.
- Narrow gutters.
- No labels, logos, shadows or decorative comp-card chrome.
- No overlapping figures.
- No face blur, pixelation, masks, black bars or painted-over facial areas.
- Preserve enough resolution for the dominant portrait.

### Canonical versus styled reference sheets

Resolve the existing ambiguity between the deterministic canonical sheet and the generated styled comp card.

#### Canonical derived reference sheet

- Built deterministically from the cast’s authoritative current-revision assets.
- Communicates identity, body proportions, angles and silhouette.
- Uses neutral casting presentation.
- Can be regenerated without image-generation credits because it is an image-composition operation.

#### Styled comp card/reference sheet

- A separate paid generation created from Wardrobe/VTO or dressed scene evidence plus canonical identity references.
- Represents a particular outfit or production look.
- Is not canonical cast identity.
- Must remain identity-gated and carry its own provenance.
- Must never write styling back into the cast identity document.
- Must not be treated as if its internal panels are independently authoritative or safely croppable unless its manifest explicitly records panel roles and coordinates.
- May be selected as the video character reference when it is the most relevant wired input.

The composer adapts to what the user connected, but it must not silently convert a neutral Cast connection into a styled identity asset.

### Video start-frame boundary

A derived reference sheet is character-reference material only.

It must never be used as the video start frame.

- Character-reference input → identity guidance.
- Start-frame input → the actual composed scene to animate.

If a video engine accepts only a start frame:

1. Generate the actual scene still through an image-generation node using the cast identity payload.
2. Pass that composed scene image to the video node.
3. Animate that scene image.

Never ask a video model to animate the reference-sheet grid.

### Calibration profiles

Calibration is required per:

- Engine.
- Model version.
- Task class.
- Reference-input capability.

Compare:

1. D-30 anchor + intent view + identity text.
2. Full three-panel reference sheet.
3. Single-visible-face three-panel sheet.
4. Portrait-only reference.
5. Four-panel sheet where appropriate.
6. Canonical versus styled reference input where both apply.

Measure:

- Facial identity retention.
- Body and proportion fidelity.
- Side/profile fidelity.
- Hair silhouette fidelity.
- Unintended extra people.
- Montage/grid reproduction.
- Pose adherence.
- Cropping or masking artefacts.
- Outfit bleed into identity.
- Drift across video segments.

Do not enable a recipe merely because it looks sensible. Enable it for an engine/model/task profile only after calibration demonstrates a benefit.

Capability profiles must be versioned because hosted model behaviour may change.

### Provenance and manifest

Record:

- Engine and exact model version.
- Capability-profile version.
- Reference-sheet recipe version.
- Canonical or styled sheet class.
- Identity revision.
- Source asset IDs and exact URLs.
- Panel roles and view angles.
- Crop/transformation coordinates.
- Derived sheet URL and content hash.
- Identity text.
- Requested intent view/task class.
- The exact final reference payload sent to the provider.
- For styled sheets, the wardrobe/VTO/source-output provenance used.

D-12 provenance snapshots both the final sheet actually sent and its constituent-source manifest.

### Tests and future verification

Future implementation must prove:

- A user connects the Cast node only once.
- The server selects the recipe automatically.
- Current-revision sources are used.
- Stale/cross-revision sources are refused or excluded.
- A derived sheet cannot become identity authority.
- Single-visible-face recipes contain exactly one visible face.
- Side/profile evidence is selected for profile tasks when the calibrated profile calls for it.
- A reference sheet can never enter the video start-frame field.
- Cache invalidation follows identity and recipe changes.
- Provenance reproduces the exact payload decision.
- Canonical and styled sheets cannot be confused.

This remains future planning. Do not implement the composer adapter, sheet renderer, image node or video node now.

## Final response

After revising the documents:

1. Summarize the identity-contract corrections.
2. Show how refused and structured fields are represented safely.
3. Explain how base/override preference pairs are handled.
4. Confirm the adaptive reference-sheet section is now complete.
5. Explain the canonical-versus-styled distinction.
6. List every remaining founder ruling.
7. Challenge any direction you disagree with in plain English.
8. Do not implement code.
9. Do not stage or commit anything.
10. Do not push, deploy or contact production.
11. Stop for founder/Codex review.
