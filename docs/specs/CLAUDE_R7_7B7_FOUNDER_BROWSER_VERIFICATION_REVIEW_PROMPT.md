# Fable Run Review — R7-7B7 Founder Snapshot Browser Verification

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are the independent, read-only reviewer for R7-7B7 rollout step 4.

Review the exact production-browser verification below and decide whether it
is safe to run. Do not edit, stage, commit, push, deploy, contact Railway,
query MySQL directly, change variables, open/control a browser, run
convergence, clear pins, or perform any product action during this review.

## Required verdict

Return exactly one:

- `APPROVE — safe to run founder snapshot read verification in production`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval covers one passive verification pass in the founder's existing
authenticated Chrome session. It does not authorize signing in on the
founder's behalf, inspecting cookies/storage/passwords, minting a session
token, any mutation or paid action, generation, credits, storage work,
pin-convergence planning/apply, scope changes, cohort expansion, `all`, or
later R7 work.

## Current production evidence

- Production commit:
  `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`
- Founder-only scope:
  `R7_SNAPSHOT_READ_SCOPE=users:1`
- Enablement deployment:
  `caa8e78e-a571-4047-844f-7e60d42640f7`
- Deployment status: `SUCCESS`
- `/api/health`: `healthy`
- database health: `up`
- home page: HTTP 200
- every user other than id 1 remains on R6.

The immediately preceding bounded audit examined exactly user 1 × model ids
`1..41,46`: 42 models, 41 current, 1 legitimate headless, 0 invalid. Its only
three attention results were the B6 pin-retirement consumer projections
`consumer_package_state` and `consumer_refresh_plan`; every other structural,
identity, seal, mint, export, board/library, and registry check was clean.

## Browser/authentication boundary

Use the browser-control runtime to select Chrome because this verification
depends on the founder's existing production login.

- Discover Chrome tabs read-only.
- Never inspect cookies, local storage, session storage, profiles, saved
  passwords, or extensions.
- Never manufacture a JWT or production cookie.
- Never use the local `verify-bot-local` recipe; that is dev-only.
- If production opens at `/login`, shows an unauthenticated state, or no
  existing Chrome session can access `/app`, stop and ask the founder to sign
  in normally in Chrome. Do not attempt credentials or another browser.
- After the founder says login is ready, restart this same bounded check from
  `/app`.

## Exact passive verification

Target:

`https://drape-production-0232.up.railway.app`

Use ordinary visible UI navigation and read-only page/network inspection. Do
not call private APIs directly and do not inject application state.

### 1. Authentication and lobby/library

1. Open `/app`.
2. Confirm the authenticated application lobby renders rather than `/login`.
3. Navigate to `/app/models`.
4. Confirm the Cast library loads without an error boundary, endless spinner,
   or "temporarily unavailable" refusal.
5. Confirm draft and minted cards render their existing thumbnail angle
   preference; do not create, rename, delete, or open a destructive menu.

### 2. Snapshot-backed Casting model

Use the exact audited founder model id `4`, which is a current, minted model
and one of the audit's pin-retirement attention cases:

`/studio?tool=casting&modelId=4`

1. Confirm the Casting Studio loads the Cast rather than displaying a generic
   load error.
2. Confirm the current selected image/package renders.
3. Confirm Profile/identity presentation renders without exposing snapshot
   ids, state versions, storage keys, provenance, or raw JSON.
4. Open the non-mutating Details/Package Health presentation.
5. Confirm the package/refresh/mint plans finish loading without an error.
6. Confirm Cast-slot Pin/Unpin controls and "unpin first" copy are absent for
   this snapshot-enabled account.
7. Confirm stale/current health presentation still renders and Retry/refresh
   affordances may be visible, but do not click any action.
8. Open version history only if it is reachable without a mutation. Confirm
   "Use this version" may remain visible, but do not click it.

### 3. Export planning

Open the existing Export/identity-pack dialog from the loaded Cast:

1. Confirm the export plan finishes loading and selected views appear.
2. Do not click Generate PDF, Download if it first generates, upscale, refresh,
   or any action that calls a mutation.
3. Close the dialog without changing state.

### 4. Wardrobe selected-view read

Navigate directly to:

`/studio?tool=wardrobe&modelId=4`

1. Confirm Wardrobe loads the model-linked start/workspace using the selected
   full-body view when available.
2. A truthful "full-body view required" refusal is acceptable if model 4 has
   no selected `frontFull`; record it rather than substituting another image.
3. Do not create a session, upload, seed chat, analyze, run VTO, refine,
   generate, or save a look.

### 5. Canvas/library read surfaces

1. Return to `/app/boards`.
2. If an existing board is available, open it; do not create or delete one.
3. Open only the non-mutating Cast picker/library presentation.
4. Confirm Cast thumbnails/package sheets render without a read error.
5. Do not place, pop out, fill, recast, reroll, pin, move, or otherwise mutate
   a board item.
