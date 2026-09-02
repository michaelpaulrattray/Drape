# Every path that can reach `main` without a pull request

**Card #263. Founder ruling, 2026-08-30, verbatim:**

> *"The CI hole is the best find in the card. A gate that only runs on pull
> requests, plus a path that pushes straight to main, means the gate is optional
> in practice. Fixing the rite to run the check is right. Worth checking whether
> anything else can reach main without a PR."*

His bar for the answer, from the same card: *"the sweep reports the full list of
push paths whether or not it finds a second offender — 'only the rite' is a real
and valuable answer, but only when it comes from a search rather than from an
assumption."*

**Read at the tree and at GitHub on 2026-09-03. The answer is: one door in the
code, and three that are not in the code at all.**

---

## The number that makes this worth having

`gate-checks` runs on `pull_request` only. Measured on `origin/main` on
2026-09-03:

| reading | figure |
|---|---|
| first-parent commits on `main` since 2026-08-25 | **499** |
| of those, arrived by a pull request | **156** |
| **arrived without one** | **343 (69%)** |
| check runs on the last three commits on `main` | **0, 0, 0** |

So the gate saw under a third of what landed, and the branch's own required
check — `gate-checks` is a required status check on `main` — never ran on any of
the rest. That is his sentence proved from our own history rather than argued:
**a gate that only runs on pull requests, beside a path that pushes straight to
main, is a gate that is optional in practice.**

Most of the 343 are briefing editions, which are supposed to go that way. The
point is not that the rite is wrong; it is that until #263 **nothing checked
what the rite pushed.**

---

## The doors in the code — derived, not remembered

`scripts/lib/pushPaths.mts` reads them off the tree; `server/pushPathsToMain.test.ts`
compares the reading to an enumerated allowlist and goes red on anything new.
**The contract for what counts as a pusher is stated exactly in the module's
own docblock** and is deliberately over-inclusive: a comment saying `git push`
inside an executable file forces that file onto the list with a reason.

### 1 · `scripts/deploy-rite.mts` — the one door, by design

It is the only file in the repository that invokes `git push`. It sets
`DRAPE_DEPLOY_RITE` on the push child, which is the only thing
`.githooks/pre-push` accepts for `main` and `local-migration`.

**What it checks before it pushes, all over the commit being pushed:**

| check | since |
|---|---|
| `core.hooksPath` is armed (else it refuses to run at all) | fable-982 |
| `merge.atlas.driver` is registered | Retro guard R1, #100 |
| `pnpm architecture:check` | fable-1320 |
| `pnpm capability:check` | fable-1320 |
| dirty-tree refusal | — |
| briefing conformance + eye frames present in the production bucket | #320 |
| the script guards, in a worktree of the commit | #152 |
| **`pnpm check`, in a worktree of the commit** | **#263 — this card** |
| the founder-activity freeze | — |

`pnpm test` is still **not** on this path: minutes, and it belongs in the
report's custody block. `capability:check --drive` is not here either, because
it spends.

### 2 · CI — nothing

All four workflows (`gate.yml`, `review.yml`, `knip.yml`, `secrets.yml`)
declare `permissions: contents: read`. **No workflow can commit or push.** The
suite asserts the set of `contents: write` workflows is empty, with a positive
control proving a write grant would be reported.

### 3 · The pre-push hook covers both deploying branches

`.githooks/pre-push` refuses `refs/heads/main` **and** `refs/heads/local-migration`
without the rite's marker. Both deploy production, so both must be in it; the
suite reads the refs out of the hook's own `case` arm rather than restating
them.

---

## ⚠ The three doors NO repository check can see

**A green suite means "no new door in the code". It does not mean the door is
shut.** These three are outside the tree, and each is written down here because
that is the only place they can be.

### A · GitHub branch protection — and it does not bind an admin

Read from the API on **2026-09-03**:

