# The unused-exports purge, slice 4 — client and shared (the manifest, #108)

> **Status: EXECUTED 2026-09-17** in the session that wrote it (foreman-20260917-1220,
> run #280, Janitor seat), on the founder's word of 16 Sep — *"105-108 clear them"* —
> and on the relay's #1022 decision of 2026-09-17 02:05Z, which is the ROAD for this
> slice: **`client/` by knip + a consumer checker with positive controls + tsc; `shared/`
> through the un-wiring differ with its reported scope widened to `shared/` (PR #1030);
> `scripts/` out.** Every table below is derived by script from the act tables and the
> executor's own log (`output/_108-s4-*`), never typed.

**The population, re-derived at HEAD `d1707381` before any act** (`pnpm janitor:knip`,
local, `output/_108-s4-knip-head.txt`): unused exports **101 files / 252 symbols** —
client 49 files / 165 symbols, shared 9 / 18, scripts 29 / 53 (out, by the decision),
server 14 / 16 (the floor: 15 ledger KEEP rows + one knip misread). Slice 3's
expectation for this reading was files 19 / exports 102; files read 18 and exports 101
because the tree had moved by one PR (#1029) — the delta is that PR's, not a drift.

## The instrument, driven before it was believed (law 2)

`output/_108-s4-classify.py` reuses slice 3's consumer checker
(`_108-types-consumers.py`: every import shape across `server/`, `client/`, `shared/`,
`scripts/`, `drizzle/`, tests and disposables INCLUDED, `@/` and `@shared/` resolved)
and drove **four positive controls first**, each FOUND before a silence counted:
`Button` (`design-system/Button.tsx`, 1 importer — `Login.tsx`), `cn` (`lib/utils.ts`,
53), `CastingPath` (`shared/castingPaths.ts`, 17), `CREDIT_COSTS`
(`features/casting/constants.ts`, 4). Then every row: declaration kind on the source,
self-uses in the comment-stripped module, consumers by the checker.

**29 rows had a consumer.** 27 were the row's own barrel re-export — itself a
population row (the design-system `index.ts` and four feature barrels), so both go
together. **Two were a file on knip's *unused files* list** — `DeleteCastDialog.tsx`
importing `publishCastDeleted`, `billing/index.ts` re-exporting `LowBalanceBanner` — and
a third, `shared/exportViews.ts: filenameWithActualImageExtension`, is imported by
`export/useExportPack.ts`, another unused file. **All three are HELD**: those files
are not this card's population, `tsc` still compiles them (so dropping the export would
red the gate), and the lobby ones are held by his own word — PROGRAM.md, 2026-08-30:
*"NOTHING IS DELETED. Segment 00's orphaned components STAY."*

**The `shared/` 18 through the differ** (`unwiring-timeline.mts`, 3781 commits, stride
10, **379 boundaries**, on PR #1030's reader — `output/_108-s4-timeline.json`):
16 `dark-born`, 2 `wired-at-head`. The two: `SKIN_FINISHES` is a name-level UNION
with its live twin in `shared/castingOptions.ts` — the pair-level read
(`importersAt`) says `castingRealization.ts::SKIN_FINISHES` has **zero** importers,
which is the #274 key doing its job; `filenameWithActualImageExtension`'s one importer
is the unused file above. **No `shared/` row on this list died.**

**The widened reader's three `shared/` deaths (the whole tree, not this list), each
read at its commit:**

| symbol | lost | at | reading |
|---|---|---|---|
| `INK_TEMPLATE_KINDS` (`shared/inkTemplateKinds.ts`) | `server/castingV2/inkTemplates.ts` | `5f412f94` (slice 2b removed a dead re-export) | **FALSE — a reader limit, fixed in PR #1030**: it is `mysqlEnum("templateKind", …)` at `drizzle/schema.ts:3289` and the reader did not walk `drizzle/`. Six `shared/` constants have the schema as their only production importer; all six counted zero before. |
| `agePhrase` (`shared/briefRewrite.ts`) | `server/castingV2/briefRewrite.ts` | `49acd1d1` (#534 — a chip edit writes into the box) | **DECIDED** at its commit. Reached today only through `familyClause.ts:77`'s re-export, whose sole consumer is `familyClause.test.ts`. Not on knip's list (the barrel exports it); recorded, not acted on. |
| `PIPELINE_SWITCHED_KEY` (`shared/crewPipelineGroups.ts`) | `CrewBackgroundWork.tsx` | `115eea80` (#493 — the pipeline block lists nothing twice) | **DECIDED** at its commit. Still returned by `groupKeyFor` (`:452`), self-consulted; the client stopped filtering by it on purpose. |

## The act tables

### Barrel lines removed (`export { … } from`) — the re-export was the row — 50 rows

| file | symbol | kind | act | note |
|---|---|---|---|---|
| `client/src/components/design-system/index.ts` | `AnimatedGridItem` | barrel | remove from barrel line | from ./Grid |
| `client/src/components/design-system/index.ts` | `BodyText` | barrel | remove from barrel line | from ./Typography |
| `client/src/components/design-system/index.ts` | `Card` | barrel | remove from barrel line | from ./Card |
| `client/src/components/design-system/index.ts` | `Container` | barrel | remove from barrel line | from ./Section |
| `client/src/components/design-system/index.ts` | `ConveyorIcon` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `ConveyorText` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `ConveyorTextColor` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `FooterLink` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `Grid` | barrel | remove from barrel line | from ./Grid |
| `client/src/components/design-system/index.ts` | `GridItem` | barrel | remove from barrel line | from ./Grid |
| `client/src/components/design-system/index.ts` | `HeroHeading` | barrel | remove from barrel line | from ./Typography |
| `client/src/components/design-system/index.ts` | `Label` | barrel | remove from barrel line | from ./Typography |
| `client/src/components/design-system/index.ts` | `LinkButton` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `NavLink` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `ProjectCard` | barrel | remove from barrel line | from ./Card |
| `client/src/components/design-system/index.ts` | `Section` | barrel | remove from barrel line | from ./Section |
| `client/src/components/design-system/index.ts` | `SectionHeading` | barrel | remove from barrel line | from ./Typography |
| `client/src/components/design-system/index.ts` | `SectionLabel` | barrel | remove from barrel line | from ./Section |
| `client/src/components/design-system/index.ts` | `ServiceCard` | barrel | remove from barrel line | from ./Card |
| `client/src/components/design-system/index.ts` | `SocialLink` | barrel | remove from barrel line | from ./Button |
| `client/src/components/design-system/index.ts` | `StatCard` | barrel | remove from barrel line | from ./Card |
| `client/src/components/design-system/index.ts` | `Tag` | barrel | remove from barrel line | from ./Typography |
| `client/src/components/design-system/index.ts` | `TwoColumn` | barrel | remove from barrel line | from ./Grid |
| `client/src/const.ts` | `COOKIE_NAME` | barrel | remove from barrel line | from @shared/const |
| `client/src/const.ts` | `SESSION_MAX_AGE_MS` | barrel | remove from barrel line | from @shared/const |
| `client/src/features/admin/overview/index.ts` | `attentionItems` | barrel | remove from barrel line | from ./NeedsHuman |
| `client/src/features/admin/overview/index.ts` | `axisTick` | barrel | remove from barrel line | from ./chartTokens |
| `client/src/features/admin/overview/index.ts` | `tooltipStyle` | barrel | remove from barrel line | from ./chartTokens |
| `client/src/features/admin/overview/index.ts` | `useChartTokens` | barrel | remove from barrel line | from ./chartTokens |
| `client/src/features/casting/components/ImageViewer/index.tsx` | `SlotChip` | barrel | remove from barrel line | from ./CanvasHelpers |
| `client/src/features/casting/components/ImageViewer/index.tsx` | `ToolButton` | barrel | remove from barrel line | from ./CanvasHelpers |
| `client/src/features/casting/constants.ts` | `HAIR_FADES` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_FAMILIES_FEMALE` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_FAMILIES_MALE` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_FRINGES` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_LENGTHS` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_PARTINGS` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_TEXTURES` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_TUCKS` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/constants.ts` | `HAIR_VOLUMES` | barrel | remove from barrel line | from @shared/castingOptions |
| `client/src/features/casting/stores/useCastingFormStore.ts` | `REQUIRED_CAST_FIELDS` | barrel | remove from barrel line | from ../engineChoicePersistence |
| `client/src/features/settings/planMath.ts` | `ANNUAL_RATE` | barrel | remove from barrel line | from @shared/annualBilling |
| `client/src/features/staff/index.ts` | `useModeratorFlagCounts` | barrel | remove from barrel line | from ./useModeratorFlagCounts |
| `client/src/features/staff/index.ts` | `useStaffAutoRefreshStore` | barrel | remove from barrel line | from ./stores/useStaffAutoRefreshStore |
| `client/src/features/staff/index.ts` | `useStaffCounts` | barrel | remove from barrel line | from ./useStaffCounts |
| `client/src/features/wardrobe/index.ts` | `GarmentCard` | barrel | remove from barrel line | from ./components/GarmentCard |
| `client/src/features/wardrobe/index.ts` | `GarmentOverlay` | barrel | remove from barrel line | from ./components/GarmentOverlay |
| `client/src/features/wardrobe/index.ts` | `QualityBadge` | barrel | remove from barrel line | from ./components/QualityBadge |
| `client/src/features/wardrobe/index.ts` | `WardrobeShortcutsBar` | barrel | remove from barrel line | from ./components/WardrobeCanvasOverlays |
| `client/src/features/wardrobe/index.ts` | `useWardrobeInventory` | barrel | remove from barrel line | from ./hooks/useWardrobeInventory |

### Export-list entries removed (`export { … }`) — 19 rows

| file | symbol | kind | act | note |
|---|---|---|---|---|
| `client/src/components/ui/badge.tsx` | `badgeVariants` | export-list | remove from export list | self-used 3× |
| `client/src/components/ui/button.tsx` | `buttonVariants` | export-list | remove from export list | self-used 3× |
| `client/src/components/ui/card.tsx` | `CardAction` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/card.tsx` | `CardDescription` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/card.tsx` | `CardFooter` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/card.tsx` | `CardHeader` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/card.tsx` | `CardTitle` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/dialog.tsx` | `DialogClose` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/dialog.tsx` | `DialogOverlay` | export-list | remove from export list | self-used 4× |
| `client/src/components/ui/dialog.tsx` | `DialogPortal` | export-list | remove from export list | self-used 3× |
| `client/src/components/ui/dialog.tsx` | `DialogTrigger` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/select.tsx` | `SelectGroup` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/select.tsx` | `SelectLabel` | export-list | remove from export list | self-used 1× |
| `client/src/components/ui/select.tsx` | `SelectScrollDownButton` | export-list | remove from export list | self-used 2× |
| `client/src/components/ui/select.tsx` | `SelectScrollUpButton` | export-list | remove from export list | self-used 2× |
| `client/src/components/ui/select.tsx` | `SelectSeparator` | export-list | remove from export list | self-used 1× |
| `client/src/features/boards/canvas/CanvasPopover.tsx` | `Popover` | export-list | remove from export list | self-used 1× |
| `client/src/features/boards/canvas/CanvasPopover.tsx` | `PopoverTrigger` | export-list | remove from export list | self-used 1× |
| `client/src/features/casting/components/WarmPrimitives.tsx` | `ETHNICITIES` | export-list | remove from export list | self-used 2× |

### `export` dropped — the module still consults the symbol — 39 rows

| file | symbol | kind | act | note |
|---|---|---|---|---|
| `client/src/components/ErrorBoundary.tsx` | `GenerationErrorBoundary` | class | drop export → **deleted after the review** | the "self-use" was the class's own `console.error` string (the reviewer's note: a row surviving on a self-reference, as `isSensitiveAction` once survived on a dead import); the class, its two interfaces, `CONTEXT_MESSAGES` and the `Button` import it alone used are gone |
| `client/src/components/design-system/Button.tsx` | `ConveyorIcon` | function | drop export | self-used 1× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Button.tsx` | `ConveyorText` | function | drop export | self-used 4× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Button.tsx` | `ConveyorTextColor` | function | drop export | self-used 6× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Card.tsx` | `Card` | const | drop export | self-used 1× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Section.tsx` | `Section` | const | drop export | self-used 1× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Section.tsx` | `SectionLabel` | function | drop export | self-used 4× in its module; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/features/admin/ChangeRequestConstants.tsx` | `ACTION_CONFIG` | const | drop export | self-used 1× in its module |
| `client/src/features/admin/components/crew/CrewReplyBox.tsx` | `CREW_REPLY_MAX` | const | drop export | self-used 2× in its module |
| `client/src/features/admin/components/crew/useCrewState.ts` | `CREW_LIVE_INTERVAL_MS` | const | drop export | self-used 1× in its module |
| `client/src/features/boards/canvas/imageActions.ts` | `proxyUrl` | function | drop export | self-used 2× in its module |
| `client/src/features/boards/stores/useCanvasLayers.ts` | `useCanvasLayers` | const | drop export | self-used 3× in its module |
| `client/src/features/casting/components/ImageViewer/CanvasHelpers.tsx` | `SlotChip` | function | drop export | self-used 1× in its module; its re-export is a population row too: client/src/features/casting/components/ImageViewer/index.tsx(re-export) |
| `client/src/features/casting/components/TriBlendSelector.tsx` | `PRESETS` | const | drop export | self-used 3× in its module |
| `client/src/features/casting/components/TriBlendSelector.tsx` | `SNAP_THRESHOLD` | const | drop export | self-used 2× in its module |
| `client/src/features/casting/engineChoicePersistence.ts` | `ENGINE_CHOICE_LABELS` | const | drop export | self-used 1× in its module |
| `client/src/features/casting/evidence/inkAddUxPolicy.ts` | `INK_DESCRIPTION_MAX_LENGTH` | const | drop export | self-used 1× in its module |
| `client/src/features/casting/evidence/inkAddUxPolicy.ts` | `INK_DESCRIPTION_MIN_LENGTH` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/components/Reimagine.tsx` | `NOTHING_TO_OFFER_LINE` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/components/Reimagine.tsx` | `REIMAGINED_LINE` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/components/Reimagine.tsx` | `REIMAGINE_FOLLOW_HELD_TITLE` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/components/Reimagine.tsx` | `REIMAGINE_UNDO_LABEL` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/referenceReadCopy.ts` | `MAKEUP_SURFACE_WORDS` | const | drop export | self-used 1× in its module |
| `client/src/features/castingV2/retentionCopy.ts` | `EXPIRY_NOTICE_MS` | const | drop export | self-used 2× in its module |
| `client/src/features/lobby/FeedbackForm.tsx` | `FEEDBACK_COPY` | const | drop export | self-used 3× in its module |
| `client/src/features/wardrobe/layerUtils.ts` | `LAYER_ORDER` | const | drop export | self-used 1× in its module |
| `client/src/features/wardrobe/layerUtils.ts` | `getIntraCategoryWeight` | function | drop export | self-used 2× in its module |
| `client/src/lib/motion.ts` | `conveyorDuration` | const | drop export | self-used 1× in its module |
| `client/src/lib/motion.ts` | `conveyorEasing` | const | drop export | self-used 1× in its module |
| `client/src/lib/motion.ts` | `transitionFast` | const | drop export | self-used 3× in its module |
| `shared/auditActionCategories.ts` | `AUDIT_CATEGORIES` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/candidateFailure.ts` | `RETRYABLE_FAILURE_KINDS` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/castingRealization.ts` | `BEARD_GREYS` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/castingRealization.ts` | `BROW_STYLES` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/castingRealization.ts` | `SKIN_CHARACTERS` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/castingRealization.ts` | `SKIN_FINISHES` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/castingRealization.ts` | `WORN_STATES` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |
| `shared/crewShiftState.ts` | `normaliseCardRef` | function | drop export | timeline: dark-born (379 boundaries); self-used 2× in its module |
| `shared/modelRegistry.ts` | `TEXT_ECONOMY_FALLBACK` | const | drop export | timeline: dark-born (379 boundaries); self-used 1× in its module |

### Declarations deleted — nothing in the tree mentions them — 62 rows (64 executed; two reverted after the gate, see below)

| file | symbol | kind | act | note |
|---|---|---|---|---|
| `client/src/components/ErrorBoundary.tsx` | `InlineError` | function | delete declaration | nothing in the tree mentions it |
| `client/src/components/ErrorBoundary.tsx` | `useRetryHandler` | function | delete declaration | nothing in the tree mentions it |
| `client/src/components/ErrorBoundary.tsx` | `withRetry` | function | delete declaration | nothing in the tree mentions it |
| `client/src/components/design-system/Button.tsx` | `FooterLink` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Button.tsx` | `LinkButton` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Button.tsx` | `NavLink` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Button.tsx` | `SocialLink` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Card.tsx` | `ProjectCard` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Card.tsx` | `ServiceCard` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Card.tsx` | `StatCard` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Grid.tsx` | `AnimatedGridItem` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Grid.tsx` | `Grid` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Grid.tsx` | `GridItem` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Grid.tsx` | `TwoColumn` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Section.tsx` | `Container` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Typography.tsx` | `BodyText` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Typography.tsx` | `HeroHeading` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Typography.tsx` | `Label` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Typography.tsx` | `SectionHeading` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/components/design-system/Typography.tsx` | `Tag` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/components/design-system/index.ts(re-export) |
| `client/src/features/admin/ChangeRequestConstants.tsx` | `PriorityBadge` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/admin/ChangeRequestConstants.tsx` | `StatusBadge` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/admin/ChangeRequestConstants.tsx` | `TypeIcon` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/admin/adminConstants.ts` | `CATEGORY_COLORS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/admin/adminConstants.ts` | `SEVERITY_COLORS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/admin/adminConstants.ts` | `SEVERITY_ICONS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/billing/LowBalanceWarning.tsx` | `useLowBalanceCheck` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `NodeControlStrip` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/components/ImageViewer/CanvasHelpers.tsx` | `ToolButton` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/features/casting/components/ImageViewer/index.tsx(re-export) |
| `client/src/features/casting/constants.ts` | `BODY_TYPES` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/constants.ts` | `FACE_SHAPES` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `useAmendments` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `useCurrentMasterPrompt` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `useIdentityWarning` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `useIsLoadingSuggestions` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `useSuggestions` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/moderator/moderatorConstants.ts` | `CATEGORY_COLORS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/moderator/moderatorConstants.ts` | `SEVERITY_COLORS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/moderator/moderatorConstants.ts` | `SEVERITY_ICONS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/features/settings/parts.tsx` | `SettingsRow` | function | delete declaration | nothing in the tree mentions it |
| `client/src/features/wardrobe/components/WardrobeCanvasOverlays.tsx` | `WardrobeShortcutsBar` | function | delete declaration | nothing in the tree mentions it; its re-export is a population row too: client/src/features/wardrobe/index.ts(re-export) |
| `client/src/features/wardrobe/constants.ts` | `MAX_TOTAL_GARMENTS` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/imageUtils.ts` | `BANNER_COMPRESSION` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `conveyorTransition` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `easeSpring` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `fadeIn` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `hoverLift` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `hoverScale` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `hoverScaleSubtle` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `imageZoomConfig` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `slideInLeft` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `slideInRight` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `staggerContainerFast` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `staggerContainerSlow` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `staggerItemScale` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `transitionSlow` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `transitionSpring` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `transitionStandard` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `viewportOnceClose` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `viewportRepeat` | const | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `withDelay` | function | delete declaration | nothing in the tree mentions it |
| `client/src/lib/motion.ts` | `withDuration` | function | delete declaration | nothing in the tree mentions it |

### HELD — with the reason — 13 rows (11 before the gate, 13 after)

| file | symbol | kind | act | note |
|---|---|---|---|---|
| `client/src/features/billing/LowBalanceWarning.tsx` | `LowBalanceBanner` | function | HOLD — its only consumer is a knip unused FILE (the lobby lane keeps those) | client/src/features/billing/index.ts(re-export) |
| `client/src/features/casting/evidence/PrivateEvidenceImage.tsx` | `PrivateEvidenceImage` | function | HOLD — restored after the gate: the R7 evidence family is PARKED by his word (#6), and `server/r7-evidence-delivery-contract.test.ts` names this component as the contract's placeholder surface | executed, then reverted byte-for-byte to main |
| `client/src/features/operations/castDeletionSync.ts` | `publishCastDeleted` | function | HOLD — its only consumer is a knip unused FILE (the lobby lane keeps those) | client/src/features/lobby/DeleteCastDialog.tsx(import) |
| `client/src/features/profile/ProfileVisual.tsx` | `ProfileCover` | function | HOLD — restored after the gate: `server/profileVisualDefaults.test.ts` pins it by its own stated stance ("the day a surface wants a cover it is there"); a shift does not overrule a recorded keep | executed, then reverted byte-for-byte to main |
| `shared/_core/errors.ts` | `BadRequestError` | const | HOLD — ledger KEEP (§29e) | timeline: dark-born (379 boundaries) |
| `shared/_core/errors.ts` | `HttpError` | class | HOLD — base class of the ledger-KEPT error set (§29e) | timeline: dark-born (379 boundaries) |
| `shared/_core/errors.ts` | `NotFoundError` | const | HOLD — ledger KEEP (§29e) | timeline: dark-born (379 boundaries) |
| `shared/_core/errors.ts` | `UnauthorizedError` | const | HOLD — ledger KEEP (§29e) | timeline: dark-born (379 boundaries) |
| `shared/exportViews.ts` | `filenameWithActualImageExtension` | function | HOLD — its only consumer is a knip unused FILE (client/src/features/export/useExportPack.ts) | timeline: wired-at-head through that file |
| `shared/inkProvenance.ts` | `isInkProvenance` | function | HOLD — ledger KEEP (§29c) | timeline: dark-born (379 boundaries) |
| `shared/inkTemplateKinds.ts` | `isInkTemplateKind` | function | HOLD — ledger KEEP (§29c) | timeline: dark-born (379 boundaries) |
| `shared/modelRegistry.ts` | `FALLBACK` | const | HOLD — ledger KEEP (§29e) | timeline: dark-born (379 boundaries) |
| `shared/modelRegistry.ts` | `MODELS` | const | HOLD — same class as FALLBACK's ledger KEEP (§29e): a convenience aggregate over members production imports by name | timeline: dark-born (379 boundaries) |

### The in-file fixpoint — 14 declarations whose only mentions were rows of this table

A `drop export` row is one the module still mentioned — and the mentioning declaration
was itself on the table (`transitionFast` held by `hoverScale`; `conveyorDuration` by
`conveyorTransition`; the shadcn `CardHeader` by its export list alone). Measured on the
first execution and then made a pass of the executor: after the table's edits, any
table row mentioned only by its own declaration is deleted, repeated to a fixpoint.

| file | symbol |
|---|---|
| `client/src/components/design-system/Button.tsx` | `ConveyorTextColor` |
| `client/src/components/ui/card.tsx` | `CardHeader` |
| `client/src/components/ui/card.tsx` | `CardFooter` |
| `client/src/components/ui/card.tsx` | `CardTitle` |
| `client/src/components/ui/card.tsx` | `CardAction` |
| `client/src/components/ui/card.tsx` | `CardDescription` |
| `client/src/components/ui/dialog.tsx` | `DialogClose` |
| `client/src/components/ui/dialog.tsx` | `DialogTrigger` |
| `client/src/components/ui/select.tsx` | `SelectGroup` |
| `client/src/components/ui/select.tsx` | `SelectLabel` |
| `client/src/components/ui/select.tsx` | `SelectSeparator` |
| `client/src/lib/motion.ts` | `transitionFast` |
| `client/src/lib/motion.ts` | `conveyorDuration` |
| `client/src/lib/motion.ts` | `conveyorEasing` |

### Declarations this edit orphaned and a second pass deleted — 12 rows

Non-exported `Props` interfaces and helpers whose only reader was a deleted component,
told apart from ones already unused at `main` by counting mentions in BOTH trees
(the already-unused ones — in `casting/constants.ts`, `ChangeRequestConstants.tsx` and two stores — are left alone: *not a chance to tidy the original*).
The last row is the one export this slice EXPOSED: `ui/popover.tsx: PopoverTrigger`
surfaced on knip the moment `CanvasPopover.tsx` stopped re-exporting it.

| file | symbol | kind | note |
|---|---|---|---|
| `client/src/components/ErrorBoundary.tsx` | `InlineErrorProps` | interface | orphaned by InlineError's deletion |
| `client/src/components/design-system/Button.tsx` | `ConveyorTextColorProps` | interface | orphaned by ConveyorTextColor's deletion |
| `client/src/components/design-system/Button.tsx` | `NavLinkProps` | interface | orphaned by NavLink's deletion |
| `client/src/components/design-system/Button.tsx` | `LinkButtonProps` | interface | orphaned by LinkButton's deletion |
| `client/src/components/design-system/Button.tsx` | `SocialLinkProps` | interface | orphaned by SocialLink's deletion |
| `client/src/components/design-system/Button.tsx` | `FooterLinkProps` | interface | orphaned by FooterLink's deletion |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `NodeControlStripProps` | interface | orphaned by NodeControlStrip's deletion |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `SegmentView` | const | orphaned by NodeControlStrip's deletion |
| `client/src/features/wardrobe/components/WardrobeCanvasOverlays.tsx` | `ShortcutsBarProps` | interface | orphaned by WardrobeShortcutsBar's deletion |
| `client/src/features/wardrobe/components/WardrobeCanvasOverlays.tsx` | `SHORTCUT_HINTS` | const | orphaned by WardrobeShortcutsBar's deletion |
| `client/src/features/wardrobe/components/WardrobeCanvasOverlays.tsx` | `SHORTCUT_HINTS_WITH_COMPARE` | const | orphaned by WardrobeShortcutsBar's deletion |
| `client/src/components/ui/popover.tsx` | `PopoverTrigger` | export-list | no other mention — delete the declaration too; exposed by CanvasPopover.tsx losing its re-export in this same slice |

### Imports the deletion orphaned and the executor removed — 32

Only an import mentioned in the body BEFORE the edits and nowhere AFTER them; an import already unused at `main` is not touched.

| file | import | from |
|---|---|---|
| `client/src/components/ErrorBoundary.tsx` | `useCallback` | "react" |
| `client/src/components/ErrorBoundary.tsx` | `useState` | "react" |
| `client/src/components/design-system/Card.tsx` | `easeOut` | "@/lib/motion" |
| `client/src/components/design-system/Grid.tsx` | `motion` | "framer-motion" |
| `client/src/components/design-system/Grid.tsx` | `cn` | "@/lib/utils" |
| `client/src/components/design-system/Grid.tsx` | `staggerContainer` | "@/lib/motion" |
| `client/src/components/design-system/Grid.tsx` | `staggerItem` | "@/lib/motion" |
| `client/src/components/design-system/Grid.tsx` | `viewportOnce` | "@/lib/motion" |
| `client/src/components/design-system/Typography.tsx` | `motion` | "framer-motion" |
| `client/src/components/design-system/Typography.tsx` | `cn` | "@/lib/utils" |
| `client/src/components/design-system/Typography.tsx` | `fadeInUp` | "@/lib/motion" |
| `client/src/components/design-system/Typography.tsx` | `viewportOnce` | "@/lib/motion" |
| `client/src/components/design-system/Typography.tsx` | `easeInOut` | "@/lib/motion" |
| `client/src/features/admin/ChangeRequestConstants.tsx` | `Badge` | "@/components/ui/badge" |
| `client/src/features/admin/adminConstants.ts` | `Info` | "lucide-react" |
| `client/src/features/admin/adminConstants.ts` | `AlertTriangle` | "lucide-react" |
| `client/src/features/admin/adminConstants.ts` | `AlertCircle` | "lucide-react" |
| `client/src/features/admin/adminConstants.ts` | `AuditCategory` | "@shared/auditActionCategories" |
| `client/src/features/boards/canvas/CanvasPopover.tsx` | `Popover` | "@/components/ui/popover" |
| `client/src/features/boards/canvas/CanvasPopover.tsx` | `PopoverTrigger` | "@/components/ui/popover" |
| `client/src/features/casting/constants.ts` | `CORE_FACE_SHAPES` | "@shared/castingOptions" |
| `client/src/features/casting/evidence/PrivateEvidenceImage.tsx` | `cn` | "@/lib/utils" |
| `client/src/features/moderator/moderatorConstants.ts` | `Info` | "lucide-react" |
| `client/src/features/moderator/moderatorConstants.ts` | `AlertTriangle` | "lucide-react" |
| `client/src/features/moderator/moderatorConstants.ts` | `AlertCircle` | "lucide-react" |
| `client/src/features/moderator/moderatorConstants.ts` | `AuditCategory` | "@shared/auditActionCategories" |
| `client/src/features/wardrobe/components/WardrobeCanvasOverlays.tsx` | `Download` | 'lucide-react' |
| `client/src/lib/motion.ts` | `Transition` | "framer-motion" |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `cn` | "@/lib/utils" |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `ChevronDown` | "lucide-react" |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `MoreHorizontal` | "lucide-react" |
| `client/src/features/boards/canvas/NodeControlStrip.tsx` | `Pin` | "lucide-react" |

### Files deleted — every export was on the table and nothing imports them

| file | why |
|---|---|
| `client/src/components/design-system/Card.tsx` | all four exports on the table; no importer. Died with the hero-only homepage, `b8e8a2d9` (2026-04-03) — *"Old homepage sections removed"* |
| `client/src/components/design-system/Grid.tsx` | same |
| `client/src/components/design-system/Section.tsx` | same |
| `client/src/components/design-system/Typography.tsx` | same |
| `client/src/lib/motion.ts` | its eight surviving exports were consumed ONLY by the four files above (knip on the executed tree listed it as an unused file); the marketing kit's motion presets went with the kit |

`CLAUDE.md`'s design-system line named *Section, Card, Typography, Grid* as "the Home.tsx
look" and is corrected in the same commit; `design-system/index.ts` is the `Button`
re-export alone, with the history on it.

## Records moved, not deleted (the executor prints every docblock it takes)

- **`PrivateEvidenceImage`** — executed, then RESTORED byte-for-byte (see the gate's
  findings below); its docblock ruling stays where it was.
- **`CATEGORY_COLORS` / `SEVERITY_COLORS`** (admin + moderator constants) — `foundation/severity.ts`'s
  docblock said their deletion belonged to section 02 once the repaint landed; it landed,
  they had no reader, and that docblock now says so.
- **`admin/overview/index.ts`** — two comments about re-exports that are gone (`attentionItems`,
  `useChartTokens`) rewritten; the second had made the barrel read as a *chart file* to
  `section07-guard.test.ts` (`f.text.includes("recharts")`), which is how the one red
  in 1,567 client tests was found and why the comment, not the guard, changed.
- Six section headings left with nothing under them (`// ==== Inline Error Display ====`
  etc.) removed by hand; three files left starting with a blank line trimmed.

## Measured after (`pnpm janitor:knip` on the executed tree, `output/_108-s4-knip-after.txt`)

| population | before | after |
|---|---|---|
| unused exports, client | 49 files / 165 symbols | **4 files / 4 symbols** (all HELD — two unused-file consumers, `ProfileCover`, `PrivateEvidenceImage`) |
| unused exports, shared | 9 / 18 | **5 / 9** (8 ledger KEEP or its class, 1 HELD — unused-file consumer) |
| unused exports, server | 14 / 16 | 14 / 16 (the floor, untouched) |
| unused exports, scripts | 29 / 53 | 30 / 57 — out by the decision; the +4 is untracked disposables absent from the worktree, not this slice |
| unused files | 18 (19 on the nightly) | 19 — `motion.ts` became one and was deleted; `scripts/lib/sabotage.mts` is the nightly's 19th, a stated knip ceiling |
| duplicates | 1 (the floor) | 1 |

`pnpm check` green (the deletion door OPEN, unchanged: 210 rows / 146 listed); the FULL `pnpm test` 13,280 passed (only the Atlas-freshness arms red before the commit hook); 1,567
client tests green; `pnpm build` green.

## The gate's four findings, and what each one was

`npx vitest run client/src` was green and the preflight ran the nearest server
suites — and **four server-side text guards read client source**
(`rename-sweep-is-repo-wide`: a guard naming a symbol need not live beside it).
The full `pnpm test` is the preflight for a client deletion, and it was run
before the second push: 13,280 passed, 3 failed — all three the Atlas-freshness
arms the commit hook regenerates.

| guard | what it read | decision |
|---|---|---|
| `server/auditLogCategoryAgreement.test.ts` — *neither console re-implements the chip* | its comment-stripper's positive control was `toContain("CATEGORY_COLORS")`, a bystander constant this slice deleted | **guard repaired**: the control token is `getActionCategory`, the derivation the arm is about; the arm's real assertion (`from "@shared/auditActionCategories"`, no `startsWith(`) was never in doubt |
| `server/profileVisualDefaults.test.ts` — *puts resilient defaults on every main account surface* | `export function ProfileCover` in `ProfileVisual.tsx`, with its own stated stance: *"the day a surface wants a cover it is there"* | **row HELD, file restored byte-for-byte**: a recorded keep is not a shift's to overrule; whether a component kept for a hypothetical surface is litter is the Retro's question, not this slice's |
| `server/r7-evidence-delivery-contract.test.ts` — *keeps retryable failures behind the shared placeholder component* | `Try image again` in `PrivateEvidenceImage.tsx` | **row HELD, file restored byte-for-byte**: the R7 evidence family is PARKED by his word (#6), and the contract names this component |
| `server/wardrobe-vto.test.ts` — *WardrobeCanvasOverlays are exported from the wardrobe barrel* | `WardrobeShortcutsBar` on the barrel | **pin dropped, deletion stands**: its render left with `d4d4ce53` (2026-04-03, *"keyboard shortcuts moved from bottom bar to triple-dot menu"*) — a pin on a dead export is a suite that fails only when its subject is finally deleted |
