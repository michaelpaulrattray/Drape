# Deploy on merge — the design (#508)

**Fable seat, 2026-09-06.** This answers #508's `awaiting-fable` hold: *what
replaces the deploy rite as the road to production, and what the rite becomes
instead.* The decisions are numbered so the flip card and PR-2 can cite them.
Status at writing: **the build half is merged dark; the road does not change
until the founder performs the flip (§Flip), which is his by the card's own
bar.**

## What this fixes, in product terms

Today production ships only when the deploy rite runs on the founder's machine
and pushes `main:local-migration` from the shared working tree. A merged PR has
shipped nothing (#296); two rite pushes can collide (#317); a shift and the
relay cannot both touch that tree; and every deploy routes through one laptop.
After the flip: **merged = live, always** — a merge to `main` builds and ships
by itself, and nobody's machine is in the loop.

## The decisions

### D1 · The road is Railway-native. The GitHub Actions deploy job is DECLINED.

The card sketched an Actions job on push-to-main that runs checks and triggers
the Railway deploy via API. Declined, and here is the trade as measured:

- The Actions road needs **two production credentials copied into GitHub**
  (a Railway token to trigger/watch, the MySQL URL to migrate). Every secret
  that leaves Railway is new surface, on the exact path this product treats
  most conservatively.
- It makes GitHub Actions a **runtime dependency of deploying** — an Actions
  outage or queue delay stops production shipping a fix.
- The checks it would buy between `main` and production are **already paid on
  both roads to `main`**: a merge passed the PR gate (`pnpm check`, both atlas
  checks, full tests, secret scan), and a rite record-push passed the rite's
  own pre-push refusals (same set plus briefing/eye-frame/quiet-edition
  judges). The only unchecked arrivals at `main` are hand pushes that bypass
  the local pre-push hook from another machine — rare, and D2 stops the worst
  of what one can do.

So: **Railway's Drape service watches `main` directly** (today:
`local-migration`). Simplest mechanism that satisfies "merged = live", zero
new credentials, zero new runtime dependencies.

> Config-as-code (`railway.json`) was also read and declined: Railway has
> deprecated it with a hard read-cutoff of **2026-12-01**, and new opt-ins are
> closed. The two service settings below are therefore dashboard fields (or a
> `railway config apply` under his word), not repo files.

### D2 · Safety moves from the road to the service: healthcheck-gated cutover.

The Drape service gets **healthcheck path `/api/health`** (timeout: default
300s). Railway's documented contract: the new deployment takes traffic **only
after** the healthcheck returns 2xx; a build that cannot boot healthy is marked
FAILED and **the old build keeps serving**. This is what makes "any merge
deploys" safe against the crash-loop class (the 2026-07-31 boot-guard incident
shape) — today a broken build replaces the good one; after this it cannot.

Prerequisite shipped in PR-1: the health endpoint's per-IP rate limit rises
10 → 30/min so Railway's checker (hostname `healthcheck.railway.app`, polling
during the cutover window) cannot be starved into a spurious 429 = failed
deploy. The endpoint's work per hit is one `SELECT 1`.

### D3 · Migrations move from the rite to the service: the pre-deploy command.

The Drape service gets pre-deploy command **`node dist/predeploy.js`** (set a
pre-deploy timeout of 600s with it). It is the #322 applier — additive
statements applied, destructive statements refused and named — running **inside
Railway's own environment, before the new build takes traffic**, using the
`DATABASE_URL` already present there. No credential moves anywhere.

This fixes two real holes at once:

- **The merge road has no migrations at all** — a merged PR whose feature
  declares a new table would boot without it until someone ran a rite.
- **The rite applies migrations AFTER the deploy is live** (§5a-bis sits after
  the watch), so even on today's road new code can boot ahead of its table.

Exit-code policy (the part that is a decision, in `scripts/lib/predeployVerdict.mts`):

