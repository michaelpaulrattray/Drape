# R6 recovery and closure — FINAL execution plan (founder-ruled 2026-07-15)

## Context

R6's ratification object is the D-55 walkable loop. The audit mapped 15 divergences; the first addendum (bench, 2026-07-14) added V16–V22 and the canon proposal; the revised addendum (2026-07-15) corrected it (C1–C11), found blockers B0.1–B0.5 (all code-verified this session), and gated canon behind a design milestone. The stabilization wrap (11 uncommitted files + state note) is verified accurate; `pnpm check` and the casting suite re-ran green. This plan incorporates the founder's revision directives and final rulings (2026-07-15). **Milestone stays R6.**

**On approval, this plan is copied verbatim into the repository as `docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md` (written at Step 0, included in Commit 2).** The operative plan lives in the repo, not only under `~/.claude/plans`.

## Founder rulings (recorded, binding)

- **Q0 — APPROVED:** two baseline commits, with the repository execution-plan document added to Commit 2.
- **FR-1 — RULED:** produce the policy report for review. Until it is ratified, **refuse all unsupported identity-changing edits; assume no supported subset.**
- **FR-2 — RULED: Option A.** Draft export refuses and routes to the mint door. **Export must never mint implicitly.**
- **FR-3 — RULED: Option B.** Minted models may be renamed as **display metadata**; renaming never alters visual identity; `agencyId` remains the stable identity key. D-55 wording is updated so naming is **required by the mint ceremony** but the display label is **not permanently frozen** (docs touch rides Batch 0's commit).
- **FR-4 — CONFIRMED:** `locked` = legacy minted alias; `archived` = deleted everywhere; existing placements degrade to the D-12 "Source unavailable" state.
- **FR-5 —** parked at D-design ratification (revised addendum §6 items 1–7 + first-addendum riders).

**Settled, not reopened:** no Photoshop-style reveal layer / aligned pixel composite / saved layer stack — restore/version checkout is the exact rollback; erasing, when enabled, is a generative masked edit through the unified classifier/canon-writer boundary, otherwise unavailable. Also settled: D-43 mint immutability, D-55 decoupling, F4 no-dice-throw propagation, milestone name stays R6.

## Universal post-batch gate (every batch, no exceptions)

1. `pnpm check` green.
2. Focused affected tests green (`npx vitest run server/casting` + any suite the batch touches).
3. `pnpm test` (full unit suite) green.
4. The batch's raw-tRPC / integration / drive checks green (listed per batch below).
5. **R6 close-out additionally requires `pnpm build` green.**

No code, commit, push, migration, or deploy without explicit founder approval of the batch. Deploy note: pushes to `local-migration` deploy production — see the Batch A-coupled release gate.

## Execution sequence

### Step 0 — baseline, TWO commits

- **Commit 1 (stabilization baseline):** exactly the 11 casting batch files + `docs/specs/CASTING_SYSTEM_AUDIT_WRAP_STATE.md`. Per-file `git add` — no blanket staging.
- **Commit 2 (docs/config):** `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`; repository copy of the first addendum as `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM.md` with a superseded banner (P-2 precedent); **`docs/specs/CASTING_SYSTEM_R6_EXECUTION_PLAN.md` (this plan)**; `CLAUDE.md`; `AGENTS.md`; `.claude/agents/advisor.md`.
- **Never staged:** `.agents/`, `.codex/`, local settings, unrelated files.

### Batch 0 — authority, security, and masked-edit closure (~1.5–2d)

1. **Masked-edit safety closure:** disable surgical/eraser masked submissions everywhere, both layers — server: `generation.iterate` refuses any request carrying `maskBase64` (typed refusal, before money moves); UI: surgical + eraser tools removed/disabled on all views with honest copy. No three-view exception survives. Re-enablement only after the unified boundary + tests exist (post-FR-1 policy; own gated item).
2. `models.update`: drop `status` entirely (zero client callers). Name updates remain allowed for drafts AND minted models per **FR-3(B)** — display metadata only; the D-55 wording update (naming required by the ceremony, label not frozen) lands in this commit's DECISION_LOG touch.
3. Legal transitions server-owned: `draft→active` only via `executeMintPackage(mint:true)` (+ internal name guard, defense in depth). No other transition endpoint until a surface needs one.
4. Legacy `generation.mint` **removed**; both export hooks (`useExportPack`, `useCastingExport`) rewired per **FR-2(A)**: export refuses unminted models and routes to the mint door; export never mints implicitly. D-46 rider-2 precedent covers deploy skew.
5. Archived exclusion per **FR-4**: `getUserModels` / `models.get` / picker / `fillFromLibrary` / registry exclude archived; generation/edit routes refuse archived; existing placements degrade to "Source unavailable".
6. `reconcile`: retire if client-unused, else accept an owned `assetId` (server-derived URL) + status guard (no minted rewrites) + `validateProxyUrl`. `compactPrompt` gains the same status guard.
7. Writer inventory doc (every masterPrompt/technicalSchema/status/asset-selection writer, incl. wardrobe/admin sweep) — input to Batch C and the FR-1 report.
8. Read-only prod-row audit **script** (status/agencyId/name consistency, `locked` count, sentinel-named minted rows). Runs against production only with separate authorization; backfill is its own gated step.
9. Observability: pino warn on refused transitions/masked submissions; logged failure path for the mintPackage marker insert (D-46 R7 log item 1).

**Batch 0 checks (gate item 4):** raw-tRPC drive invariants — status change refused (E6), legacy mint absent (E7), archived ops refused + picker exclusion (E8), reconcile rejects unowned/remote URLs (E9), masked submission refused server-side (E10); UI drive: surgical/eraser absent on every view; export-on-draft refuses + routes (FR-2A); router-harness units (batch3-hardening pattern).

### Batch A-safe (~0.5d)

V9 name field in the `addFirst` mint door (`CastModelModal.tsx:135-140`); V8 count honesty (`useSheetController.ts:109` counts the actionable set; stale headshot = its own labeled state with the F6 exits); N1 `lib/boardOps.ts:454` canonical-list fix (+`threeQuarter`); V21 internal view-naming normalization.

**Checks:** SD13 (placed-draft Edit can name-and-mint); count == dialog-rows parity; stale-headshot state labeled with exits.

### Batch C-prep — FR-1 policy report (report only; BEFORE Batch A-coupled implementation)

`docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md` for founder ratification:
- exact allowed identity-edit **categories** (typed, enumerated; body build, age presentation, and body-region marks presumptively refused);
- required **source view / evidence** per allowed category;
- deterministic **refusal categories** (all mark types: ink, scars, pigmentation, piercings, structural);
- **fail-closed** behavior: classification unavailable/uncertain ⇒ identity-gate refusal (inverts the current fail-open contract for identity writes; cosmetic-path behavior stated explicitly);
- the **test matrix** proving every writer and entry point (iterate, masked [disabled], refresh, add-views, mint, export, `applyModelEdit`) follows the policy.

Headshot-anchored evidence appears only as candidate reasoning inside the report. **Until ratified: all unsupported identity-changing edits refused; no supported subset assumed.** V6/V7 are not claimed closed by any routing rule.

### Batch B — status read-model unification (~0.5–1d; after Batch 0; may proceed while FR-1 is under review)

Shared predicates module (status-driven; `agencyId` detail-only); kill the `useStudioStore.ts:139` gallery hardcode and `useCastGate.ts:101-104` gate-action inference; `locked` = minted alias, `archived` = deleted everywhere (FR-4); sweep every derivation; source-level literal-guard test (floorParity pattern).

**Checks:** predicate units + literal guard; package/session/board/gate status agreement drive.

### Batch A-coupled — V1+V14 minimal, typed iteration only (~0.5–1d; ONLY after FR-1 is ratified)

Per-angle framing (`frontClose`/`sideClose`/`threeQuarter` → close; body trio → full); typed-iterate allowlist deleted; six-angle focused tests. Masked tools remain disabled (Batch 0). Explicit statement in code + report: iterate remains un-composed until canon; current propagation limits unchanged.

**RELEASE GATE (founder directive):** A-coupled may be a separate local commit, but it is **not pushed to `local-migration` (i.e. not deployed or released) until Batch C's shared identity guard, refusal policy, and tests are complete.** Opening six-view typed iteration before that protection would broaden the unsafe propagation surface.

**Checks:** six-angle framing units; masked tools remain disabled (regression assert).

### Batch C — honest interim (after FR-1 ratification; ~1.5–2d)

1. The ratified FR-1 policy at one shared guard, enforced across all doors (iterate, refresh, add-views, mint, export, `applyModelEdit`; masked path stays disabled).
2. Freeze-and-append dies for cosmetic edits; ratified allowed identity edits (if any) write the document deliberately.
3. **No-schema marks interim:** refuse unsupported new mark edits (all categories); preserve existing tattoo/body-art language untouched; guard automatic compaction from removing/paraphrasing it; **tests: a document containing tattoo/body-art language never receives `CLEAN_SKIN_RULE`** (generation, refresh, iterate, compaction paths). Typed mark/category/region persistence stays in the designed architecture (Batch D).
4. F5 placeholder copy updated to match the ratified policy (never advertise refused edits).
5. No successful identity edit may leave a permanently unresolvable stale package — refuse before commit or provide the restore exit, proven by test.
6. DECISION_LOG entry (D-56): interim policy + every amended clause (F3/F5/F6 scope, D-55 loop shape + FR-3 naming wording, masked-tool disablement).

**Checks:** revised addendum §8 Batch-C list verbatim; the FR-1 test matrix (every writer, every door); `CLEAN_SKIN_RULE` guard tests; Y-loop drive re-scripted to the ratified policy; restore reachable wherever promised.

### Close-out → R6 closes

Minimal docs reconciliation (V13: stale-is-live, F6 copy, built-vs-designed truthfulness); state note updated; full drive re-run; **`pnpm build` green**; A-coupled release gate lifted (Batch C complete) → sync push on founder approval; founder walk → R6 closes. Batch D-design becomes the named R7 track only on the founder's call (spec only until ratified; includes D-30 supersession, D-21 pin deletion, edit-tools-write-canon, V22 canon-aware gate, masked-tool re-enablement policy).

## First implementation batch

**Step 0 (two commits) + Batch 0**, on approval of this final plan. Nothing else moves until Batch 0's gates are green and reviewed.
