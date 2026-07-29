# Casting System R7-8 acceptance and dogfood closure

**Date:** 2026-07-29
**Authority:** `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`, D-74
**Release:** `f96a6b0` plus the documentation closure commit
**Status:** COMPLETE

## 1. Current production acceptance criteria

These criteria replace the R6-entry list for the completed R7 Casting
milestone. Historical plans remain evidence of how the system arrived here;
they are not current product instructions.

1. **Intent, quote, and deliberate spend.** A Cast starts from natural
   language and/or structured identity settings. The server owns the resolved
   operation, exact model, required inputs, price, and 1K output contract.
   Every paid action is explicit; reload, close, restore, export, and package
   reads never spend.
2. **Durable operations.** Paid generation, refresh, recast, iteration,
   variation, evidence authoring, projection, and refunds use durable
   idempotent operations. An interrupted client resumes server truth rather
   than creating a second charge or an ambiguous result.
3. **Exact identity authority.** Identity-bearing calls target the exact model
   and immutable identity revision. Callers cannot substitute a recent model,
   silently rewrite the identity document, or treat a generated image as
   identity authority.
4. **Snapshot reads and transitions.** Current Cast, package, history, Canvas,
   export, and downstream identity readers resolve the effective immutable
   snapshot. Restore appends a new snapshot and operation receipt; it never
   rewrites or deletes earlier authority.
5. **Cast Profile.** A minted Cast has a separate read-only identity Profile.
   Presentation belongs to Canvas/Wardrobe. Identity change routes to Fork;
   missing package coverage routes only to a deliberate supported action.
6. **Strip-first package care.** The six canonical slots and Coverage &
   versions agree on current, missing, stale, refreshing, failed, and
   unavailable states. Plans disclose exact supported work and price.
   Unsupported or uncalibrated work exposes no paid control.
7. **History shows states, not audit noise.** Each distinct semantic Cast state
   is presented once. Restore-of-restore chains collapse in the reader while
   append-only snapshots, parentage, selections, and receipts remain intact.
8. **Lifecycle and deletion.** Archive is not a recovery contract. Deliberate
   final Cast deletion removes the Cast, views, linked placements, and owned
   image evidence atomically, retaining only scrubbed non-recoverable records
   required by accounting, security, or published legal policy.
9. **Evidence privacy.** Private evidence plates, raw anatomical ontology,
   source asset identifiers, storage locators, and other features' private
   text do not cross public DTOs. Accepted evidence closes through immutable
   feature versions and snapshot selections.
10. **Natural-language tattoo authoring.** Users describe a tattoo and body
    location naturally. The server owns anatomy, laterality, source view,
    visibility, guidance, affected views, preservation checks, and pricing.
    Multiple accepted tattoos accumulate. The public UI does not expose the
    old chest calibration harness.
11. **Calibrated tattoo release only.** Only founder-confirmed exact tuples are
    available. Every uncalibrated tuple and every first-unseen projection
    refuses before quota, durable operation, provider work, or credits.
    Evidence and placement checks remain fail-closed; no check is weakened to
    make a provider result pass.
12. **Walk truth.** A Walk refresh may run only when the requested accepted
    feature is predicted visible and the projection cohort is calibrated.
    The repeated Walk tattoo failures correctly rejected wrong-side/out-of-zone
    provider output and refunded once; they are not treated as successful
    refreshes or as proof that the evidence gate is too strict.
13. **Fixed 1K contract.** Casting generation and Identity Pack export are
    1K-only in this release. Export uses the selected package bytes, costs
    zero credits, and has no customer-callable 2K/4K/upscale path.
14. **Navigation and account truth.** Casting, Cast Profile, Canvas, and lobby
    back actions land on their named destinations. The account popout opens
    real Settings, Billing, Usage, Security, referral, and role-gated routes.
    Security reports the actual sign-in provider and exposes no inert account
    connection controls.
15. **Canvas recovery and scale.** Cast placements read current snapshot and
    lifecycle truth. Delete/undo, selection, nudge, duplicate, lineage, and
    source-unavailable degradation remain intact. A real 36-node board loads,
    remains legible, selects, and nudges within the recorded production
    thresholds.
