# Fable Run Review — R7-7B7 Founder Browser Re-verification

You are the independent, read-only reviewer for the restarted founder-only
production browser verification after the approved stale-view copy correction.

Review the exact boundary below and decide whether it is safe to run. Do not
edit, stage, commit, push, deploy, query a database, change Railway variables,
run convergence, clear pins, generate media, spend credits, or control the
browser during this review.

## Required verdict

Return exactly one:

- `APPROVE — safe to restart founder snapshot read verification in production`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval may cover only one passive read verification pass in the founder's
existing authenticated Chrome session. It must not authorize any mutation,
paid action, generation, restore, refresh, mint, PDF export, Wardrobe VTO,
Canvas edit, pin change, convergence plan/apply, scope change, cohort
expansion, `all`, database query, or later R7 work.

## Verified production state

- Project: `drape-production`
- App service: `Drape`
- Production deployment:
  `4a3694d3-44c9-42a4-8cf3-cd728312b90c`
- Deployment status: `SUCCESS`
- Deployed commit:
  `5abde1e78d4643a866e8029b7b91fc11002cac3f`
- Production branch: `local-migration`
- Scope: `R7_SNAPSHOT_READ_SCOPE=users:1`
- Health endpoint: HTTP 200, `status=healthy`, database `up`
- Home page: HTTP 200
- Public URL:
  `https://drape-production-0232.up.railway.app`

The deployed commit is exactly one copy/test-only commit after the previously
reviewed B1–B6 runtime:

- ordinary stale mint refusal now says:
  `refresh it before minting`;
- it no longer says:
  `(unpin first if pinned)`;
- the distinct R6 pinned-stale refusal still contains explicit unpin guidance.

No variable, schema, migration, database, storage, billing, selection, pin, or
authority behavior changed in that deployment.

## Prior browser evidence and stop condition

The first Fable-approved passive pass used the founder's normal authenticated
Chrome session and successfully verified:

1. `/app` authenticated lobby;
2. `/app/models` library;
3. `/studio?tool=casting&modelId=4`;
4. snapshot-selected package and Profile presentation;
5. read-only Versions & package details / Package Health.

It then stopped because five ordinary stale selected views displayed the
misleading parenthetical `unpin first if pinned`, even though snapshot-mode pin
controls were correctly absent.

No mutation, paid action, generation, credit, provider, storage, pin, or
database operation occurred. Export, Wardrobe, and Canvas were not exercised.

The correction was independently reviewed, locally committed, independently
reviewed for deployment, pushed, deployed to terminal `SUCCESS`, and passed
scope-preservation and passive health checks.

## Exact browser boundary

- Use only the founder's existing Chrome profile and authenticated Drape tab.
- Browser discovery may inspect visible tabs only.
- Never inspect cookies, local/session storage, profiles, saved passwords,
  extensions, tokens, or browser files.
- Never mint or inject a session cookie or JWT.
- If `/app` is unauthenticated, stop and ask the founder to sign in normally.
- Do not use a dev verification cookie or `verify-bot-local`.
- Keep `R7_SNAPSHOT_READ_SCOPE=users:1` unchanged.
- Do not contact Railway or any database during the browser pass.

## Exact passive verification sequence

Restart from the beginning:

1. Navigate to `/app`.
   - Confirm the authenticated lobby loads without a visible error.
2. Navigate to `/app/models`.
   - Confirm the founder's Cast library renders.
   - Record thumbnail presentation only; do not delete, rename, or open a
     mutation control.
3. Navigate to `/studio?tool=casting&modelId=4`.
   - Confirm model 4 loads from the audited founder cohort.
   - Confirm its visible Profile/package presentation is coherent.
4. Open the read-only Versions & package details / Package Health dialog.
   - Confirm the obsolete text `unpin first if pinned` is absent from every
     ordinary stale view.
   - Confirm ordinary stale views instead instruct the user to refresh.
   - Confirm no Cast-slot Pin/Unpin control or pin-first guidance is visible.
   - Do not click Refresh, Retry, Use this version, Pin, Unpin, Mint, Add
     Views, headshot, iterate, or any other action.
5. Open the Export dialog only.
   - Confirm it renders the snapshot-backed selected package coherently.
   - Do not click Export identity pack, download, proxy, or any action button.
6. Navigate to Wardrobe for model 4.
   - Confirm the selected full-body view is used when present, or the documented
     selected headshot fallback/refusal is shown.
   - Do not create a session, upload, seed chat, generate, refine, compare
     identity, save a look, or run tattoo/quality analysis.
7. Verify one read-only Canvas surface.
   - Prefer an existing CastNode's package sheet/details.
   - If an empty Cast node already exists, opening the Cast picker is allowed,
     but do not select/place a Cast.
   - If exercising the picker would require creating a node or changing a
     board, record it as not safely exercisable and do not mutate the board.
   - Board-item presentation pins are a separate feature and must remain
     untouched.
8. Stop and report the observations.

## Mutation boundary

Allowed interactions are navigation, opening/closing read-only dialogs or
panels, selecting a display-only tab, and inspecting visible text/images.

Forbidden interactions include:

- any button that sends a mutation;
- Refresh, Retry, Restore/Use this version, Pin/Unpin, Mint, Add Views;
- identity PDF export/download;
- Wardrobe create/upload/seed/generate/refine/check/save/delete;
- Canvas placement, node creation, deletion, pinning, movement, or edits;
- rename or delete;
- paid actions or any action that creates a `clientRequestId`;
- raw API calls, database queries, Railway actions, or scope changes.

If uncertainty exists about whether a control mutates, do not click it.

## Required challenges

1. Verify production really serves exact commit `5abde1e...` at terminal
   `SUCCESS` and scope remains exactly `users:1`.
2. Verify model 4 belongs to the previously audited founder cohort and is an
   appropriate current-head test subject.
3. Trace every named surface to queries/read projections and identify the first
   mutation boundary.
4. Verify opening Package Health invokes only read procedures.
5. Verify the corrected ordinary-stale copy is reachable from the same
   mint-plan blocker path observed previously.
6. Verify pinned-stale R6 guidance remains irrelevant to the founder's
   snapshot-mode projection while Cast-slot pins are dormant.
7. Verify the client hides all Cast-slot pin controls when
   `pinningAvailable=false`.
8. Verify Canvas board-item presentation pins are unrelated and untouched.
9. Verify opening the Export dialog cannot automatically create a PDF, proxy
   images, or write anything.
10. Verify Wardrobe navigation/hydration is read-only and identify every
    explicit action that must not be clicked.
11. Verify Canvas read-only inspection can be performed without creating,
    placing, moving, deleting, or pinning an item.
12. Verify no query path bootstraps, converges, repairs, charges, generates, or
    writes snapshot state.
13. Verify the browser boundary does not require cookie/token inspection or
    automation-created authentication.
14. Define immediate stop conditions:
    - authentication is missing;
    - obsolete ordinary-stale pin copy remains;
    - a Cast-slot Pin/Unpin control appears;
    - snapshot internals or storage keys appear;
    - a surface auto-fires a mutation/provider/credit action;
    - visible selection/identity data contradicts the audited package;
    - any unexpected error blocks a named surface.
15. Confirm the pass stops after reporting observations and cannot proceed into
    pin planning/apply automatically.

## Required report

1. Verdict.
2. Exact production commit/scope proof.
3. Surface-by-surface read-only proof.
4. Authentication and browser-state boundary.
5. Mutation/credit/provider stop boundaries.
6. Any blocker and smallest correction.
7. Non-blocking cautions.
8. Exact scope of approval and the next unauthorized operation.