6. If no existing board is available, record this Canvas step as
   "not exercisable without mutation" and do not create one.

### 6. Network and console honesty

During the pass:

- record failed production requests and console errors;
- confirm no observed request invokes a mutation procedure;
- tolerate ordinary read queries and static image fetches;
- do not print or retain response bodies containing identity documents, URLs,
  names, emails, keys, or raw server errors;
- report procedure names/status codes and closed error copy only;
- do not save screenshots, HAR files, traces, downloads, or output into the
  repository.

### 7. Stop condition

Stop immediately and leave `users:1` unchanged if any of the following occurs:

- snapshot closure refusal or generic "temporarily unavailable" on an audited
  current model;
- an unexpected redirect/login loss after authentication was confirmed;
- any mutation request is accidentally initiated;
- any credit/provider/storage action appears;
- private snapshot/storage fields appear in visible UI;
- package/Profile/Library/Wardrobe/Canvas projections disagree visibly about
  the selected current Cast;
- an unexplained server 5xx or client error boundary appears.

Do not attempt to repair, bootstrap, converge, refresh, restore, pin, or retry
through a paid action.

## Required code review

Read the B7 portion of:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`

Read the relevant production/UI paths completely:

- `server/casting/snapshotReadScope.ts`
- `server/casting/effectiveCastState.ts`
- `server/casting/effectiveCastRead.ts`
- `server/casting/modelReadProjections.ts`
- `server/casting/mintPackage.ts` package-state projection
- `server/casting/refreshSlots.ts` plan projection
- `server/routes/models.ts`
- `server/routes/boardOps.ts`
- `server/routes/boards.ts`
- `server/routes/registry.ts`
- `server/routes/wardrobe.ts` list/session read boundaries
- `client/src/features/casting/components/PackageHealthDialog.tsx`
- `client/src/features/casting/components/CastProfilePanel.tsx`
- `client/src/features/casting/components/SlotVersionHistory.tsx`
- `client/src/features/export/ExportPackDialog.tsx`
- `client/src/features/lobby/LibraryView.tsx`
- `client/src/features/boards/canvas/CastPickerModal.tsx`
- `client/src/features/studio/hooks/useStudioEntry.ts`

## Required challenges

1. Verify every named navigation/read is non-mutating until an explicitly
   forbidden action button is clicked.
2. Verify model id 4 belongs to the exact audited founder cohort and its audit
   head was current/valid.
3. Verify opening the Casting route for a minted model is supported and does
   not implicitly mutate, bootstrap, or charge.
4. Verify Package Health/Details issues only read plans on open.
5. Verify opening version history is read-only and "Use this version" is the
   mutation boundary.
6. Verify Export dialog opening is planning-only and identify the exact first
   mutation boundary that must not be crossed.
7. Verify Wardrobe route/model loading is read-only and identify the exact
   session/provider mutation boundaries.
8. Verify Canvas picker/board inspection is read-only and that board-item pins
   remain separate.
9. Verify the pin controls must be absent in snapshot mode while legacy stored
   pins may still explain the audit attention.
10. Verify no UI can silently fall back to newest-filled R6 truth for the
    enabled founder.
11. Verify authenticated traffic is scoped from server-owned user id 1 and a
    browser cannot select its mode.
12. Challenge whether any route load performs a hidden mutation, lazy
    convergence, analytics write, or provider call.
13. Verify the no-cookie-inspection/no-token-minting boundary.
14. Verify stopping for normal login is safer than automation and does not
    weaken the evidence.
15. Verify network/console evidence can be summarized without leaking private
    content.
16. Decide whether the registry-safe projection needs a separate direct API
    verification. There is no in-repo UI consumer; the structural/consumer
    audit was clean. Do not authorize a raw/private API call unless it is
    necessary and can be made safely.
17. Decide whether the legitimate headless model needs browser exercise. It is
    already proven by the production audit; do not require selecting it unless
    the UI identifies it without exposing private data.
18. Verify the pass performs no automatic paid action and cannot accidentally
    spend credits through hover/prefetch/dialog-open behavior.
19. Verify failure leaves the scope at `users:1` for diagnosis; changing it
    back to `off` is a separate Railway operation unless an immediate safety
    incident requires the pre-agreed rollback.
20. Verify the next operation remains the separately reviewed read-only
    pin-convergence plan—not pin clearing or cohort expansion.

## Required report

1. Verdict.
2. Exact browser/authentication boundary.
3. Surface-by-surface read-only proof.
4. Mutation/credit/provider boundary proof.
5. Any blocker and smallest correction.
6. Non-blocking cautions.
7. Exact scope of approval and next unauthorized operation.