- Additive statement **applied and read back missing**, or apply **errored**,
  or the schema **could not be read** → **exit 1**, deploy blocked, old build
  keeps serving. Fails closed, like the classifier.
- Missing objects whose DDL is **destructive** (his ceremony) or **not found**
  in the migration files → **exit 0 with the refusal printed**. A waiting
  ceremony must not wedge every subsequent deploy — that is today's behaviour
  on both roads, and the rite-as-checker keeps naming it in every receipt
  until he runs it.

### D4 · Deployed truth becomes readable: the sha in `/api/health`.

The health body gains `build`: the `RAILWAY_GIT_COMMIT_SHA` Railway stamps on
every GitHub-triggered deploy (`null` off-platform). The whole #296 trap class
— *"health 200, so it shipped"* read off the OLD process — existed because a
200 cannot say which tree answered. Now anything — the rite, a shift, the
verify job, the founder — can ask production *"which commit are you?"* with no
credentials. The UPTIME ANCHOR stays (it also proves a RESTART, which the sha
alone does not on a redeploy of the same commit).

### D5 · Verification is a secretless GitHub job — observability, never the road.

`.github/workflows/deploy-verify.yml`, on push to `main`: poll
`/api/health` until `build` equals the pushed sha and status is `healthy`
three times, then print the anchor line. **No secrets, no checkout, no
tokens.** Red = the merge did not become live (build failed, healthcheck
refused, or Railway never picked it up) — loud on the commit where the next
shift looks. It is gated on the repo variable `DEPLOY_ON_MERGE=live` so it
stays silent until the flip, and if GitHub Actions is down, deploys flow
anyway — only the receipt is missing.

### D6 · The rite keeps its push and loses its monopoly.

Briefing editions and record commits **keep the rite road** (the protected
push). The card offered auto-merge PRs as the alternative; declined because:

- An edition PR pays ~7 gate minutes for a JSON his page wants now, several
  times a night.
- The rite's edition-specific refusals — quiet-edition judge, briefing parse
  at the pushed commit, **eye frames present in the production bucket** (a
  HEAD against `R2_PUBLIC_URL` read off the service) — would all need
  rebuilding as CI with production reads to be equivalent. The protected push
  already runs them, before the push, with the same fail-closed shape.

After the flip (PR-2): `BRANCHES` becomes `["main"]` and
`DEPLOY_SOURCE_REF` becomes `"main"` (`scripts/lib/ritePushSequence.mts` —
`server/deployTriggerClaims.test.ts` re-derives the documented claims from
it). Everything else the rite does — the freeze courtesy with `--anyway`, the
pre-push refusals, the watch matched on commit hash, health ×3, the anchor,
flags-vs-record, schema read-back, static assets, the balance lines, the
receipt — is unchanged. It becomes **the editions' road and every deploy's
checker**, which is what the card asked it to become.

### D7 · `local-migration` retires — in PR-2, after the flip is confirmed.