16. **Deploy-skew discipline.** R7 deployments occur with no active paid
    founder drive. Request/response changes are additive for one client cycle
    or return the single `APP_UPDATE_REQUIRED` reload instruction. Migrations
    are additive and forward-only. Founder acceptance starts after a hard
    reload and exact deployed commit verification.

## 2. R7-8 audit record

### Production browser evidence

- Casting **Back to lobby** and Canvas **Back to lobby** both landed at `/app`.
- Account popout exposed Settings, Billing, Share Drape, role-gated Admin and
  Moderator, and Log out. Profile, Usage, Billing & Plan, and Security loaded
  their real data.
- The pre-hardening Security panel falsely advertised Google and Apple
  connection actions without handlers. `f96a6b0` replaced that surface with
  the actual `authProvider`, email, dialog semantics, and an accessible named
  close button.
- A temporary production Canvas was populated through visible no-cost UI with
  36 nodes. Cold reload reached all 36 in **1,856 ms**, a visible Cast selected
  in **563 ms**, and ArrowRight changed its persisted transform in **73 ms**.
  The temporary Canvas was deleted after the drive.
- The founder balance stayed at **66,200 credits**. No provider or paid
  generation ran during R7-8.

### Code and contract audit

- Removed unreferenced local-only implementations for the retired bug-report,
  feedback, Canvas toolbar, compact-prompt button, legacy WebGL hero, and
  unused lazy-import retry paths.
- Removed the now-unused React Three Fiber/Three dependencies.
- Preserved the compact-prompt server route for old-bundle/deploy compatibility;
  no current client exposes it.
- Fixed 1K generation/export authority remains covered by
  `server/w1-export-truth.test.ts`.
- Missing client request identifiers resolve to the single reload instruction
  covered by `server/r7-deploy-skew.test.ts`.
- `scripts/verify-canvas.mts` now contains a repeatable provider-free 36-node
  render, selection, nudge, and heap gate for the next fully migrated
  disposable environment.

### Verification matrix

- `pnpm check`: pass.
- `pnpm test`: **248 files / 3,182 tests passed**; environment-dependent
  database suites skipped without `TEST_DATABASE_URL` as designed.
- `pnpm build`: pass.
- `drizzle-kit check` with a non-network dummy URL: pass.
- Focused auth, Settings hardening, deploy-skew, and 1K export tests: pass.
- Production no-cost browser drive: pass.

The local `.env` development database is behind cleanup-backend migration
`0012`, so the current R7-8 headless Canvas script correctly refused to boot.
R7 did not migrate that shared development target or contact production data
to force a green headless run. Earlier R7 disposable/headless gates remain
valid; the new 36-node leg is committed for the next fully migrated disposable
drive, and the equivalent current production drive passed through visible UI.
This is an environment-preparation debt, not a production product blocker.

## 3. Explicitly logged non-R7 launch choices

These are not hidden R7 failures and were not changed under Casting authority:

- The public product-demo modal still says the demo is coming soon and needs
  the founder's final video asset.
- Home still proxies the hero video; direct-CDN cutover is a launch-performance
  choice.
- Referral claiming has both explicit redeem UI and server contracts, while an
  unused automatic `?ref=` claim hook remains. Because referral credits are
  billing-sensitive, wiring or retiring that automatic behavior needs a
  separate product/billing ruling.
- Cybernetics, scars, moles, birthmarks, and other permanent-feature families
  remain refused until each receives its own evidence, visibility,
  preservation, billing, and calibration plan.
- Tattoo removal, replacement, cover-up, movement, and resizing remain
  separate unratified operations; R7 completed calibrated `ink.add` only.

## 4. Closure

R7-0 through R7-8 are complete. Dogfooding may begin inside the released
scope: normal Casting and 1K export for all eligible users, with evidence
ingestion/composer/package authoring limited to founder user 1 and exact
tattoo tuples limited by the release policy.

There is no ratified R8 plan. The founder must choose the next product and
technical boundary before R8 is defined.
