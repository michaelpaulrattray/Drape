# Janitor instrument: knip (dead files, exports, dependencies)

`pnpm janitor:knip` — the Janitor's cheap first-pass reader for dead code
(issue #34). It runs [knip](https://knip.dev) over the whole tree with the
config in `knip.json` and prints a compact list. **It has NO deletion
authority.** The Atlas's retirement views (`docs/architecture/`) and the
un-wiring differ (`scripts/diff-importer-count-across-time.mts`) keep that;
a knip row is a pointer to open the file, never a verdict to remove it.

**The nightly** (`.github/workflows/knip.yml`, Warden patrol #1, 2026-08-26):
the same command runs on main every night at 15:00 UTC (01:00 AEST) and by
hand with `gh workflow run knip.yml`. It is a reading, not a gate — the job
reddens only when knip could not run (any exit but its own 0/1), and
otherwise writes the per-category counts to the run summary and the compact
list as a 30-day artifact (`knip-reading-<run id>`). The Janitor patrol reads
the newest summary against the table below and appends a row; nothing in the
nightly deletes, and nothing in it decides.

## What knip reads (and the Atlas could not, until 2026-08-23)

Entries: `server/_core/index.ts`, `client/src/main.tsx`, every hand-run
`scripts/**/*.{ts,mts}` (except the two `lib/` directories, which are
libraries and whose exports ARE judged), `seed.ts`, `vitest.setup.ts`, and —
through knip's vitest plugin — every `*.test.ts`. Dynamic `await import()`
and barrel re-exports are followed.

Controls taken 2026-08-26 on the committed config (working law 2):

- **Negative** — five modules reached only by dynamic import or a barrel
  (`server/routes/emailAuth.ts`, `googleAuth.ts`, `server/db/ipBlocking.ts`,
  `server/db/index.ts`, `server/security/loginAttackAlert.ts`) are absent
  from the unused-files list. These are the exact modules the Atlas once
  read as having zero callers (CLAUDE.md, "Architecture Atlas").
- **Positive** — a planted `server/_knipPlantDead.ts` and a planted
  `KNIP_PLANT_EXPORT` in `server/castingV2/thumbnails.ts` were both
  reported; removed, the counts returned to the pre-plant reading exactly.

## Ceilings (stated, not silent)

- An export used ONLY by a test file counts as used — tests are entries.
  The uncalled-export sweep, not knip, sees that class.
- `scripts/**/*-disposable.*` are ignored entirely: they are litter by
  definition (issue #8) and would drown the reading.
- The `drizzle` plugin is off (`"drizzle": false`) because it loads
  `drizzle.config.ts`, which throws without `DATABASE_URL`; the config's own
  imports are not judged.
- `railway.cmd`, `netstat`, `taskkill.exe` are OS/CLI binaries the scripts
  shell out to, allowlisted in `ignoreBinaries`.
- `client/src/components/ui/*` are shadcn primitives added as a set; 40 of
  them were unused and held 21 unused `@radix-ui/*` dependencies — **deleted
  2026-09-16 under #105** (`docs/specs/SHADCN_PRIMITIVES_PURGE_MANIFEST_2026-09-16.md`;
  the population was 41 by then; `dropdown-menu.tsx` was held for #106 and
  went with it the same day, `docs/specs/NON_SHADCN_ORPHANS_PURGE_MANIFEST_2026-09-16.md`).
  The directory now holds only primitives with importers. A vendored library
  is still code, and a re-vendored primitive is reported on purpose.
- **An unused file can be a DEAD FEATURE rather than litter, and only the
  history read tells them apart** (#106, 2026-09-16): `useReferralClaim.ts`
  read as unused on all three readers and `git log -S` on its import string
  named the commit that orphaned it — a page deletion that took the client
  half of the referral link with it, while Settings kept handing the link out
  (#1010). A row whose last importer was deleted ON PURPOSE is litter; a row
  whose last importer was deleted for some OTHER reason is the un-wiring
  differ's finding, and it is held, not purged.
- **A `scripts/lib/` module whose only importer is a `*-disposable.*` reads
  as unused** (`scripts/lib/sabotage.mts`, imported only by
  `prove-sabotage-survives-death-disposable.mts`) — a consequence of the
  disposable ignore above, found Janitor run 1. Such a row is a KEEP; grep
  `scripts/` including disposables before believing a `lib/` file is dead.
- **The duplicate-exports floor is 1, and it is on purpose** (#108 slice 1,
  2026-09-16; floor 2 → 1 with #1014, 2026-09-17): `server/castingV2/faceDescribe.ts:
  describeWithTeeth, describeFace` is a PINNED bench result — the shipped
  pointer beside the arm it points at, with `faceDescribe.test.ts:132` asserting
  the identity so a re-pointing without a new run goes red. The other one —
  `server/db/credits.ts: deductCredits, deductPoints`, a rename alias with six
  live money-path callers and thirty guard regexes spelling only the old name
  (triage §35c) — is RETIRED under #1014: the guards were widened to the real
  name first, each driven with a sabotage through the other spelling, then the
  six callers renamed and the alias deleted. A duplicates reading of 1 is the
  floor; a reading above 1 names a new alias.
- **An inline `import("./x").T` in a type position is a consumer knip does
  NOT see** (#108 slice 3, 2026-09-17): `SchemaPathByField` was listed as an
  unused type while `identityFieldHandlers.ts` read it as
  `import("./identityTypes").SchemaPathByField[F]`; tsc would have refused the
  drop. Before believing a type row, grep the tree for `import("` beside the
  name. That one site is a named import now (the file already imported from
  the module statically), so the row left the list honestly; a future one is
  the same read.

- **A self-use count is a claim about the tree BEFORE a batch deletion, not
  after** (#108 slice 4, 2026-09-17): 14 `drop export` rows were "self-used"
  only by another row of the same table, and the first execution left them
  as dead locals behind green `tsc`. The slice-4 executor runs an in-file
  fixpoint (a table row mentioned only by its own declaration is deleted,
  repeated until nothing moves) and a mentions-in-both-trees pass for the
  non-exported `Props` interfaces a deleted component orphans. And **one
  export can surface the moment another leaves**: `ui/popover.tsx:
  PopoverTrigger` was on nobody's list until `CanvasPopover.tsx` stopped
  re-exporting it — re-run knip on the executed tree before calling a
  population clear.

## Readings (the Janitor appends one line per run; findings become cards)

| date | files | deps | devDeps | exports | types | duplicates | note |
|---|---|---|---|---|---|---|---|
| 2026-08-26 | 51 | 34 | 7 | 174 | 115 | 18 | first reading at `1ccc7e21`; `server/db/billing.ts: addTopupCredits` — the path-three death CLAUDE.md records — is in the export list, so the instrument and the differ agree on a known specimen. `add` and `pnpm` in devDependencies since the initial bootstrap (`3dad2280`) look like a mistyped `pnpm add`. |
| 2026-08-26 | 51 | 34 | 7 | 173 | 115 | 18 | Janitor run 1 at `c6273d0a` (07:40): identical to the first reading bar one export (174 → 173). Filed as cards #105 (shadcn set + deps), #106 (11 files, three readers agree), #107 (devDeps + `semgrep` binary), #108 (exports/types/duplicates via the differ). Ceiling: `scripts/lib/sabotage.mts` is a false positive (importer is a disposable). Full list `output/janitor-knip-20260826.txt`. |
| 2026-08-29 | 50 | 1 | — | 178 | 117 | 19 | Janitor run 2 at `66c405a8`, **compact reporter, so these are FILE counts** (see the warning below). The nightly the day before (`33128922917`, CI) read 51 / 1 / 180 / 117 / 18 on the same instrument. Two real deltas: `conceptUpload.ts` gained a duplicate export (`CONCEPT_REVIEW_READING` aliases `CONCEPT_READING_LABEL`, landed `e45e5611` for #196/#197) — duplicate 19, and #108's first slice; and `scripts/lib/sabotage.mts` reads unused in CI but not locally, because the local tree holds an untracked importer a clean checkout does not. Full lists `output/janitor-knip-20260829-compact.txt` (compact) and `output/janitor-knip-20260829.txt` (default). |
| 2026-09-04 | 69 | 1 | — | 186 | 122 | 19 | ⚠ **Janitor run 3's reading, appended by run 4 — run 3 recorded it in `JANITOR_LOG.md` §F and never added the row here**, which is the drift this table exists to prevent, so it is filled in rather than skipped. Nightly `33903445959`, compact. Its own note: **unused files 51 → 69 in seven days (+18)** was the delta worth watching; the other three moved by single digits. No deletion proposed from it — knip, the Atlas and the un-wiring differ are three readers and none has deletion authority alone. |
| 2026-09-07 | 69 | 1 | — | 191 | 129 | 19 | Janitor run 4, nightly `34153675089` at `18547497`, compact. ✅ **The +18 climb STOPPED: files flat at 69 across three days**, and duplicates flat at 19 — so run 3's one watch-item is answered, and answered the right way. Exports 186 → 191 and types 122 → 129 are the ordinary drift of a week's merges. Nothing proposed; recorded on #108. |
| 2026-09-11 | 69 | 1 | — | 194 | 132 | 19 | Janitor run 5, nightly `34631395445` at `ac7c2cd7`, compact. **Files flat at 69 for a week** (four nightlies: 09-08, 09-09, 09-10, 09-11 all `success`); duplicates flat at 19. Exports 191 → 194, types 129 → 132 — single-digit drift again. Nothing proposed. |
| 2026-09-15 | 69 | 1 | — | 200 | 134 | 19 | Read by #105's session (not a patrol), nightly `35008863398` at `4f3c49da`, compact. **The reading that #105 was executed against**: 41 of the 69 files were `components/ui/*`. ✅ **40 of those and 33 of the 34 packages in the one `package.json` line are DELETED in PR #1008 (`ed7b0032`)** — manifest `docs/specs/SHADCN_PRIMITIVES_PURGE_MANIFEST_2026-09-16.md`. Expected next nightly: files 69 → **29**, and the deps line reduced to `@radix-ui/react-dropdown-menu` alone (held for #106). A next reading that does NOT show that drop is the finding. |
| 2026-09-16 | (29 expected) | (1) | — | — | — | — | Read by #106's session (not a patrol), against the same `35008863398` reading — no nightly has run since #1008 merged, so the 29 is #105's expectation, not a measurement. **9 more files and the last unused package DELETED in #106's PR** — manifest `docs/specs/NON_SHADCN_ORPHANS_PURGE_MANIFEST_2026-09-16.md`. Expected next nightly: files **20** (the two that remain unused are `useReferralClaim.ts`, held for bug #1010, and `features/casting/index.ts`, #29's), deps **0**. ⚠ **One of #106's eleven rows was a dead FEATURE, not litter** — `useReferralClaim.ts`, orphaned by a page deletion in April while Settings kept issuing the `?ref=` link it served; held and carded (#1010). A next reading that shows more than those two unused files is the finding. |
| 2026-09-16 | (20 expected) | (0) | — | — | — | (2 expected) | Read by #108 slice 1 (not a patrol), still against `35008863398` — no nightly since #1008/#1011 merged. **17 of the 19 duplicate exports go** in #108's slice-1 PR (triage §35, card comment on #108): the 12 client `Name, default` pairs (no file has EVER imported the default — `git log -G` over the whole history), four `credits.ts` `*Points` rename aliases (three of them `UNREVIEWED` ledger rows, now TAKEN, ceiling 20 → 17), and `CONCEPT_REVIEW_READING`. Two HELD and stated as the floor above. Expected next nightly: duplicates 19 → **2**; files/exports/types unmoved by this slice. A reading above 2 is the finding. |
| 2026-09-17 | 19 | 0 | — | 193 | 134 | 2 | **A MEASUREMENT, not an expectation** — nightly `35119015532` at `b411314d`, triggered by hand after #108 slice 1 merged (the cron had not run since `35008863398`), compact. ✅ **Every expectation above landed**: files 69 → 19 (the 16 lobby/export/billing rows and `features/casting/index.ts` were already on the 09-15 list — no new orphan; `useReferralClaim.ts` left it when #1015 wired the hook), deps 1 → 0, **duplicates 19 → 2, the stated floor**. Read by #108 slice 2 (not a patrol): the export population is **458 symbols in 193 files**, dispositioned by class in `docs/specs/UNUSED_EXPORTS_PURGE_MANIFEST_2026-09-17.md` — 153 server dark-born rows are the deletion list, NOT executed yet. ⚠ The differ was found blind to `const { x } = await import()` on the way (36 wired symbols at zero; PR #1017) and every row was read on the repaired reader. |
| 2026-09-17 | 19 | 0 | — | **102** | 134 | 2 | **A MEASUREMENT on the executing tree** — `pnpm janitor:knip` run locally at #108 slice 2b's branch (not a nightly; the nightly measures it after the merge). **Unused exports 193 → 102 files, 458 → 256 symbols.** The 16 server rows left are the 15 ledger KEEP rows and `COILED_NONBINARY_STYLES`, which knip reports as an unused export and is a plain `const` at HEAD (triage §37c) — so the server population is at its floor and every remaining symbol is client (163), shared (18) or scripts (57), outside the differ's reported scope. Executed: 149 `export` keywords dropped, 19 barrel lines, 5 declarations + 4 db functions the barrel table had wrong (§37b), 28 of 29 hand rows. Files, types and duplicates untouched by this slice, as expected. A next nightly above 102 / 256 is the finding. |
| 2026-09-17 | 19 | 0 | — | 102 | **0** | 2 | **Nightly `35135458071` at `c8ee90c6` FIRST, then a measurement on the executing tree.** The nightly landed slice 2b's expectation exactly (exports 102 files, types 134, duplicates 2, files 19) and is the reading #108 slice 3 executed against: **271 unused type symbols in 134 files → 0 — the *Unused exported types* section is ABSENT from `pnpm janitor:knip` on the branch.** 221 `export` keywords dropped, 15 declarations deleted, 40 barrel lines and 9 export-list entries removed, 1 inline `import()` type rewritten as a named import (the ceiling above). Manifest `docs/specs/UNUSED_TYPES_PURGE_MANIFEST_2026-09-17.md`; triage §38 argues why no control-instrument reads a type. Exports, files and duplicates untouched by this slice. A next nightly that prints a types section at all is the finding. |
| 2026-09-17 | 19 | 0 | — | **54** | 0 | 1 | **A MEASUREMENT on the executing tree** (#108 slice 4, not a patrol) — HEAD `d1707381` read locally 101 files / 252 symbols (client 165, shared 18, scripts 53, server 16); after: **54 symbols** = scripts 57 (out, by #1022; the +4 is untracked disposables absent from the worktree) + server 16 (floor) + shared 9 (8 ledger KEEP or its class, 1 held) + client 4 (held: two whose consumers are knip unused FILES, `ProfileCover` and `PrivateEvidenceImage` restored after the gate — a recorded keep and the parked R7 contract). Files 19: `lib/motion.ts` became one and was deleted with the design-system kit it served; `sabotage.mts` is the stated ceiling above. Duplicates 1, the floor. |
| 2026-09-18 | 19 | 0 | — | 53 | — | 1 | **Janitor run 7, the nightly `35256683364` at `98664570`, compact (triggered by hand at 18:05Z; the 15:00Z cron has fired 2.0–4.7 h late on each of the last fourteen days, so it had not yet run). ✅ **Slice 4's expectations landed on the nightly**: files 19, deps 0, duplicates 1 (the floor), the *Unused exported types* section ABSENT, and 53 FILES holding unused exports — 30 `scripts/` (out by #1022), 15 `server/` (the ledger floor), 4 `client/` (the held four: `LowBalanceBanner`, `PrivateEvidenceImage`, `publishCastDeleted`, `ProfileCover`), 4 `shared/` (kept/held). Nothing proposed; the population is at the floor #108's slices stated, and what is left of #108 waits on decisions that are not a shift's. |
| 2026-09-20 | 19 | 0 | — | **56** | — | **2** | **Janitor run 8, the nightly `35527260025` at `cc0ffef5` (fired on schedule, 17:52Z). Three rows above run 7's floor and one duplicate up, all from the 19 Sep merges, each read at the code (#1049): `features/staff/index.ts: useAccountMenuCounts` — a barrel line whose only consumer went DIRECT in #1043 to break the AppChrome ↔ staff chunk ring (stale line); `bundleBudget.mts: kb` (#1041) and `orderedBand.mts: ORDER_LABEL_PREFIX` (#1038) — read only inside their own modules (surplus `export`); `lib/staffPage.ts: lazyRoute, staffPage` — **a duplicate BY DESIGN**, `staffPagesLazy.test.ts:102,258` reads the NAME, so it stays and is not re-asked. Also read: *Unlisted binaries (1)* `founderActivity.test.ts: drape-probe.cmd` has stood in every nightly since #723 — a fixture the test writes itself, a knip false positive with a one-line home in `ignoreBinaries`. PR #1050 takes the three and the ignore; knip on its branch reads **exports 53, duplicates 2, binaries absent** — the expected next nightly. |
| 2026-09-22 | 19 | 0 | — | **55** | **1** | 2 | **Janitor run 9, the nightly `35767237320` at `8b0d3f44` (fired on schedule, 18:27Z).** Run 8's predicted floor landed exactly on the 21 Sep nightly (`35647295633`: exports 53) and the 22 Sep merges then put it **two files above**, with a *types* section reappearing after run 7 saw it absent. Read at the code (#1141), each reached only from inside its own declaring module: `castingV2Scope.ts: CASTING_ROLL_ENGINE_MODELS, parseCastingRollEngineModel` (the roll-engine model flag, #1079 — read by the error message at `:2837`, the parser at `:2847` and the two call sites at `:2853`/`:2891`); `houseBlock.ts: CREATURE_EXPRESSION_FANG_SENTENCE` (#1069 — read by `CREATURE_EXPRESSION_LINE` one line below); `falImages.ts: FAL_EDIT_SIBLINGS` (#1079 — read by `editSiblingOf` immediately below); and the types section's single row `crewShiftState.ts: CardPullRequestWhere` (read by the exported `CardPullRequestMatch` and one local). One row LEFT the list in the same window — `rollEngine.ts: resetCastingEngineForTests` — which is why the net is +2 and not +3. Run 8's `lib/staffPage.ts` KEEP was the shape checked for and none of the five has it: no test, generator, Atlas or capability-atlas entry names any of them. PR #1142 drops the five keywords. |
| 2026-09-24 | 19 | 0 | — | **53** | **2** | 2 | **A MEASUREMENT on two clean trees, not a nightly** (Janitor run 9, PR #1142's branch `895b164f` against its parent `0c329d60`). ⚠ **The baseline was taken twice because the first one was wrong in the direction this ledger's own header warns about.** A `pnpm janitor:knip` in the MAIN working tree read **files 18, exports 55** while the same commit in a clean worktree read **files 19, exports 55** with three extra findings — `scripts/lib/sabotage.mts` as an unused file, `capabilityAtlas.mts: raiseSites`, and `importerCountDiff.mts: walk, isTestFile, selfUsesOfName`. The cause is the header's own, now grown: the main tree carries **585 untracked disposables**, they import things, and knip walks them. **So the gap between a main-tree reading and the nightly is currently THREE findings wide.** The honest before/after, both clean and both at one commit: `0c329d60` files 19 · exports **55** · types **3** · duplicates 2 → `895b164f` files 19 · exports **53** · types **2** · duplicates 2, and the diff between the two runs is exactly the five rows above and nothing else. **Expected next nightly: files 19, exports 53, types 2, duplicates 2, binaries absent.** Above that is run 10's finding. |

| 2026-09-26 | 19 | 0 | — | **71** | **13** | 2 | **A MEASUREMENT on a clean worktree, not a nightly** (#108 slice 5, a builder seat, at `fa8ac509`) — directly comparable to run 9's row above, which was the same kind of reading. The newest nightly is `36177483290` at `655a496a` (2026-09-25 19:05Z), one day behind this tree, and its own counts were not read; **the 53 → 71 files and 2 → 13 types are therefore a local-to-local delta over the 24–26 Sep merges, and they are the next Janitor patrol's finding rather than this slice's** (clock fires 2026-09-27). Nothing is proposed from it. What slice 5 did touch: **one row**, `LowBalanceWarning.tsx: LowBalanceBanner`, deleted with its dead barrel line on his word *"108)clear them"* — expected next reading **70 files / 115 symbols**. The other four of #108's held five are the FLOOR recorded immediately below. |

## The client/shared unused-exports FLOOR is 4, and it is on purpose

⚠ **A READING THAT SHOWS THESE FOUR IS CORRECT, NOT UNFINISHED — DO NOT RE-ASK
THEM** (#108 slice 5, 2026-09-26, on his word *"108)clear them"*; the full read is
`docs/specs/UNUSED_EXPORTS_PURGE_MANIFEST_2026-09-26_SLICE5.md`). Each is held by a
ruling of his or by a live control, so no shift can act on it and a shift that
re-reads the list learns nothing the fifth time:

| row | what holds it |
|---|---|
| `client/src/features/operations/castDeletionSync.ts: publishCastDeleted` | its consumer CALLS it at `features/lobby/DeleteCastDialog.tsx:64` — a Segment 00 lobby orphan, and his word is *"NOTHING IS DELETED. Segment 00's orphaned components STAY."* |
| `shared/exportViews.ts: filenameWithActualImageExtension` | three call sites in `features/export/useExportPack.ts` plus a self-use at `exportViews.ts:84`, and that consumer file is read by a live guard at five places (`server/modelLifecycleGuard.test.ts`) |
| `client/src/features/profile/ProfileVisual.tsx: ProfileCover` | a recorded keep with its reasoning written out — `server/profileVisualDefaults.test.ts:85` asserts the literal `"export function ProfileCover"` |
| `client/src/features/casting/evidence/PrivateEvidenceImage.tsx: PrivateEvidenceImage` | the R7 evidence family is PARKED by his word (#6) and `server/r7-evidence-delivery-contract.test.ts:48` names this component as the contract's placeholder surface |

**A fifth client or shared row is a finding**, exactly as a duplicates reading
above 1 is: it names something new rather than one of these four.

⚠ **THE COLUMNS ABOVE ARE NOT ALL THE SAME KIND OF NUMBER, AND ONE ROW MIXED
TWO REPORTERS.** Measured Janitor run 2: `pnpm janitor:knip` passes
`--reporter compact`, which prints **one line per FILE**, so its `(178)` is
*178 files holding unused exports*. knip's DEFAULT reporter prints one line per
**symbol**, and on the same tree, the same minute, it reads **443 unused exports
and 250 unused types** — with `files` (50) and `duplicates` (19) identical
either way and `dependencies` reading **34** rather than `1`, because the
compact form groups them all under `package.json`.

Run 1's row took `files`, `deps`, `devDeps` and `duplicates` from the default
reporter and `exports` and `types` from the compact one. So *"173 unused
exports, 115 unused types"* — the headline of card **#108** — are FILE counts,
and the export population is 2.6× what the card says. **Nothing grew; the
instrument was read two ways.** From the 2026-08-29 row on, every row states its
reporter, and a row that does not is a compact row by default.

The nightly runs `pnpm janitor:knip`, so **the whole historical series is
compact** and is comparable to itself. A default-reporter reading is a different
series and is labelled as one.

⚠ **AND A LOCAL READING IS NOT THE NIGHTLY.** The workflow's header says the
nightly and a hand reading "cannot disagree" because it is the same command.
They disagreed by one row on 2026-08-29: untracked scratch in the working tree
changes the import graph knip walks, and a clean checkout has none of it. **The
nightly is the authority**; a local run is for a delta you are about to cause.
