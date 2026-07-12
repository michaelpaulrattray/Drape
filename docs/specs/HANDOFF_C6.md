# R6 handoff — C6 mid-stride (2026-07-13, session wrap at founder's request)

**A fresh session takes over from here.** Read `PASS_1_BUILD_PLAN.md`, `DECISION_LOG.md` Group 6j (+ D-55), and the task list. Gates per commit: `pnpm check` + `pnpm build` + `pnpm test` + `npx tsx scripts/verify-canvas.mts` (dev server running; drive's FIRST run after edits often fails early legs on Vite cold compile — rerun before diagnosing).

## Shipped this session (all pushed through `9b1a612`; final commit below adds the rest)

C1–C5 complete (see build plan + log). VC-R6a fixes, VC-R6b bug batch (5), drive-2 fixes (4 + rename correction), A4 + trap assessments, Group 6j log, floor slice (R-7/R-9), C6 slice 2 (node-chrome consolidation + slim popped views + paste-selects-copies + ElevenLabs dot rhythm).

## In the FINAL commit of this session (compiles, builds, unit-green; drive status below)

- **D-55 (trap ruling (a)) — views decouple from minting**: `executeMintPackage` `mint:false` path (stays draft, gates verified headshot-keyed), route input (name optional when staying draft), `CastModelModal` stays-draft ghost action ("Or add these views and keep exploring…"), `useCastGate` stayDraft threading (no isMinted flip, stays in session). Logged as D-55 in Group 6j.
- **Drive invariant Y** (paid, `RUN_PAID_INVARIANTS=Y`, ~1600cr): the walkable loop — fork → views as draft (Y2 asserts status stays draft) → identity iterate → siblings stale (Y3) → bulk-refresh offer (Y4) → mint → same edit refused (Y5). **Never yet executed** (paid) — founder runs when he chooses.
- **Label grammar** (founder, drive 2): `jerrryt` / `jerrryt · Full front` / `jerrryt · Draft` — "Cast ·" prefix only on unnamed empty nodes; "· Library" dead; `restore` suppressed from the engine slot (plumbing, not an engine).

## Drive status at wrap

Last full run: **3 failures — C1/C2 (library pick fill) + K3 (duplicate persisted)** on the first run after edits; C1's detection is image-based (not label drift) and the signature matches the session's recurring cold-compile flake (see the C1/C4/C5 commit messages — every prior instance went green on rerun). **Next session: rerun the drive FIRST.** If C1/C2/K3 persist, suspect the picker-grid click (`.canvas-scope .grid button img`) or the CastModelModal edits; nothing in the final commit touches the pick path server-side.

## C6 scoreboard

| Item | Status |
|---|---|
| R-7/R-9 unified floor + dot step | **DONE** (d76a227) |
| ElevenLabs dot rhythm (24px / fine) | **DONE** (9b1a612) |
| Node-chrome consolidation (one below-node pill, Edit=pen, strip dead) | **DONE** (9b1a612) — DS §5.8/§5.10 amendment to record in C8 docs |
| Popped-view toolbar slimming (ruled) | **DONE** (9b1a612) |
| Paste/set-duplicate selects the copies | **DONE** (9b1a612) |
| D-55 stays-draft views + Y + label grammar | **DONE in final commit** (this handoff's commit) |
| **Tidy up** (D-50.3 banked spec: row-major over `node.measured`, y-then-x, 60px gutters, ONE `moveNodes` batch + ONE undo entry; slots in group toolbar + `GroupContextMenu`) | **UNTOUCHED — next concrete step**: add a `tidy` action to `handleGroupAction` computing the pack from React Flow `node.measured` dims, then a group-toolbar slot + context-menu row |
| **D-54 dblclick routing** (tile → takeover focused on the view; thread `initialAngle` through `CastEditContext`→`CastingTakeover`→`CastingWorkspace` hydration setting `activeView`; root dblclick → environment; popped views/image nodes keep the D-52 viewer) | **UNTOUCHED** |
| **D-45(2)** BoardHeader avatar → balance popover + top-up (reuse StudioSlimHeader's popover pattern) + BoardHeader token pass | **UNTOUCHED** |
| **Notes** "actually good" pass (R-6 monochrome ruled — remove the `'paper'` variant constant from NoteNode; interaction/sizing polish) | **UNTOUCHED** |
| **A4 belt-slimming rider (APPROVED)**: export verb → `···` ActionMenu `extraItems` row, delete `NextStepChip` + `useCastingViewGeneration` + `StudioCanvas.nextStepOverlay`, retire menu Retry, mask stroke colors → house language | **UNTOUCHED** |

## After C6

- **C7**: first-run intro (`canvasIntroSeen` profile column — **prod migration via MYSQL_PUBLIC_URL before deploy sync**), D-9 ghost composition per DS §11.1 (comp-card caption language), §11.2 copy reconcile, AddNodeMenu→picker check, D-27 board thumbnails (debounced `boards.update` from cast landings), `listCastableModels` N+1 join.
- **C8**: docs batch (reconcile Group 6j + D-55 into DS/build plan; DS §5.8/§5.10 consolidation amendment; deploy-version-skew R7 note), toast audit, admin named debts, C8-flex Recent Work provenance rule (only if trivial). Then **VC-R6 final** (fresh-account walkthrough).
- **Open on the founder**: R-7/R-9/dot-rhythm three-surface screenshot set (async, capture with tmp puppeteer script per `.claude/skills/verify`); running paid Y; the LOBBY & HOME POLISH batch brief.
