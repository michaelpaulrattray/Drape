# The unused-exports purge — the manifest (#108 slice 2)

> **Status: WRITTEN 2026-09-17, NOT EXECUTED.** Janitor session for #108 slice 2
> (foreman-20260917-0200, run #274), on the founder's word of 16 Sep: *"105-108
> clear them"* — manifest-first, the un-wiring differ read on every row before
> it goes. **This document is the reading; the deletion is the next Janitor
> session's brief and it carries this manifest.** Nothing below is deleted yet.

**The finding** (card #108, Janitor patrol #1): knip's unused-export list. Read
here at the nightly run `35119015532` on `b411314d` (triggered by hand after
slice 1 merged, so the reading is post-slice-1): **193 files holding 458 unused
export symbols**, 2 duplicates (the floor), 19 unused files (all already on the
09-15 list — no new orphan).

## The instrument was repaired before it was believed (law 2)

The card's road is *"exports through the differ, not by hand"*, and the first
thing the differ did this session was report a live symbol dead. Over the
30-day window (`67fd37df` → `b411314d`) it named six symbols whose production
importers fell to zero; the sixth, `blockIp`, has **two live callers** —
`routes/admin/ipBlocking.ts` and `lib/adminActions/changeRequestActions.ts`,
both `const { blockIp } = await import("../../db")`. The reader
(`scripts/lib/importerCountDiff.mts`) did not read that shape at all.

Measured at HEAD before the fix: **36 production-wired server exports counted
ZERO importers** — both login routers (`emailAuthRouter`, `googleAuthRouter`),
`issueStripeRefund`, `adjustUserCredits`, `updateUserRole`, `blockIp` and the
whole change-request road. A symbol already at zero can never be seen to fall
to zero, so the timeline would have reported silence on the day either login
route died. **PR #1017** repairs it (destructured dynamic imports read as named
imports; `const mod = await import()` as a namespace binding); seven of eight
new arms redden under the old reader; `--controls february` passes; the
deletion door reads 0 rewired. After: 36 → 0. **Every table below is read on
the repaired reader.** The full-history timeline was walked twice, stride 10
over 3765 commits (377 boundaries, 216 s each) — once on each reader — and the
class counts moved exactly as the repair predicts: `wired-at-head` 1730 → 1766,
`dark-born` 1171 → 1134, `died` 32 → 31 (`blockIp` leaves the died list).

## The population, by what each reader can say (#909)

| class | rows | who can read it | this manifest |
|---|---|---|---|
| **server, dark-born** — never a production importer at any of 377 boundaries, knip-unused (no test, no script, no production importer today) | **153** | both readers agree | **the deletion list**: 147 drop `export`, 6 delete the declaration |
| server, barrel re-export line unused | 19 | knip; the declaration is wired directly | drop the re-export line |
| server, twinned name (`server/db/index.ts` lines aside) | 23 | the timeline unions a name across files (its stated limit) | read by hand, per file, before it goes |
| server, `export { … }` list / re-export shape the reader does not index | 6 | knip only | read by hand |
| server, **died** — wired once, lost every importer | 2 (+`isIpBlocked` via its barrel line) | the differ's own class | **read at their commits below: all DECIDED** |
| server, already on the deletion ledger | 15 | `cleanup-dispositions.yaml` | KEEP / HELD / FILED stand |
| client | 163 | **outside the differ's reported scope** (`server/` only, by design — the sweep's scope) | not this slice; a scope decision on the instrument first |
| shared | 18 | outside the differ's reported scope | not this slice |
| scripts/lib, scripts/calibration | 57 | tooling; the differ excludes `scripts/` on purpose | not this slice; knip judges them against script entries |
| **total** | **458** | | |

**The 30-day window's other five findings, each read at its commit, all
DECIDED:** `OPEN_SLOT_PREFIX` (its one use in `referenceSlotCatalogue.ts` was
replaced by `3e43ffe1` and the import left dead — the reader's own docblock
already names it as one of six dead imports); `PLAN_ORDER` (`#583` folded the
ladder and the route now serves `OFFERED_PLAN_ORDER`, derived from it and
pinned by `card391LadderFold.test.ts`); `calculateCreditAdjustment` (`#664`
made the proration Stripe's own; still self-consulted by `stripeService.ts:490`
and named by 18 test lines); `authorizeInkAddDescription` and
`commitBeginInkAddIntent` (`c99ff1c4`, the placement-picker intent's own
retirement — both HELD on the ledger with their blockers named).

