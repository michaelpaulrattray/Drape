# Claude prompt — final FR-1 ratification contract correction

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform one final **narrow documentation correction** before the founder-ratified FR-1 policy is staged or committed.

Revise only:

- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`

Do not implement production code. Do not begin Batch B, Batch A-coupled, or Batch C. Do not stage, commit, push, deploy, migrate, or contact production.

Preserve Revision 8's founder-ratified status and all nine ratified decisions.

## 1. Make §5.4's closed TypeScript contract internally valid and complete

The current prose is correct, but the central example is not yet a genuinely closed TypeScript contract:

- `value: NormalizedValueFor<typeof leaf>` refers to a `leaf` that is not a type-scope variable.
- `AuthorizableIdentityField` is referenced but never defined.
- `NormalizedValueFor`, `TypedPreferencePatchFor`, and `TypedSchemaPatchFor` are described in comments rather than defined as complete types.
- The section promises closed typed unions and no placeholder types, so these cannot remain conceptual gaps in the binding implementation contract.

### Required field union

Define the real authorizable field union:

```ts
type AuthorizableIdentityField =
  | SupportedIdentityLeaf
  | StructuredIdentityField["field"];
```

Classifier-recognized but refused fields must remain excluded.

### Required field-to-value mapping

Define one complete field-to-value mapping, or an equally strict conditional type, covering every `AuthorizableIdentityField`.

It must encode:

- The five base/override leaves as `EnumWithOverrideValue`:
  - `person.hair.style`
  - `person.hair.color`
  - `person.face.eyeColor`
  - `person.face.facialHair`
  - `person.skin.texture`
- Other supported face/hair/skin leaves as their appropriate durable descriptor type.
- `person.build` as its closed body-type value.
- `person.age` as its closed age value.
- `person.gender` as its closed gender value.
- `person.skinTone` as its closed skin-tone value.
- `person.ethnicity` as its structured blend value:

```ts
{ blend: Array<{ name: string; pct: number }> }
```

Do not flatten structured values into prose.

The exact naming may differ, but `NormalizedValueFor<F>` must be a real defined type derived from this complete mapping.

### Required mapped discriminated union

Replace the invalid `typeof leaf` variant with a mapped discriminated union equivalent to:

```ts
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
```

This must preserve the relationship between each exact leaf and its exact normalized value type.

### Required persistence destination mapping

Do not leave `TypedPreferencePatchFor` or `TypedSchemaPatchFor` undefined.

Define complete field-keyed mappings for:

- Preference keys written by each authorizable field.
- Schema path written by each authorizable field, or `never` when no schema mirror exists.

Derive the patch/write types from those maps.

An acceptable shape is:

```ts
type TypedPreferencePatchFor<F extends AuthorizableIdentityField> =
  Required<Pick<ModelPreferences, PreferenceKeysByField[F]>>;

type TypedSchemaWriteFor<F extends AuthorizableIdentityField> =
  [SchemaPathByField[F]] extends [never]
    ? null
    : { path: SchemaPathByField[F]; value: string };
```

Requirements:

- Fully enumerate `PreferenceKeysByField` and `SchemaPathByField` from the verified §8.5 ledger plus structured fields.
- Override-pair preference patches require both base and override keys, so stale overrides cannot survive.
- A no-schema-mirror field returns `null`, not `{}`. In TypeScript, `{}` is not an exact empty object and would weaken the contract.
- Invalid preference keys and schema paths must not compile.
- No LLM output can choose a persistence destination.

### Required handler and registry

Define the generic constraint for real:

```ts
interface IdentityFieldHandler<F extends AuthorizableIdentityField> {
  buildPreferencePatch(
    value: NormalizedValueFor<F>,
    current: ModelPreferences
  ): TypedPreferencePatchFor<F>;

  buildSchemaWrite(
    value: NormalizedValueFor<F>,
    current: TechnicalSchema
  ): TypedSchemaWriteFor<F>;

  buildPromptFragment(value: NormalizedValueFor<F>): string;
  promptDirectives(value: NormalizedValueFor<F>): string[];
  stalesSiblings: true;
}
```

The exhaustive server registry must be equivalent to:

```ts
IDENTITY_FIELD_HANDLERS satisfies {
  [F in AuthorizableIdentityField]: IdentityFieldHandler<F>
};
```

The exact implementation syntax remains a Batch C choice, but the binding contract must be complete enough that two implementers cannot reasonably choose incompatible authorization shapes.

Update M18's type-contract tests to cover the completed mapping and handler registry.

## 2. Clarify initial natural eyelashes versus the post-creation `features` escape hatch

Revision 8 correctly says natural eyelash anatomy may be described during initial casting, while post-creation eyelash edits refuse. However, the document also says eyelashes must never be smuggled through `features`, and `features` is currently part of creation intake. Make the boundary explicit:

- Validated **natural eyelash anatomy**—naturally long, dense, sparse, straight, or curled lashes—may persist through the initial creation brief and its validated initial `features` → master-description path.
- This creates no dedicated eyelash leaf and no post-creation eyelash-edit authorization.
- Cosmetic eyelash language—mascara, false lashes, extensions, lash lifts, cosmetic curl/treatments—refuses during creation as presentation before model save or credit deduction.
- After the model exists, no edit, append, reconcile, raw route, or `features` update may use `features` as an escape hatch for a natural or cosmetic eyelash change.
- Natural eyelash anatomy remains creation-only during R6; later editing requires a future explicit field, mapping, prompt contract, and tests.

Update the relevant test requirements:

- M22 positive case: an initial brief describing natural eyelash anatomy passes validation and persists into the initial master description.
- M22 negative cases: mascara, false-lash, extension, lift, and cosmetic-treatment creation briefs refuse before save and charge.
- M16/M18 retain post-creation refusal and `features`-bypass coverage.

Do not broaden this clarification into makeup support in Casting.

## 3. Read-only consistency review

After editing, verify:

1. The policy remains `FOUNDER-RATIFIED 2026-07-16 — implementation pending`.
2. All nine ratified decisions remain unchanged.
3. `AuthorizableIdentityField` is defined.
4. The leaf/value discriminated union is valid and preserves exact field/value relationships.
5. All helper patch/write types are defined, not merely mentioned in comments.
6. Every authorizable field has exact preference and schema destinations.
7. Refused leaves and marks remain type-excluded.
8. Override-pair patches require both members.
9. Initial natural eyelash anatomy and post-creation eyelash refusal no longer contradict each other.
10. No code or implementation status is overstated.

## Final response

Report:

1. The exact §5.4 type corrections.
2. How field-specific value and persistence types are now derived.
3. How the natural-eyelash creation boundary was clarified.
4. The tests added to the policy matrix.
5. Whether any undefined or placeholder contract types remain.
6. The exact file changed.

Confirm explicitly:

- No production code changed.
- No implementation batch started.
- Nothing was staged or committed.
- Nothing was pushed or deployed.
- Production was not contacted.

Stop for founder/Codex review.
