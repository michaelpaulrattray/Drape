# The unused-types purge — the manifest (#108 slice 3)

> **Status: EXECUTED 2026-09-17** in the same session that wrote it
> (foreman-20260917-0520, run #276, Janitor seat), on the founder's word of
> 16 Sep — *"105-108 clear them"* — and on slice 2b's road: population
> re-derived at HEAD, every row classified by a checker driven with positive
> controls before its silences counted, `pnpm check` run BEFORE the hand rows,
> the executor refusing the whole run unless every row matched exactly once.

**The finding** (card #108, Janitor patrol #1): knip's *unused exported types*
list. Read here at the nightly run `35135458071` on `c8ee90c6` — HEAD at the
time, the run that measured slice 2b — **134 files holding 271 unused type
symbols** (server 174, client 65, scripts 17, shared 15); unused exports 102
files (slice 2b's expectation, landed), duplicates 2 (the floor), unused files
19 (no new orphan).

## Why this slice does not go through the differ, and why that is not a shortcut

The card's road is *"through the un-wiring differ, not by hand"*, because an
unused EXPORT is one of three things — never wired, **un-wired by a later
commit** (a control that died), or reached through a shape knip cannot see —
and only the differ tells the first from the second. That question is asked of
CONTROLS: code that runs on a request path and can stop doing so.

**Every row in this population is compile-time only.** Read at the bytes,
not assumed: the population's declaration shapes are 163 `type`, 59
`interface`, 40 barrel re-export lines and 9 `export { … }` list entries —
**no `enum`, no `class`, no value of any kind**. A type cannot be on a request
path; it cannot be a control; it cannot die the path-three death. And all
three control-instruments say so of themselves rather than leaving it to be
inferred:

- the differ's declaration pattern is `const|let|function|class|enum`
  (`scripts/lib/importerCountDiff.mts:168`) — it does not index a type at all;
- the uncalled-export sweep reads `type|interface` and then discards them:
  *"Types and interfaces are contracts, not call sites — out of scope"*
  (`scripts/sweep-uncalled-exports-disposable.mts:426`);
- so the deletion ledger's population (the sweep's list) holds **zero** of the
  174 server types here — measured by intersection, not assumed.

So the readers for a type are exactly two: **knip** (the finder) and **tsc**
(the proof). Slice 2's open question — whether the differ's reported scope
widens to client/shared — does not touch this slice, because no scope of any
control-instrument has ever included a type. That is why this manifest covers
all four areas at once where slice 2b stopped at `server/`.

**What a wrong deletion costs here, stated:** a type nothing reads is deleted;
a type something reads through a shape knip missed fails `pnpm check` on the
branch — a red on the gate, never a runtime change. The consumer checker below
exists to find that shape BEFORE tsc does, so a held row is a decision rather
than a surprise.

## The instrument, driven before it was believed (law 2)

`output/_108-types-consumers.py` indexes every import statement in
`server/`, `client/`, `shared/`, `scripts/` and `drizzle/` — **tests and
`*-disposable.*` scripts INCLUDED**, which knip ignores (slice 2b's note 2:
a tracked export can have an untracked consumer) — across four shapes: static
named/namespace imports, `export { … } from` re-exports, inline
`import("./x").T` type references, and `const { x } = await import()`. It
resolves `@/` and `@shared/` (the second was missing on its first run and
mis-held one row; the alias table is `tsconfig.json`'s `paths`, read there).

- **Positive controls first**: `CreativeEngine` (`server/providers/types.ts`,
  6 importers) and `CastingPath` (`shared/castingPaths.ts`, 17) — both FOUND
  before any silence was believed.
- **Its one real finding: `SchemaPathByField`** (`identityTypes.ts`) is read by
  `identityFieldHandlers.ts:221` as `import("./identityTypes").SchemaPathByField[F]`
  — an inline type-position `import()`. **knip does not see that shape**; tsc
  would have refused the drop. Held, then dissolved: the file already
  static-imports from `./identityTypes` (no cycle), so the reference is
  rewritten as a named import and the row leaves knip's list honestly rather
  than by exclusion. **Recorded as a knip ceiling in `docs/JANITOR_KNIP.md`.**
- 19 rows had a consumer that was itself a population row (the design-system
  barrel re-exporting each component's `Props`) — consistent pairs, both go.
- **One rule the code corrected**: the first act table excluded the barrel
  file from its own source's consumers and so mis-read `ConceptDescribeRefusal`
  — `conceptDescribe.ts` both re-exports it AND imports it for its own use.
  `pnpm check` caught it in 16 s (*run it before the hand rows*); the rule now
  excludes only the barrel file's RE-EXPORT statement, and exactly one row
  moved when the table was re-derived.
- A tracked-type-with-untracked-consumer scan over 1,278 disposable and
  untracked scripts found one import (`Facet` from `refineFacets`) and it is
  not a population row — no hold.

## What executed, and the two rows read by hand

`scripts/_108-slice3-execute-disposable.mts` works on the TypeScript AST
(an `interface` body spans lines; a regex cannot find its end) and refuses the
whole run — writing nothing — unless every row finds exactly one target. It
prints every leading comment it deletes with a declaration, so a docblock that
is a RECORD is caught by eye. Two were:

- **`SourcePicture`** (`recipeAssembler.ts`) carried the closed-vocabulary
  ruling for `SourceKind["pictures"]` (fable-1137 §2d, fable-1274 §1). The
  alias had no reader; the ruling is not the alias's. **It is moved onto
  `SourceKind`'s own docblock**, the union it describes — where a second list
  cannot drift from it — with one line saying where it came from. The
  paragraph about the alias itself (*"derived from `SourceKind` as of
  2026-08-21 … it had no caller left to notice"*) is retired with the alias.
- **`OpenKindSide`** (`openKindQuestion.ts`) was declared *"so the next reader
  does not go looking for a side branch"*. The sentence stays as a plain
  comment; the type that carried it goes, with its now-orphaned `Instance`
  import — the ONLY import this slice orphaned (a before/after scan of all
  145 changed files found 15 other single-mention named imports, every one
  already unused at `main`; left alone — *not a chance to tidy the original*).

**Measured after** (`pnpm janitor:knip` on the branch, not a nightly): unused
exported types **134 files / 271 symbols → 0 / 0 — the section is absent from
the report**; unused exports 102 (unmoved), files 19, duplicates 2. A next
nightly that prints an *Unused exported types* section at all is the finding.

**The Atlas diff, read** (CLAUDE.md: reviewed with the change, never edited):
the `redeclared-shape` collector compares a file's type literals against the
EXPORTED shapes of modules it imports, so un-exporting 221 types moves its
population. One finding resolved (`carriedSegments.ts:45` — the shape it
matched is no longer exported) and three appeared, each a literal that used to
match TWO exported shapes (ambiguous, suppressed) and now matches one:
`facePanel.ts:582/583` against `PresentationClause`, whose `words` is `string`
where the literal's is `readonly string[]` — not the same shape; and
`inkReferenceMint.ts:121` against `InkUploadRefusal`, the generic
`{ code, message }` refusal pair. None is a copy. They join the collector's
warn-class list (44 → 46) rather than `acceptedFindings`, which is empty by
design and stays so.

## The tables — every row derived from `output/_108-types-acts.tsv` by `output/_108-slice3-manifest.py`, never typed

**DROP `export` by area:** client 39, scripts 17, server 153, shared 12. **By kind:** interface 60, type 161.

### DELETE — the declaration itself: nothing in its own file names it either (15)

| file | symbol | kind | note |
|---|---|---|---|
| `client/src/features/casting/components/ImageViewer/ViewTabs.tsx` | `GeneratedAsset` | interface |  |
| `client/src/features/wardrobe/types.ts` | `DecomposedGarment` | interface |  |
| `client/src/features/wardrobe/types.ts` | `OverlayStyleNote` | interface |  |
| `client/src/features/wardrobe/types.ts` | `VTOResult` | interface |  |
| `client/src/features/wardrobe/types.ts` | `WardrobeGarment` | interface |  |
| `client/src/features/wardrobe/types.ts` | `WardrobeOutfit` | interface |  |
| `client/src/features/wardrobe/types.ts` | `WardrobeSession` | interface |  |
| `server/casting/identity/identityTypes.ts` | `ReferenceModality` | type |  |
| `server/castingV2/inkTemplates.ts` | `InkTemplateName` | type |  |
| `server/castingV2/openKindQuestion.ts` | `OpenKindSide` | type |  |
| `server/castingV2/recipeAssembler.ts` | `SourcePicture` | type |  |
| `server/castingV2/sliceRefundLedger.ts` | `SliceRefundReason` | type |  |
| `shared/castingRealization.ts` | `RealizedAxisKey` | type |  |
| `shared/changeRequestLabels.ts` | `ChangeRequestAction` | type |  |
| `shared/crewCardState.ts` | `CrewCardState` | type |  |

### DROP `export` — still used inside its own module; nothing imports it (221)

| file | symbol | kind | local uses |
|---|---|---|---|
| `client/src/components/design-system/Button.tsx` | `ButtonProps` | interface | 1 |
| `client/src/components/design-system/Button.tsx` | `FooterLinkProps` | interface | 1 |
| `client/src/components/design-system/Button.tsx` | `LinkButtonProps` | interface | 1 |
| `client/src/components/design-system/Button.tsx` | `NavLinkProps` | interface | 1 |
| `client/src/components/design-system/Button.tsx` | `SocialLinkProps` | interface | 1 |
| `client/src/components/design-system/Card.tsx` | `CardProps` | interface | 1 |
| `client/src/components/design-system/Card.tsx` | `ProjectCardProps` | interface | 1 |
| `client/src/components/design-system/Card.tsx` | `ServiceCardProps` | interface | 1 |
| `client/src/components/design-system/Card.tsx` | `StatCardProps` | interface | 1 |
| `client/src/components/design-system/Grid.tsx` | `GridItemProps` | interface | 2 |
| `client/src/components/design-system/Grid.tsx` | `GridProps` | interface | 1 |
| `client/src/components/design-system/Grid.tsx` | `TwoColumnProps` | interface | 1 |
| `client/src/components/design-system/Section.tsx` | `ContainerProps` | interface | 1 |
| `client/src/components/design-system/Section.tsx` | `SectionLabelProps` | interface | 1 |
| `client/src/components/design-system/Section.tsx` | `SectionProps` | interface | 1 |
| `client/src/components/design-system/Typography.tsx` | `BodyTextProps` | interface | 1 |
| `client/src/components/design-system/Typography.tsx` | `HeadingProps` | interface | 1 |
| `client/src/components/design-system/Typography.tsx` | `LabelProps` | interface | 1 |
| `client/src/components/design-system/Typography.tsx` | `TagProps` | interface | 1 |
| `client/src/features/admin/overview/NeedsHuman.tsx` | `AttentionItem` | interface | 2 |
| `client/src/features/admin/overview/chartTokens.ts` | `ChartTokens` | interface | 8 |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `NodeControlStripProps` | interface | 1 |
| `client/src/features/boards/canvas/NodeStatusBadge.tsx` | `NodeStatus` | type | 2 |
| `client/src/features/boards/canvas/nodes/ImageNode.tsx` | `ImageNodeData` | interface | 1 |
| `client/src/features/boards/nodes/FrameNode.tsx` | `FrameNodeData` | type | 1 |
| `client/src/features/boards/nodes/NoteNode.tsx` | `NoteNodeData` | type | 1 |
| `client/src/features/boards/stores/useOptimisticFills.ts` | `OptimisticFill` | interface | 2 |
| `client/src/features/casting/constants.ts` | `CastingVibe` | interface | 1 |
| `client/src/features/casting/evidence/PrivateEvidenceImage.tsx` | `PrivateEvidenceImageProps` | interface | 1 |
| `client/src/features/casting/hooks/castingBindings.ts` | `FailedAction` | type | 2 |
| `client/src/features/casting/pendingCastRegistry.ts` | `CastingOperationOutcome` | type | 2 |
| `client/src/features/operations/outcomeSlot.ts` | `OutcomeOrigin` | type | 1 |
| `client/src/features/staff/staffRole.ts` | `StaffRole` | type | 1 |
| `client/src/features/staff/useAccountMenuCounts.ts` | `AccountMenuCounts` | interface | 1 |
| `client/src/features/staff/useModeratorFlagCounts.ts` | `ModeratorFlagCounts` | interface | 2 |
| `client/src/features/studio/components/CastModelModal.tsx` | `EvidenceMintTierPlan` | interface | 1 |
| `client/src/features/studio/components/CastModelModal.tsx` | `MintIntegrityPrediction` | interface | 1 |
| `client/src/features/studio/components/CastModelModal.tsx` | `TierIntegrity` | type | 1 |
| `client/src/features/wardrobe/types.ts` | `GarmentStatus` | type | 1 |
| `scripts/calibration/lib/speckDensity.mts` | `Patch` | type | 2 |
| `scripts/lib/askCatalogue.mts` | `Tier` | type | 10 |
| `scripts/lib/benchCommands.mts` | `HyperfineResult` | type | 1 |
| `scripts/lib/capabilityAtlas.mts` | `InterpreterCall` | type | 2 |
| `scripts/lib/ceremonyAutoApply.mts` | `StatementKind` | type | 1 |
| `scripts/lib/constancyArm.mts` | `ConstancySide` | type | 3 |
| `scripts/lib/designLawControls.mts` | `Control` | type | 2 |
| `scripts/lib/designLawSurfaces.mts` | `PlannedSurface` | type | 1 |
| `scripts/lib/faceScanWire.mts` | `ScanAsk` | type | 7 |
| `scripts/lib/falSpend.mts` | `FalUnitPrice` | type | 2 |
| `scripts/lib/interactionLatency.mts` | `Probe` | type | 2 |
| `scripts/lib/interactionLatency.mts` | `ProbeReading` | type | 4 |
| `scripts/lib/outsider.mts` | `ScopeFlag` | type | 1 |
| `scripts/lib/refineDriver.mts` | `RefineOutcome` | type | 3 |
| `scripts/lib/ritePushSequence.mts` | `PushAttempt` | type | 4 |
| `scripts/lib/shiftLedger.mts` | `AttributedSession` | type | 3 |
| `scripts/lib/worldGuard.mts` | `MixedWorld` | type | 2 |
| `server/_core/sdk.ts` | `SessionPayload` | type | 1 |
| `server/casting/composeIdentityPayload.ts` | `IdentityManifest` | interface | 2 |
| `server/casting/composeIdentityPayload.ts` | `IdentityPayload` | interface | 1 |
| `server/casting/composeIdentityPayload.ts` | `StaleInputFlag` | interface | 2 |
| `server/casting/engineChoiceMetadata.ts` | `EngineChoiceField` | type | 4 |
| `server/casting/evidence/composer/inkAddRecipe.ts` | `InkAddRecipeIdentity` | interface | 1 |
| `server/casting/evidence/composer/inkAuthorization.ts` | `InkAuthorizationRefusal` | type | 1 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationBuildCohort` | type | 1 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationOcclusionCohort` | type | 1 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationPresentationCohort` | type | 1 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationRates` | interface | 3 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationSourceKind` | type | 1 |
| `server/casting/evidence/composer/inkCalibration.ts` | `InkCalibrationToneCohort` | type | 1 |
| `server/casting/evidence/composer/inkComposer.ts` | `InkComposerInlineImage` | interface | 7 |
| `server/casting/evidence/composer/inkProbe.ts` | `InkPlacementProbeDetail` | interface | 1 |
| `server/casting/evidence/composer/inkProbe.ts` | `InkProbeKind` | type | 1 |
| `server/casting/evidence/evidencePackageComposition.ts` | `EvidencePackageComposerInlineImage` | interface | 3 |
| `server/casting/evidence/evidencePackageComposition.ts` | `EvidencePackageDerivedImage` | interface | 2 |
| `server/casting/evidence/evidencePackageExecution.ts` | `EvidencePackageExecutionFailureCode` | type | 3 |
| `server/casting/evidence/evidencePackageExecution.ts` | `EvidencePackageExecutionStage` | type | 2 |
| `server/casting/evidence/evidencePackagePlan.ts` | `EvidencePackagePlanSlot` | interface | 4 |
| `server/casting/evidence/evidencePackagePlan.ts` | `EvidencePackageRefusal` | type | 2 |
| `server/casting/evidence/evidencePackagePlan.ts` | `EvidencePackageSlotStatus` | type | 1 |
| `server/casting/evidence/evidencePackageProbe.ts` | `EvidencePackageProbeInlineImage` | interface | 3 |
| `server/casting/evidence/evidencePackageProbe.ts` | `FeatureRegionVisibility` | type | 1 |
| `server/casting/evidence/evidencePackageRegistry.ts` | `EvidenceVisibilityDirective` | type | 1 |
| `server/casting/evidence/evidencePackageRegistry.ts` | `ExistingSelectionImpact` | type | 1 |
| `server/casting/evidence/evidencePackageRegistry.ts` | `MissingViewAuthority` | type | 1 |
| `server/casting/evidence/founderEvidenceCeremony.ts` | `FounderEvidenceCeremonyMode` | type | 3 |
| `server/casting/evidence/inkAnatomyRegistry.ts` | `InkAnatomySurface` | type | 2 |
| `server/casting/evidence/inkAnatomyRegistry.ts` | `InkAnatomyZone` | type | 9 |
| `server/casting/evidence/inkInstructionPlanner.ts` | `InkInstructionPlanRefusal` | type | 1 |
| `server/casting/evidence/inkPackageImpactV2.ts` | `InkFeatureAngleAuthority` | interface | 4 |
| `server/casting/evidence/inkProjectionComposition.ts` | `InkProjectionComposerInlineImage` | interface | 3 |
| `server/casting/identity/creationIntake.ts` | `CreationIntakeRefusal` | interface | 1 |
| `server/casting/identity/editAuthority.ts` | `EditAuthorityModel` | interface | 1 |
| `server/casting/identity/identityTypes.ts` | `AgeValue` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `BodyTypeOption` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `ClassifierParent` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `DurableDescriptor` | type | 18 |
| `server/casting/identity/identityTypes.ts` | `FaceLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `FormOption` | type | 4 |
| `server/casting/identity/identityTypes.ts` | `GenderOption` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `HairLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `NormalizedValueByField` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `PersonStructuredCategory` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `PreferenceKeysByField` | type | 3 |
| `server/casting/identity/identityTypes.ts` | `RefusedIdentityLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `SkinLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `SkinToneOption` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `StructuredIdentityField` | type | 2 |
| `server/casting/identity/identityTypes.ts` | `SupportedFaceLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `SupportedHairLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `SupportedSkinLeaf` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `WritableIdentityPreferenceKey` | type | 1 |
| `server/casting/identity/identityTypes.ts` | `WritableIdentitySchemaPath` | type | 1 |
| `server/casting/identity/mintIntegrity.ts` | `MintCheck` | interface | 4 |
| `server/casting/identity/mintIntegrity.ts` | `TierViewCheck` | interface | 2 |
| `server/casting/operationContract.ts` | `GenerationOperationProgressStep` | interface | 1 |
| `server/casting/operationContract.ts` | `PublicGenerationOperationChild` | interface | 1 |
| `server/casting/promptReinforcement.ts` | `EthnicityBlendEntry` | interface | 1 |
| `server/castingV2/axisRegistry.ts` | `RealizedShelfAxis` | type | 1 |
| `server/castingV2/axisRegistry.ts` | `TasteWritableAxis` | type | 4 |
| `server/castingV2/bornWornDetector.ts` | `BornWornDetection` | type | 1 |
| `server/castingV2/callCensus.ts` | `CallStage` | type | 1 |
| `server/castingV2/castingIntent.ts` | `CohortKey` | type | 3 |
| `server/castingV2/castingIntent.ts` | `ComposedDirection` | type | 2 |
| `server/castingV2/changeAmplitude.ts` | `AmplitudeBasis` | type | 1 |
| `server/castingV2/deliveryCourt.ts` | `DeliveryDeclined` | type | 1 |
| `server/castingV2/detectionUniversality.ts` | `DetectionVerdict` | type | 1 |
| `server/castingV2/facetCards.ts` | `FacetNaming` | type | 1 |
| `server/castingV2/facetCards.ts` | `FacetPreservation` | type | 1 |
| `server/castingV2/hairColourFromReference.ts` | `HairColourReadRefusal` | type | 1 |
| `server/castingV2/hairColourFromReference.ts` | `HairColourReadRefusalCode` | type | 1 |
| `server/castingV2/hairReferenceCutter.ts` | `HairCarrierRefusal` | type | 1 |
| `server/castingV2/hairReferenceCutter.ts` | `HairCarrierRefusalCode` | type | 3 |
| `server/castingV2/hairResolver.ts` | `HairAxis` | type | 3 |
| `server/castingV2/hairResolver.ts` | `HairTier` | type | 3 |
| `server/castingV2/inkDeliveryCrop.ts` | `InkDeliveryCut` | type | 1 |
| `server/castingV2/inkDeliveryCrop.ts` | `InkDeliveryCutRefusal` | type | 1 |
| `server/castingV2/inkDeliveryMint.ts` | `InkDeliveryMintDependencies` | type | 1 |
| `server/castingV2/inkPlateDoor.ts` | `InkPlateRefusalCode` | type | 1 |
| `server/castingV2/inkPlateEngines.ts` | `InkPlateMintRequest` | type | 1 |
| `server/castingV2/inkReferenceCutter.ts` | `InkCut` | type | 1 |
| `server/castingV2/inkReferenceCutter.ts` | `InkCutRefusal` | type | 1 |
| `server/castingV2/inkReferenceCutter.ts` | `InkCutRefusalCode` | type | 3 |
| `server/castingV2/inkReferenceMint.ts` | `InkReferenceMintRefusal` | type | 1 |
| `server/castingV2/inkReferenceMint.ts` | `InkReferenceMintRefusalCode` | type | 3 |
| `server/castingV2/inkTemplates.ts` | `InkTemplateBuild` | type | 1 |
| `server/castingV2/inkUploadDoor.ts` | `InkUploadRefusalCode` | type | 1 |
| `server/castingV2/inkUploadService.ts` | `InkUploadPlate` | type | 1 |
| `server/castingV2/interpreter.ts` | `InterpreterUnavailableCause` | type | 1 |
| `server/castingV2/makeupFromReference.ts` | `MakeupReadRefusal` | type | 1 |
| `server/castingV2/makeupFromReference.ts` | `MakeupReadRefusalCode` | type | 1 |
| `server/castingV2/mintedSlots.ts` | `OpenKindToFile` | type | 2 |
| `server/castingV2/openKindPolicy.ts` | `PolicyBasis` | type | 1 |
| `server/castingV2/openKindPolicy.ts` | `PolicyStanding` | type | 1 |
| `server/castingV2/packageOrchestrator.ts` | `PackageSlotOutcome` | type | 4 |
| `server/castingV2/recipeAssembler.ts` | `RecipeReference` | type | 2 |
| `server/castingV2/recipeAssembler.ts` | `RecipeRefusal` | type | 2 |
| `server/castingV2/recipeAssembler.ts` | `StandingWords` | type | 2 |
| `server/castingV2/recipeAssembler.ts` | `WithheldWords` | type | 3 |
| `server/castingV2/referenceAttachDoor.ts` | `ReferenceAttachRefusalCode` | type | 1 |
| `server/castingV2/referenceCompleteness.ts` | `Adjudication` | type | 5 |
| `server/castingV2/referenceCompleteness.ts` | `GuardInstrument` | type | 1 |
| `server/castingV2/referenceCompleteness.ts` | `GuardPass` | type | 1 |
| `server/castingV2/referenceLibrary.ts` | `ReferenceRole` | type | 1 |
| `server/castingV2/referenceMint.ts` | `DisputedNothingKept` | type | 2 |
| `server/castingV2/referenceMint.ts` | `MintDependencies` | type | 1 |
| `server/castingV2/referenceMint.ts` | `MintedSlot` | type | 6 |
| `server/castingV2/referenceMint.ts` | `SlotWordsReader` | type | 1 |
| `server/castingV2/referenceProvenance.ts` | `ReferenceReadAdoption` | type | 1 |
| `server/castingV2/refineDelta.ts` | `DoorAt` | type | 4 |
| `server/castingV2/refineDelta.ts` | `InventionDoorOutcome` | type | 2 |
| `server/castingV2/refineInterpreter.ts` | `ReadFailure` | type | 2 |
| `server/castingV2/refineRefusals.ts` | `RefusalCharge` | type | 1 |
| `server/castingV2/refineRefusals.ts` | `RefusalReportClass` | type | 1 |
| `server/castingV2/refusalCounter.ts` | `RefusalTally` | type | 2 |
| `server/castingV2/reliabilityReport.ts` | `ClassTally` | type | 7 |
| `server/castingV2/reliabilityReport.ts` | `StoredVerification` | type | 2 |
| `server/castingV2/repaintRender.ts` | `ReferenceLoader` | type | 1 |
| `server/castingV2/repaintRender.ts` | `RepaintDelivery` | type | 1 |
| `server/castingV2/repaintRender.ts` | `RepaintRefusal` | type | 1 |
| `server/castingV2/rollRecovery.ts` | `ProviderProbe` | type | 1 |
| `server/castingV2/seedFidelity.ts` | `StatedAge` | type | 1 |
| `server/castingV2/segmentAssembly.ts` | `SegmentExclusion` | type | 1 |
| `server/castingV2/segmentCuts.ts` | `SegmentDrop` | type | 2 |
| `server/castingV2/segmentCuts.ts` | `SegmentDropReason` | type | 1 |
| `server/castingV2/varianceBudget.ts` | `ReleaseRung` | type | 3 |
| `server/castingV2/viewConformance.ts` | `AxisVerdict` | type | 5 |
| `server/castingV2/viewConformance.ts` | `AxisVerdictWord` | type | 2 |
| `server/castingV2/viewConformance.ts` | `ConformanceAxis` | type | 2 |
| `server/castingV2/viewConformance.ts` | `ViewConformanceInput` | type | 1 |
| `server/castingV2/wardrobeDoor.ts` | `WardrobePickRefusal` | type | 2 |
| `server/castingV2/wardrobeLine.ts` | `WardrobeLineSource` | type | 1 |
| `server/db/boards.ts` | `FillEmptyCastNodeResult` | type | 1 |
| `server/db/bugReports.ts` | `BugReportRow` | type | 2 |
| `server/db/crewShiftRuns.ts` | `CrewShiftRunView` | type | 1 |
| `server/db/generationOperations.ts` | `AcknowledgeGenerationOperationResult` | type | 1 |
| `server/db/generationOperations.ts` | `AcquireGenerationOperationLockResult` | type | 3 |
| `server/db/generationOperations.ts` | `ClaimGenerationOperationInput` | interface | 2 |
| `server/db/generationOperations.ts` | `DismissGenerationOperationLandingResult` | type | 1 |
| `server/db/generationOperations.ts` | `LandGenerationOperationResult` | type | 1 |
| `server/db/users.ts` | `ProfileUpdateData` | interface | 1 |
| `server/klaviyo.ts` | `ProfileAttributes` | interface | 1 |
| `server/logging/logger.ts` | `RequestContext` | interface | 1 |
| `server/providers/types.ts` | `IdentityVerdict` | type | 1 |
| `server/providers/types.ts` | `ImageReference` | type | 1 |
| `server/providers/types.ts` | `ProviderProvenance` | type | 4 |
| `server/providers/types.ts` | `Validator` | interface | 1 |
| `server/providers/types.ts` | `VoiceEngine` | interface | 1 |
| `server/wardrobe/garmentDetection.ts` | `SlotType` | type | 4 |
| `server/wardrobe/outfitDecomposition.ts` | `DecomposedGarment` | interface | 2 |
| `shared/boardTypes.ts` | `InputSnapshot` | interface | 4 |
| `shared/briefRewrite.ts` | `BriefEdit` | type | 2 |
| `shared/briefRewrite.ts` | `BriefEditMode` | type | 1 |
| `shared/castingClarification.ts` | `CastingClarificationChoice` | interface | 1 |
| `shared/castingClarification.ts` | `CastingClarificationKind` | type | 1 |
| `shared/castingOptions.ts` | `EthnicityBlendEntry` | interface | 2 |
| `shared/crewCardIntents.ts` | `CrewIntentResolution` | type | 1 |
| `shared/crewCardResolution.ts` | `Hold` | type | 2 |
| `shared/crewCardResolution.ts` | `ResolvableCard` | type | 3 |
| `shared/crewCardResolution.ts` | `Unreadable` | type | 2 |
| `shared/crewReplyAcknowledgement.ts` | `AcknowledgementHold` | type | 2 |
| `shared/inkPlacementVocabulary.ts` | `InkPlacementSides` | type | 1 |

### DROP THE BARREL LINE — the re-export is unused (40)

| barrel file | symbol | source |
|---|---|---|
| `client/src/components/design-system/index.ts` | `BodyTextProps` | `client/src/components/design-system/Typography.tsx` |
| `client/src/components/design-system/index.ts` | `ButtonProps` | `client/src/components/design-system/Button.tsx` |
| `client/src/components/design-system/index.ts` | `CardProps` | `client/src/components/design-system/Card.tsx` |
| `client/src/components/design-system/index.ts` | `ContainerProps` | `client/src/components/design-system/Section.tsx` |
| `client/src/components/design-system/index.ts` | `FooterLinkProps` | `client/src/components/design-system/Button.tsx` |
| `client/src/components/design-system/index.ts` | `GridItemProps` | `client/src/components/design-system/Grid.tsx` |
| `client/src/components/design-system/index.ts` | `GridProps` | `client/src/components/design-system/Grid.tsx` |
| `client/src/components/design-system/index.ts` | `HeadingProps` | `client/src/components/design-system/Typography.tsx` |
| `client/src/components/design-system/index.ts` | `LabelProps` | `client/src/components/design-system/Typography.tsx` |
| `client/src/components/design-system/index.ts` | `LinkButtonProps` | `client/src/components/design-system/Button.tsx` |
| `client/src/components/design-system/index.ts` | `NavLinkProps` | `client/src/components/design-system/Button.tsx` |
| `client/src/components/design-system/index.ts` | `ProjectCardProps` | `client/src/components/design-system/Card.tsx` |
| `client/src/components/design-system/index.ts` | `SectionLabelProps` | `client/src/components/design-system/Section.tsx` |
| `client/src/components/design-system/index.ts` | `SectionProps` | `client/src/components/design-system/Section.tsx` |
| `client/src/components/design-system/index.ts` | `ServiceCardProps` | `client/src/components/design-system/Card.tsx` |
| `client/src/components/design-system/index.ts` | `SocialLinkProps` | `client/src/components/design-system/Button.tsx` |
| `client/src/components/design-system/index.ts` | `StatCardProps` | `client/src/components/design-system/Card.tsx` |
| `client/src/components/design-system/index.ts` | `TagProps` | `client/src/components/design-system/Typography.tsx` |
| `client/src/components/design-system/index.ts` | `TwoColumnProps` | `client/src/components/design-system/Grid.tsx` |
| `client/src/features/admin/overview/index.ts` | `AttentionItem` | `client/src/features/admin/overview/NeedsHuman.tsx` |
| `client/src/features/admin/overview/index.ts` | `ChartTokens` | `client/src/features/admin/overview/chartTokens.ts` |
| `client/src/features/staff/index.ts` | `AccountMenuCounts` | `client/src/features/staff/useAccountMenuCounts.ts` |
| `client/src/features/staff/index.ts` | `ModeratorFlagCounts` | `client/src/features/staff/useModeratorFlagCounts.ts` |
| `client/src/features/staff/index.ts` | `StaffRefreshControls` | `client/src/features/staff/StaffBar.tsx` |
| `server/casting/geminiService.ts` | `GeminiPart` | `server/casting/geminiTypes.ts` |
| `server/casting/geminiService.ts` | `ModelViews` | `server/casting/geminiTypes.ts` |
| `server/castingV2/conceptDescribe.ts` | `ConceptDescribeRefusal` | `server/castingV2/conceptDescribeCopy.ts` |
| `server/castingV2/promptAuthor.ts` | `StatedAge` | `server/castingV2/seedFidelity.ts` |
| `server/db/index.ts` | `AcknowledgeGenerationOperationResult` | `server/db/generationOperations.ts` |
| `server/db/index.ts` | `AcquireGenerationOperationLockResult` | `server/db/generationOperations.ts` |
| `server/db/index.ts` | `BugReportRow` | `server/db/bugReports.ts` |
| `server/db/index.ts` | `ClaimGenerationOperationInput` | `server/db/generationOperations.ts` |
| `server/db/index.ts` | `DismissGenerationOperationLandingResult` | `server/db/generationOperations.ts` |
| `server/db/index.ts` | `FillEmptyCastNodeResult` | `server/db/boards.ts` |
| `server/db/index.ts` | `GdprExportData` | `server/db/gdprExport.ts` |
| `server/db/index.ts` | `LandGenerationOperationResult` | `server/db/generationOperations.ts` |
| `server/db/index.ts` | `ProfileUpdateData` | `server/db/users.ts` |
| `server/db/moderatorQueries.ts` | `FlaggedUserDiscrepancy` | `server/db/discrepancyQueries.ts` |
| `server/lib/adminActions/index.ts` | `ChangeRequestAction` | `shared/changeRequestLabels.ts` |
| `server/logging/index.ts` | `RequestContext` | `server/logging/logger.ts` |

### …of which the SOURCE declaration is itself on the list (both go) (19)

| source file | symbol |
|---|---|
| `client/src/components/design-system/Button.tsx` | `FooterLinkProps` |
| `client/src/components/design-system/Button.tsx` | `LinkButtonProps` |
| `client/src/components/design-system/Button.tsx` | `NavLinkProps` |
| `client/src/components/design-system/Button.tsx` | `SocialLinkProps` |
| `client/src/components/design-system/Card.tsx` | `CardProps` |
| `client/src/components/design-system/Card.tsx` | `ProjectCardProps` |
| `client/src/components/design-system/Card.tsx` | `ServiceCardProps` |
| `client/src/components/design-system/Card.tsx` | `StatCardProps` |
| `client/src/components/design-system/Grid.tsx` | `GridItemProps` |
| `client/src/components/design-system/Grid.tsx` | `GridProps` |
| `client/src/components/design-system/Grid.tsx` | `TwoColumnProps` |
| `client/src/components/design-system/Section.tsx` | `ContainerProps` |
| `client/src/components/design-system/Section.tsx` | `SectionLabelProps` |
| `client/src/components/design-system/Section.tsx` | `SectionProps` |
| `client/src/components/design-system/Typography.tsx` | `BodyTextProps` |
| `client/src/components/design-system/Typography.tsx` | `HeadingProps` |
| `client/src/components/design-system/Typography.tsx` | `LabelProps` |
| `client/src/components/design-system/Typography.tsx` | `TagProps` |
| `shared/changeRequestLabels.ts` | `ChangeRequestAction` |

### …of which the SOURCE stays exported (imported directly elsewhere) (6)

| source file | symbol | still imported by |
|---|---|---|
| `client/src/features/staff/StaffBar.tsx` | `StaffRefreshControls` | client/src/features/staff/useStaffRefresh.ts |
| `server/casting/geminiTypes.ts` | `GeminiPart` | server/casting/geminiGeneration.ts; server/casting/geminiViews.ts |
| `server/casting/geminiTypes.ts` | `ModelViews` | server/casting/geminiViews.ts |
| `server/castingV2/conceptDescribeCopy.ts` | `ConceptDescribeRefusal` | server/castingV2/conceptDescribe.ts |
| `server/db/discrepancyQueries.ts` | `FlaggedUserDiscrepancy` | server/discrepancyFlagging.test.ts |
| `server/db/gdprExport.ts` | `GdprExportData` | server/pathB-hardening.test.ts |

### DROP FROM THE `export { … }` LIST — an import re-exported and never read through this file (9)

| file | symbol | act |
|---|---|---|
| `server/castingV2/castingIntent.ts` | `FacialHairLean` | remove from export list |
| `server/castingV2/castingIntent.ts` | `LeanStrength` | remove from export list |
| `server/castingV2/hairResolver.ts` | `AgeBand` | remove from export list + drop the now-unused import |
| `server/castingV2/hairResolver.ts` | `HeritageComponent` | remove from export list + drop the now-unused import |
| `server/castingV2/hairResolver.ts` | `Sex` | remove from export list + drop the now-unused import |
| `server/castingV2/inkTemplates.ts` | `InkTemplateKind` | remove from export list |
| `server/castingV2/reliabilityReport.ts` | `Facet` | remove from export list + drop the now-unused import |
| `server/castingV2/segmentsOnFace.ts` | `Facet` | remove from export list + drop the now-unused import |
| `server/wardrobe/vtoGeneration.ts` | `TattooMap` | remove from export list |

### HELD — a consumer knip did not see (1)

| file | symbol | why |
|---|---|---|
| `server/casting/identity/identityTypes.ts` | `SchemaPathByField` | consumer knip did not see: server/casting/identity/identityFieldHandlers.ts (dyn-member); server/casting/identity/identityFieldHandlers.ts (dyn-member) |