## DIED — the three rows on knip's list, read at the commit that closed the road

| symbol | file | last wired | the commit | verdict |
|---|---|---|---|---|
| `describeHeritage` | `server/castingV2/cohortPhotorealHuman.ts` | 2026-08-27 | `f643b5cd` (#177 Row A: the anchor photo rides; the family clause stopped re-rendering heritage through it) | **DECIDED.** Still the house composer's own renderer (`cohortPhotorealHuman.ts:2482`); only the `export` is unused → drop `export` |
| `INK_POINTER_FIELDS` | `server/castingV2/refineDelta.ts` | 2026-08-23 | `3e0a4da6` (3b: the prune walk moved to the derived `INK_SLOT_FIELDS`) | **DECIDED.** `INK_SLOT_FIELDS` is derived from it and its docblock states why there are two; only the `export` is unused → drop `export` |
| `isIpBlocked` | `server/db/ipBlocking.ts` (knip lists the barrel line) | 2026-02-19 | `2722bc5b` — the `rateLimit.ts` wrapper `checkIpBlocked`, whose only consumer was a test; **CLAUDE.md already records this road** (*"the chain looked wired at each link and was dead as a whole"*) | **KEEP.** `blockIp` calls it for its duplicate check (`ipBlocking.ts:64`); the request-path check CLAUDE.md lists under *not enforced* is a founder decision to wire or bin, not a Janitor act. Ledger row reviewed in this commit (UNREVIEWED 17 → 16, triage §36) |

## One disagreement between the readers, stated

`generateRemainingViews` (`server/casting/geminiViews.ts`): the file-keyed
reader counts ONE importer — `geminiService.ts:61` re-exports it, and a
re-export is a mention the reader counts on purpose — while knip says nothing
imports it through that re-export either. Both are right about their own
question. It is in the read-by-hand table with the other twinned names.

## What the next session does with this

1. Branch, then **re-derive the tables** (`scripts/_108-slice2-manifest-disposable.mts`
   over a fresh cross — the population moves with every merge; #909).
2. Execute the DELETE (6) and DROP `export` (147) tables mechanically; execute
   the barrel lines (19) with them. `pnpm check` + the suite are the safety —
   a test that names a symbol as a STRING (a `toContain` guard) is the shape
   that survives knip and fails the gate, and that is the gate working.
3. The 29 read-by-hand rows: each one opened, per file, and either taken with
   its reason on this manifest or held with its blocker.
4. Flip nothing on the ledger by mechanism: a row that is on the ledger stays
   as it is.
5. Client / shared / scripts populations are NOT this slice: the differ's
   reported scope is `server/` and widening it changes the deletion ledger's
   own population (`unread` would grow by every client symbol). That is an
   instrument decision and it is carded on #108, not taken here.


### DELETE — dark-born, nothing in the tree mentions it (6)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/casting/composeIdentityPayload.ts` | `composeIdentityPayload` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |
| `server/castingV2/axisRegistry.ts` | `IDENTITY_FIELD_AXES` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |
| `server/castingV2/renderVerification.ts` | `isOccluded` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |
| `server/db/inviteCodes.ts` | `approveUserDirectly` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |
| `server/db/waitlist.ts` | `checkEmailOnWaitlist` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |
| `server/logging/logger.ts` | `logger` | dark-born | 0 | 0 | delete the declaration | nothing in the tree mentions it |

### DROP `export` — dark-born, still used inside its own module (147)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/_core/spokenError.ts` | `isSpokenError` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/auditLog.ts` | `ABUSE_ALERT_SEVERITY_RANK` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/aiService.ts` | `fetchImageAsBase64` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/casting/engineChoiceMetadata.ts` | `ENGINE_CHOICE_FIELDS` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/casting/evidence/composer/inkAuthorization.ts` | `INK_AUTHORIZATION_MIN_CONFIDENCE` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkAuthorization.ts` | `INK_AUTHORIZATION_RECIPE_VERSION` | dark-born | 0 | 9 | drop `export` | self-used 9× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_BUILD_COHORTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_OCCLUSION_COHORTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_PRESENTATION_COHORTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_RECORD_VERSION` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_SOURCE_KINDS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `INK_CALIBRATION_TONE_COHORTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkCalibration.ts` | `summarizeInkCalibration` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `buildInkAnywhereIdentityPoseProbeRequest` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkAnywhereFeaturePlacementProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkAnywhereGuideCoverageProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkAnywherePlacementAuditProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkAnywhereVisibilityProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkFeaturePlacementProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/composer/inkProbe.ts` | `parseInkVisibilityProbe` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidenceCandidateContract.ts` | `EVIDENCE_CANDIDATE_ATTEMPT_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidenceCandidateContract.ts` | `EVIDENCE_CANDIDATE_BILLING_ROLES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidenceCandidateContract.ts` | `EVIDENCE_CANDIDATE_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidenceCandidateContract.ts` | `EVIDENCE_INTENT_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidenceCandidateContract.ts` | `EVIDENCE_PROBE_OUTCOMES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidenceComposerScope.ts` | `EvidenceComposerConfigurationError` | dark-born | 0 | 11 | drop `export` | self-used 11× in its module |
| `server/casting/evidence/evidenceComposerScope.ts` | `evidenceComposerEnabledForUser` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidencePackageComposition.ts` | `EVIDENCE_PACKAGE_CROP_RECIPE_VERSION` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidencePackageExecution.ts` | `EVIDENCE_PACKAGE_EXECUTION_FAILURE_CODES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidencePackageExecution.ts` | `EVIDENCE_PACKAGE_EXECUTION_STAGES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidencePackagePlan.ts` | `EVIDENCE_PACKAGE_REFUSALS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/evidencePackageProbe.ts` | `FEATURE_REGION_VISIBILITIES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidencePackageProbe.ts` | `OBSERVED_ANATOMICAL_SIDES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidencePackageProbe.ts` | `OBSERVED_TRAVEL_DIRECTIONS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/evidence/evidencePackageScope.ts` | `EvidencePackageConfigurationError` | dark-born | 0 | 5 | drop `export` | self-used 5× in its module |
| `server/casting/evidence/inkAnatomyRegistry.ts` | `allSupportedInkAnatomyTuples` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/evidence/inkAnatomyRegistry.ts` | `INK_ZONE_RULES` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/casting/evidence/operationReplayFamily.ts` | `OPERATION_REPLAY_FAMILIES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/geminiClient.ts` | `checkIdentityConsistency` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editAuthority.ts` | `CLASSIFIER_PROMPT_HEADER` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editAuthority.ts` | `EYELASH_PATTERN` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editAuthority.ts` | `NORMALIZER_PROMPT_HEADER` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editAuthority.ts` | `VAGUE_REFERENCE_PATTERN` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editAuthority.ts` | `WHOLE_IDENTITY_PATTERN` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/editGate.ts` | `PERMANENT_MARKS_DIMENSION` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/casting/identity/identityCommit.ts` | `editField` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/casting/identity/identityFieldHandlers.ts` | `isValidBaseValue` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/identity/marksVocabulary.ts` | `MARK_CATEGORIES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/identity/marksVocabulary.ts` | `MARK_VOCABULARY` | dark-born | 0 | 5 | drop `export` | self-used 5× in its module |
| `server/casting/identity/structuredEdit.ts` | `STRUCTURED_UPDATE_KEYS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/operationContract.ts` | `GENERATION_OPERATION_CHILD_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/operationContract.ts` | `GENERATION_OPERATION_LANDING_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/operationContract.ts` | `GENERATION_OPERATION_STATUSES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/casting/promptParser.ts` | `PARSER_SYSTEM_PROMPT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/casting/snapshotRestoreScope.ts` | `SnapshotRestoreScopeConfigurationError` | dark-born | 0 | 5 | drop `export` | self-used 5× in its module |
| `server/castingV2/castingIntent.ts` | `COMPOSED_AVOID_MAX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `COMPOSED_THESIS_MAX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `parseStatedHair` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `ROLE_MAX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `STATED_HAIR_MAX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `STATED_SKIN_MAX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/castingIntent.ts` | `SUPPORTED_COHORTS` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/castingV2/castingV2Scope.ts` | `CastingOpenLaneCoverageError` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/castingV2/castingV2Scope.ts` | `CastingOpenLaneScopeConfigurationError` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/castingV2Scope.ts` | `CastingRetryCoverageError` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/castingV2/castingV2Scope.ts` | `CastingRetryScopeConfigurationError` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/castingV2Scope.ts` | `parseCastingOpenLaneScope` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/castingV2Scope.ts` | `parseCastingRetryScope` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/compositeIntegrity.ts` | `SEAM_MIN_SHARE` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/conceptDescribe.ts` | `ABSENCE_CLAIMS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/diagnosticCapture.ts` | `STORAGE_CLEANUP_WORKER_ENV` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/falConcurrency.ts` | `LIMIT_RETRIES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/hairReferenceCrop.ts` | `SEAM_EDGE_MARGIN` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/hairResolver.ts` | `HAIR_AXES` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/castingV2/hairStyles.ts` | `FINISH_WORDS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/inkDeliveryCrop.ts` | `INK_DELIVERY_REGION_PAD` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/inkDeliveryMint.ts` | `INK_DELIVERY_KEY_PREFIX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/inkDeliveryMint.ts` | `INK_DELIVERY_SIDE_UNREAD` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/castingV2/inkPlacement.ts` | `servedAndBare` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/inkPlateDoor.ts` | `INK_PLATE_KEY_PREFIX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/inkReferenceCrop.ts` | `LICENCE_PAD_FACTOR` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/interpreter.ts` | `COHORT_WALL_RETRIED` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/interpreter.ts` | `NOTES_OVERFLOW` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/promptAuthor.ts` | `SKIN_CONTRADICTIONS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/referenceMint.ts` | `composeBelowHeadCut` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/referenceMint.ts` | `LIBRARY_KEY_PREFIX` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/castingV2/referenceMint.ts` | `OPEN_KIND_READ_EMPTY` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/referenceProvenance.ts` | `REFERENCE_READ_INTENTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/refineDelta.ts` | `joinItems` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/refineDelta.ts` | `namesSameThing` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/refinePreservation.ts` | `ALWAYS_PROTECTED` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/refinePreservation.ts` | `CATEGORIES` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/refinePreservation.ts` | `protectableFacets` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/refineReask.ts` | `designReaskHandle` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/refineReask.ts` | `inkCutHalfSentence` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/refineReask.ts` | `leaveAsTheyAre` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/castingV2/refineReask.ts` | `reaskByHandle` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/refusalCounter.ts` | `REFUSAL_ACTION` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/reimagine.ts` | `REIMAGINE_ALLOWANCE_FLOOR` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/reimagine.ts` | `REIMAGINE_MAX_OUTPUT_TOKENS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/reimagine.ts` | `REIMAGINE_OVERRUN_TOLERANCE` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/reliabilityReport.ts` | `classOfCheck` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/reliabilityReport.ts` | `FALSE_PASS_BAR` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/reliabilityReport.ts` | `labelOfStoredCheck` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/renderVerification.ts` | `subjectHeading` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/rollEngine.ts` | `castingImageQueue` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/rollRecovery.ts` | `isTornCancel` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/rollRecovery.ts` | `isTornFailure` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/rollRecovery.ts` | `isTornUnseen` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/rollService.ts` | `closedSessionRefusal` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/sheetPreview.ts` | `SHEET_PREVIEW_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/signEngine.ts` | `castPackageQueue` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/slotWordShape.ts` | `artifactPhraseIn` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/thumbnails.ts` | `THUMB_QUALITY` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/castingV2/varianceBudget.ts` | `RELEASE_LADDER` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/castingV2/viewConformance.ts` | `AXIS_VERDICTS` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/crew/crewTabScope.ts` | `CrewTabScopeConfigurationError` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/db/castingV2InkDeliveryCrops.ts` | `InkDeliveryCropOwnershipError` | dark-born | 0 | 5 | drop `export` | self-used 5× in its module |
| `server/db/crewShiftRuns.ts` | `CREW_SHIFT_RUN_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/db/migrationLag.ts` | `reportMigrationLag` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/db/waitlist.ts` | `getWaitlistPosition` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/klaviyo.ts` | `createOrUpdateProfile` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/klaviyo.ts` | `FROZEN_ACCOUNT_SUPPORT_URL` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/klaviyo.ts` | `trackEvent` | dark-born | 0 | 4 | drop `export` | self-used 4× in its module |
| `server/lib/adminActions/approvalStateBlocker.ts` | `CHANGE_REQUEST_STATE_REQUIREMENTS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/providers/falQueue.ts` | `DEFAULT_IDENTITY_MODEL` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/providers/falTransport.ts` | `cancelFalUrl` | dark-born | 0 | 3 | drop `export` | self-used 3× in its module |
| `server/providers/openrouterImages.ts` | `DEFAULT_CREATIVE_MODEL` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/providers/openrouterImages.ts` | `GPT_IMAGE_2_USD_PER_IMAGE` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/routes/characterSheet.ts` | `CHARACTER_SHEET_RATE_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/routes/crewEyeFrames.ts` | `CREW_EYE_FRAME_RATE_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/routes/evidenceDelivery.ts` | `EVIDENCE_DELIVERY_RATE_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/routes/inkDesignDelivery.ts` | `INK_DESIGN_DELIVERY_RATE_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/routes/models.ts` | `isFinalModelDeleteEnabled` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/routes/referenceDelivery.ts` | `REFERENCE_DELIVERY_RATE_LIMIT` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/security/rateLimit.ts` | `TRUSTED_PROXY_HOPS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/security/securityHeaders.ts` | `THEME_BOOT_SCRIPT_HASH` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/stripe/invoiceLines.ts` | `isProrationLine` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/stripe/invoiceLines.ts` | `isSubscriptionLine` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/stripe/stripeProducts.ts` | `isHiddenPlanTier` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/stripe/stripeService.ts` | `getPaymentIntentFromSession` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/stripe/stripeService.ts` | `REFUND_CREATE_FAILED_STATUSES` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/testing/suiteClocks.ts` | `COLD_IMPORT_TIMEOUT_MS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/testing/suiteClocks.ts` | `TREE_SWEEP_TIMEOUT_MS` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/wardrobe/garmentDescription.ts` | `ANALYZING_DESCRIPTION_PREFIX` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |
| `server/wardrobe/utils.ts` | `getIntraCategoryWeight` | dark-born | 0 | 2 | drop `export` | self-used 2× in its module |
| `server/wardrobe/utils.ts` | `urlToBase64` | dark-born | 0 | 1 | drop `export` | self-used 1× in its module |

### DROP THE BARREL LINE — the re-export is unused; the declaration is reached directly (19)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/db/index.ts` | `addTopupCredits` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `approveUserDirectly` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `checkEmailOnWaitlist` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `completeReferral` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `deleteBoardItemVersions` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getGenerationById` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getModelAssetByView` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getOperationLockByOperation` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getReferralCreditsEarned` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getUserByEmail` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getUserDraftModelsWithThumbnail` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `getWaitlistPosition` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `initializeUserCredits` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `isIpBlocked` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `redeemInviteCode` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `spendWindow` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/db/index.ts` | `updateOutfit` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/logging/index.ts` | `logger` | barrel line | n/a | 2 | drop the re-export line | the declaration lives elsewhere and is reached there |
| `server/logging/index.ts` | `rootLogger` | barrel line | n/a | 0 | drop the re-export line | the declaration lives elsewhere and is reached there |

### READ BY HAND — twinned names and export lists the reader does not index (29)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/casting/aiService.ts` | `AspectRatio` | wired-at-head?twin | n/a | 3 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/aiService.ts` | `GenerationMode` | wired-at-head?twin | n/a | 3 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/aiService.ts` | `ImageResolution` | wired-at-head?twin | n/a | 3 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `BRAND_NAME` | dark-born?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `castingSessionKey` | dark-born?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `checkIdentityConsistency` | dark-born?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `deleteCastingSessionsFor` | dark-born?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `extractMimeType` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `generateRemainingViews` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `getAiClient` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `getStudioSettings` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiService.ts` | `SAFETY_SETTINGS` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/casting/geminiViews.ts` | `generateRemainingViews` | wired-at-head?twin | 1 | 1 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/castingIntent.ts` | `FACIAL_HAIR_LEANS` | wired-at-head?twin | n/a | 2 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/castingIntent.ts` | `HAIR_COLOURS` | not-in-timeline | n/a | 1 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/castingIntent.ts` | `LEAN_STRENGTHS` | wired-at-head?twin | n/a | 2 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/castingIntent.ts` | `VARIATION_AXES` | dark-born?twin | n/a | 2 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/cohortPhotorealHuman.ts` | `BUILDS` | deleted?twin | n/a | 1 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/hairStyles.ts` | `COILED_NONBINARY_STYLES` | not-in-timeline | n/a | 2 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/heritagePromotion.ts` | `HERITAGE_WORDS` | not-in-timeline | n/a | 2 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/heritagePromotion.ts` | `HERITAGES` | deleted?twin | n/a | 1 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/inkTemplates.ts` | `INK_TEMPLATE_KINDS` | not-in-timeline | n/a | 1 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/interpreter.ts` | `INTERPRETER_SYSTEM_PROMPT` | not-in-timeline | n/a | 0 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/promptAuthor.ts` | `ageClaimsIn` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/promptAuthor.ts` | `ageContradictionIn` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/promptAuthor.ts` | `saysSex` | wired-at-head?twin | n/a | 0 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/realizedAxes.ts` | `REALIZED_AXIS_KEYS` | not-in-timeline | n/a | 1 | read by hand — not a declaration shape the reader indexes | an `export { … }` list or a re-export |
| `server/castingV2/signService.ts` | `CASTING_V2_SIGN_COSTS` | wired-at-head?twin | n/a | 1 | read by hand — twinned name | the history reader unions the name across files |
| `server/castingV2/signService.ts` | `CASTING_V2_SIGN_PRICE_CREDITS` | wired-at-head?twin | n/a | 2 | read by hand — twinned name | the history reader unions the name across files |

### DIED — read at their commits (below) (2)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/castingV2/cohortPhotorealHuman.ts` | `describeHeritage` | died | 0 | 1 | read — DECIDED at its commit | last wired 2026-08-27 26e10ca3; lost server/castingV2/familyClause.ts |
| `server/castingV2/refineDelta.ts` | `INK_POINTER_FIELDS` | died | 0 | 1 | read — DECIDED at its commit | last wired 2026-08-23 74b1c98d; lost server/castingV2/prunedSlots.ts |

### KEEP — already dispositioned on the ledger (15)

| file | symbol | class | importers at HEAD | self-uses | act | note |
|---|---|---|---|---|---|---|
| `server/casting/evidence/composer/inkAddRecipe.ts` | `INK_ADD_RECIPE` | ledger HELD | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/casting/evidence/composer/inkRetryDecision.ts` | `probeOutcomeAllowsCanon` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/casting/evidence/evidencePackageAuthority.ts` | `planEvidencePackageSync` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/casting/evidence/inkAnatomyRegistry.ts` | `isLimbInkZone` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/casting/identity/anchorSelector.ts` | `roleForAuthorizedResult` | ledger HELD | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/axisRegistry.ts` | `AXIS_REGISTRY_BINDINGS` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/axisRegistry.ts` | `isTasteWritable` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/hairStyles.ts` | `HAIR_STYLE_NAMES` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/refineFacets.ts` | `axesOfFacet` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/refusalCounter.ts` | `refusalTallies` | ledger FILED | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/rollEngine.ts` | `resetCastingEngineForTests` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/segmentsOnFace.ts` | `ACCESSORY_FACET` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/signEngine.ts` | `resetSignEnginesForTests` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/castingV2/zoneScope.ts` | `scopedFacets` | ledger KEEP | 0 | 0 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
| `server/db/ipBlocking.ts` | `isIpBlocked` | ledger UNREVIEWED | 0 | 1 | KEEP (ledger) | dispositioned on cleanup-dispositions.yaml |