Order matters: if the rite stopped pushing `local-migration` before Railway
stops watching it, nothing would deploy. So PR-2 lands only after the founder's
flip is confirmed live (a merge observed shipping with no rite). PR-2: the
`BRANCHES`/`DEPLOY_SOURCE_REF` change, delete `local-migration` at origin, and
the **law-7 sweep along the dying branch** — every mention in `.githooks/
pre-push` (the ref stays protected until deleted, then the line goes),
`CLAUDE.md`'s deploy section, the `deploy-railway` skill, `scripts/lib/
ritePushSequence.mts`, `gate-stall-check`, and docs. The sweep is part of the
fix; three controls have died to un-swept removals in this repository's record.

### D8 · The freeze courtesy does not cover the merge road — named, priced, and repaired separately.

Today the rite refuses to deploy while the founder has casting work from the
last ten minutes. A merge will deploy without that courtesy. The exposure is
D-85's accepted collision class (≤ ~6 minutes of visible wait, money conserved
by per-slice billing + the sweep) — the freeze was manners, not a control. The
repair that keeps the manners on the road shifts actually use: the #543 merge
helper (`pr-merge-in-order.mts`) gains the same founder-activity read before
merging — filed as a follow-up card, not built here. His own merges never
needed a freeze against himself.

## The flip — his acts, in this order

1. *(Already merged before the flip, dark: PR-1 — sha in health, the predeploy
   bundle, the gated verify workflow, the rate-limit rise.)*
2. Railway → Drape service → Settings: **Pre-deploy command** =
   `node dist/predeploy.js`, **Pre-deploy timeout** = 600. Rehearses on the
   CURRENT road — the next rite deploy proves it in the deploy logs before
   anything depends on it.
3. Same page: **Healthcheck path** = `/api/health`. Also rehearses on the
   current road.
4. Same page: change the watched branch **`local-migration` → `main`**. This
   is the flip.
5. `gh variable set DEPLOY_ON_MERGE --body live` (a shift may run this on his
   word — it is a GitHub repo variable, not a Railway change).
6. **The proof, per the card's bar:** merge one trivial PR and watch it go
   live with no rite (verify job green; `/api/health` carries its sha).
   Rollback proof: `git revert` that PR, merge, verify green — one revert
   commit, as the bar demands. (Railway's redeploy-previous-build stays
   available as the fast manual road, as today.) The deliberate-break arm —
   a build that fails its healthcheck leaving the old build serving — is
   Railway's documented contract plus rehearsal step 3; running a deliberate
   red on production's deploy history is offered at flip time on his word,
   not performed unasked.
7. PR-2 (D7) lands. The record is updated and the design is done.

## What must stay true (the checker's charter)

- A red `deploy-verify` on `main` is a **finding**: a merge that did not
  become live. The next shift treats it like a red gate.
- The rite's receipt remains the durable deploy record for edition pushes,
  and its checker half (flags, schema, assets, balances) still runs on every
  rite invocation whatever road a commit took to production.
- Nothing in this design changes what the gate checks, what the reviewer
  reviews, or any money/auth rule. The pre-push hook still refuses direct
  pushes to `main`.

## Flip record

- **2026-09-06 17:26 AEST — flipped.** Pre-deploy command and healthcheck
  rehearsed on the old road first (deployment `3f960d48`: predeploy ran in its
  own container, `nothing pending`, healthcheck green, `/api/health` uptime
  142 s = new process). Branch changed `local-migration` → `main`; Railway
  built main at `90e7fdca` (PR #592) with no rite, and `/api/health` answered
  `build=90e7fdca` at uptime 70 s. `DEPLOY_ON_MERGE=live` set 07:27Z.
- **Step 6, both halves, driven the same evening.** Proof merge PR #595
  squashed `619eb6cc` at 07:40:57Z; Railway built it unprompted; `/api/health`
  answered `build=619eb6cc` at uptime 78 s; `deploy-verify` on that sha:
  **success**. Rollback: PR #596 reverted it (`0f2cdb9f`), merged, and its
  sha went live the same way with `deploy-verify` green — one revert commit,
  as the bar demanded. Two of the night shift's own merges (`c17d8f42`,
  `dfad6c2e`) went live under the new road in the same hour, verify green on
  both, before either proof PR had merged.
- **Step 7, PR-2 (this record's own PR):** `DEPLOY_SOURCE_REF` and `BRANCHES`
  become `main` alone; `local-migration` is deleted at origin; the D7 sweep
  along the dying branch — `.githooks/pre-push`, `CLAUDE.md`'s deploy
  section, the `deploy-railway` skill, `AGENTS.md`, `scripts/lib/
  ritePushSequence.mts` and its suite, `deployTriggerClaims.test.ts` (whose
  guard now inverts: no document may say `local-migration` deploys or that a
  merged PR has not shipped), `park-state.mts`, `pushPaths.mts`, `gate.yml`,
  `PUSH_PATHS_TO_MAIN.md`. The design is done.
