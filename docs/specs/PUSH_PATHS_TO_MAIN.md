# Every path that can reach `main` without a pull request

> ⚠ **2026-09-06 (#508 PR-2): `local-migration` is deleted.** Railway builds
> `main` directly, so every sentence below that says "both deploying branches"
> or "`main` and `local-migration`" describes the two-ref era it was written in.
> The live shape: `main` is the one deploying branch; the pre-push hook guards
> it alone; a PR merge is now itself a deploy and carries the gate.

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

### 1b · `scripts/pr-merge-in-order.mts` — changes `main`, and is still not a door

Added 2026-09-05 (#543 item 3, founder-ordered). It is the second file in the
repository to invoke `git push`, and it earns the most interesting entry on this
list, because **it does change `main` and the change is not a bypass.**

- **Its `git push` cannot reach a protected ref.** It is a bare push inside a
  feature branch's own worktree, run only to merge `main` INTO a branch GitHub
  reports `BEHIND` or `CONFLICTING` — the sync the overlap rule makes routine
  now that two PRs are in flight at once. The worktree comes from a PR's
  `headRefName`, and a pull request's head is never `main`.
- **That is reasoning from somewhere else, so it is also locked at the push.**
  `refuseProtectedPush` reads `HEAD` back out of the worktree immediately
  before pushing and refuses any ref `.githooks/pre-push` guards — derived from
  the hook by `readProtectedRefs`, never restated. A worktree somehow sitting
  on `main` gets a refusal, not a push.
- **The way it reaches `main` is `gh pr merge --squash`**, which the detector
  cannot see because it is not `git push`. That road is the sanctioned one: it
  goes through branch protection with `gate-checks` required, and the tool
  itself refuses to merge a PR whose gate is not green, whose Fable verdict
  nobody has acknowledged, or which touches a money/auth surface or `review.yml`
  with no verdict at all.

**The general point this entry records**, since it is the first of its kind
here: the enumerated list is about `git push`, and `gh pr merge` is a second
verb that writes to `main`. It is not a hole — every PR merge is exactly the
road the gate exists to police — but a future tool that merges without the gate
green would be one, and it would appear on no list in this document.

### 1c · `scripts/lib/ritePushSequence.mts` — names `git push`, and cannot push

Added 2026-09-06 (#317). It is the rite's push-SEQUENCE decision: which refs go,
in which order, and — the point of the card — that the sequence **STOPS at the
first failure**, so a rejected `main` can never be followed by the
`local-migration` push that production actually builds from.

- **It is pure.** No child processes at all. The rite injects a pusher
  (`gitPushStatus`) and keeps sole custody of `DRAPE_DEPLOY_RITE`, the marker
  `.githooks/pre-push` demands for `main` and `local-migration`. This module
  could not push a protected ref even if it tried to spawn one.
- **The literal is prose, in contract 2 of its docblock**, explaining why the
  verdict must come from the child's exit status rather than its output: a
  successful `git push` writes `To github.com…` to stderr, and an up-to-date one
  writes nothing at all, so any reading that matches on text is a coin flip.
  That was the shape of the bug — `run()` returned stderr as a string, so a
  rejected push and a successful one had the same type and no status.
- **Its recovery messages also print git commands**, including `git merge`, for
  a human to run at 5am. Text on a terminal, never a spawn — and they name the
  merge repair specifically to steer a tired shift away from `--force`, which is
  the one thing it must not do to either deploy ref.

`server/ritePushSequence.test.ts` is on the list for the same reason and spawns
nothing either: it drives the sequence with a **fake pusher**, which is exactly
what lets the STOP be proven without a remote.

**Over-inclusion here is the contract working**, exactly as it is for
`pushPaths.mts` and this suite: a file that reasons *about* pushing gets read by
a detector that matches the words, and the answer is to write down why it is not
a door rather than to narrow the detector.

### 2 · CI — nothing

All four workflows (`gate.yml`, `review.yml`, `knip.yml`, `secrets.yml`)
declare `permissions: contents: read`. **No workflow can commit or push.**

**Two arms, not one, and the second is the one that matters going forward.** The
suite asserts the set of `contents: write` workflows is empty — *and* that every
workflow declares an explicit top-level `permissions:` block at all. ⚠ A
workflow with **no block** inherits the repository's default workflow token
permissions, which is server-side state (door A), so it could gain write without
its own file ever saying the word. An absent block is the silent direction.

⚠ **What neither arm can see** is a workflow that pushes through a marketplace
action or a PAT secret rather than `git push` — it would contain neither
pattern. The `contents: write` grant is what such an action needs from the
default token, which is why the permissions arm is the load-bearing one.

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

Read from the API on **2026-09-03**, and re-read the same day after the founder
ruled *"protect it"* (#461):

```
main:            required checks [gate-checks, founder-gate] · strict false
                 enforce_admins FALSE · allow_force_pushes false · allow_deletions false
                 no required_pull_request_reviews
local-migration: required checks [gate-checks, founder-gate] · strict false
                 enforce_admins FALSE · allow_force_pushes false · allow_deletions false
                 no required_pull_request_reviews
                 (was NOT PROTECTED AT ALL until 2026-09-03)
collaborators:   michaelpaulrattray (admin) — one
rulesets:        none
default workflow token permissions: READ · can_approve_pull_request_reviews false
```

⚠ **The two protections are identical in every field but one, and the
difference is GitHub's, not a choice.** `main`'s two required checks carry
`app_id: null` (satisfiable by any app); `local-migration`'s resolved to
`app_id: 15368` (GitHub Actions) because those contexts had already reported on
this repository by the time it was protected. **The API refuses `null` there** —
driven twice, once with the legacy `contexts` array and once with an explicit
`checks: [{app_id: null}]`, and both came back `15368`. It is the stricter of
the two directions, and it is recorded because a later reader diffing the two
protections will find it and should not have to re-derive why.

⚠ **The last line is recorded because a workflow that declares no `permissions:`
block inherits it.** It is `read` today, so an undeclared workflow is harmless
today; it is one settings change away from being a write-capable job in a
repository that deploys production from two branches. The suite's second CI arm
is what makes that setting stop mattering.

⚠ **Protecting `local-migration` narrowed this door and did not close it.**
`enforce_admins: false` means protection does not bind the founder — but a
workflow token is **not** an administrator, so the required checks should now
bind a silently-write-capable job on both deploying refs.

⚠ **That last sentence is REASONED, not driven, and it is marked so on purpose.**
`enforce_admins` exempts administrators; the Actions token acts as
`github-actions[bot]`, which is not one. **It was not tested here, because
testing it means pushing to a branch that deploys production.** It is the one
claim in door A that is not read off an API response, and if it ever matters
enough to rely on, it is provable on a throwaway branch protected the same way —
not on this one. What remains regardless is everything protection does not reach,
and the fact that this setting is still invisible to every check in the tree.

⚠ **`enforce_admins: false` means the required checks do not apply to an
administrator, and the only collaborator is an administrator.** This is not a
deduction from the setting — it is visible in the artifact: the last three
commits on `main` carry **zero check runs** while `gate-checks` is required on
that branch. GitHub accepted them because the pusher was an admin.

✅ **`local-migration` is protected as of 2026-09-03** — ~~has no protection at
all~~ — on the founder's word, Crew reply #108, verbatim and entire: *"protect
it"* (#461). It carries `main`'s settings exactly: the same two required checks,
no force pushes, no deletions, and the same `enforce_admins: false`. So the
change binds every actor that is not an administrator, and the sentence above
about admins applies to it identically.

⚠ **`.githooks/pre-push` is still the only thing in front of an ADMIN push to
either branch**, and a hook is per-clone (see B). That is unchanged by #461 and
it is the honest limit of what was bought: the door that closed is the one a
fresh clone, the GitHub web editor, or a write-capable workflow would have used.

**Neither was a shift's to change on its own judgement** — repository settings
are the founder's, like Railway variables. Both were carded rather than acted
on; he ruled on both the same morning (`main` stays as it is, #460; this one is
protected, #461). See the foot of this file.

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

- **`server/pushPathsToMain.test.ts`** — eighteen arms, with a sibling suite (`server/typecheckOnCommit.test.ts`, 8 arms) on the typecheck's own verdict. The population of
  pushers, workflow writers and protected refs is derived; each absence arm has
  a positive control beside it, because a suite whose whole output is empty sets
  is green when its reader is broken too (working law 2).
- ⚠ **AND IT RUNS ON THE PUSH PATH, WHICH IT DID NOT WHEN IT WAS WRITTEN.** The
  first cut of this suite ran only on `gate-checks`, i.e. **only on pull
  requests** — the exact hole its own card was filed to close, and on the 69% of
  commits measured above it would never have run at all. A shift rite-pushing a
  disposable that pushes would have landed an unenumerated door and reddened the
  NEXT pull request's gate, which is #152's origin incident happening again to
  #152's own successor. It is now in `PUSH_PATH_SUITES`
  (`scripts/lib/scriptGuards.mts`), which the rite runs in a worktree of the
  commit. **Caught by the reviewer on PR #459, not by us**, and it is the
  strongest single argument in this document for the review step existing.
  ⚠ The named list is deliberately hand-written and is NOT a shadow of the grep
  beside it: the grep answers *"does this suite sweep `scripts/`?"*, the list
  answers *"must this run before a direct push?"*, and only a person can answer
  the second. The origin floor is checked on the **derived** list alone, so a
  named suite can never keep a dead derivation looking alive.
- **It refuses rather than reporting an empty list** when the derivation loses
  its origin case (`scripts/deploy-rite.mts`) — a blind reader answering "no
  doors" is the most dangerous output this instrument could produce.
- **It asserts the rite's call sites**, not just that the checks exist. Both
  `runScriptGuardsOnCommit` and `runTypecheckOnCommit` must be called on `sha`.
  This repository has three recorded controls that were written, documented and
  then reached by nothing; the enumeration above *claims* the rite typechecks,
  and a claim about a control is worth nothing without an arm on the call site.
- ⚠ **AND A CALL-SITE ARM IS NOT A VERDICT ARM** — the second thing the reviewer
  caught. It proves the typecheck is *reached*, never that it can say **no**.
  `server/typecheckOnCommit.test.ts` drives the verdict itself: a red status is
  red, the compiler's own error line survives into what the rite prints, and a
  run that produced **nothing at all** is refused rather than read as a pass.
  That last arm is the one that matters — `spawnSync` refuses a `.cmd` on
  Windows with EINVAL and returns both streams empty, byte-identical to a quiet
  pass, and it is why `readCheckRun` is exported rather than buried: a fake
  `check` would have hidden the very guard under test.
- **Driven — 11/11.** `scripts/_263-sabotage-disposable.mts` edits the real files
  and runs the real suite, one cause at a time: the rite losing the typecheck
  call, the rite losing the script-guard call, the hook losing
  `main` (`local-migration` until #508 PR-2 deleted it), the detector losing the argv shape, a new unlisted pushing
  script, a workflow gaining `contents: write`, a workflow losing its
  `permissions:` block, **the enumeration falling off the rite's push path**,
  a **`.cmd` wrapper pushing** — the native shape on the Windows machine the rite
  runs on, and one the first cut of the detector could not see — and the two on
  the typecheck's own verdict: a run that produced NOTHING read as a pass, and a
  RED check reported as ok. All eleven caught; the tree verified green again afterwards. Some sabotages redden **two**
  arms rather than one — in each case the second is the in-suite positive control
  noticing that its own sabotage no longer lands, which is the control working,
  not a coupling defect.

---

## Declined, with the reason

The PR review's fourth finding: the rite now makes **two** worktrees of the same
commit — one for the script guards, one for the typecheck — where one shared
worktree running both bodies would halve the setup and teardown.

**Not taken, deliberately.** The two are independent custody checks and sharing
a worktree entangles them: whichever ran first would decide whether the second
ran at all, and a failure in one would arrive wearing the other's error message.
The rite already spends minutes watching a deploy; a second `git worktree add`
is seconds against that. The reviewer called it a nit and did not block on it,
and this paragraph is here so the next person to notice it finds a decision
rather than an oversight.

## What was on his desk out of this — ✅ BOTH ANSWERED 2026-09-03

Two settings changes, neither of them a shift's to make. He ruled on both the
same morning and both rulings are recorded here rather than only in a comment.

1. **Turn on "Do not allow bypassing the above settings" for `main`**
   (`enforce_admins`). Today the required checks do not bind the only account
   that can push. ⚠ **This would make the rite's own pushes fail**, because a
   rite push has no check runs on it — so it is a real decision with a real
   cost, not a tick-box, and it is carded with that tradeoff spelled out rather
   than recommended blind.
   → ✅ **HE SAID NO, and gave the reason** (#460, Crew reply #110, verbatim):
   *"Leave it unticked. I want the page in the morning and eight minutes a night
   is not worth it."* He also corrected this document's own class of claim — the
   rite's checks are a **different set** from the gate's, not a superset — and
   ordered the one gap that is expensive closed instead: the secret scan now runs
   in the ceremony (#469, PR #473). **`main` stays exactly as the block above
   shows it.**
2. **Protect `local-migration`, or stop deploying from it.** It deploys
   production and has no server-side protection whatsoever.
   → ✅ **DONE** (#461, Crew reply #108, verbatim and entire: *"protect it"*).
   Applied 2026-09-03 as an exact mirror of `main`, verified by diffing the two
   protection payloads field by field. The remaining door is the admin one in B,
   which is deliberate and is item 1's answer.