```
main:            required checks [gate-checks, founder-gate] · strict false
                 enforce_admins FALSE · allow_force_pushes false · allow_deletions false
                 no required_pull_request_reviews
local-migration: NOT PROTECTED AT ALL
collaborators:   michaelpaulrattray (admin) — one
```

⚠ **`enforce_admins: false` means the required checks do not apply to an
administrator, and the only collaborator is an administrator.** This is not a
deduction from the setting — it is visible in the artifact: the last three
commits on `main` carry **zero check runs** while `gate-checks` is required on
that branch. GitHub accepted them because the pusher was an admin.

⚠ **`local-migration` has no protection at all**, and it deploys production. The
`.githooks/pre-push` hook is the *only* thing standing in front of it, and a
hook is per-clone (see B).

**Neither is a shift's to change** — repository settings are the founder's, like
Railway variables. Both are carded rather than acted on; see the foot of this
file.

### B · `core.hooksPath` — the hook file is committed, its installation is not

`.githooks/pre-push` is in the repository. The `git config core.hooksPath
.githooks` that arms it is **local config in each clone**. A fresh clone has the
file and not the gate.

**The one place this is enforceable is the rite itself**, and it does enforce
it: the rite refuses to run when `core.hooksPath` is not `.githooks`, on the
stated reasoning that a silently-absent guard is worse than none (invariant 7).
A second machine, a second clone, or a CI runner that never runs the rite is
simply not covered.

### C · `--no-verify`, and the GitHub web/API editor

`git push --no-verify` skips the hook. The hook's own header names this and
rules on it — *"THE ESCAPE IS ASKING, NOT `--no-verify`"* — which is a rule and
not a mechanism.

Committing through the GitHub web editor or the REST API touches no local hook
at all. With `enforce_admins: false` (door A) an admin commit lands on `main`
directly.

**Neither is reachable from a repository check.** They are why door A matters:
GitHub-side protection is the only backstop that exists for a client that never
runs our hooks.

---

## How this list stays true

- **`server/pushPathsToMain.test.ts`** — twelve arms. The population of pushers,
  workflow writers and protected refs is derived; each absence arm has a
  positive control beside it, because a suite whose whole output is empty sets
  is green when its reader is broken too (working law 2).
- **It refuses rather than reporting an empty list** when the derivation loses
  its origin case (`scripts/deploy-rite.mts`) — a blind reader answering "no
  doors" is the most dangerous output this instrument could produce.
- **It asserts the rite's call sites**, not just that the checks exist. Both
  `runScriptGuardsOnCommit` and `runTypecheckOnCommit` must be called on `sha`.
  This repository has three recorded controls that were written, documented and
  then reached by nothing; the enumeration above *claims* the rite typechecks,
  and a claim about a control is worth nothing without an arm on the call site.
- **Driven — 6/6.** `scripts/_263-sabotage-disposable.mts` edits the real files
  and runs the real suite, one cause at a time: the rite losing the typecheck
  call, the rite losing the script-guard call, the hook losing
  `local-migration`, the detector losing the argv shape, a new unlisted pushing
  script, and a workflow gaining `contents: write`. All six caught; the tree
  verified green again afterwards. Two of the six redden **two** arms rather
  than one — in both cases the second is the in-suite positive control noticing
  that its own sabotage no longer lands, which is the control working, not a
  coupling defect.

---

## What is on his desk out of this

Two settings changes, neither of them a shift's to make:

1. **Turn on "Do not allow bypassing the above settings" for `main`**
   (`enforce_admins`). Today the required checks do not bind the only account
   that can push. ⚠ **This would make the rite's own pushes fail**, because a
   rite push has no check runs on it — so it is a real decision with a real
   cost, not a tick-box, and it is carded with that tradeoff spelled out rather
   than recommended blind.
2. **Protect `local-migration`, or stop deploying from it.** It deploys
   production and has no server-side protection whatsoever.
